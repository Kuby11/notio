// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { failsWith, gatewayStub, renderWithProviders } from '../../../../../test/auth-fixture';
import { AuthError } from '../../types/errors';
import { LoginForm } from './login-form';

/**
 * Component tests of the form: we check user behaviour, not implementation
 * details — the network and the container are replaced, everything else is real.
 */

const { push } = vi.hoisted(() => ({ push: vi.fn<(path: string) => void>() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn<() => void>() }),
}));

beforeEach(() => {
  push.mockClear();
});

describe('LoginForm', () => {
  it('shows field errors and skips the network when the form is invalid', async () => {
    const user = userEvent.setup();
    const gateway = gatewayStub();
    renderWithProviders(<LoginForm />, gateway);

    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    // Leave the password empty: the form must show both errors at once.
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText("This email doesn't look right")).toBeInTheDocument();
    expect(screen.getByText('Enter a password')).toBeInTheDocument();
    expect(gateway.signIn).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('signs in and navigates to the home page on success', async () => {
    const user = userEvent.setup();
    const gateway = gatewayStub();
    renderWithProviders(<LoginForm />, gateway);

    await user.type(screen.getByLabelText('Email'), '  User@Notio.Dev ');
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/'));

    // The email is normalised before submit: without it accounts duplicate by case.
    expect(gateway.signIn).toHaveBeenCalledWith({
      email: 'user@notio.dev',
      password: 'correct-horse-battery',
    });
  });

  it('shows the domain error message instead of navigating', async () => {
    const user = userEvent.setup();
    const gateway = gatewayStub({
      signIn: failsWith(
        new AuthError('EMAIL_NOT_VERIFIED', 'Confirm your email via the link we sent'),
      ),
    });
    renderWithProviders(<LoginForm />, gateway);

    await user.type(screen.getByLabelText('Email'), 'user@notio.dev');
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Confirm your email via the link we sent',
    );
    expect(push).not.toHaveBeenCalled();
  });

  it('stays keyboard accessible: field labels are bound to the inputs', async () => {
    renderWithProviders(<LoginForm />, gatewayStub());

    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password');
  });
});
