export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export type LogFields = Record<string, unknown>;

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

export interface LoggerOptions {
  /** Имя сервиса: gateway, pages-service, ... */
  service: string;
  level?: LogLevel;
  /** Текущее время в ISO-формате; по умолчанию Date.now(). Передаётся явно в тестах. */
  now?: () => Date;
  /** Приёмник строк. По умолчанию console — подменяется в тестах. */
  sink?: (line: string) => void;
}

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export function isLogLevel(value: string): value is LogLevel {
  return (LOG_LEVELS as readonly string[]).includes(value);
}

/** Приводит Error к безопасному для логов объекту: стек и причина, но без циклов. */
function serializeError(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }

  return value;
}

/**
 * Структурный логгер: одна JSON-строка на событие.
 * В логи не попадают секреты и PII — только то, что сервис передал явно.
 */
export function createLogger(options: LoggerOptions): Logger {
  const level = options.level ?? 'info';
  const now = options.now ?? (() => new Date());
  const sink = options.sink ?? ((line: string) => console.log(line));

  const write = (entryLevel: LogLevel, message: string, fields?: LogFields): void => {
    if (LEVEL_WEIGHT[entryLevel] < LEVEL_WEIGHT[level]) {
      return;
    }

    const payload: LogFields = {
      level: entryLevel,
      service: options.service,
      timestamp: now().toISOString(),
      message,
      ...fields,
    };

    if (payload['error'] !== undefined) {
      payload['error'] = serializeError(payload['error']);
    }

    sink(JSON.stringify(payload));
  };

  return {
    debug: (message, fields) => write('debug', message, fields),
    info: (message, fields) => write('info', message, fields),
    warn: (message, fields) => write('warn', message, fields),
    error: (message, fields) => write('error', message, fields),
  };
}
