# notio

Клон Notion как портфолио-проект: микросервисы на Cloudflare Workers, изолированные базы,
блочный редактор и групповое редактирование в реальном времени на Durable Objects.

Цель проекта — показать уровень middle+/senior: чистую архитектуру, сквозную типизацию,
продуманное тестирование и безопасность как требование первого класса.

> Текущий статус: **Этап 1 — контракты и инфраструктура бэкенда.** Работают gateway с
> проксированием, rate limit, CORS и сквозным request-id, а также pages-service с деревом
> страниц на D1: создание, чтение, обновление, постраничный список, fractional indexing.

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
│  └─ ...                   auth, workspace, media, search, realtime — по этапам
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
pnpm db:migrate:pages   # применить миграции к локальной базе
pnpm db:seed:pages      # демо-данные (по желанию)
pnpm dev                # workers (wrangler) и web (next dev)
```

- фронтенд: http://localhost:3000
- индекс API: http://localhost:8787/
- gateway (liveness): http://localhost:8787/health
- gateway (readiness, опрашивает сервисы): http://localhost:8787/api/health
- страницы через gateway: http://localhost:8787/api/pages?workspaceId=…

Полный сквозной путь (клиент → gateway → Service Binding → сервис → D1) проверяется так:

```bash
pnpm dev:workers   # в одном терминале
pnpm smoke         # в другом
```

## API страниц (через gateway)

```bash
WS=00000000-0000-4000-8000-000000000001
ACTOR=00000000-0000-4000-8000-00000000000a

curl "http://localhost:8787/api/pages?workspaceId=$WS"
curl -X POST http://localhost:8787/api/pages \
  -H "content-type: application/json" -H "x-actor-id: $ACTOR" \
  -d "{\"workspaceId\":\"$WS\",\"title\":\"Новая страница\"}"
```

В разработке gateway принимает `x-actor-id`; вне development — нет (fail closed),
пока не появится проверка JWT на Этапе 2.

## Скрипты

| Команда                                        | Что делает                                          |
| ---------------------------------------------- | --------------------------------------------------- |
| `pnpm dev`                                     | Поднимает workers и web вместе                      |
| `pnpm dev:workers`                             | Только backend: `wrangler dev` с двумя сервисами    |
| `pnpm dev:gateway` / `pnpm dev:pages`          | Один сервис отдельно                                |
| `pnpm build`                                   | Сборка воркеров (dry-run bundle) и Next.js          |
| `pnpm typecheck`                               | `tsc` во всех пакетах + генерация типов Workers     |
| `pnpm lint`                                    | oxlint по всему монорепо                            |
| `pnpm format` / `pnpm format:check`            | oxfmt                                               |
| `pnpm test` / `pnpm test:coverage`             | Тесты, порог покрытия 80%                           |
| `pnpm smoke`                                   | Smoke-проверка сквозного пути и защитных заголовков |
| `pnpm types`                                   | Генерация `worker-configuration.d.ts`               |
| `pnpm db:generate`                             | Новая миграция из схемы Drizzle                     |
| `pnpm db:migrate:pages` / `pnpm db:seed:pages` | Миграции и демо-данные локально                     |

## Архитектурные решения

Документы в `docs/adr/`:

1. [Монорепо на pnpm workspaces + Turborepo](docs/adr/0001-monorepo-pnpm-turborepo.md)
2. [Межсервисная коммуникация через Service Bindings](docs/adr/0002-service-bindings-between-services.md)
3. [Сквозные типы: Hono RPC + Zod](docs/adr/0003-end-to-end-types-hono-rpc-zod.md)
4. [Тесты Workers: Vitest 5 + @cloudflare/vitest-plugin](docs/adr/0004-testing-with-vitest-cloudflare-plugin.md)
5. [Линтер и форматтер: oxlint + oxfmt](docs/adr/0005-oxlint-oxfmt-tooling.md)
6. [Слой данных: Drizzle, fractional indexing, UUIDv4](docs/adr/0006-data-layer-drizzle-fractional-indexing.md)
7. [Сквозная инфраструктура gateway](docs/adr/0007-gateway-cross-cutting-middleware.md)

Правила архитектуры фронтенда (слои domain → application → adapters → ui) описаны в
[`.agents/AGENTS.md`](.agents/AGENTS.md), план работ — в
[`notion-clone-plan.md`](notion-clone-plan.md).

## Этапы

| Этап | Содержание                                                       | Статус |
| ---- | ---------------------------------------------------------------- | ------ |
| 0    | Фундамент: монорепо, линтеры, CI, health-check, Service Binding  | ✅     |
| 1    | Контракты, роутинг gateway, request-id, rate limit, D1 + Drizzle | ✅     |
| 2    | Auth на Better Auth, JWT/JWKS, защита роутов                     | ⏳     |
| 3    | Workspaces и роли                                                | ⏳     |
| 4    | Страницы и дерево на фронтенде                                   | ⏳     |
| 5    | Блочный редактор                                                 | ⏳     |
| 6    | Медиа и файлы                                                    | ⏳     |
| 7    | Поиск                                                            | ⏳     |
| 8    | Realtime на Durable Objects + Yjs                                | ⏳     |
| 9    | Аудит безопасности                                               | ⏳     |
| 10   | OpenAPI, observability, a11y                                     | ⏳     |
| 11   | Деплой и презентация                                             | ⏳     |
