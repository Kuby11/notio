/**
 * Smoke-проверка notio: настоящий путь запроса клиент → gateway → Service Binding →
 * сервис → D1, плюс аутентификация, защитные заголовки и rate limit.
 *
 *   pnpm smoke              # сам поднимает backend, проверяет и гасит его
 *   pnpm smoke -- --verbose # показывает логи workers
 *   pnpm smoke -- --reuse   # использовать уже запущенный backend (ничего не гасит)
 *
 * По умолчанию скрипт всегда поднимает свой backend: ссылка подтверждения почты
 * приходит в лог workers, и без своих логов проверка была бы неполной.
 * С `--reuse` логов не будет, поэтому токен подтверждения собирается из
 * dev-секрета — такой режим годится только для локального стенда.
 */
import { spawn } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

const BASE_URL = process.env['GATEWAY_URL'] ?? 'http://localhost:8787';
const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';
const BOOT_TIMEOUT_MS = 90_000;
const POLL_INTERVAL_MS = 500;
const PROBE_TIMEOUT_MS = 2_000;
const PASSWORD = 'correct-horse-battery';
const SMOKE_IP = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
/** Срок жизни ссылки подтверждения: совпадает с emailVerification.expiresIn. */
const VERIFICATION_TTL_SECONDS = 60 * 60 * 24;
const VERBOSE = process.argv.includes('--verbose');
const REUSE_RUNNING_BACKEND = process.argv.includes('--reuse');
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
 * Ссылка подтверждения почты.
 *
 * Better Auth подписывает её JWT секретом сервиса и не кладёт в базу, поэтому
 * в dev мы берём её двумя путями: из логов workers (когда smoke сам их поднял)
 * либо собираем тем же секретом из .dev.vars. В production письмо уходит
 * на почту, и smoke так не работает — это инструмент локальной проверки.
 */
function verificationTokenFromLogs(email) {
  const pattern = new RegExp(
    `"to":"${email.replaceAll('.', '\\.')}"[^}]*"actionUrl":"[^"]*token=([^&"]+)`,
  );
  const logs = workerLogs.join('');

  return pattern.exec(logs)?.[1] ?? null;
}

function devSecret() {
  try {
    const content = readFileSync('.dev.vars', 'utf8');

    return /^BETTER_AUTH_SECRET=(.+)$/m.exec(content)?.[1].trim() ?? null;
  } catch {
    return null;
  }
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function mintVerificationToken(email, secret) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = base64UrlJson({
    email,
    iat: issuedAt,
    exp: issuedAt + VERIFICATION_TTL_SECONDS,
  });
  const signature = createHmac('sha256', secret)
    .update(`${base64UrlJson({ alg: 'HS256' })}.${payload}`)
    .digest('base64url');

  return `${base64UrlJson({ alg: 'HS256' })}.${payload}.${signature}`;
}

async function resolveVerificationToken(email) {
  const fromLogs = verificationTokenFromLogs(email);

  if (fromLogs !== null) {
    return fromLogs;
  }

  const secret = devSecret();

  return secret === null ? null : mintVerificationToken(email, secret);
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

/**
 * Останавливает уже запущенный backend перед стартом своего.
 * Скрипту нужен собственный процесс: ссылка подтверждения приходит в его лог.
 */
function stopForeignBackend() {
  const command = process.platform === 'win32' ? 'taskkill' : 'pkill';

  spawn(command, process.platform === 'win32' ? ['/IM', 'workerd.exe', '/F'] : ['-f', 'wrangler'], {
    stdio: 'ignore',
    shell: process.platform === 'win32',
  });
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

/** Cookie из ответа входа: значение пары «имя=значение» для следующего запроса. */
function sessionCookie(response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .filter((cookie) => cookie.startsWith('notio.session_token='))
    .join('; ');
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
  check(
    Array.isArray(readinessBody.services) &&
      readinessBody.services.some((service) => service.service === 'auth-service'),
    'Ответ /api/health не содержит состояние auth-service',
  );

  // Закрытый маршрут без токена.
  const anonymous = await fetch(`${BASE_URL}/api/pages`, {
    headers: { 'cf-connecting-ip': '203.0.113.70' },
  });

  check(
    anonymous.status === 401,
    `GET /api/pages без токена вернул ${anonymous.status}, ожидался 401`,
  );

  // Полный флоу: регистрация → подтверждение → вход → JWT.
  const email = `smoke-${randomUUID().slice(0, 8)}@notio.test`;
  const signUp = await fetch(`${BASE_URL}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: BASE_URL,
      'cf-connecting-ip': `${SMOKE_IP}`,
    },
    body: JSON.stringify({ email, password: PASSWORD, name: 'Smoke' }),
  });

  check(
    signUp.status === 200,
    `POST /api/auth/sign-up/email вернул ${signUp.status}: ${await signUp.clone().text()}`,
  );

  // Повторная регистрация той же почты должна честно сообщить о конфликте.
  const duplicate = await fetch(`${BASE_URL}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: BASE_URL,
      'cf-connecting-ip': `${SMOKE_IP}`,
    },
    body: JSON.stringify({ email, password: PASSWORD, name: 'Smoke' }),
  });
  const duplicateBody = await json(duplicate);

  check(
    duplicate.status === 409,
    `Повторная регистрация вернула ${duplicate.status}, ожидался 409: ${JSON.stringify(duplicateBody)}`,
  );
  check(
    duplicateBody.code === 'CONFLICT',
    `Повторная регистрация вернула код ${duplicateBody.code}, ожидался CONFLICT`,
  );

  const token = await resolveVerificationToken(email);
  check(
    token !== null,
    'Не удалось получить ссылку подтверждения: запустите smoke без --reuse, чтобы он поднял свой backend и прочитал ссылку из логов',
  );

  let cookie = '';
  let jwt = null;

  if (token !== null) {
    const verified = await fetch(
      `${BASE_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}&callbackURL=%2F`,
      { redirect: 'manual', headers: { 'cf-connecting-ip': `${SMOKE_IP}` } },
    );

    check(
      [200, 302].includes(verified.status),
      `Подтверждение почты вернуло ${verified.status}, ожидался 200 или 302`,
    );

    const signIn = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: BASE_URL,
        'cf-connecting-ip': `${SMOKE_IP}`,
      },
      body: JSON.stringify({ email, password: PASSWORD }),
    });

    check(signIn.status === 200, `Вход вернул ${signIn.status}: ${await signIn.clone().text()}`);

    cookie = sessionCookie(signIn);
    check(cookie.startsWith('notio.session_token='), 'Вход не выдал cookie сессии');

    const tokenResponse = await fetch(`${BASE_URL}/api/auth/token`, {
      headers: { cookie, 'cf-connecting-ip': `${SMOKE_IP}` },
    });
    const tokenBody = await json(tokenResponse);

    check(tokenResponse.status === 200, `GET /api/auth/token вернул ${tokenResponse.status}`);
    check(
      typeof tokenBody.token === 'string' && tokenBody.token.split('.').length === 3,
      'auth-service не выдал JWT активной сессии',
    );

    jwt = tokenBody.token ?? null;
  }

  // Подделка токена: подпись не проходит проверку по JWKS.
  const forged = `${(jwt ?? 'a.b.c').split('.').slice(0, 2).join('.')}.tampered`;
  const forgedResponse = await fetch(`${BASE_URL}/api/pages`, {
    headers: {
      authorization: `Bearer ${forged}`,
      'cf-connecting-ip': '203.0.113.72',
    },
  });

  check(
    forgedResponse.status === 401,
    `Подделанный JWT вернул ${forgedResponse.status}, ожидался 401`,
  );

  let createdBody = null;
  let created = null;

  if (jwt !== null) {
    created = await fetch(`${BASE_URL}/api/pages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${jwt}`,
        'cf-connecting-ip': '203.0.113.73',
      },
      body: JSON.stringify({
        workspaceId: WORKSPACE_ID,
        title: `smoke ${new Date().toISOString()}`,
      }),
    });
    createdBody = await json(created);

    check(
      created.status === 201,
      `POST /api/pages с JWT вернул ${created.status}, ожидался 201: ${JSON.stringify(createdBody)}`,
    );
    check(createdBody.workspaceId === WORKSPACE_ID, 'Созданная страница лежит в чужом workspace');
  }

  const listed = await fetch(
    `${BASE_URL}/api/pages?workspaceId=${WORKSPACE_ID}&includeTrashed=true`,
    { headers: { 'cf-connecting-ip': '203.0.113.74' } },
  );

  check(listed.status === 401, `Список страниц без токена вернул ${listed.status}, ожидался 401`);

  if (created !== null && createdBody?.id) {
    const authorizedList = await fetch(
      `${BASE_URL}/api/pages?workspaceId=${WORKSPACE_ID}&includeTrashed=true`,
      { headers: { authorization: `Bearer ${jwt}`, 'cf-connecting-ip': '203.0.113.74' } },
    );
    const listedBody = await json(authorizedList);

    check(
      listedBody.items.some((page) => page.id === createdBody.id),
      'Созданная страница не появилась в списке — потерялась запись в D1 или фильтрация',
    );

    const favorite = await fetch(
      `${BASE_URL}/api/pages/${createdBody.id}?workspaceId=${WORKSPACE_ID}`,
      {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${jwt}`,
          'cf-connecting-ip': '203.0.113.75',
        },
        body: JSON.stringify({ isFavorite: true }),
      },
    );

    check(favorite.status === 200, `PATCH избранного вернул ${favorite.status}, ожидался 200`);

    const favorites = await fetch(`${BASE_URL}/api/pages/favorites?workspaceId=${WORKSPACE_ID}`, {
      headers: { authorization: `Bearer ${jwt}`, 'cf-connecting-ip': '203.0.113.75' },
    });
    const favoritesBody = await json(favorites);

    check(
      favorites.status === 200,
      `GET /api/pages/favorites вернул ${favorites.status}, ожидался 200`,
    );
    check(
      Array.isArray(favoritesBody.items) &&
        favoritesBody.items.some((page) => page.id === createdBody.id),
      'Избранная страница не появилась в /api/pages/favorites',
    );

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
  }

  console.log(
    JSON.stringify(
      {
        liveness: livenessBody,
        readiness: readinessBody,
        auth: { email, signedUp: signUp.status, verified: token !== null, gotJwt: jwt !== null },
        created:
          createdBody === null
            ? null
            : { id: createdBody.id, title: createdBody.title, position: createdBody.position },
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
    '\nSmoke-проверка пройдена: регистрация с отказом на занятом email, подтверждение почты, вход, JWT, отказ по подделанному токену, запись страницы в D1 и список избранного работают.',
  );

  return true;
}

async function main() {
  let workers = null;

  if (REUSE_RUNNING_BACKEND && (await isGatewayUp())) {
    console.log(`Используем уже запущенный backend на ${BASE_URL} (--reuse).`);
  } else {
    if (await isGatewayUp()) {
      console.log(
        `На ${BASE_URL} уже отвечает чужой backend — останавливаю его: без своих логов smoke неполон. Запустите с --reuse, чтобы этого не делать.`,
      );
      stopForeignBackend();
    }

    console.log('Поднимаю backend и миграции...');

    const migration = await run(PNPM, ['run', 'db:migrate']);
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
