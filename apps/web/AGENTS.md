<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — фронтенд notio (`apps/web`)

Документ для ИИ-агентов и разработчиков: как устроен фронтенд клона Notion и по каким правилам в нём пишется код. Это каноническая версия для `apps/web`; локальные копии лежат в `.agents/AGENTS.md` и `.opencode/AGENTS.md`. Если задача требует нарушить правило — остановись и спроси, а не обходи его.

Бэкенд (Hono-микросервисы на Cloudflare Workers) здесь не рассматривается: фронтенд общается с ним только через gateway. Форма данных описана в `packages/contracts` — это единственный источник правды о DTO.

---

## 1. Стек

| Задача                    | Инструмент                                                  |
| ------------------------- | ----------------------------------------------------------- |
| Фреймворк                 | Next.js 16 (App Router), React 19, TypeScript strict        |
| Серверное состояние       | TanStack Query                                              |
| Клиентское (UI) состояние | Zustand                                                     |
| Валидация и схемы         | Zod 4, общие схемы из `packages/contracts`                  |
| UI-kit                    | shadcn/ui (стиль `base-nova` на Base UI), Tailwind          |
| Формы                     | react-hook-form + `zodResolver`                             |
| Редактор                  | Tiptap 3 (официальные расширения, DragHandle, Suggestion)   |
| Сеть                      | `fetch` через gateway + Zod-валидация ответов               |
| Аутентификация            | клиент Better Auth, JWT кешируется в памяти                 |
| Тесты                     | Vitest 5, Testing Library, jsdom; smoke `scripts/smoke.mjs` |
| Линт и формат             | oxlint + oxfmt, плюс скрипт проверки границ                 |

**Важно про shadcn/base-nova.** Стиль собран на Base UI (`@base-ui/react`), а не на Radix: проп `asChild` не поддерживается. Вложенные интерактивные элементы делаются через `render`:

```tsx
<DropdownMenuTrigger render={<Button variant="ghost">Меню</Button>} />
```

Компоненты импортируют `cn` из npm-пакета `cn`; локальная точка — `shared/ui/utils.ts` (алиас `@/shared/ui/utils` в `components.json`). Готовые примитивы лежат в `shared/ui` и руками не правятся — кастомизация через пропсы/variants/className.

---

## 2. Структура каталогов

```
apps/web/
├─ src/
│  ├─ app/                        # Next.js App Router. Роуты тонкие: только композиция
│  │  ├─ (auth)/login|register/
│  │  ├─ workspaces/[workspaceId]/...
│  │  └─ layout.tsx
│  ├─ core/                       # composition root и каркас приложения
│  │  ├─ container.tsx            # сборка модулей (DI)
│  │  ├─ providers.tsx            # QueryClient + ContainerProvider
│  │  └─ ui/                      # AppLayout, AppSidebar (собирают модули вместе)
│  ├─ shared/                     # переиспользуемый код, который не знает о домене
│  │  ├─ ui/                      # примитивы (shadcn) + cn
│  │  ├─ configs/                 # env и константы
│  │  └─ types/                   # общие типы (TokenProvider)
│  ├─ modules/                    # доменные модули (вертикальные срезы)
│  │  ├─ auth/
│  │  ├─ pages/
│  │  ├─ workspaces/
│  │  └─ editor/
│  └─ proxy.ts                    # защита роутов (Next 16 proxy convention)
└─ test/                          # общие фикстуры тестов (auth-fixture и т.п.)
```

Анатомия модуля: `hooks/`, `types/` и `index.ts` есть всегда, остальные папки появляются по мере надобности. Пустые каталоги не создаются: нет стора — нет папки `stores`; нет внутренних компонентов — нет `ui/private`.

```
modules/<module>/
├─ hooks/
│  └─ use-<module>.ts        # единственный facade hook: вся оркестрация модуля
├─ stores/                   # Zustand: только UI-состояние модуля, *.store.ts
├─ api/                      # вызовы сети: fetch/RPC + Zod, кеш токена
├─ types/                    # типы, порты (интерфейсы), DTO-схемы
├─ utils/                    # чистые функции: правила, мапперы, assert-проверки, ключи Query
├─ ui/
│  ├─ private/               # компоненты, используемые только внутри модуля
│  └─ public/                # компоненты, доступные другим модулям и app
└─ index.ts                  # публичный API модуля: единственная точка входа
```

В `ui` живут только компоненты: ни `hooks`, ни `stores` там быть не может (проверяется `check-boundaries`).

### Назначение и запреты по папкам

| Папка        | Что можно                                                                       | Что нельзя                                                                          |
| ------------ | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `hooks`      | единственный facade-хук модуля: Query/Mutation, вызов порта, правила из `utils` | прямой `fetch`, знание о DTO и чужих модулях, классы use case, россыпь мелких хуков |
| `stores`     | простые сырые методы состояния (set/toggle/reset)                               | серверные данные, сеть, бизнес-логика, значения `Date.now()`                        |
| `api`        | `fetch`/RPC, Zod-валидация ответов, маппинг ошибок, кеш токена                  | React, Query, Zustand, `core`, `stores`, чужой UI                                   |
| `types`      | типы, порты-интерфейсы, DTO-схемы, константы                                    | логика и побочные эффекты                                                           |
| `utils`      | чистые функции (правила, мапперы DTO, assert-проверки), ключи Query             | React, сеть, глобальное состояние                                                   |
| `ui/private` | компоненты только для этого модуля                                              | экспорт через `index.ts`, хуки и сторы                                              |
| `ui/public`  | компоненты для других модулей/app; экспортируются через `index.ts`              | бизнес-логика и прямые вызовы API, хуки и сторы                                     |
| `index.ts`   | фабрика модуля, единственный facade-хук, public UI, публичные типы              | экспорт `api`, `stores`, `ui/private` наружу                                        |

### Текущие модули

| Модуль       | Ответственность                                                         | Фасадный хук    |
| ------------ | ----------------------------------------------------------------------- | --------------- |
| `auth`       | вход/регистрация, OAuth, сессия, JWT-провайдер с кешем, выход           | `useAuth`       |
| `pages`      | дерево страниц, создание/переименование/перемещение, избранное, корзина | `usePages`      |
| `workspaces` | рабочие пространства, участники, роли, инвайты                          | `useWorkspaces` |
| `editor`     | блочный документ, вставка/удаление/перемещение блоков, версии           | `useEditor`     |

---

## 3. Правила зависимостей

1. **`shared` не импортирует ничего из `modules`, `core` и `app`.** Shared ничего не знает о домене: если код зависит от модуля — он живёт в `core` или в модуле.
2. **Другой код видит только `modules/<module>` (index.ts).** Глубокие импорты (`modules/x/hooks/...`, `modules/x/api/...`, `modules/x/stores/...`) запрещены и ломают `pnpm lint`.
3. **`api` используется только внутри своего модуля.** Наружу модуль отдаёт фабрику (`createPagesModule`), которая собирает адаптер и возвращает порт; с портом работают хуки модуля.
4. **`stores` импортируются только внутри своего модуля** и только из хуков/компонентов этого модуля. Состояние стора для других модулей доступно через facade-хук (`usePages`, `useEditor`).
5. **UI-компоненты содержат только UI-логику.** Вся работа с сетью/состоянием — в хуках. Компонент не вызывает `fetch`, не знает про DTO и не импортирует `api`.
6. **В каждом модуле ровно один facade-хук** (`useAuth`, `usePages`, `useWorkspaces`, `useEditor`), который содержит всю оркестрацию: запросы, мутации, работу со стором и правила из `utils`. Дробить логику на мелкие хуки нельзя: компонент получает один объект с данными и операциями. Бизнес-логика (проверки, оркестрация) живёт в хуке, доменные правила — в `utils`.
7. **Ключи TanStack Query — только в `utils/query-keys.ts` модуля.** Фабрики ключей — чистая логика: они не зависят от React и используются хуком для кеша и инвалидации.
8. **Инверсия зависимостей сохраняется.** Хуки зависят от порта из `types/ports.ts`; реализацию (адаптер) даёт `api`; связывает их composition root. Код модуля не знает про Better Auth, `fetch` и `localStorage`.

### Матрица допустимых импортов

| Откуда ↓ / Куда → |        `shared`         |       `core`        |       модуль (index)        |   внутренности модуля   | чужие `stores`/`api` |
| ----------------- | :---------------------: | :-----------------: | :-------------------------: | :---------------------: | :------------------: |
| `app`             |           ✅            |         ✅          |             ✅              |           ❌            |          ❌          |
| `core`            |           ✅            |         ✅          |             ✅              |           ❌            |          ❌          |
| модуль (hooks/ui) |           ✅            | ✅ (`useContainer`) |         ✅ (редко)          |         ✅ свой         |          ❌          |
| модуль (`api`)    | ✅ (`configs`, `types`) |         ❌          | ✅ (свой index, если нужно) | ✅ свои `types`/`utils` |          ❌          |
| `shared`          |           ✅            |         ❌          |             ❌              |           ❌            |          ❌          |

Правила проверяются автоматически: `pnpm lint` запускает oxlint и `scripts/check-boundaries.mjs`. Скрипт падает при нарушении shared-границы, глубоком импорте модуля, импорте чужого `stores`/`api`, React/Query/Zustand внутри `api`, папке `hooks/use-cases`, `hooks`/`stores` внутри `ui`, втором facade-хуке модуля и `query-keys.ts` вне `utils`.

---

## 4. Поток данных и Dependency Injection

```
UI-компонент
   │  вызывает facade-хук (use-pages, use-editor, ...)
   ▼
facade hook ──► useContainer() ──► Container (core/container.tsx)
   │                                   │  порты
   │  Query/Mutation + правила из utils│
   └──────────────────────────────────► порт (types/ports.ts)
                                            ▲
                                            │ реализует
                                       api-адаптер ──► gateway ──► сервисы
```

- **Composition root — `core/container.tsx`.** Единственное место, где модули встречаются друг с другом. Контейнер не знает ни про адаптеры, ни про DTO: он вызывает фабрики модулей.
- `createAuthModule({ baseUrl })` создаёт модуль поверх Better Auth; `createAuthModuleWithGateway(gateway)` — для тестов.
- `createPagesModule({ accessToken })`, `createWorkspacesModule({ accessToken })`, `createEditorModule({ accessToken })` собирают api-адаптеры и отдают наружу только порты (`PageRepository`, `WorkspaceGateway`, `BlockRepository`).
- Токен передаётся как `TokenProvider` из `shared/types`: модули не зависят от auth-модуля, а auth-модуль не знает, кто использует его токен.
- Доступ в React — `useContainer()`. Компоненты не создают адаптеры и не вызывают фабрики напрямую.
- В тестах контейнер собирается с in-memory gateway: `createContainer(fakeGateway)` — см. `test/auth-fixture.tsx`.

### Как добавить операцию в модуль

1. Опиши/дополни порт в `types/ports.ts` модуля.
2. Реализуй метод в `api/*.repository.api.ts` (Zod на ответ, ошибка при `!response.ok`).
3. Если у операции есть доменные ограничения — добавь правило или `assert`-функцию в `utils/` с unit-тестом.
4. Вызови операцию из facade-хука (`queryFn`/`mutationFn`), применив правило; фабрика модуля из `index.ts` уже отдаёт нужный порт.
5. Покрой поведение: правило — unit-тестом, сценарий пользователя — компонентным тестом или smoke.

---

## 5. Управление состоянием

| Тип состояния                                                     | Где живёт                    | Нельзя                                                   |
| ----------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------- |
| Данные с сервера (страницы, workspace, блоки, участники)          | TanStack Query               | дублировать в Zustand                                    |
| UI-состояние (раскрытые узлы дерева, выделенный блок, slash-меню) | Zustand-стор модуля          | хранить серверные данные и бизнес-логику                 |
| Состояние формы                                                   | react-hook-form              | глобальный стор                                          |
| Фильтры, поиск, выбранная страница                                | URL (searchParams/route)     | локальный стейт, если это должно переживать перезагрузку |
| Сессия                                                            | httpOnly cookies Better Auth | токены в `localStorage`/Zustand                          |

### TanStack Query

- Ключи — только через фабрики: `utils/query-keys.ts` модуля.
- Мутации, меняющие дерево/список, используют оптимистичные обновления с откатом (`onMutate` → снапшот → `onError` rollback → `onSettled` invalidate).
- Дефолты `staleTime`/retry задаются один раз в `core/providers.tsx`.
- События realtime в будущем инвалидируют/патчат кеш Query, а не пишут в Zustand.

### Zustand

- Один маленький стор на область, селекторы (`useStore(s => s.x)`), без подписки на весь стор.
- Стор содержит только сырые методы (`toggle`, `setX`, `reset`), не вызывает сеть и не строит derived-логику.
- Стор не экспортируется из `index.ts` модуля: снаружи — только facade-хук.

---

## 6. Ошибки

- Сервер отдаёт RFC 7807 (`application/problem+json`). Адаптер превращает ответ в прикладную ошибку модуля (`AuthError` и т.п.), UI различает ошибки по типу, а не по тексту.
- Ошибки не глотаются молча: `catch {}` без обработки запрещён. Если ошибка пробрасывается — она должна быть типизирована.
- UI показывает: инлайн — для форм, error boundary — для сегментов роутов, toast — для действий.

---

## 7. Безопасность на фронтенде

- Токены и сессии не храним в `localStorage`/`sessionStorage`/Zustand. Сессия — httpOnly cookies Better Auth; JWT кешируется только в памяти (`createAccessToken` из `api/access-token.ts`, TTL 60 секунд).
- Защита роутов — `src/proxy.ts`: без cookie сессии редирект на `/login`. Это UX-барьер; настоящая авторизация — на gateway (RBAC проверяется там).
- Весь пользовательский контент редактора рендерится безопасным рендерером; `dangerouslySetInnerHTML` без санитизации и обоснования запрещён.
- Внешние ссылки: `rel="noopener noreferrer"`, схемы только `http(s)`/`mailto`.
- Переменные окружения — только через `shared/configs/env.ts` (Zod-валидация). В клиент попадают только `NEXT_PUBLIC_*`.
- Realtime: сессия не уходит в query-string WebSocket-URL; viewer получает read-only режим.

---

## 8. Редактор (Stage 5)

Зафиксированные решения:

- **Tiptap напрямую** (без Yjs на этом этапе), автогенерируемое slash-меню Tiptap.
- **Блоки — отдельные строки в БД** (`blocks`), порядок — fractional indexing; `page_versions` хранит полные снапшоты (последние 50).
- **Автосохранение — debounce 1000 мс** при каждом изменении документа; отправка/диффинг живёт в facade-хуке модуля `editor`, не в компоненте.
- Реестр типов блоков — `utils/block.ts` (`registerBlock`, `getBlockDefinition`): новый тип добавляется регистрацией, а не правкой `switch` (OCP).
- Компонент `Editor` — только UI: контент и UI-состояние приходят из единственного facade-хука `useEditor`, операции с блоками — оттуда же.

---

## 9. Компоненты и Next.js

- **Server Components по умолчанию.** `'use client'` ставится на самом глубоком листе, которому нужен интерактив/хуки/Query/Zustand.
- Роут в `app/` тонкий: импортирует public-компонент модуля и рендерит его; никакой бизнес-логики.
- Примитивы `shared/ui` не правим вручную.
- Пропсы минимальные (ISP): передавать `authorName`, а не целого `User`.
- Доступность: семантические теги, aria-атрибуты, фокус, клавиатурная навигация (дерево страниц, slash-меню, Cmd+K).
- Запрещено: `any`, `as`-приведения для обхода типов, `@ts-ignore` без причины, «магические» строки (константы/enum/union-типы).

---

## 10. Именование

| Сущность     | Соглашение                                      | Пример                               |
| ------------ | ----------------------------------------------- | ------------------------------------ |
| Компоненты   | `PascalCase.tsx` в `ui/private` или `ui/public` | `page-tree.tsx`, `oauth-buttons.tsx` |
| Facade-хуки  | `use-<module>.ts`                               | `use-pages.ts`                       |
| Ключи Query  | `utils/query-keys.ts`                           | `pageKeys`                           |
| Правила      | `utils/*.ts`, assert-функции                    | `assertWorkspaceName`                |
| Стор         | `*.store.ts`                                    | `page-tree.store.ts`                 |
| API-адаптеры | `*.repository.api.ts` / `*.api.ts`              | `page.repository.api.ts`             |
| Мапперы      | `utils/*.mapper.ts`                             | `mapper.ts`                          |
| DTO-схемы    | `types/dto.ts`                                  | `PageResponseSchema`                 |
| Порты        | `types/ports.ts`                                | `PageRepository`                     |
| Тесты        | рядом с субъектом, `*.test.ts(x)`               | `mapper.test.ts`                     |

---

## 11. Тестирование

| Слой              | Где тест            | Что проверяем                                                                                            |
| ----------------- | ------------------- | -------------------------------------------------------------------------------------------------------- |
| Утилиты и правила | `utils/*.test.ts`   | чистые функции, правила, assert-проверки, мапперы DTO                                                    |
| Хуки и UI         | `ui/**/*.test.tsx`  | поведение пользователя: формы, сессия, инвалидация кеша; контейнер подменяется через `test/auth-fixture` |
| API-адаптеры      | `api/*.test.ts`     | Zod-валидация ответов, маппинг RFC 7807, TTL кеша токена, мок `fetch`/клиента                            |
| Сквозные          | `scripts/smoke.mjs` | auth, workspace, дерево страниц, блоки через реальный gateway                                            |

- Покрытие меряется для чистой логики модулей (`utils`), порог 80% (lines/functions/branches/statements) в `vitest.config.ts`.
- Тесты правил не поднимают React и сеть; сценарии хуков проверяются через компоненты.
- Негативные security-сценарии обязательны: viewer не редактирует, чужой workspace недоступен, истёкшая сессия ведёт на логин, payload в блоке не исполняется.
- Нетривиальные решения фиксируются ADR в `docs/adr/`.

---

## 12. Чек-лист: новая фича в модуле

1. Определи, в какой модуль входит фича; не создавай новый модуль без доменной причины.
2. Добавь правила и мапперы в `utils/` + unit-тесты.
3. Опиши порт в `types/ports.ts`, реализуй вызов в `api/`, добавь DTO-схему (из `packages/contracts`).
4. Подключи вызов в единственном facade-хуке (Query/Mutation, оптимистичные обновления, правила, ключи из `utils/query-keys.ts`).
5. Собери UI: компонент в `ui/private` (если внутренний) или `ui/public` (если нужен другим); только UI-логика.
6. Если компонент виден наружу — экспортируй из `index.ts`.
7. Подключи роут в `app/` (тонкий).
8. Прогони `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`, при необходимости `pnpm test:coverage` и `pnpm smoke`.

## 13. Definition of Done

- Границы архитектуры соблюдены, `pnpm lint` зелёный (включая `check-boundaries`).
- Нет `any`, неподавленных ошибок типов и линтера.
- Фича покрыта тестами на нужных слоях; покрытие чистой логики не ниже порога.
- Серверные данные — только в TanStack Query; UI-состояние — только в сторе модуля; стор не течёт наружу.
- Нет токенов в клиентском хранилище и несанитизированного HTML.
- Состояния загрузки/ошибки/пустоты обработаны, интерфейс доступен с клавиатуры.
- Нетривиальное решение описано ADR.

## 14. Команды

```bash
pnpm lint            # oxlint + проверка границ архитектуры
pnpm format          # oxfmt
pnpm format:check    # проверка форматирования
pnpm typecheck       # turbo run typecheck
pnpm test            # turbo run test
pnpm test:coverage   # покрытие (порог 80% для utils)
pnpm build           # turbo run build
pnpm smoke           # сквозной сценарий против локальных воркеров
```
