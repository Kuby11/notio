import { env as workerEnv } from 'cloudflare:workers';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { MailSender, OutboundMail } from '../src/auth/mailer';
import { AUTH_BASE_PATH, JWKS_PATH, TOKEN_PATH } from '../src/auth/options';
import type { AppEnv, Bindings } from '../src/env';
import { createAuthRoutes } from '../src/routes/auth';
import { createHealthRoutes, SERVICE_NAME } from '../src/routes/health';

const env = workerEnv as Bindings;

let requestCounter = 0;

/**
 * Better Auth ограничивает чувствительные эндпоинты (вход, регистрация)
 * отдельным жёстким лимитом в несколько попыток на IP. Тесты имитируют
 * разных клиентов, иначе счётчики исчерпывали бы лимит внутри одного сценария.
 */
function uniqueIp(): string {
  requestCounter += 1;

  return `198.51.100.${requestCounter % 250}`;
}

/** Письма перехватываются вместо отправки: тестам нужен доступ к ссылке. */
function createTestApp(mail: OutboundMail[]): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  const mailSender: MailSender = {
    send: async (message) => {
      mail.push(message);
    },
  };

  app.route('/', createHealthRoutes());
  app.route('/', createAuthRoutes({ mailSender }));

  return app;
}

interface CallOptions {
  method?: string;
  body?: unknown;
  cookie?: string;
}

async function call(app: Hono<AppEnv>, path: string, options: CallOptions = {}) {
  const ip = uniqueIp();
  const headers: Record<string, string> = {
    'cf-connecting-ip': ip,
    'x-forwarded-for': ip,
    // Better Auth проверяет Origin на изменяющих запросах (защита от CSRF),
    // браузер присылает его всегда — тесты должны вести себя так же.
    origin: 'http://localhost:8787',
  };

  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  if (options.cookie) {
    headers['cookie'] = options.cookie;
  }

  return Promise.resolve(
    app.request(
      path,
      {
        method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      },
      env,
    ),
  );
}

function uniqueEmail(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}@notio.test`;
}

async function usersWithEmail(email: string): Promise<{ id: string; email: string }[]> {
  const result = await env.DB.prepare('SELECT id, email FROM user WHERE email = ?')
    .bind(email)
    .all<{ id: string; email: string }>();

  return result.results;
}

interface SignUpResult {
  app: Hono<AppEnv>;
  mail: OutboundMail[];
  email: string;
  verificationUrl: string;
}

async function signUp(prefix: string): Promise<SignUpResult> {
  const mail: OutboundMail[] = [];
  const app = createTestApp(mail);
  const email = uniqueEmail(prefix);

  const response = await call(app, `${AUTH_BASE_PATH}/sign-up/email`, {
    body: { email, password: 'correct-horse-battery', name: 'Аня' },
  });

  expect(response.status).toBe(200);

  const verificationUrl = mail.at(-1)?.actionUrl ?? '';
  expect(verificationUrl).not.toBe('');

  return { app, mail, email, verificationUrl };
}

/** Подтверждение почты возвращает редирект на страницу успеха. */
async function verify(app: Hono<AppEnv>, verificationUrl: string): Promise<Response> {
  const url = new URL(verificationUrl);

  return call(app, `${url.pathname}${url.search}`, { method: 'GET' });
}

async function signInWithPassword(
  app: Hono<AppEnv>,
  email: string,
  password = 'correct-horse-battery',
): Promise<Response> {
  return call(app, `${AUTH_BASE_PATH}/sign-in/email`, { body: { email, password } });
}

function cookieFrom(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
}

describe('auth-service /health', () => {
  it('отвечает ok и описывает сервис', async () => {
    const app = createTestApp([]);
    const response = await app.request('/health', {}, env);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: 'ok',
      services: [{ service: SERVICE_NAME, status: 'ok' }],
    });
  });
});

describe('регистрация и вход', () => {
  it('регистрирует пользователя и отправляет письмо верификации', async () => {
    const mail: OutboundMail[] = [];
    const app = createTestApp(mail);
    const email = uniqueEmail('sign-up');

    const response = await call(app, `${AUTH_BASE_PATH}/sign-up/email`, {
      body: { email, password: 'correct-horse-battery', name: 'Аня' },
    });
    const body = (await response.json()) as { user?: { email?: string; emailVerified?: boolean } };

    expect(response.status).toBe(200);
    expect(body.user?.email).toBe(email);
    expect(body.user?.emailVerified).toBe(false);
    expect(await usersWithEmail(email)).toHaveLength(1);
    expect(mail).toHaveLength(1);
    expect(mail[0]).toMatchObject({ to: email, kind: 'VERIFY_EMAIL' });
    expect(mail[0]?.actionUrl).toContain('/api/auth/verify-email');
  });

  it('не создаёт второй аккаунт на тот же email и отвечает 409', async () => {
    const mail: OutboundMail[] = [];
    const app = createTestApp(mail);
    const email = uniqueEmail('dupe');
    const body = { email, password: 'correct-horse-battery', name: 'Глеб' };

    const first = await call(app, `${AUTH_BASE_PATH}/sign-up/email`, { body });
    expect(first.status).toBe(200);

    const second = await call(app, `${AUTH_BASE_PATH}/sign-up/email`, { body });

    // Better Auth ответил бы 200 без второй строки: клиент решил бы, что
    // аккаунт создан, и потерял бы его. Отвечаем явным конфликтом.
    expect(second.status).toBe(409);
    expect(await second.clone().json()).toMatchObject({
      code: 'CONFLICT',
      detail: 'Аккаунт с такой почтой уже существует',
    });
    expect(await usersWithEmail(email)).toHaveLength(1);
  });

  it('ловит занятую почту независимо от регистра', async () => {
    const mail: OutboundMail[] = [];
    const app = createTestApp(mail);
    const email = uniqueEmail('Case');
    const body = { password: 'correct-horse-battery', name: 'Маша' };

    await call(app, `${AUTH_BASE_PATH}/sign-up/email`, { body: { ...body, email } });
    const second = await call(app, `${AUTH_BASE_PATH}/sign-up/email`, {
      body: { ...body, email: email.toUpperCase() },
    });

    expect(second.status).toBe(409);
  });

  it('не создаёт сессию до подтверждения почты', async () => {
    const { app, email } = await signUp('unverified');

    const response = await signInWithPassword(app, email);

    expect(response.status).toBe(403);
    expect(response.headers.getSetCookie().join(';')).not.toContain('session_token');
  });

  it('полный флоу: регистрация → подтверждение → вход → сессия → выход', async () => {
    const { app, email, verificationUrl } = await signUp('flow');

    const verified = await verify(app, verificationUrl);
    expect([200, 302]).toContain(verified.status);

    const signInResponse = await signInWithPassword(app, email);
    expect(signInResponse.status).toBe(200);

    const cookie = cookieFrom(signInResponse);
    expect(cookie).toContain('notio.session_token');

    const session = await call(app, `${AUTH_BASE_PATH}/get-session`, { cookie });
    expect(session.status).toBe(200);
    expect(await session.json()).toMatchObject({ user: { email, emailVerified: true } });

    const signOut = await call(app, `${AUTH_BASE_PATH}/sign-out`, { method: 'POST', cookie });
    expect(signOut.status).toBe(200);
    expect(signOut.headers.getSetCookie().join(';')).toContain('notio.session_token=;');

    // После выхода сессии нет: Better Auth отвечает 200 c null либо 401.
    const afterSignOut = await call(app, `${AUTH_BASE_PATH}/get-session`, { cookie });
    const sessionAfterSignOut = await afterSignOut.json();
    expect(sessionAfterSignOut === null || afterSignOut.status === 401).toBe(true);
  });

  it('не пускает с неверным паролем', async () => {
    const { app, email, verificationUrl } = await signUp('wrong-pass');
    await verify(app, verificationUrl);

    const response = await signInWithPassword(app, email, 'wrong-password-here');

    expect(response.status).toBe(401);
  });

  it('не создаёт сессию для неизвестного пользователя', async () => {
    const app = createTestApp([]);

    const response = await signInWithPassword(app, uniqueEmail('ghost'));

    expect(response.status).toBe(401);
  });

  it('отклоняет слишком короткий пароль', async () => {
    const app = createTestApp([]);

    const response = await call(app, `${AUTH_BASE_PATH}/sign-up/email`, {
      body: { email: uniqueEmail('short'), password: 'short', name: 'Короткий' },
    });

    expect(response.status).toBe(400);
  });

  it('нормализует email в нижний регистр', async () => {
    const app = createTestApp([]);
    const email = uniqueEmail('Case');

    await call(app, `${AUTH_BASE_PATH}/sign-up/email`, {
      body: { email: email.toUpperCase(), password: 'correct-horse-battery', name: 'Маша' },
    });

    const stored = await env.DB.prepare('SELECT email FROM user').all<{ email: string }>();

    expect(stored.results.map((row) => row.email)).toContain(email.toLowerCase());
    expect(stored.results.map((row) => row.email)).not.toContain(email);
  });
});

describe('JWT и JWKS', () => {
  it('отдаёт JWKS с ключами подписи', async () => {
    const app = createTestApp([]);

    const response = await call(app, JWKS_PATH);
    const jwks = (await response.json()) as { keys: { kty?: string }[] };

    expect(response.status).toBe(200);
    expect(Array.isArray(jwks.keys)).toBe(true);
  });

  it('выдаёт JWT по сессии', async () => {
    const { app, email, verificationUrl } = await signUp('token');
    await verify(app, verificationUrl);

    const cookie = cookieFrom(await signInWithPassword(app, email));
    const token = await call(app, TOKEN_PATH, { cookie });
    const body = (await token.json()) as { token?: string };

    expect(token.status).toBe(200);
    expect(body.token).toBeTypeOf('string');
    expect(body.token?.split('.')).toHaveLength(3);
  });

  it('не выдаёт JWT без сессии', async () => {
    const app = createTestApp([]);

    const response = await call(app, TOKEN_PATH);

    expect(response.status).toBe(401);
  });
});
