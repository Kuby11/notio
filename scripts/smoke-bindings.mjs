/**
 * Smoke-проверка реального Service Binding в локальной разработке.
 *
 * Запуск:
 *   1) в одном терминале — `pnpm dev:workers`
 *   2) в другом — `pnpm smoke`
 *
 * Vitest-тесты gateway используют заглушку биндинга, поэтому настоящее
 * межсервисное соединение проверяется именно здесь: gateway должен увидеть
 * pages-service в `services` агрегированного ответа.
 */
const BASE_URL = process.env['GATEWAY_URL'] ?? 'http://localhost:8787';

const failures = [];

function check(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

async function main() {
  const liveness = await fetch(`${BASE_URL}/health`);
  const livenessBody = await liveness.json();

  check(liveness.status === 200, `GET /health вернул ${liveness.status}, ожидался 200`);
  check(livenessBody.status === 'ok', `GET /health вернул status=${livenessBody.status}`);

  const readiness = await fetch(`${BASE_URL}/api/health`);
  const readinessBody = await readiness.json();

  check(
    readiness.status === 200,
    `GET /api/health вернул ${readiness.status}, ожидался 200 (сервис недоступен)`,
  );
  check(
    Array.isArray(readinessBody.services) &&
      readinessBody.services.some((service) => service.service === 'pages-service'),
    'Ответ /api/health не содержит состояние pages-service — Service Binding не сработал',
  );

  console.log(JSON.stringify({ liveness: livenessBody, readiness: readinessBody }, null, 2));

  if (failures.length > 0) {
    console.error('\nSmoke-проверка не пройдена:');
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('\nSmoke-проверка пройдена: gateway видит pages-service через Service Binding.');
}

try {
  await main();
} catch (error) {
  console.error(`Не удалось выполнить smoke-проверку (${BASE_URL} доступен?):`, error.message);
  process.exitCode = 1;
}
