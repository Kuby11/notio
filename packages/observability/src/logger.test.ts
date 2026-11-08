import { describe, expect, it, vi } from 'vitest';
import { createLogger, isLogLevel, LOG_LEVELS } from './logger';

function createTestLogger(level?: 'debug' | 'info' | 'warn' | 'error') {
  const lines: string[] = [];
  const logger = createLogger({
    service: 'gateway',
    level,
    now: () => new Date('2026-10-18T12:00:00.000Z'),
    sink: (line) => lines.push(line),
  });

  return { logger, lines, last: (): Record<string, unknown> => JSON.parse(lines.at(-1) ?? '{}') };
}

describe('createLogger', () => {
  it('writes a JSON line with level, service, time and message', () => {
    const { logger, last } = createTestLogger();

    logger.info('gateway started');

    expect(last()).toEqual({
      level: 'info',
      service: 'gateway',
      timestamp: '2026-10-18T12:00:00.000Z',
      message: 'gateway started',
    });
  });

  it('adds event fields', () => {
    const { logger, last } = createTestLogger();

    logger.warn('slow request', { requestId: 'req-1', durationMs: 1200 });

    expect(last()).toMatchObject({
      level: 'warn',
      requestId: 'req-1',
      durationMs: 1200,
    });
  });

  it('respects the level threshold: debug is not written at info', () => {
    const { logger, lines } = createTestLogger('info');

    logger.debug('details');
    logger.info('event');

    expect(lines).toHaveLength(1);
  });

  it('writes everything at debug level', () => {
    const { logger, lines } = createTestLogger('debug');

    logger.debug('a');
    logger.info('b');
    logger.warn('c');
    logger.error('d');

    expect(lines).toHaveLength(4);
  });

  it('does not write debug by default', () => {
    const { logger, lines } = createTestLogger();

    logger.debug('quiet');

    expect(lines).toHaveLength(0);
  });

  it('serializes an Error into name/message/stack', () => {
    const { logger, last } = createTestLogger();
    const error = new Error('boom');

    logger.error('unhandled', { error });

    const serialized = last()['error'] as { name: string; message: string; stack?: string };
    expect(serialized.name).toBe('Error');
    expect(serialized.message).toBe('boom');
    expect(serialized.stack).toContain('Error: boom');
  });

  it('leaves a non-Error error value as is', () => {
    const { logger, last } = createTestLogger();

    logger.error('unhandled', { error: 'string' });

    expect(last()['error']).toBe('string');
  });

  it('writes to console by default', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    createLogger({ service: 'gateway' }).info('via console');

    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0]?.[0]).toContain('"service":"gateway"');
    spy.mockRestore();
  });
});

describe('isLogLevel', () => {
  it('recognizes known levels and rejects garbage', () => {
    expect(LOG_LEVELS.every(isLogLevel)).toBe(true);
    expect(isLogLevel('trace')).toBe(false);
  });
});
