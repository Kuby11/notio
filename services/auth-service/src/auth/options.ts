import type { BetterAuthOptions, SecondaryStorage } from 'better-auth';
import { betterAuth } from 'better-auth';
import { jwt } from 'better-auth/plugins';
import type { Bindings } from '../env';
import { requireAuthSecret } from '../env';
import type { MailSender } from './mailer';

export const AUTH_BASE_PATH = '/api/auth';

/** Эндпоинт с открытыми ключами: gateway проверяет по нему подпись токена. */
export const JWKS_PATH = '/api/auth/jwks';

/** Эндпоинт выдачи JWT активной сессии. */
export const TOKEN_PATH = '/api/auth/token';

export interface AuthDependencies {
  mailSender: MailSender;
  /** Куда ссылаться в письмах: в dev — на локальный фронтенд. */
  publicUrl: string;
  /**
   * Адаптер базы. В Workers — Drizzle поверх D1 со сгенерированной схемой
   * (`@better-auth/cli generate`), в CLI — заглушка для генерации схемы.
   */
  database: BetterAuthOptions['database'];
  /** KV для rate limit и cookie-кэша. */
  secondaryStorage: SecondaryStorage;
  log?: (message: string) => void;
}

const DEFAULT_RATE_LIMIT_MAX = 20;
const DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 60;

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * OAuth-провайдер включается только при наличии client id и secret:
 * без них Better Auth не должен ни падать на старте, ни предлагать вход,
 * который невозможно завершить.
 */
function socialProviders(env: Bindings): BetterAuthOptions['socialProviders'] {
  const providers: NonNullable<BetterAuthOptions['socialProviders']> = {};

  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    providers.github = {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    };
  }

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    providers.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    };
  }

  return providers;
}

/**
 * Origin'ы, которым сервис доверяет: собственный адрес и явно перечисленные.
 *
 * Better Auth сверяет Origin на изменяющих запросах: без списка вход
 * с фронтенда на другом порту считался бы подделкой (CSRF-защита).
 */
function trustedOrigins(env: Bindings, publicUrl: string): string[] {
  const own = new URL(publicUrl).origin;
  const extra = (env.TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return [...new Set([own, ...extra])];
}

/**
 * Единая сборка опций Better Auth.
 *
 * Функция чистая: не обращается к базе и не требует Workers-окружения.
 * Благодаря этому же объект использует CLI для генерации схемы
 * (`@better-auth/cli generate`), который работает в Node.
 */
export function buildAuthOptions(env: Bindings, deps: AuthDependencies): BetterAuthOptions {
  const log = deps.log ?? ((message: string) => console.log(message));

  return {
    appName: 'notio',
    baseURL: deps.publicUrl,
    basePath: AUTH_BASE_PATH,
    secret: requireAuthSecret(env),

    // База: Drizzle поверх D1 со схемой, сгенерированной Better Auth CLI.
    database: deps.database,

    // Счётчики rate limit живут в KV, а не в памяти изолята: один и тот же
    // пользователь попадает в разные инстансы Workers.
    secondaryStorage: deps.secondaryStorage,

    // Сессия живёт только в httpOnly-cookie, токен браузер не читает.
    // Cookie-кэш отключён намеренно: после выхода из аккаунта кэшированные
    // данные сессии продолжали бы отдавать пользователя ещё несколько минут.
    // Чтение сессии из D1 локально и достаточно быстро.
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: false,
      sendResetPassword: async ({ user, url }) => {
        await deps.mailSender.send({
          to: user.email,
          kind: 'RESET_PASSWORD',
          subject: 'Восстановление пароля в notio',
          actionUrl: url,
        });
      },
    },

    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60 * 24,
      sendVerificationEmail: async ({ user, url }) => {
        await deps.mailSender.send({
          to: user.email,
          kind: 'VERIFY_EMAIL',
          subject: 'Подтвердите почту в notio',
          actionUrl: url,
        });
      },
    },

    socialProviders: socialProviders(env),

    // Сессия не создаётся для запросов с чужим Origin: защита от CSRF
    // на уровне origin, а не только на уровне SameSite.
    trustedOrigins: trustedOrigins(env, deps.publicUrl),

    rateLimit: {
      enabled: true,
      window: positiveInt(env.RATE_LIMIT_WINDOW_SECONDS, DEFAULT_RATE_LIMIT_WINDOW_SECONDS),
      max: positiveInt(env.RATE_LIMIT_MAX_REQUESTS, DEFAULT_RATE_LIMIT_MAX),
      storage: 'secondary-storage',
    },

    // JWT нужен межсервисному взаимодействию: gateway проверяет подпись
    // локально по JWKS и не ходит в auth-service на каждый запрос.
    plugins: [
      jwt({
        jwks: {
          // В production закрытый ключ шифруется секретом сервиса: даже при утечке
          // базы его нельзя использовать. В dev шифрование отключено, чтобы
          // смена BETTER_AUTH_SECRET не ломала уже выданные ключи JWKS.
          disablePrivateKeyEncryption: env.ENVIRONMENT !== 'production',
        },
      }),
    ],

    advanced: {
      useSecureCookies: env.ENVIRONMENT === 'production',
      cookiePrefix: 'notio',
      database: {
        // Идентификаторы пользователей и сессий — UUID: внутренние сервисы
        // принимают id только в формате UUID из общего контракта.
        generateId: 'uuid',
      },
      ipAddress: {
        // Лимит считаем по IP, который проставляет Cloudflare, а не по
        // заголовкам, которые клиент мог бы подделать.
        ipAddressHeaders: ['cf-connecting-ip'],
      },
    },

    logger: {
      level: env.ENVIRONMENT === 'production' ? 'error' : 'warn',
      log(level, message, ...args) {
        log(JSON.stringify({ level, service: 'auth-service', message, args }));
      },
    },
  };
}

export { betterAuth };
