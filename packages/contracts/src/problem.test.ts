import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  DEFAULT_PROBLEM_TYPE,
  isProblemDetails,
  ProblemDetailsSchema,
  problem,
  PROBLEM_CONTENT_TYPE,
  toProblemErrors,
} from './problem';

async function readProblem(response: Response): Promise<unknown> {
  expect(response.headers.get('content-type')).toBe(PROBLEM_CONTENT_TYPE);
  return response.json();
}

describe('problem', () => {
  it('собирает problem details с title по умолчанию из status', async () => {
    const response = problem({ status: 404, detail: 'Страница не найдена' });

    expect(response.status).toBe(404);
    expect(await readProblem(response)).toEqual({
      type: DEFAULT_PROBLEM_TYPE,
      title: 'Not Found',
      status: 404,
      detail: 'Страница не найдена',
    });
  });

  it('подставляет Unexpected Error для неизвестного кода', async () => {
    const body = await readProblem(problem({ status: 599 }));

    expect(body).toMatchObject({ title: 'Unexpected Error', status: 599 });
  });

  it('поддерживает code, requestId, instance и кастомные заголовки', async () => {
    const body = await readProblem(
      problem({
        status: 429,
        code: 'RATE_LIMITED',
        requestId: 'req-42',
        instance: '/api/health',
        headers: { 'retry-after': '30' },
      }),
    );

    expect(body).toMatchObject({
      code: 'RATE_LIMITED',
      requestId: 'req-42',
      instance: '/api/health',
    });
  });

  it('не позволяет указать title вручную поверх дефолтного', async () => {
    const body = await readProblem(problem({ status: 500, title: 'Внутренняя ошибка' }));

    expect(body).toMatchObject({ title: 'Внутренняя ошибка' });
  });

  it('выбрасывает исключение для некорректного статуса', () => {
    expect(() => problem({ status: 42 })).toThrow();
  });
});

describe('isProblemDetails', () => {
  it('распознаёт problem details', () => {
    expect(isProblemDetails({ type: 'about:blank', title: 'Not Found', status: 404 })).toBe(true);
  });

  it('отвергает обычную ошибку и мусор', () => {
    expect(isProblemDetails({ message: 'boom' })).toBe(false);
    expect(isProblemDetails(null)).toBe(false);
    expect(isProblemDetails('about:blank')).toBe(false);
  });
});

describe('toProblemErrors', () => {
  it('преобразует issues Zod в список path/message', () => {
    const schema = z.object({ title: z.string().min(3) });
    const result = schema.safeParse({ title: 'ab' });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(toProblemErrors(result.error)).toEqual([
      { path: 'title', message: expect.stringContaining('3') },
    ]);
  });
});

describe('ProblemDetailsSchema', () => {
  it('принимает тело, собранное problem()', async () => {
    const body = await readProblem(problem({ status: 403, code: 'FORBIDDEN' }));

    expect(ProblemDetailsSchema.safeParse(body).success).toBe(true);
  });
});
