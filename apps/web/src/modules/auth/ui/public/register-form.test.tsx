// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { failsWith, gatewayStub, renderWithProviders } from '../../../../../test/auth-fixture';
import { AuthError } from '../../types/errors';
import { RegisterForm } from './register-form';

describe('RegisterForm', () => {
  it('requires a name, an email, and a password of sufficient length', async () => {
    const user = userEvent.setup();
    const gateway = gatewayStub();
    renderWithProviders(<RegisterForm />, gateway);

    await user.type(screen.getByLabelText('Name'), 'A');
    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Name must be at least 2 characters')).toBeInTheDocument();
    expect(screen.getByText("This email doesn't look right")).toBeInTheDocument();
    expect(screen.getByText('Password must be at least 12 characters')).toBeInTheDocument();
    expect(gateway.signUp).not.toHaveBeenCalled();
  });

  it('creates an account and asks to confirm the email', async () => {
    const user = userEvent.setup();
    const gateway = gatewayStub();
    renderWithProviders(<RegisterForm />, gateway);

    await user.type(screen.getByLabelText('Name'), 'Anna');
    await user.type(screen.getByLabelText('Email'), 'User@Notio.Dev');
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'We sent a confirmation link to user@notio.dev. Open it, then sign in.',
    );
    expect(gateway.signUp).toHaveBeenCalledWith({
      name: 'Anna',
      email: 'user@notio.dev',
      password: 'correct-horse-battery',
    });
  });

  it('shows the server rejection about a taken email', async () => {
    const user = userEvent.setup();
    const gateway = gatewayStub({
      signUp: failsWith(new AuthError('EMAIL_TAKEN', 'An account with this email already exists')),
    });
    renderWithProviders(<RegisterForm />, gateway);

    await user.type(screen.getByLabelText('Name'), 'Anna');
    await user.type(screen.getByLabelText('Email'), 'user@notio.dev');
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'An account with this email already exists',
      ),
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
