// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { dynamic, GET } from './route';

describe('GET /api/version', () => {
  it('지금 빌드 값을 캐시하지 말라며 돌려준다', async () => {
    const res = GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    await expect(res.json()).resolves.toEqual({ build: 'dev' });
  });

  it('빌드 때 굳지 않는다', () => {
    expect(dynamic).toBe('force-dynamic');
  });
});
