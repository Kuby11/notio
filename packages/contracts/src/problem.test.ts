import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { isProblemDetails, PROBLEM_CONTENT_TYPE, problem, toProblemErrors } from './problem';

async function readProblem(response: Response): Promise<Record<string, unknown>> {
  expect(response.headers.get('content-type')).toBe(PROBLEM_CONTENT_TYPE);
  return (await response.json()) as Record<string, unknown>;
}

describe('problem', () => {
  it('fills in the title and code from the HTTP status', async () => {
    const response = problem({ status: 404, detail: 'Page not found' });

    expect(response.status).toBe(404);
    expect(await readProblem(response)).toEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'Page not found',
      code: 'NOT_FOUND',
    });
  });

  it('falls back to Unexpected Error and INTERNAL_ERROR for an unknown code', async () => {
    const body = await readProblem(problem({ status: 599 }));

    expect(body).toMatchObject({ title: 'Unexpected Error', status: 599, code: 'INTERNAL_ERROR' });
  });

  it('supports codes from the shared enum: 401, 403, 429, 503', async () => {
    expect((await readProblem(problem({ status: 401 })))['code']).toBe('UNAUTHENTICATED');
    expect((await readProblem(problem({ status: 403 })))['code']).toBe('FORBIDDEN');
    expect((await readProblem(problem({ status: 429 })))['code']).toBe('RATE_LIMITED');
    expect((await readProblem(problem({ status: 503 })))['code']).toBe('SERVICE_UNAVAILABLE');
  });

  it('supports explicit code, requestId, instance and custom headers', async () => {
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

  it('allows overriding the title', async () => {
    const body = await readProblem(problem({ status: 500, title: 'Internal error' }));

    expect(body).toMatchObject({ title: 'Internal error', code: 'INTERNAL_ERROR' });
  });

  it('throws for an invalid status', () => {
    expect(() => problem({ status: 42 })).toThrow();
  });

  it('throws for a code outside the enum', () => {
    expect(() =>
      problem({ status: 400, code: 'UNKNOWN_CODE' as unknown as 'VALIDATION_ERROR' }),
    ).toThrow();
  });
});

describe('isProblemDetails', () => {
  it('recognises problem details', async () => {
    expect(await readProblem(problem({ status: 404 }))).toEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('rejects a plain error and garbage', () => {
    expect(isProblemDetails({ message: 'boom' })).toBe(false);
    expect(isProblemDetails(null)).toBe(false);
    expect(isProblemDetails('about:blank')).toBe(false);
  });
});

describe('toProblemErrors', () => {
  it('converts Zod issues into a list of path/message pairs', () => {
    const schema = z.object({ title: z.string().min(3) });
    const result = schema.safeParse({ title: 'ab' });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(toProblemErrors(result.error)).toEqual([
      { path: 'title', message: expect.stringContaining('3') },
    ]);
  });
});
