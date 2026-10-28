# notio

Клон Notion как портфолио-проект: микросервисы на Cloudflare Workers, изолированные базы,
блочный редактор и групповое редактирование в реальном времени на Durable Objects.

Цель проекта — показать уровень middle+/senior: чистую архитектуру, сквозную типизацию,
продуманное тестирование и безопасность как требование первого класса.

> Текущий статус: **Этап 2 — аутентификация.** Работают gateway с проксированием, rate limit,
> CORS, сквозным request-id и проверкой JWT по JWKS; auth-service (Better Auth на D1) с
> регистрацией, подтверждением почты, сессией в cookie и выдачей JWT; pages-service с деревом
> страниц на D1. На фронтенде — вход и регистрация, защита маршрутов через `proxy.ts`.

## Стек

| Область         | Выбор                                                            |
| --------------- | ---------------------------------------------------------------- |
| Монорепо        | pnpm workspaces + Turborepo                                      |
| Фронтенд        | Next.js 16 (App Router), TanStack Query, Zustand, Zod, shadcn/ui |
| Редактор        | Tiptap + Yjs, dnd-kit                                            |
| Бэкенд          | Hono на Cloudflare Workers, Service Bindings между сервисами     |
| Данные          | D1 (database-per-service), Drizzle ORM + drizzle-kit             |
| Файлы и очереди | R2, KV, Queues, Cron Triggers                                    |
| Realtime        | Durable Objects (Hibernation API) + Yjs                          |
| Аутентификация  | Better Auth (Drizzle-адаптер, D1)                                |
| Тесты           | Vitest 5, @cloudflare/vitest-plugin, Testing Library, Playwright |
| Линт и формат   | oxlint + oxfmt                                                   |
| CI/CD           | GitHub Actions + Wrangler                                        |

## Структура

```
notio/
├─ apps/web/                Next.js App Router
├─ services/
│  ├─ gateway/              единственная публичная точка входа: роутинг, CORS, rate limit
│  ├─ pages-service/        страницы и блоки, своя база D1 notio-pages
│  ├─ auth-service/         аутентификация Better Auth, своя база D1 notio-auth
│  └─ ...                   workspace, media, search, realtime — по этапам
├─ packages/
│  ├─ contracts/            Zod-схемы API, RFC 7807, коды ошибок, события
│  ├─ db/                   общие утилиты Drizzle для сервисов
│  ├─ observability/        структурное логирование
│  └─ config/               tsconfig-пресеты
├─ docs/adr/                архитектурные решения
└─ scripts/                 smoke-проверка сквозного пути запроса
```

## Быстрый старт

```bash
pnpm install
cp .dev.vars.example .dev.vars   # локальный BETTER_AUTH_SECRET
pnpm db:migrate                  # миграции обеих баз: notio-pages и notio-auth
pnpm db:seed:pages               # демо-данные (по желанию)
pnpm dev                         # workers (wrangler) и web (next dev)
```

Секреты читаются из `.dev.vars` рядом с конфигом сервиса, поэтому файл нужен и в корне,
и в `services/auth-service/` (второй можно сделать символической ссылкой).

- фронтенд: http://localhost:3000
- индекс API: http://localhost:8787/
- gateway (liveness): http://localhost:8787/health
- gateway (readiness, опрашивает сервисы): http://localhost:8787/api/health
- аутентификация: http://localhost:3000/register и http://localhost:3000/login
- страницы через gateway: http://localhost:8787/api/pages?workspaceId=… (нужен JWT)

Полный сквозной путь (клиент → gateway → Service Binding → сервис → D1) проверяется одной
командой — она сама поднимает backend, применяет миграции и гасит его:

```bash
pnpm smoke              # сам поднимает и останавливает backend
pnpm smoke -- --verbose # с логами workers
pnpm smoke -- --reuse   # использовать уже запущенный backend, ничего не гасить
```

Свои логи нужны для ссылки подтверждения почты, поэтому по умолчанию smoke всегда
поднимает свой backend; если на порту уже кто-то отвечает, скрипт это остановит и
предупредит. `--reuse` пропускает подъём, но тогда подтверждение собирается из
`.dev.vars` — режим только для локального стенда.

## Аутентификация и доступ к API

Вход и регистрация — на фронтенде (`/login`, `/register`). Сессия живёт в httpOnly-cookie
`notio.session_token`, поэтому браузер отправляет её сам. Закрытые маршруты `/api/*`
(кроме `/api/health` и `/api/auth/*`) требуют JWT:

```bash
WS=00000000-0000-4000-8000-000000000001
EMAIL="you@notio.test"
PASS="correct-horse-battery"

# 1. Регистрация: письмо с подтверждением уходит в лог auth-service (в dev).
#    Повторная регистрация этой же почты вернёт 409 CONFLICT.
curl -X POST http://localhost:8787/api/auth/sign-up/email \
  -H "content-type: application/json" -H "origin: http://localhost:8787" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"name\":\"Вы\"}"

# 2. Подтверждение: ссылка из лога вида /api/auth/verify-email?token=…&callbackURL=%2F
curl "http://localhost:8787/api/auth/verify-email?token=<TOKEN>&callbackURL=%2F"

# 3. Вход и получение JWT (cookie сохраняем в файл).
curl -s -c cookies.txt -X POST http://localhost:8787/api/auth/sign-in/email \
  -H "content-type: application/json" -H "origin: http://localhost:8787" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}"
JWT=$(curl -s -b cookies.txt http://localhost:8787/api/auth/token | sed 's/.*"token":"\([^"]*\)".*/\1/')

# 4. Запрос к закрытому API от имени пользователя.
curl -H "authorization: Bearer $JWT" \
  "http://localhost:8787/api/pages?workspaceId=$WS"

curl -X POST http://localhost:8787/api/pages \
  -H "content-type: application/json" -H "authorization: Bearer $JWT" \
  -d "{\"workspaceId\":\"$WS\",\"title\":\"Новая страница\"}"
```

Идентичность определяется только из подписанного токена: заголовок `x-actor-id` от клиента
отбрасывается, gateway подставляет сервису id пользователя из claims. Без токена —
`401` в формате `application/problem+json`.

### Вход через Google и GitHub

Провайдер включается, только когда заданы обе части ключа в
`services/auth-service/.dev.vars` (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`,
`GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`). Redirect URI строится от
`BETTER_AUTH_URL`, то есть callback идёт **через gateway, а не через фронтенд**:

```
Google:  http://localhost:8787/api/auth/callback/google
GitHub:  http://localhost:8787/api/auth/callback/github
```

Эти два адреса нужно прописать в консоли провайдера (Google Cloud → OAuth client →
Authorized redirect URIs; GitHub → OAuth App → Authorization callback URL — там адрес
один). Частые причины «кнопка не работает»:

- **Адрес зарегистрирован на порту 3000.** Callback обслуживает auth-service за gateway,
  порт 8787. Приложение Google, которое ещё не прошло верификацию (publishing status
  `Testing`), пускает только аккаунты из списка Test users — остальным отдаёт
  `Error 403: access_denied`.
- **Приложение открыто как `127.0.0.1:3000`.** Cookie сессии и `state` живут на хосте
  gateway (`localhost`), поэтому открывать приложение нужно по тому же имени:
  `http://localhost:3000`.
- **Аккаунт уже существует с паролем.** Связывание по почте включено
  (`accountLinking.trustedProviders` = настроенные провайдеры), но локальная почта должна
  быть подтверждена — иначе вход через провайдера отклоняется.

Ошибка провайдера возвращает пользователя на страницу входа с `?error=<код>`
(`access_denied`, `state_mismatch`, `invalid_code`, …), форма показывает причину, а
auth-service пишет её в лог (`oauth_callback_error`).

## API страниц (через gateway)

Страницы доступны только с JWT — см. раздел «Аутентификация и доступ к API» выше.
Публичными остаются `/`, `/health`, `/api/health` и `/api/auth/*`.

## Скрипты

| Команда                                                 | Что делает                                        |
| ------------------------------------------------------- | ------------------------------------------------- |
| `pnpm dev`                                              | Поднимает workers и web вместе                    |
| `pnpm dev:workers`                                      | Только backend: `wrangler dev` с тремя сервисами  |
| `pnpm dev:gateway` / `pnpm dev:auth` / `pnpm dev:pages` | Один сервис отдельно                              |
| `pnpm build`                                            | Сборка воркеров (dry-run bundle) и Next.js        |
| `pnpm typecheck`                                        | `tsc` во всех пакетах + генерация типов Workers   |
| `pnpm lint`                                             | oxlint по всему монорепо                          |
| `pnpm format` / `pnpm format:check`                     | oxfmt                                             |
| `pnpm test` / `pnpm test:coverage`                      | Тесты, порог покрытия 80%                         |
| `pnpm smoke`                                            | Smoke-проверка: auth, JWT, запись в D1, заголовки |
| `pnpm types`                                            | Генерация `worker-configuration.d.ts`             |
| `pnpm db:generate`                                      | Новая миграция из схемы Drizzle                   |
| `pnpm db:migrate` / `pnpm db:seed:pages`                | Миграции обеих баз и демо-данные локально         |

## Архитектурные решения

Документы в `docs/adr/`:

1. [Монорепо на pnpm workspaces + Turborepo](docs/adr/0001-monorepo-pnpm-turborepo.md)
2. [Межсервисная коммуникация через Service Bindings](docs/adr/0002-service-bindings-between-services.md)
3. [Сквозные типы: Hono RPC + Zod](docs/adr/0003-end-to-end-types-hono-rpc-zod.md)
4. [Тесты Workers: Vitest 5 + @cloudflare/vitest-plugin](docs/adr/0004-testing-with-vitest-cloudflare-plugin.md)
5. [Линтер и форматтер: oxlint + oxfmt](docs/adr/0005-oxlint-oxfmt-tooling.md)
6. [Слой данных: Drizzle, fractional indexing, UUIDv4](docs/adr/0006-data-layer-drizzle-fractional-indexing.md)
7. [Сквозная инфраструктура gateway](docs/adr/0007-gateway-cross-cutting-middleware.md)
8. [Аутентификация: Better Auth, сессия в cookie и JWT для gateway](docs/adr/0008-auth-service-better-auth-jwt.md)
9. [Фронтенд аутентификации: слои, DI и доступ к API по JWT](docs/adr/0009-frontend-auth-layers.md)

Правила архитектуры фронтенда (слои domain → application → adapters → ui) описаны в
[`.agents/AGENTS.md`](.agents/AGENTS.md), план работ — в
[`notion-clone-plan.md`](notion-clone-plan.md).

## Этапы

| Этап | Содержание                                                       | Статус |
| ---- | ---------------------------------------------------------------- | ------ |
| 0    | Фундамент: монорепо, линтеры, CI, health-check, Service Binding  | ✅     |
| 1    | Контракты, роутинг gateway, request-id, rate limit, D1 + Drizzle | ✅     |
| 2    | Auth на Better Auth, JWT/JWKS, защита роутов                     | ✅     |
| 3    | Workspaces и роли                                                | ⏳     |
| 4    | Страницы и дерево на фронтенде                                   | ⏳     |
| 5    | Блочный редактор                                                 | ⏳     |
| 6    | Медиа и файлы                                                    | ⏳     |
| 7    | Поиск                                                            | ⏳     |
| 8    | Realtime на Durable Objects + Yjs                                | ⏳     |
| 9    | Аудит безопасности                                               | ⏳     |
| 10   | OpenAPI, observability, a11y                                     | ⏳     |
| 11   | Деплой и презентация                                             | ⏳     |
