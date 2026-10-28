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
  it('вызывает обработчик на совпадение модификатора и клавиши', () => {
    const handler = vi.fn<(event: KeyboardEvent) => void>();
    renderHook(() => useKeybinding('mod+k', handler));

    press({ key: 'k', ctrlKey: true });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('игнорирует нажатия без модификатора и чужие клавиши', () => {
    const handler = vi.fn<(event: KeyboardEvent) => void>();
    renderHook(() => useKeybinding('mod+k', handler));

    press({ key: 'k' });
    press({ key: 'j', ctrlKey: true });

    expect(handler).not.toHaveBeenCalled();
  });

  it('не срабатывает на автоповтор при удержании', () => {
    const handler = vi.fn<(event: KeyboardEvent) => void>();
    renderHook(() => useKeybinding('mod+/', handler));

    press({ key: '/', ctrlKey: true, repeat: true });

    expect(handler).not.toHaveBeenCalled();
  });

  it('отменяет стандартное поведение браузера на совпадении', () => {
    const handler = vi.fn<(event: KeyboardEvent) => void>();
    renderHook(() => useKeybinding('mod+k', handler));

    const event = press({ key: 'k', ctrlKey: true });

    expect(event.defaultPrevented).toBe(true);
  });

  it('не перехватывает события при выключенном подписчике', () => {
    const handler = vi.fn<(event: KeyboardEvent) => void>();
    renderHook(() => useKeybinding('mod+k', handler, { enabled: false }));

    press({ key: 'k', ctrlKey: true });

    expect(handler).not.toHaveBeenCalled();
  });

  it('снимает слушатель при размонтировании', () => {
    const handler = vi.fn<(event: KeyboardEvent) => void>();
    const { unmount } = renderHook(() => useKeybinding('mod+k', handler));

    unmount();
    press({ key: 'k', ctrlKey: true });

    expect(handler).not.toHaveBeenCalled();
  });
});

describe('useModKeyLabel', () => {
  it('показывает Ctrl на не-Apple платформах', () => {
    const { result } = renderHook(() => useModKeyLabel());

    // jsdom reports a non-Apple platform, matching Windows/Linux users.
    expect(result.current).toBe('Ctrl');
  });
});
