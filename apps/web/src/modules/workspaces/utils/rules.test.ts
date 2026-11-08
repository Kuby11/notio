import { describe, expect, it } from 'vitest';
import {
  assertWorkspaceName,
  capabilitiesOf,
  isInvitableRole,
  roleLabel,
  INVITABLE_ROLES,
} from './rules';

describe('capabilitiesOf', () => {
  it('owner can do everything', () => {
    expect(capabilitiesOf('owner')).toEqual({
      canRename: true,
      canArchive: true,
      canManageMembers: true,
      canInvite: true,
    });
  });

  it('editor and viewer cannot manage the workspace', () => {
    for (const role of ['editor', 'viewer'] as const) {
      expect(capabilitiesOf(role)).toEqual({
        canRename: false,
        canArchive: false,
        canManageMembers: false,
        canInvite: false,
      });
    }
  });

  it('without a role nothing is allowed', () => {
    expect(capabilitiesOf(null)).toEqual({
      canRename: false,
      canArchive: false,
      canManageMembers: false,
      canInvite: false,
    });
  });
});

describe('roleLabel', () => {
  it('returns the role label', () => {
    expect(roleLabel('owner')).toBe('Owner');
    expect(roleLabel('editor')).toBe('Editor');
    expect(roleLabel('viewer')).toBe('Viewer');
  });
});

describe('isInvitableRole', () => {
  it('allows only editor and viewer', () => {
    expect(isInvitableRole('editor')).toBe(true);
    expect(isInvitableRole('viewer')).toBe(true);
    expect(isInvitableRole('owner')).toBe(false);
    expect(isInvitableRole('admin')).toBe(false);
  });
});

describe('INVITABLE_ROLES', () => {
  it('does not include owner', () => {
    expect(INVITABLE_ROLES).not.toContain('owner');
    expect(INVITABLE_ROLES).toHaveLength(2);
  });
});

describe('assertWorkspaceName', () => {
  it('trims whitespace around the name', () => {
    expect(assertWorkspaceName('  My office  ')).toBe('My office');
  });

  it('rejects an empty name', () => {
    expect(() => assertWorkspaceName('   ')).toThrowError(/Name cannot be empty/);
  });
});
