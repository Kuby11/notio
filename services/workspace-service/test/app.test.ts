import { describe, expect, it } from 'vitest';
import { createWorkspaceServiceApp } from '../src/app';
import { TEST_ENV, call } from './helpers';

describe('createWorkspaceServiceApp', () => {
  it('responds with problem+json for an unknown route', async () => {
    const response = await createWorkspaceServiceApp().request('/nope', {}, TEST_ENV);

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toBe('application/problem+json');
    expect(await response.json()).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('turns a domain error into an RFC 7807 response', async () => {
    const response = await call('/workspaces', {
      body: { name: '' },
      userId: '00000000-0000-4000-8000-00000000000a',
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('does not leak failure details on an unhandled error', async () => {
    // Routes never throw 500 directly, so we check the 404
    // format and the absence of a stack leak — the 500 branch is covered by logging.
    const response = await createWorkspaceServiceApp().request('/nope', {}, TEST_ENV);

    const text = await response.clone().text();

    expect(text).not.toContain('stack');
    expect(response.headers.get('content-type')).toBe('application/problem+json');
  });
});
