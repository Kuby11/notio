// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useKeybinding, useModKeyLabel } from './use-keybinding';

function press(combo: Partial<KeyboardEventInit> & { key: string }): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...combo });
  window.dispatchEvent(event);
  return event;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useKeybinding', () => {
  it('calls the handler on a matching modifier and key', () => {
    const handler = vi.fn<(event: KeyboardEvent) => void>();
    renderHook(() => useKeybinding('mod+k', handler));

    press({ key: 'k', ctrlKey: true });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('ignores presses without a modifier and other keys', () => {
    const handler = vi.fn<(event: KeyboardEvent) => void>();
    renderHook(() => useKeybinding('mod+k', handler));

    press({ key: 'k' });
    press({ key: 'j', ctrlKey: true });

    expect(handler).not.toHaveBeenCalled();
  });

  it('does not fire on auto-repeat while the key is held', () => {
    const handler = vi.fn<(event: KeyboardEvent) => void>();
    renderHook(() => useKeybinding('mod+/', handler));

    press({ key: '/', ctrlKey: true, repeat: true });

    expect(handler).not.toHaveBeenCalled();
  });

  it('prevents the default browser behaviour on a match', () => {
    const handler = vi.fn<(event: KeyboardEvent) => void>();
    renderHook(() => useKeybinding('mod+k', handler));

    const event = press({ key: 'k', ctrlKey: true });

    expect(event.defaultPrevented).toBe(true);
  });

  it('does not intercept events while the subscriber is disabled', () => {
    const handler = vi.fn<(event: KeyboardEvent) => void>();
    renderHook(() => useKeybinding('mod+k', handler, { enabled: false }));

    press({ key: 'k', ctrlKey: true });

    expect(handler).not.toHaveBeenCalled();
  });

  it('removes the listener on unmount', () => {
    const handler = vi.fn<(event: KeyboardEvent) => void>();
    const { unmount } = renderHook(() => useKeybinding('mod+k', handler));

    unmount();
    press({ key: 'k', ctrlKey: true });

    expect(handler).not.toHaveBeenCalled();
  });
});

describe('useModKeyLabel', () => {
  it('shows Ctrl on non-Apple platforms', () => {
    const { result } = renderHook(() => useModKeyLabel());

    // jsdom reports a non-Apple platform, matching Windows/Linux users.
    expect(result.current).toBe('Ctrl');
  });
});
