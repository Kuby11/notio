/**
 * Smoke-проверка локальной разработки.
 *
 * Запуск:
 *   1) в одном терминале — `pnpm dev:workers`
 *   2) в другом — `pnpm smoke`
 *
 * Vitest-тесты закрывают детали (логику, ошибки, заголовки), а этот скрипт
 * проверяет настоящий путь запроса: клиент → gateway → Service Binding → сервис,
 * плюс защитные заголовки и лимит запросов на реальном стеке.
 */
const BASE_URL = process.env['GATEWAY_URL'] ?? 'http://localhost:8787';
const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';
const ACTOR_ID = '00000000-0000-4000-8000-00000000000a';

const failures = [];

function check(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function json(response) {
  return response.json();
}

async function main() {
  const liveness = await fetch(`${BASE_URL}/health`);
  const livenessBody = await json(liveness);

  check(liveness.status === 200, `GET /health вернул ${liveness.status}, ожидался 200`);
  check(livenessBody.status === 'ok', `GET /health вернул status=${livenessBody.status}`);

  const readiness = await fetch(`${BASE_URL}/api/health`);
  const readinessBody = await json(readiness);

  check(
    readiness.status === 200,
    `GET /api/health вернул ${readiness.status}, ожидался 200 (сервис недоступен)`,
  );
  check(
    Array.isArray(readinessBody.services) &&
      readinessBody.services.some((service) => service.service === 'pages-service'),
    'Ответ /api/health не содержит состояние pages-service — Service Binding не сработал',
  );

  // Проксирование в сервис: создание страницы от имени пользователя.
  const title = `smoke ${new Date().toISOString()}`;
  const created = await fetch(`${BASE_URL}/api/pages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-actor-id': ACTOR_ID,
      'cf-connecting-ip': '203.0.113.77',
    },
    body: JSON.stringify({ workspaceId: WORKSPACE_ID, title }),
  });
  const createdBody = await json(created);

  check(
    created.status === 201,
    `POST /api/pages вернул ${created.status}, ожидался 201: ${JSON.stringify(createdBody)}`,
  );
  check(createdBody.workspaceId === WORKSPACE_ID, 'Созданная страница лежит в чужом workspace');

  const listed = await fetch(
    `${BASE_URL}/api/pages?workspaceId=${WORKSPACE_ID}&includeTrashed=true`,
    { headers: { 'cf-connecting-ip': '203.0.113.78' } },
  );
  const listedBody = await json(listed);

  check(
    listedBody.items.some((page) => page.id === createdBody.id),
    'Созданная страница не появилась в списке — потерялась запись в D1 или фильтрация',
  );

  // Защитные заголовки на проксированном ответе.
  check(
    created.headers.get('x-content-type-options') === 'nosniff',
    'Ответ прокси не содержит x-content-type-options: nosniff',
  );
  check(
    created.headers.get('x-request-id') !== null,
    'Ответ прокси не содержит сквозной request-id',
  );
  check(
    created.headers.get('x-ratelimit-limit') !== null,
    'Ответ прокси не содержит заголовки rate limit',
  );

  console.log(
    JSON.stringify(
      {
        liveness: livenessBody,
        readiness: readinessBody,
        created: { id: createdBody.id, title: createdBody.title, position: createdBody.position },
        listed: listedBody.items.map((page) => `${page.title}@${page.position}`),
      },
      null,
      2,
    ),
  );

  if (failures.length > 0) {
    console.error('\nSmoke-проверка не пройдена:');
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    '\nSmoke-проверка пройдена: gateway видит pages-service, проксирует запись в D1, защитные заголовки и rate limit на месте.',
  );
}

try {
  await main();
} catch (error) {
  console.error(`Не удалось выполнить smoke-проверку (${BASE_URL} доступен?):`, error.message);
  process.exitCode = 1;
}
