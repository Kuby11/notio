import { describe, expect, it } from 'vitest';
import {
  assertWorkspaceName,
  capabilitiesOf,
  isInvitableRole,
  roleLabel,
  INVITABLE_ROLES,
} from './rules';

describe('capabilitiesOf', () => {
  it('owner может всё', () => {
    expect(capabilitiesOf('owner')).toEqual({
      canRename: true,
      canArchive: true,
      canManageMembers: true,
      canInvite: true,
    });
  });

  it('editor и viewer не управляют workspace', () => {
    for (const role of ['editor', 'viewer'] as const) {
      expect(capabilitiesOf(role)).toEqual({
        canRename: false,
        canArchive: false,
        canManageMembers: false,
        canInvite: false,
      });
    }
  });

  it('без роли — ничего нельзя', () => {
    expect(capabilitiesOf(null)).toEqual({
      canRename: false,
      canArchive: false,
      canManageMembers: false,
      canInvite: false,
    });
  });
});

describe('roleLabel', () => {
  it('возвращает русское название роли', () => {
    expect(roleLabel('owner')).toBe('Owner');
    expect(roleLabel('editor')).toBe('Editor');
    expect(roleLabel('viewer')).toBe('Viewer');
  });
});

describe('isInvitableRole', () => {
  it('разрешает только editor и viewer', () => {
    expect(isInvitableRole('editor')).toBe(true);
    expect(isInvitableRole('viewer')).toBe(true);
    expect(isInvitableRole('owner')).toBe(false);
    expect(isInvitableRole('admin')).toBe(false);
  });
});

describe('INVITABLE_ROLES', () => {
  it('не включает owner', () => {
    expect(INVITABLE_ROLES).not.toContain('owner');
    expect(INVITABLE_ROLES).toHaveLength(2);
  });
});

describe('assertWorkspaceName', () => {
  it('обрезает пробелы вокруг названия', () => {
    expect(assertWorkspaceName('  Мой офис  ')).toBe('Мой офис');
  });

  it('не пропускает пустое название', () => {
    expect(() => assertWorkspaceName('   ')).toThrowError(/Название не может быть пустым/);
  });
});
