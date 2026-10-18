// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SESSION,
  failsWith,
  gatewayStub,
  renderWithProviders,
  sessionFailsWith,
  sessionOf,
} from '../../../../../test/auth-fixture';
import { AuthError } from '../../domain/errors';
import { SessionPanel } from './session-panel';

const { push } = vi.hoisted(() => ({ push: vi.fn<(path: string) => void>() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn<() => void>() }),
}));

beforeEach(() => {
  push.mockClear();
});

describe('SessionPanel', () => {
  it('предлагает войти, когда сессии нет', async () => {
    renderWithProviders(<SessionPanel />, gatewayStub());

    expect(await screen.findByText('Вы не вошли')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Войти' })).toHaveAttribute('href', '/login');
  });

  it('показывает пользователя активной сессии', async () => {
    renderWithProviders(<SessionPanel />, gatewayStub({ currentSession: sessionOf(SESSION) }));

    expect(await screen.findByText('Аня')).toBeInTheDocument();
    expect(screen.getByText('user@notio.dev')).toBeInTheDocument();
    expect(screen.getByText('да')).toBeInTheDocument();
  });

  it('выходит и уводит на страницу входа', async () => {
    const user = userEvent.setup();
    const gateway = gatewayStub({ currentSession: sessionOf(SESSION) });
    renderWithProviders(<SessionPanel />, gateway);

    await user.click(await screen.findByRole('button', { name: 'Выйти' }));

    await waitFor(() => expect(gateway.signOut).toHaveBeenCalled());
    expect(push).toHaveBeenCalledWith('/login');
  });

  it('не выдаёт «успешный» выход, если сервис ответил ошибкой', async () => {
    const user = userEvent.setup();
    const gateway = gatewayStub({
      currentSession: sessionOf(SESSION),
      signOut: failsWith(new AuthError('NETWORK_ERROR', 'Сервис недоступен. Проверьте соединение')),
    });
    renderWithProviders(<SessionPanel />, gateway);

    await user.click(await screen.findByRole('button', { name: 'Выйти' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Сервис недоступен');
  });

  it('объясняет, что не удалось проверить сессию', async () => {
    renderWithProviders(
      <SessionPanel />,
      gatewayStub({
        currentSession: sessionFailsWith(
          new AuthError('UNKNOWN', 'Не удалось выполнить вход. Попробуйте снова'),
        ),
      }),
    );

    expect(await screen.findByText('Не удалось проверить сессию')).toBeInTheDocument();
  });
});
