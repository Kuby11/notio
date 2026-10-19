// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { failsWith, gatewayStub, renderWithProviders } from '../../../../../test/auth-fixture';
import { AuthError } from '../../types/errors';
import { RegisterForm } from './register-form';

describe('RegisterForm', () => {
  it('требует имя, почту и пароль достаточной длины', async () => {
    const user = userEvent.setup();
    const gateway = gatewayStub();
    renderWithProviders(<RegisterForm />, gateway);

    await user.type(screen.getByLabelText('Имя'), 'А');
    await user.type(screen.getByLabelText('Почта'), 'не-почта');
    await user.type(screen.getByLabelText('Пароль'), 'коротко');
    await user.click(screen.getByRole('button', { name: 'Создать аккаунт' }));

    expect(await screen.findByText('Имя не короче 2 символов')).toBeInTheDocument();
    expect(screen.getByText('Почта выглядит некорректно')).toBeInTheDocument();
    expect(screen.getByText('Пароль не короче 12 символов')).toBeInTheDocument();
    expect(gateway.signUp).not.toHaveBeenCalled();
  });

  it('создаёт аккаунт и просит подтвердить почту', async () => {
    const user = userEvent.setup();
    const gateway = gatewayStub();
    renderWithProviders(<RegisterForm />, gateway);

    await user.type(screen.getByLabelText('Имя'), 'Аня');
    await user.type(screen.getByLabelText('Почта'), 'User@Notio.Dev');
    await user.type(screen.getByLabelText('Пароль'), 'correct-horse-battery');
    await user.click(screen.getByRole('button', { name: 'Создать аккаунт' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Мы отправили ссылку');
    expect(gateway.signUp).toHaveBeenCalledWith({
      name: 'Аня',
      email: 'user@notio.dev',
      password: 'correct-horse-battery',
    });
  });

  it('показывает отказ сервира о занятом email', async () => {
    const user = userEvent.setup();
    const gateway = gatewayStub({
      signUp: failsWith(new AuthError('EMAIL_TAKEN', 'Аккаунт с такой почтой уже существует')),
    });
    renderWithProviders(<RegisterForm />, gateway);

    await user.type(screen.getByLabelText('Имя'), 'Аня');
    await user.type(screen.getByLabelText('Почта'), 'user@notio.dev');
    await user.type(screen.getByLabelText('Пароль'), 'correct-horse-battery');
    await user.click(screen.getByRole('button', { name: 'Создать аккаунт' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Аккаунт с такой почтой уже существует'),
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
