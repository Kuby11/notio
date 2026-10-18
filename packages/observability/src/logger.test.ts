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
  it('пишет JSON-строку с уровнем, сервисом, временем и сообщением', () => {
    const { logger, last } = createTestLogger();

    logger.info('gateway started');

    expect(last()).toEqual({
      level: 'info',
      service: 'gateway',
      timestamp: '2026-10-18T12:00:00.000Z',
      message: 'gateway started',
    });
  });

  it('добавляет поля события', () => {
    const { logger, last } = createTestLogger();

    logger.warn('slow request', { requestId: 'req-1', durationMs: 1200 });

    expect(last()).toMatchObject({
      level: 'warn',
      requestId: 'req-1',
      durationMs: 1200,
    });
  });

  it('уважает порог уровня: debug не пишется при info', () => {
    const { logger, lines } = createTestLogger('info');

    logger.debug('подробности');
    logger.info('событие');

    expect(lines).toHaveLength(1);
  });

  it('пишет всё при уровне debug', () => {
    const { logger, lines } = createTestLogger('debug');

    logger.debug('a');
    logger.info('b');
    logger.warn('c');
    logger.error('d');

    expect(lines).toHaveLength(4);
  });

  it('по умолчанию не пишет debug', () => {
    const { logger, lines } = createTestLogger();

    logger.debug('тихо');

    expect(lines).toHaveLength(0);
  });

  it('сериализует Error в name/message/stack', () => {
    const { logger, last } = createTestLogger();
    const error = new Error('boom');

    logger.error('unhandled', { error });

    const serialized = last()['error'] as { name: string; message: string; stack?: string };
    expect(serialized.name).toBe('Error');
    expect(serialized.message).toBe('boom');
    expect(serialized.stack).toContain('Error: boom');
  });

  it('оставляет не-Error значение ошибки как есть', () => {
    const { logger, last } = createTestLogger();

    logger.error('unhandled', { error: 'строка' });

    expect(last()['error']).toBe('строка');
  });

  it('по умолчанию пишет в console', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    createLogger({ service: 'gateway' }).info('через console');

    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0]?.[0]).toContain('"service":"gateway"');
    spy.mockRestore();
  });
});

describe('isLogLevel', () => {
  it('узнаёт известные уровни и отвергает мусор', () => {
    expect(LOG_LEVELS.every(isLogLevel)).toBe(true);
    expect(isLogLevel('trace')).toBe(false);
  });
});
