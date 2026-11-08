import { describe, expect, it } from 'vitest';
import { createWorkspaceService } from '../src/services/workspace.service';
import { TEST_ENV } from './helpers';

describe('failure branches', () => {
  it('fails when auth-service is unavailable while reading members', async () => {
    const env = {
      ...TEST_ENV,
      AUTH_SERVICE: {
        fetch: async () => new Response('boom', { status: 500 }),
      } as unknown as Fetcher,
    };

    const service = createWorkspaceService(env, () => new Date());
    const workspace = await service.create('00000000-0000-4000-8000-00000000000a', {
      name: 'Project',
    });

    await expect(
      service.listMembers(workspace.id, '00000000-0000-4000-8000-00000000000a'),
    ).rejects.toThrow(/auth-service did not return profiles/);
  });

  it('takes limits from the configuration and falls back to defaults on garbage', async () => {
    const env = {
      ...TEST_ENV,
      INVITATION_TTL_DAYS: 'lots',
      ARCHIVE_RETENTION_DAYS: '-3',
      MAX_ACTIVE_INVITATIONS: '',
    };

    const service = createWorkspaceService(env, () => new Date());
    const workspace = await service.create('00000000-0000-4000-8000-00000000000a', {
      name: 'Project',
    });

    // Garbage invitation limit from the config → the default (20) is used,
    // and the invitation is created successfully.
    const invitation = await service.createInvitation(
      workspace.id,
      '00000000-0000-4000-8000-00000000000a',
      {
        role: 'viewer',
      },
    );

    expect(invitation).toBeDefined();
  });

  it('does not delete an archive whose retention has not expired yet', async () => {
    const owner = '00000000-0000-4000-8000-00000000000a';
    const service = createWorkspaceService(TEST_ENV, () => new Date());
    const workspace = await service.create(owner, { name: 'Project' });
    await service.archive(workspace.id, owner);

    const removed = await service.purgeExpired();

    expect(removed).toBe(0);
  });
});
