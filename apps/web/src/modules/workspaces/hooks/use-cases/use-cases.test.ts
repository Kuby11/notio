import { describe, expect, it } from 'vitest';
import { CreateWorkspace } from './create-workspace';
import { RenameWorkspace } from './rename-workspace';
import { ArchiveWorkspace } from './archive-workspace';
import { ChangeMemberRole } from './change-member-role';
import { RemoveMember } from './remove-member';
import { CreateInvitation } from './create-invitation';
import { RevokeInvitation } from './revoke-invitation';
import { AcceptInvitation } from './accept-invitation';
import { ListWorkspaces } from './list-workspaces';
import { ListMembers } from './list-members';
import type { WorkspaceGateway } from '../../types/ports';

/**
 * In-memory порт: use cases тестируются без React и без сети.
 */
class InMemoryWorkspaceGateway implements WorkspaceGateway {
  workspaces: {
    id: string;
    name: string;
    slug: string;
    ownerId: string;
    archivedAt: string | null;
    createdAt: string;
    updatedAt: string;
    currentUserRole: 'owner' | 'editor' | 'viewer' | null;
  }[] = [];
  members: {
    workspaceId: string;
    userId: string;
    role: 'owner' | 'editor' | 'viewer';
    user: { id: string; email: string; name: string };
    createdAt: string;
    updatedAt: string;
  }[] = [];
  invitations: {
    id: string;
    workspaceId: string;
    role: 'editor' | 'viewer';
    token: string;
    invitedEmail: string | null;
    inviteUrl: string;
    createdBy: string;
    expiresAt: string;
    acceptedAt: string | null;
    createdAt: string;
  }[] = [];

  async list() {
    return this.workspaces;
  }
  async create(name: string) {
    const ws = {
      id: `ws-${this.workspaces.length + 1}`,
      name,
      slug: name.toLowerCase(),
      ownerId: 'user-1',
      archivedAt: null,
      createdAt: '2026-10-18T00:00:00.000Z',
      updatedAt: '2026-10-18T00:00:00.000Z',
      currentUserRole: 'owner' as const,
    };
    this.workspaces.push(ws);
    return ws as never;
  }
  async rename(id: string, name: string) {
    const ws = this.workspaces.find((w) => w.id === id)!;
    ws.name = name;
    return ws as never;
  }
  async archive(id: string) {
    const ws = this.workspaces.find((w) => w.id === id)!;
    ws.archivedAt = '2026-10-18T00:00:00.000Z';
    return ws as never;
  }

  async restore(id: string) {
    const ws = this.workspaces.find((w) => w.id === id)!;
    ws.archivedAt = null;
    return ws as never;
  }
  async listMembers(workspaceId: string) {
    return this.members.filter((m) => m.workspaceId === workspaceId);
  }
  async changeRole(workspaceId: string, userId: string, role: 'owner' | 'editor' | 'viewer') {
    const m = this.members.find(
      (member) => member.workspaceId === workspaceId && member.userId === userId,
    )!;
    m.role = role;
    return m as never;
  }
  async removeMember(workspaceId: string, userId: string) {
    this.members = this.members.filter(
      (m) => !(m.workspaceId === workspaceId && m.userId === userId),
    );
  }
  async createInvitation(workspaceId: string, role: 'editor' | 'viewer') {
    const inv = {
      id: `inv-${this.invitations.length + 1}`,
      workspaceId,
      role,
      token: 'token-123',
      invitedEmail: null,
      inviteUrl: 'http://localhost:3000/invite/token-123',
      createdBy: 'user-1',
      expiresAt: '2026-10-25T00:00:00.000Z',
      acceptedAt: null,
      createdAt: '2026-10-18T00:00:00.000Z',
    };
    this.invitations.push(inv);
    return inv as never;
  }
  async revokeInvitation(workspaceId: string, token: string) {
    this.invitations = this.invitations.filter(
      (i) => !(i.workspaceId === workspaceId && i.token === token),
    );
  }
  async acceptInvitation(token: string) {
    const inv = this.invitations.find((i) => i.token === token)!;
    const m = {
      workspaceId: inv.workspaceId,
      userId: 'user-2',
      role: inv.role,
      user: { id: 'user-2', email: 'user2@notio.dev', name: 'User 2' },
      createdAt: '2026-10-18T00:00:00.000Z',
      updatedAt: '2026-10-18T00:00:00.000Z',
    };
    this.members.push(m);
    return m as never;
  }
}

describe('CreateWorkspace', () => {
  it('создаёт workspace с обрезанным именем', async () => {
    const gateway = new InMemoryWorkspaceGateway();

    const ws = await new CreateWorkspace(gateway).execute('  Мой офис  ');

    expect(ws.name).toBe('Мой офис');
  });

  it('не создаёт workspace с пустым именем', async () => {
    const gateway = new InMemoryWorkspaceGateway();

    expect(() => new CreateWorkspace(gateway).execute('   ')).toThrow(
      /Название не может быть пустым/,
    );
  });
});

describe('RenameWorkspace', () => {
  it('переименовывает workspace', async () => {
    const gateway = new InMemoryWorkspaceGateway();
    await gateway.create('Старое');

    const ws = await new RenameWorkspace(gateway).execute('ws-1', '  Новое  ');

    expect(ws.name).toBe('Новое');
  });

  it('отклоняет пустое имя', async () => {
    const gateway = new InMemoryWorkspaceGateway();

    expect(() => new RenameWorkspace(gateway).execute('ws-1', '')).toThrow(
      /Название не может быть пустым/,
    );
  });
});

describe('ArchiveWorkspace', () => {
  it('архивирует workspace', async () => {
    const gateway = new InMemoryWorkspaceGateway();
    await gateway.create('Тест');

    await expect(new ArchiveWorkspace(gateway).execute('ws-1')).resolves.toBeDefined();
  });
});

describe('ChangeMemberRole', () => {
  it('меняет роль участника', async () => {
    const gateway = new InMemoryWorkspaceGateway();
    gateway.members.push({
      workspaceId: 'ws-1',
      userId: 'u2',
      role: 'viewer',
      user: { id: 'u2', email: 'u2@notio.dev', name: 'U2' },
      createdAt: '',
      updatedAt: '',
    });

    const member = await new ChangeMemberRole(gateway).execute('ws-1', 'u2', 'editor');

    expect(member.role).toBe('editor');
  });
});

describe('RemoveMember', () => {
  it('удаляет участника', async () => {
    const gateway = new InMemoryWorkspaceGateway();
    gateway.members.push({
      workspaceId: 'ws-1',
      userId: 'u2',
      role: 'viewer',
      user: { id: 'u2', email: 'u2@notio.dev', name: 'U2' },
      createdAt: '',
      updatedAt: '',
    });

    await new RemoveMember(gateway).execute('ws-1', 'u2');

    expect(gateway.members).toHaveLength(0);
  });
});

describe('CreateInvitation', () => {
  it('создаёт приглашение', async () => {
    const gateway = new InMemoryWorkspaceGateway();

    const invitation = await new CreateInvitation(gateway).execute('ws-1', 'editor');

    expect(invitation.role).toBe('editor');
    expect(gateway.invitations).toHaveLength(1);
  });
});

describe('RevokeInvitation', () => {
  it('отзывает приглашение', async () => {
    const gateway = new InMemoryWorkspaceGateway();
    await gateway.createInvitation('ws-1', 'viewer');

    await new RevokeInvitation(gateway).execute('ws-1', 'token-123');

    expect(gateway.invitations).toHaveLength(0);
  });
});

describe('AcceptInvitation', () => {
  it('принимает приглашение', async () => {
    const gateway = new InMemoryWorkspaceGateway();
    await gateway.createInvitation('ws-1', 'viewer');

    const member = await new AcceptInvitation(gateway).execute('token-123');

    expect(member.userId).toBe('user-2');
    expect(member.role).toBe('viewer');
  });
});

describe('ListWorkspaces', () => {
  it('возвращает список workspace', async () => {
    const gateway = new InMemoryWorkspaceGateway();
    await gateway.create('Тест');

    const list = await new ListWorkspaces(gateway).execute();

    expect(list).toHaveLength(1);
  });
});

describe('ListMembers', () => {
  it('возвращает участников workspace', async () => {
    const gateway = new InMemoryWorkspaceGateway();
    gateway.members.push({
      workspaceId: 'ws-1',
      userId: 'u2',
      role: 'viewer',
      user: { id: 'u2', email: 'u2@notio.dev', name: 'U2' },
      createdAt: '',
      updatedAt: '',
    });

    const members = await new ListMembers(gateway).execute('ws-1');

    expect(members).toHaveLength(1);
  });
});
