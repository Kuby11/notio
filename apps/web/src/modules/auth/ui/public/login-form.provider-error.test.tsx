// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { gatewayStub, renderWithProviders } from '../../../../../test/auth-fixture';
import { LoginForm } from './login-form';

// The form navigates after a successful sign-in: outside AppRouter the test substitutes navigation.
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn<() => void>(),
    replace: vi.fn<() => void>(),
    back: vi.fn<() => void>(),
    forward: vi.fn<() => void>(),
    refresh: vi.fn<() => void>(),
    prefetch: vi.fn<(href: string) => void>(),
  }),
  usePathname: () => '/login',
}));

describe('LoginForm: возврат после OAuth', () => {
  it('объясняет отказ провайдера вместо молчаливого возврата', () => {
    renderWithProviders(<LoginForm providerError="access_denied" />, gatewayStub());

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The provider declined the sign-in. Allow access and try again',
    );
  });

  it('истёкшую попытку показывает как истечение, а не как отказ', () => {
    renderWithProviders(<LoginForm providerError="state_mismatch" />, gatewayStub());

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The sign-in attempt expired. Please try again',
    );
  });

  it('без ?error= сообщения нет', () => {
    renderWithProviders(<LoginForm />, gatewayStub());

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
