// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { failsWith, gatewayStub, renderWithProviders } from '../../../../test/auth-fixture';
import { AuthError } from '../domain/errors';
import { LoginForm } from './login-form';

/**
 * Компонентные тесты формы: проверяем поведение пользователя, а не детали
 * реализации — сеть и контейнер подменены, всё остальное настоящее.
 */

const { push } = vi.hoisted(() => ({ push: vi.fn<(path: string) => void>() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn<() => void>() }),
}));

beforeEach(() => {
  push.mockClear();
});

describe('LoginForm', () => {
  it('показывает ошибки полей и не ходит в сеть при неверной форме', async () => {
    const user = userEvent.setup();
    const gateway = gatewayStub();
    renderWithProviders(<LoginForm />, gateway);

    await user.type(screen.getByLabelText('Почта'), 'не-почта');
    // Пароль оставляем пустым: форма должна показать обе ошибки сразу.
    await user.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByText('Почта выглядит некорректно')).toBeInTheDocument();
    expect(screen.getByText('Укажите пароль')).toBeInTheDocument();
    expect(gateway.signIn).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('входит и уводит на главную по успешному входу', async () => {
    const user = userEvent.setup();
    const gateway = gatewayStub();
    renderWithProviders(<LoginForm />, gateway);

    await user.type(screen.getByLabelText('Почта'), '  User@Notio.Dev ');
    await user.type(screen.getByLabelText('Пароль'), 'correct-horse-battery');
    await user.click(screen.getByRole('button', { name: 'Войти' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/'));

    // Почту нормализуем до отправки: без этого аккаунты дублируются по регистру.
    expect(gateway.signIn).toHaveBeenCalledWith({
      email: 'user@notio.dev',
      password: 'correct-horse-battery',
    });
  });

  it('показывает текст доменной ошибки вместо ухода на страницу', async () => {
    const user = userEvent.setup();
    const gateway = gatewayStub({
      signIn: failsWith(
        new AuthError('EMAIL_NOT_VERIFIED', 'Подтвердите почту по ссылке из письма'),
      ),
    });
    renderWithProviders(<LoginForm />, gateway);

    await user.type(screen.getByLabelText('Почта'), 'user@notio.dev');
    await user.type(screen.getByLabelText('Пароль'), 'correct-horse-battery');
    await user.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Подтвердите почту по ссылке из письма',
    );
    expect(push).not.toHaveBeenCalled();
  });

  it('остаётся доступной с клавиатуры: подписи полей связаны с вводом', async () => {
    renderWithProviders(<LoginForm />, gatewayStub());

    expect(screen.getByLabelText('Почта')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Пароль')).toHaveAttribute('autocomplete', 'current-password');
  });
});
