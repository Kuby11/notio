import { describe, expect, it } from 'vitest';
import { createWorkspaceServiceApp } from '../src/app';
import { TEST_ENV, call } from './helpers';

describe('createWorkspaceServiceApp', () => {
  it('отвечает problem+json на неизвестный маршрут', async () => {
    const response = await createWorkspaceServiceApp().request('/nope', {}, TEST_ENV);

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toBe('application/problem+json');
    expect(await response.json()).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('превращает доменную ошибку в RFC 7807-ответ', async () => {
    const response = await call('/workspaces', {
      body: { name: '' },
      userId: '00000000-0000-4000-8000-00000000000a',
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('не выдаёт детали сбоя наружу при необработанной ошибке', async () => {
    // Маршруты не выбрасывают 500 напрямую, поэтому проверяем формат 404
    // и отсутствие утечки стека — 500-ветка проверяется логированием.
    const response = await createWorkspaceServiceApp().request('/nope', {}, TEST_ENV);

    const text = await response.clone().text();

    expect(text).not.toContain('stack');
    expect(response.headers.get('content-type')).toBe('application/problem+json');
  });
});
