import { HealthResponseSchema, type HealthResponse, type ServiceHealth } from '@notio/contracts';
import { SessionPanel } from '../features/auth/ui/session-panel';
import { PageTree } from '../features/pages/ui/page-tree';
import { env } from '../shared/config/env';

const REQUEST_TIMEOUT_MS = 5_000;

/**
 * Этап 0: единственный вызов бэкенда с фронтенда — проверка живости gateway.
 * Ответ не доверяем: он валидируется общим Zod-контрактом из packages/contracts.
 * `null` означает «сервис недоступен» — это штатное состояние, а не ошибка рендера.
 */
async function loadGatewayHealth(): Promise<HealthResponse | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${env.NEXT_PUBLIC_GATEWAY_URL}/api/health`, {
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const parsed = HealthResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function StatusBadge({ status }: { status: ServiceHealth['status'] }) {
  const styles =
    status === 'ok'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
      : 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200';

  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>{status}</span>;
}

export default async function Home() {
  const health = await loadGatewayHealth();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
      <header className="space-y-2">
        <p className="text-sm font-medium tracking-wide text-neutral-500 uppercase">
          {env.NEXT_PUBLIC_APP_NAME}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Клон Notion на Cloudflare Workers</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Этап 2: аутентификация, сессии в cookie и JWT для защищённых запросов.
        </p>
      </header>

      <SessionPanel />

      <section
        aria-labelledby="health-heading"
        className="rounded-xl border border-neutral-200 dark:border-neutral-800"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
          <h2 id="health-heading" className="font-medium">
            Состояние сервисов
          </h2>
          {health ? <StatusBadge status={health.status} /> : null}
        </div>

        {health ? (
          <table className="w-full text-sm">
            <caption className="sr-only">Состояние сервисов, опрошенных через gateway</caption>
            <thead className="text-left text-neutral-500">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">
                  Сервис
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Статус
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Версия
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Задержка
                </th>
              </tr>
            </thead>
            <tbody>
              {health.services.map((service) => (
                <tr
                  key={service.service}
                  className="border-t border-neutral-200 dark:border-neutral-800"
                >
                  <td className="px-5 py-3 font-mono text-xs">{service.service}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={service.status} />
                    {service.error ? (
                      <span className="ml-2 text-xs text-amber-700 dark:text-amber-300">
                        {service.error}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-5 py-3 text-neutral-500">{service.version}</td>
                  <td className="px-5 py-3 text-neutral-500">{service.latencyMs} мс</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-5 py-6 text-sm text-amber-700 dark:text-amber-300">
            Gateway недоступен по адресу {env.NEXT_PUBLIC_GATEWAY_URL}. Запустите бэкенд командой{' '}
            <code className="font-mono">pnpm dev:workers</code>.
          </p>
        )}
      </section>

      <section
        aria-labelledby="pages-heading"
        className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800"
      >
        <h2 id="pages-heading" className="text-sm font-medium">
          Страницы
        </h2>
        <div className="mt-3">
          <PageTree workspaceId="00000000-0000-4000-8000-000000000001" />
        </div>
      </section>
    </main>
  );
}
