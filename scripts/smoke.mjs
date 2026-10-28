/**
 * Smoke check for notio: a real request path client -> gateway -> Service Binding ->
 * service -> D1, plus authentication, security headers and rate limiting.
 *
 *   pnpm smoke              # starts the backend itself, checks it and shuts it down
 *   pnpm smoke -- --verbose # show worker logs
 *   pnpm smoke -- --reuse   # use an already running backend (kills nothing)
 *
 * By default the script always starts its own backend: the email confirmation
 * link arrives in the worker logs, and the check would be incomplete without
 * them. With `--reuse` there are no logs, so the verification token is derived
 * from the dev secret — that mode is only fit for a local stand.
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
/** Lifetime of the confirmation link: matches emailVerification.expiresIn. */
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
 * The email confirmation link.
 *
 * Better Auth signs it with the service JWT secret and does not store it in
 * the database, so in dev we get it two ways: from the worker logs (when
 * smoke started them itself) or by re-deriving it with the same secret from
 * .dev.vars. In production the mail goes to an inbox and this does not work —
 * the script is a local verification tool.
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
 * On Windows `pnpm` is a .cmd wrapper, which Node cannot execute without a
 * shell (spawn EINVAL), so the shell is enabled on win32 only.
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

/** Runs a command and returns its output; a failure does not crash the script. */
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
    // Kill the whole tree: the shell spawns pnpm, which in turn spawns workerd.
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
}

/**
 * Stops an already running backend before starting our own.
 * The script needs its own process: the confirmation link arrives in its logs.
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

  const anonymous = await fetch(`${BASE_URL}/api/pages`, {
    headers: { 'cf-connecting-ip': '203.0.113.70' },
  });

  check(
    anonymous.status === 401,
    `GET /api/pages без токена вернул ${anonymous.status}, ожидался 401`,
  );

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

    const trashed = await fetch(
      `${BASE_URL}/api/pages/${createdBody.id}?workspaceId=${WORKSPACE_ID}`,
      {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${jwt}`,
          'cf-connecting-ip': '203.0.113.75',
        },
        body: JSON.stringify({ isTrashed: true }),
      },
    );

    check(trashed.status === 200, `Перенос в корзину вернул ${trashed.status}, ожидался 200`);

    const trash = await fetch(`${BASE_URL}/api/pages/trash?workspaceId=${WORKSPACE_ID}`, {
      headers: { authorization: `Bearer ${jwt}`, 'cf-connecting-ip': '203.0.113.75' },
    });
    const trashBody = await json(trash);

    check(trash.status === 200, `GET /api/pages/trash вернул ${trash.status}, ожидался 200`);
    check(
      Array.isArray(trashBody.items) && trashBody.items.some((page) => page.id === createdBody.id),
      'Удалённая страница не появилась в /api/pages/trash',
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
    '\nSmoke-проверка пройдена: регистрация с отказом на занятом email, подтверждение почты, вход, JWT, отказ по подделанному токену, запись страницы в D1, списки избранного и корзины работают.',
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
