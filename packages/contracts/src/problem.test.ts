import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { isProblemDetails, PROBLEM_CONTENT_TYPE, problem, toProblemErrors } from './problem';

async function readProblem(response: Response): Promise<Record<string, unknown>> {
  expect(response.headers.get('content-type')).toBe(PROBLEM_CONTENT_TYPE);
  return (await response.json()) as Record<string, unknown>;
}

describe('problem', () => {
  it('подставляет title и код по HTTP-статусу', async () => {
    const response = problem({ status: 404, detail: 'Страница не найдена' });

    expect(response.status).toBe(404);
    expect(await readProblem(response)).toEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'Страница не найдена',
      code: 'NOT_FOUND',
    });
  });

  it('подставляет Unexpected Error и INTERNAL_ERROR для неизвестного кода', async () => {
    const body = await readProblem(problem({ status: 599 }));

    expect(body).toMatchObject({ title: 'Unexpected Error', status: 599, code: 'INTERNAL_ERROR' });
  });

  it('умеет коды из общего enum: 401, 403, 429, 503', async () => {
    expect((await readProblem(problem({ status: 401 })))['code']).toBe('UNAUTHENTICATED');
    expect((await readProblem(problem({ status: 403 })))['code']).toBe('FORBIDDEN');
    expect((await readProblem(problem({ status: 429 })))['code']).toBe('RATE_LIMITED');
    expect((await readProblem(problem({ status: 503 })))['code']).toBe('SERVICE_UNAVAILABLE');
  });

  it('поддерживает явный code, requestId, instance и кастомные заголовки', async () => {
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

  it('позволяет переопределить title', async () => {
    const body = await readProblem(problem({ status: 500, title: 'Внутренняя ошибка' }));

    expect(body).toMatchObject({ title: 'Внутренняя ошибка', code: 'INTERNAL_ERROR' });
  });

  it('выбрасывает исключение для некорректного статуса', () => {
    expect(() => problem({ status: 42 })).toThrow();
  });

  it('выбрасывает исключение для кода вне enum', () => {
    expect(() =>
      problem({ status: 400, code: 'НЕ_ИЗВЕСТНЫЙ_КОД' as unknown as 'VALIDATION_ERROR' }),
    ).toThrow();
  });
});

describe('isProblemDetails', () => {
  it('распознаёт problem details', async () => {
    expect(await readProblem(problem({ status: 404 }))).toEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      code: 'NOT_FOUND',
    });
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
