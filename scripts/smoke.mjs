/**
 * Smoke-проверка notio: настоящий путь запроса клиент → gateway → Service Binding →
 * сервис → D1, плюс защитные заголовки и rate limit.
 *
 *   pnpm smoke              # сам поднимает backend, проверяет и гасит его
 *   pnpm smoke -- --verbose # показывает логи workers
 *
 * Если backend уже запущен (`pnpm dev:workers`), скрипт использует его и ничего
 * не останавливает.
 */
import { spawn } from 'node:child_process';

const BASE_URL = process.env['GATEWAY_URL'] ?? 'http://localhost:8787';
const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';
const ACTOR_ID = '00000000-0000-4000-8000-00000000000a';
const BOOT_TIMEOUT_MS = 90_000;
const POLL_INTERVAL_MS = 500;
const PROBE_TIMEOUT_MS = 2_000;
const VERBOSE = process.argv.includes('--verbose');
const PNPM = 'pnpm';

const failures = [];
const workerLogs = [];

function check(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function json(response) {
  return response.json();
}

/**
 * На Windows `pnpm` — это обёртка .cmd, и Node не запускает такие файлы без
 * оболочки (spawn EINVAL), поэтому она включается только на win32.
 */
function spawnOptions(extra = {}) {
  return {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    ...extra,
  };
}

async function isGatewayUp() {
  try {
    const response = await fetch(`${BASE_URL}/health`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });

    return response.ok;
  } catch {
    return false;
  }
}

/** Выполняет команду и возвращает её вывод; ошибка не роняет скрипт. */
function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, spawnOptions());
    let output = '';

    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    child.on('error', () => resolve({ code: 1, output }));
    child.on('close', (code) => resolve({ code: code ?? 0, output }));
  });
}

/** Пишет вывод workers в буфер и (при --verbose) в терминал. */
function collectWorkerLogs(chunk) {
  const text = String(chunk);
  workerLogs.push(text);

  if (VERBOSE) {
    process.stdout.write(text);
  }
}

function startWorkers() {
  const child = spawn(PNPM, ['run', 'dev:workers'], spawnOptions());

  child.stdout.on('data', collectWorkerLogs);
  child.stderr.on('data', collectWorkerLogs);

  return child;
}

function stopWorkers(child) {
  if (!child || child.exitCode !== null || child.pid === undefined) {
    return;
  }

  if (process.platform === 'win32') {
    // Убиваем всё дерево: оболочка запускает pnpm, а тот — workerd.
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
}

async function waitForGateway() {
  const deadline = Date.now() + BOOT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (await isGatewayUp()) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  return false;
}

async function runChecks() {
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
        created: {
          id: createdBody.id,
          title: createdBody.title,
          position: createdBody.position,
        },
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
    return false;
  }

  console.log(
    '\nSmoke-проверка пройдена: gateway видит pages-service, проксирует запись в D1, защитные заголовки и rate limit на месте.',
  );

  return true;
}

async function main() {
  let workers = null;

  if (!(await isGatewayUp())) {
    console.log(`Gateway на ${BASE_URL} не отвечает — поднимаю backend и миграции...`);

    const migration = await run(PNPM, ['run', 'db:migrate:pages']);
    if (migration.code !== 0) {
      console.error('Не удалось применить миграции:\n', migration.output);
      process.exitCode = 1;
      return;
    }

    workers = startWorkers();

    const isReady = await waitForGateway();
    if (!isReady) {
      stopWorkers(workers);
      console.error(
        `Backend не поднялся за ${BOOT_TIMEOUT_MS / 1000} с. Логи workers:\n`,
        workerLogs.join('').slice(-2000),
      );
      process.exitCode = 1;
      return;
    }
  } else {
    console.log(`Используем уже запущенный gateway на ${BASE_URL}.`);
  }

  const onInterrupt = () => {
    stopWorkers(workers);
    process.exit(130);
  };

  process.on('SIGINT', onInterrupt);
  process.on('SIGTERM', onInterrupt);

  try {
    const passed = await runChecks();
    if (!passed) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`Smoke-проверка упала с ошибкой:`, error.message);
    process.exitCode = 1;
  } finally {
    stopWorkers(workers);
  }
}

await main();
