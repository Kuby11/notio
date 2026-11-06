import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '../messages/en.json';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi, type Mock } from 'vitest';
import { ContainerProvider, createContainer, type ContainerOverrides } from '../src/core/container';
import type {
  AuthError,
  AuthGateway,
  AuthSession,
  Credentials,
  SignUpInput,
} from '../src/modules/auth';

/** Shared fixtures for component tests.
 * Network and container are replaced, while forms and hooks are real:
 * the test checks user behaviour, not a mock.
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

/** Auth port with typed mocks for every call. */
export function gatewayStub(overrides: Partial<AuthGateway> = {}): AuthGatewayStub {
  return {
    signUp: vi.fn<SignUpGetter>(async () => undefined),
    signIn: vi.fn<CredentialsGetter>(async () => undefined),
    signOut: vi.fn<AsyncVoid>(async () => undefined),
    currentSession: vi.fn<SessionGetter>(async () => null),
    accessToken: vi.fn<TokenGetter>(async () => null),
    updateUser: vi.fn<AuthGateway['updateUser']>(async () => SESSION.user),
    changeEmail: vi.fn<AuthGateway['changeEmail']>(async () => undefined),
    changePassword: vi.fn<AuthGateway['changePassword']>(async () => undefined),
    deleteAccount: vi.fn<AuthGateway['deleteAccount']>(async () => undefined),
    ...overrides,
  } as AuthGatewayStub;
}

/** Argument-less call mock that fails with the given domain error. */
export function failsWith(error: AuthError): Mock<AsyncVoid> {
  return vi.fn<AsyncVoid>(async () => {
    throw error;
  });
}

/** Session request mock that fails with the given domain error. */
export function sessionFailsWith(error: AuthError): Mock<SessionGetter> {
  return vi.fn<SessionGetter>(async () => {
    throw error;
  });
}

/** Session mock: handy when the state is fixed. */
export function sessionOf(session: AuthSession | null): Mock<SessionGetter> {
  return vi.fn<SessionGetter>(async () => session);
}

/** Renders a component inside the query and dependency-injection providers.
 * Retries are off: tests wait for a specific outcome, not "try again".
 */

export const TEST_MESSAGES = enMessages;

export function renderWithIntl(ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale="ru" messages={TEST_MESSAGES}>
      {ui}
    </NextIntlClientProvider>,
  );
}

export function renderWithProviders(
  ui: ReactElement,
  gateway: AuthGateway,
  overrides: ContainerOverrides = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <NextIntlClientProvider locale="ru" messages={TEST_MESSAGES}>
      <QueryClientProvider client={queryClient}>
        <ContainerProvider container={createContainer(gateway, overrides)}>{ui}</ContainerProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}
