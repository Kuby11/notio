// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  SESSION,
  gatewayStub,
  renderWithProviders,
  sessionOf,
} from '../../../../test/auth-fixture';
import { AuthError, type AuthGateway } from '@/modules/auth';
import { Toaster } from '@/shared/ui/toast';
import { ProfileSection } from './profile-section';

const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn<() => void>(),
    replace: vi.fn<() => void>(),
    back: vi.fn<() => void>(),
    forward: vi.fn<() => void>(),
    refresh: vi.fn<() => void>(),
    prefetch: vi.fn<() => void>(),
  }),
}));

describe('секция профиля', () => {
  it('после сохранения показывает состояние, которое вернул сервис', async () => {
    const user = userEvent.setup();
    const gateway = gatewayStub({
      currentSession: sessionOf(SESSION),
      updateUser: vi.fn<AuthGateway['updateUser']>(async ({ name }) => ({
        ...SESSION.user,
        name: name ?? SESSION.user.name,
      })),
    });

    renderWithProviders(
      <>
        <ProfileSection workspaceId={WORKSPACE_ID} />
        <Toaster />
      </>,
      gateway,
    );

    const input = await screen.findByLabelText('Имя');
    await user.clear(input);
    await user.type(input, 'Ваня');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      expect(gateway.updateUser).toHaveBeenCalledWith({ name: 'Ваня' });
    });

    expect(await screen.findByDisplayValue('Ваня')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(await screen.findByText('Профиль обновлён')).toBeInTheDocument();
  });

  it('показывает ошибку, если сохранить профиль не удалось', async () => {
    const user = userEvent.setup();
    const gateway = gatewayStub({
      currentSession: sessionOf(SESSION),
      updateUser: vi.fn<AuthGateway['updateUser']>(async () => {
        throw new AuthError('NETWORK_ERROR', 'NETWORK_ERROR');
      }),
    });

    renderWithProviders(
      <>
        <ProfileSection workspaceId={WORKSPACE_ID} />
        <Toaster />
      </>,
      gateway,
    );

    const input = await screen.findByLabelText('Имя');
    await user.clear(input);
    await user.type(input, 'Ваня');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Сервис недоступен');
    // The field keeps what the user typed: nothing was stored.
    expect(screen.getByLabelText('Имя')).toHaveValue('Ваня');
  });
});
