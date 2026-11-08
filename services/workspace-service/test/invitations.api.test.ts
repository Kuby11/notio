import { describe, expect, it } from 'vitest';
import { createWorkspaceService, INVITATION_TTL_DAYS } from '../src/services/workspace.service';
import { MemberRepository } from '../src/repositories/member.repository';
import { TEST_ENV, call, createWorkspace, jsonOf, newUserId, type WorkspaceBody } from './helpers';

interface InvitationBody {
  id: string;
  token: string;
  role: string;
  inviteUrl: string;
}

async function invite(workspaceId: string, ownerId: string, role: 'editor' | 'viewer' = 'editor') {
  const response = await call(`/workspaces/${workspaceId}/invitations`, {
    body: { role },
    userId: ownerId,
  });

  expect(response.status).toBe(201);

  return jsonOf<InvitationBody>(response);
}

describe('invitation links', () => {
  it('issues a link and adds the acceptor with the invitation role', async () => {
    const owner = newUserId();
    const guest = newUserId();
    const workspace = await createWorkspace(owner, 'Project');
    const invitation = await invite(workspace.id, owner, 'viewer');

    expect(invitation.token).toMatch(/^[0-9a-f]{64}$/);
    expect(invitation.inviteUrl).toContain(`/invite/${invitation.token}`);

    const accepted = await call('/invitations/accept', {
      body: { token: invitation.token },
      userId: guest,
    });
    const member = await jsonOf<{ userId: string; role: string }>(accepted);

    expect(accepted.status).toBe(200);
    expect(member).toMatchObject({ userId: guest, role: 'viewer' });

    // The acceptor sees the workspace in their own list.
    const list = await jsonOf<{ items: WorkspaceBody[] }>(
      await call('/workspaces', { userId: guest }),
    );
    expect(list.items.map((item) => item.id)).toContain(workspace.id);
  });

  it('fills the member profile from auth-service data', async () => {
    const owner = newUserId();
    const workspace = await createWorkspace(owner, 'Project');

    const members = await jsonOf<{ items: { user: { id: string; email: string } }[] }>(
      await call(`/workspaces/${workspace.id}/members`, { userId: owner }),
    );

    expect(members.items[0]?.user.email).toBe(`${owner}@notio.test`);
  });

  it('does not accept the same link twice', async () => {
    const owner = newUserId();
    const first = newUserId();
    const second = newUserId();
    const workspace = await createWorkspace(owner, 'Project');
    const invitation = await invite(workspace.id, owner);

    await call('/invitations/accept', { body: { token: invitation.token }, userId: first });
    const secondAttempt = await call('/invitations/accept', {
      body: { token: invitation.token },
      userId: second,
    });

    expect(secondAttempt.status).toBe(410);
    expect(await secondAttempt.json()).toMatchObject({ code: 'CONFLICT' });
    expect(await new MemberRepository(TEST_ENV).findRole(workspace.id, second)).toBeNull();
  });

  it('rejects an expired link', async () => {
    const owner = newUserId();
    const guest = newUserId();
    const workspace = await createWorkspace(owner, 'Project');
    const invitation = await invite(workspace.id, owner);

    // The link has expired: the scenario clock is moved past INVITATION_TTL_DAYS.
    const afterExpiry = new Date(Date.now() + (INVITATION_TTL_DAYS + 1) * 24 * 60 * 60 * 1000);
    const service = createWorkspaceService(TEST_ENV, () => afterExpiry);

    await expect(service.acceptInvitation(invitation.token, guest)).rejects.toMatchObject({
      status: 410,
    });
    expect(await new MemberRepository(TEST_ENV).findRole(workspace.id, guest)).toBeNull();
  });

  it('does not find a nonexistent token', async () => {
    const response = await call('/invitations/accept', {
      body: { token: 'a'.repeat(64) },
      userId: newUserId(),
    });

    expect(response.status).toBe(404);
  });

  it('does not issue an invitation without the owner right', async () => {
    const owner = newUserId();
    const editor = newUserId();
    const workspace = await createWorkspace(owner, 'Project');
    await new MemberRepository(TEST_ENV).upsert(
      workspace.id,
      editor,
      'editor',
      new Date().toISOString(),
    );

    const response = await call(`/workspaces/${workspace.id}/invitations`, {
      body: { role: 'viewer' },
      userId: editor,
    });

    expect(response.status).toBe(403);
  });

  it('does not grant the owner role through an invitation', async () => {
    const owner = newUserId();
    const workspace = await createWorkspace(owner, 'Project');

    const response = await call(`/workspaces/${workspace.id}/invitations`, {
      body: { role: 'owner' },
      userId: owner,
    });

    expect(response.status).toBe(400);
  });

  it('respects the active invitation limit', async () => {
    const owner = newUserId();
    const workspace = await createWorkspace(owner, 'Project');
    const max = Number.parseInt(TEST_ENV.MAX_ACTIVE_INVITATIONS ?? '20', 10);

    for (let index = 0; index < max; index += 1) {
      await invite(workspace.id, owner);
    }

    const overflow = await call(`/workspaces/${workspace.id}/invitations`, {
      body: { role: 'viewer' },
      userId: owner,
    });

    expect(overflow.status).toBe(409);
    expect(await overflow.json()).toMatchObject({ code: 'CONFLICT' });
  });

  it('lets the owner revoke an invitation', async () => {
    const owner = newUserId();
    const guest = newUserId();
    const workspace = await createWorkspace(owner, 'Project');
    const invitation = await invite(workspace.id, owner);

    const revoked = await call(`/workspaces/${workspace.id}/invitations/${invitation.token}`, {
      method: 'DELETE',
      userId: owner,
    });
    const acceptAfterRevoke = await call('/invitations/accept', {
      body: { token: invitation.token },
      userId: guest,
    });

    expect(revoked.status).toBe(204);
    expect(acceptAfterRevoke.status).toBe(404);
  });

  it('hides invitations from a stranger', async () => {
    const owner = newUserId();
    const stranger = newUserId();
    const workspace = await createWorkspace(owner, 'Project');
    await invite(workspace.id, owner);

    const response = await call(`/workspaces/${workspace.id}/invitations`, { userId: stranger });

    expect(response.status).toBe(404);
  });
});

describe('member management', () => {
  it('changes the role of a member', async () => {
    const owner = newUserId();
    const editor = newUserId();
    const workspace = await createWorkspace(owner, 'Project');
    const link = await invite(workspace.id, owner);

    await call('/invitations/accept', { body: { token: link.token }, userId: editor });

    const response = await call(`/workspaces/${workspace.id}/members/${editor}`, {
      method: 'PATCH',
      body: { role: 'viewer' },
      userId: owner,
    });

    expect(response.status).toBe(200);
    expect(await new MemberRepository(TEST_ENV).findRole(workspace.id, editor)).toBe('viewer');
  });

  it('does not allow removing the last owner', async () => {
    const owner = newUserId();
    const workspace = await createWorkspace(owner, 'Project');

    const demote = await call(`/workspaces/${workspace.id}/members/${owner}`, {
      method: 'PATCH',
      body: { role: 'viewer' },
      userId: owner,
    });
    const remove = await call(`/workspaces/${workspace.id}/members/${owner}`, {
      method: 'DELETE',
      userId: owner,
    });

    expect(demote.status).toBe(400);
    expect(remove.status).toBe(400);
    expect(await new MemberRepository(TEST_ENV).findRole(workspace.id, owner)).toBe('owner');
  });

  it('lets ownership pass to a second member and the first be demoted', async () => {
    const first = newUserId();
    const second = newUserId();
    const workspace = await createWorkspace(first, 'Project');
    await new MemberRepository(TEST_ENV).upsert(
      workspace.id,
      second,
      'editor',
      new Date().toISOString(),
    );

    const promote = await call(`/workspaces/${workspace.id}/members/${second}`, {
      method: 'PATCH',
      body: { role: 'owner' },
      userId: first,
    });
    const demoteFirst = await call(`/workspaces/${workspace.id}/members/${first}`, {
      method: 'PATCH',
      body: { role: 'editor' },
      userId: second,
    });

    expect(promote.status).toBe(200);
    expect(demoteFirst.status).toBe(200);
    expect(await new MemberRepository(TEST_ENV).findRole(workspace.id, first)).toBe('editor');
  });

  it('removes a member at the initiative of the owner', async () => {
    const owner = newUserId();
    const guest = newUserId();
    const workspace = await createWorkspace(owner, 'Project');
    const link = await invite(workspace.id, owner);
    await call('/invitations/accept', { body: { token: link.token }, userId: guest });

    const response = await call(`/workspaces/${workspace.id}/members/${guest}`, {
      method: 'DELETE',
      userId: owner,
    });

    expect(response.status).toBe(204);
    expect(await new MemberRepository(TEST_ENV).findRole(workspace.id, guest)).toBeNull();
  });

  it('does not let editor manage members', async () => {
    const owner = newUserId();
    const editor = newUserId();
    const workspace = await createWorkspace(owner, 'Project');
    await new MemberRepository(TEST_ENV).upsert(
      workspace.id,
      editor,
      'editor',
      new Date().toISOString(),
    );

    const response = await call(`/workspaces/${workspace.id}/members/${owner}`, {
      method: 'DELETE',
      userId: editor,
    });

    expect(response.status).toBe(403);
  });
});
