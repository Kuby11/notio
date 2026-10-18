import { describe, expect, it } from 'vitest';
import { createWorkspaceService } from '../src/services/workspace.service';
import { TEST_ENV } from './helpers';

describe('ветви сбоев', () => {
  it('отдаёт ошибку, если auth-service недоступен при чтении участников', async () => {
    const env = {
      ...TEST_ENV,
      AUTH_SERVICE: {
        fetch: async () => new Response('boom', { status: 500 }),
      } as unknown as Fetcher,
    };

    const service = createWorkspaceService(env, () => new Date());
    const workspace = await service.create('00000000-0000-4000-8000-00000000000a', {
      name: 'Проект',
    });

    await expect(
      service.listMembers(workspace.id, '00000000-0000-4000-8000-00000000000a'),
    ).rejects.toThrow(/auth-service не отдал профили/);
  });

  it('берёт сроки из конфигурации, а при мусоре — из значений по умолчанию', async () => {
    const env = {
      ...TEST_ENV,
      INVITATION_TTL_DAYS: 'много',
      ARCHIVE_RETENTION_DAYS: '-3',
      MAX_ACTIVE_INVITATIONS: '',
    };

    const service = createWorkspaceService(env, () => new Date());
    const workspace = await service.create('00000000-0000-4000-8000-00000000000a', {
      name: 'Проект',
    });

    // Лимит приглашений из конфига мусорный → берётся значение по умолчанию (20),
    // приглашение создаётся успешно.
    const invitation = await service.createInvitation(
      workspace.id,
      '00000000-0000-4000-8000-00000000000a',
      {
        role: 'viewer',
      },
    );

    expect(invitation).toBeDefined();
  });

  it('не удаляет архив, если срок ретенции ещё не истёк', async () => {
    const owner = '00000000-0000-4000-8000-00000000000a';
    const service = createWorkspaceService(TEST_ENV, () => new Date());
    const workspace = await service.create(owner, { name: 'Проект' });
    await service.archive(workspace.id, owner);

    const removed = await service.purgeExpired();

    expect(removed).toBe(0);
  });
});
