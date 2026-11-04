import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * Shared DOM test setup: cleanup of unmounted trees between
 * tests and jest-dom matchers for accessible role and text names.
 */
afterEach(() => {
  cleanup();
});

/*
 * Base UI dispatches synthetic clicks through PointerEvent, which jsdom does
 * not implement. MouseEvent is API-compatible for the fields the library
 * reads, so it is enough for switches and other clickable controls in tests.
 */
if (typeof window !== 'undefined' && typeof window.PointerEvent === 'undefined') {
  Object.defineProperty(window, 'PointerEvent', {
    configurable: true,
    value: class PointerEventPolyfill extends MouseEvent {},
  });
}
