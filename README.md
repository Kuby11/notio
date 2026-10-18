# notio

Клон Notion как портфолио-проект: микросервисы на Cloudflare Workers, изолированные базы,
блочный редактор и групповое редактирование в реальном времени на Durable Objects.

Цель проекта — показать уровень middle+/senior: чистую архитектуру, сквозную типизацию,
продуманное тестирование и безопасность как требование первого класса.

> Текущий статус: **Этап 0 — фундамент.** Работают gateway и pages-service, связанные
> Service Binding'ом, и минимальный фронтенд, который спрашивает состояние gateway.

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
│  ├─ gateway/              единственная публичная точка входа
│  ├─ pages-service/        заглушка Этапа 0 (своя база D1)
│  └─ ...                   auth, workspace, media, search, realtime — по этапам
├─ packages/
│  ├─ contracts/            Zod-схемы API, RFC 7807, типы событий
│  └─ config/               tsconfig-пресеты и пресеты Vitest
├─ docs/adr/                архитектурные решения
└─ scripts/                 smoke-проверка Service Binding
```

## Быстрый старт

```bash
corepack enable          # один раз, если pnpm ещё не установлен
pnpm install
pnpm dev                 # gateway + pages-service (wrangler) и web (next dev)
```

- фронтенд: http://localhost:3000
- gateway (liveness): http://localhost:8787/health
- gateway (readiness, опрашивает сервисы): http://localhost:8787/api/health

Проверить, что gateway действительно достучился до pages-service через Service Binding:

```bash
pnpm dev:workers   # в одном терминале
pnpm smoke         # в другом
```

## Скрипты

| Команда                               | Что делает                                               |
| ------------------------------------- | -------------------------------------------------------- |
| `pnpm dev`                            | Поднимает workers и web вместе                           |
| `pnpm dev:workers`                    | Только backend: `wrangler dev` с двумя сервисами         |
| `pnpm dev:gateway` / `pnpm dev:pages` | Один сервис отдельно                                     |
| `pnpm build`                          | Сборка воркеров (dry-run bundle) и Next.js               |
| `pnpm typecheck`                      | `tsc` во всех пакетах + генерация типов Workers          |
| `pnpm lint`                           | oxlint по всему монорепо                                 |
| `pnpm format` / `pnpm format:check`   | oxfmt                                                    |
| `pnpm test` / `pnpm test:coverage`    | Тесты, порог покрытия 80%                                |
| `pnpm smoke`                          | Smoke-проверка Service Binding против запущенных workers |
| `pnpm types`                          | Генерация `worker-configuration.d.ts`                    |

## Архитектурные решения

Документы в `docs/adr/`:

1. [Монорепо на pnpm workspaces + Turborepo](docs/adr/0001-monorepo-pnpm-turborepo.md)
2. [Межсервисная коммуникация через Service Bindings](docs/adr/0002-service-bindings-between-services.md)
3. [Сквозные типы: Hono RPC + Zod](docs/adr/0003-end-to-end-types-hono-rpc-zod.md)
4. [Тесты Workers: Vitest 5 + @cloudflare/vitest-plugin](docs/adr/0004-testing-with-vitest-cloudflare-plugin.md)
5. [Линтер и форматтер: oxlint + oxfmt](docs/adr/0005-oxlint-oxfmt-tooling.md)

Правила архитектуры фронтенда (слои domain → application → adapters → ui) описаны в
[`.agents/AGENTS.md`](.agents/AGENTS.md), план работ — в
[`notion-clone-plan.md`](notion-clone-plan.md).

## Этапы

| Этап | Содержание                                                      | Статус |
| ---- | --------------------------------------------------------------- | ------ |
| 0    | Фундамент: монорепо, линтеры, CI, health-check, Service Binding | ✅     |
| 1    | Контракты, роутинг gateway, миграции D1                         | ⏳     |
| 2    | Auth на Better Auth, JWT/JWKS, защита роутов                    | ⏳     |
| 3    | Workspaces и роли                                               | ⏳     |
| 4    | Страницы и дерево                                               | ⏳     |
| 5    | Блочный редактор                                                | ⏳     |
| 6    | Медиа и файлы                                                   | ⏳     |
| 7    | Поиск                                                           | ⏳     |
| 8    | Realtime на Durable Objects + Yjs                               | ⏳     |
| 9    | Аудит безопасности                                              | ⏳     |
| 10   | OpenAPI, observability, a11y                                    | ⏳     |
| 11   | Деплой и презентация                                            | ⏳     |
