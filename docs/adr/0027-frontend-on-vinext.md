# ADR 0027. Фронтенд на vinext вместо тулчейна Next.js

- **Статус:** принято
- **Дата:** 2026-11-04

## Контекст

`apps/web` написан на Next.js 16 (App Router) и собирался штатным `next build`.
Бэкенд целиком живёт на Cloudflare Workers, поэтому фронтенду нужен путь деплоя
на Workers без отдельного адаптера сборки. Пакет `next` тянет собственный
компилятор и не собирает приложение под Workers напрямую.

`vinext` — Vite-плагин, который реализует публичный API Next.js (роутинг, RSC,
`next/*`, `proxy.ts`, Metadata API) поверх Vite и нативно интегрируется с
Workers через `@cloudflare/vite-plugin`. Совместимость проверена `vinext check`:
21 поддерживаемая возможность, 4 частичных, 0 несовместимостей.

## Решение

1. Сборка и dev-сервер — Vite с плагином `vinext()` и `@cloudflare/vite-plugin`;
   деплой — `vinext-cloudflare deploy` по `cloudflare.config.ts`.
2. Пакет `next` удалён из зависимостей. Объявления `next` и `next/*` для `tsc`
   и рантайма даёт vinext (`apps/web/vinext-env.d.ts`), поэтому исходники
   продолжают импортировать `next/navigation`, `next/link`, `next/headers` и т.д.
3. `next.config.ts` остаётся: vinext читает из него `headers()` (CSP и
   security-заголовки), `transpilePackages` и `poweredByHeader`. Настройки
   `turbopack`/`webpack` убраны — алиас `next-intl/config` vinext разрешает сам.
4. Vitest резолвит `next/*` в рантайм-шимы vinext: реальный пакет в тестах не нужен.
5. `pnpm typecheck` в `apps/web` — это `tsc --noEmit`; `vinext typegen` не
   запускается, потому что перезаписывает `next-env.d.ts` шаблоном Next.

## Последствия

- `pnpm dev` / `pnpm build` / `pnpm start` в `apps/web` работают через Vite;
  `pnpm deploy` собирает и публикует Worker.
- Dev-сервер выдаёт предупреждения Vite об оптимизации зависимостей
  (`next-intl` и `@tanstack/react-query`), на сборку и рантайм они не влияют.
- Проприетарные возможности Next (typed routes, Turbopack-загрузчики) недоступны:
  типизированные `href` не генерируются, а конфиги загрузчиков надо переносить
  в Vite-плагины.
- Остальные сервисы монорепозитория не затронуты: фронтенд по-прежнему общается
  с бэкендом только через gateway.
