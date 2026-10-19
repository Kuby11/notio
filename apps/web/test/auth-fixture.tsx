import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi, type Mock } from 'vitest';
import { ContainerProvider, createContainer } from '../src/core/container';
import type {
  AuthError,
  AuthGateway,
  AuthSession,
  Credentials,
  SignUpInput,
} from '../src/modules/auth';

/**
 * Общие фикстуры для компонентных тестов.
 *
 * Сеть и контейнер подменяются, а формы, хуки и use cases — настоящие:
 * тест проверяет поведение пользователя, а не мок.
 */

type AsyncVoid = () => Promise<void>;
type SessionGetter = () => Promise<AuthSession | null>;
type TokenGetter = () => Promise<string | null>;
type CredentialsGetter = (credentials: Credentials) => Promise<void>;
type SignUpGetter = (input: SignUpInput) => Promise<void>;

export type AuthGatewayStub = AuthGateway & {
  signIn: Mock<CredentialsGetter>;
  signUp: Mock<SignUpGetter>;
  signOut: Mock<AsyncVoid>;
  currentSession: Mock<SessionGetter>;
  accessToken: Mock<TokenGetter>;
};

export const SESSION: AuthSession = {
  user: { id: 'user-1', email: 'user@notio.dev', name: 'Аня', emailVerified: true },
  expiresAt: '2026-10-19T00:00:00.000Z',
};

/** Порт аутентификации с типизированными моками всех вызовов. */
export function gatewayStub(overrides: Partial<AuthGateway> = {}): AuthGatewayStub {
  return {
    signUp: vi.fn<SignUpGetter>(async () => undefined),
    signIn: vi.fn<CredentialsGetter>(async () => undefined),
    signOut: vi.fn<AsyncVoid>(async () => undefined),
    currentSession: vi.fn<SessionGetter>(async () => null),
    accessToken: vi.fn<TokenGetter>(async () => null),
    ...overrides,
  } as AuthGatewayStub;
}

/** Мок вызова без аргументов, который падает с заданной доменной ошибкой. */
export function failsWith(error: AuthError): Mock<AsyncVoid> {
  return vi.fn<AsyncVoid>(async () => {
    throw error;
  });
}

/** Мок запроса сессии, который падает с заданной доменной ошибкой. */
export function sessionFailsWith(error: AuthError): Mock<SessionGetter> {
  return vi.fn<SessionGetter>(async () => {
    throw error;
  });
}

/** Мок сессии: удобно, когда состояние фиксировано. */
export function sessionOf(session: AuthSession | null): Mock<SessionGetter> {
  return vi.fn<SessionGetter>(async () => session);
}

/**
 * Рендерит компонент внутри провайдеров запросов и внедрения зависимостей.
 * Повторы отключены: в тестах мы ждём конкретный исход, а не «попробуем ещё раз».
 */
export function renderWithProviders(ui: ReactElement, gateway: AuthGateway) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ContainerProvider container={createContainer(gateway)}>{ui}</ContainerProvider>
    </QueryClientProvider>,
  );
}
