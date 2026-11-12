// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 고친 OMR 문제지의 '정답표 반영 대기' 표시(sql/103)는 성적 시스템이 **새 정답표를 받았을 때만** 지운다.
 * 얼었거나(채점 시작) 등록이 실패하면 남아야 보기 화면이 계속 경고한다.
 */

const PAPER_ID = '11111111-1111-4111-8111-111111111111';
const paper = {
  id: PAPER_ID, title: '문제지', settings: { omr: true }, total_questions: 1,
  created_at: '2026-11-12T00:00:00Z', updated_at: '2026-11-12T03:04:05.123456+00:00', user_id: 'u1',
};
const deletes: { eq: [string, unknown][]; lte: [string, unknown][] }[] = [];
/** 문제지 행을 읽을 때마다 돌려줄 값 — 첫 번째는 처음 읽기, 두 번째는 항목을 읽은 뒤 판 재확인 */
let paperReads: unknown[] = [];

vi.mock('@/lib/require-session', () => ({ requireSession: async () => ({ ok: true }) }));
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    auth: { admin: { getUserById: async () => ({ data: { user: { email: 't@araeducation.co.kr' } } }) } },
    from: (table: string) => {
      if (table === 'problem_paper_sync_pending') {
        const record = { eq: [] as [string, unknown][], lte: [] as [string, unknown][] };
        deletes.push(record);
        const chain = {
          delete: () => chain,
          eq: (c: string, v: unknown) => { record.eq.push([c, v]); return chain; },
          lte: (c: string, v: unknown) => { record.lte.push([c, v]); return Promise.resolve({ error: null }); },
        };
        return chain;
      }
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        maybeSingle: async () => ({ data: paperReads.length > 0 ? paperReads.shift() : paper }),
        limit: async () => ({
          data: [{ order_index: 0, snapshot: { question_type: '객관식', answer: '2', choices: ['a', 'b', 'c', 'd', 'e'], source: { grade: '중2' } } }],
          error: null,
        }),
      };
      return chain;
    },
  },
}));

const { POST } = await import('./route');

function call(extra: Record<string, string> = {}) {
  return POST(new Request('http://x/api/sync-paper-to-grades', {
    method: 'POST', body: JSON.stringify({ paperId: PAPER_ID, ...extra }),
  }) as unknown as Parameters<typeof POST>[0]);
}

beforeEach(() => {
  deletes.length = 0;
  paperReads = [];
  vi.stubEnv('ARA_SYSTEM_INTAKE_URL', 'http://intake');
  vi.stubEnv('ARA_SYSTEM_INTAKE_SECRET', 's');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('POST /api/sync-paper-to-grades — 반영 대기 표시', () => {
  it('새 정답표가 들어가면 **읽은 판 이전**의 표시만 지운다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ created: false, answerKeyFrozen: false }))));
    const res = await call();
    expect((await res.json()).ok).toBe(true);
    expect(deletes).toEqual([{ eq: [['paper_id', PAPER_ID]], lte: [['edited_at', paper.updated_at]] }]);
  });

  it('정답표가 얼었으면 지우지 않는다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ answerKeyFrozen: true }))));
    await call();
    expect(deletes).toEqual([]);
  });

  it('등록이 거절되면 지우지 않는다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"code":"x"}', { status: 409 })));
    const res = await call();
    expect((await res.json()).ok).toBe(false);
    expect(deletes).toEqual([]);
  });
});

describe('POST /api/sync-paper-to-grades — 문제지 판', () => {
  it('정답표와 함께 문제지 판(updated_at)을 글자 그대로 싣는다', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ created: false })));
    vi.stubGlobal('fetch', fetchMock);
    await call();
    const sent = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(sent.sourceRevision).toBe(paper.updated_at);
  });

  it('항목을 읽는 사이 문제지가 고쳐졌으면 보내지 않는다(판과 정답표가 어긋난다)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    paperReads = [paper, { ...paper, updated_at: '2026-11-12T04:00:00+00:00' }];
    const res = await call();
    expect(res.status).toBe(409);
    expect((await res.json()).reason).toBe('paper_changed');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('더 새 판이 이미 들어가 있으면(stale) 반영 대기 표시를 지우지 않는다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ stale: true }))));
    await call();
    expect(deletes).toEqual([]);
  });

  it('보낸 화면의 판이 지금 판이 아니면 등록하지 않는다(옛 화면이 화면에 없는 정답표를 올리지 않게)', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ created: false })));
    vi.stubGlobal('fetch', fetchMock);
    const res = await call({ revision: '2026-11-12T00:00:00+00:00' });
    expect(res.status).toBe(409);
    expect((await res.json()).reason).toBe('paper_changed');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('같은 판이면(표기가 달라도 같은 시각) 보낸다', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ created: false })));
    vi.stubGlobal('fetch', fetchMock);
    await call({ revision: '2026-11-12T12:04:05.123456+09:00' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('같은 밀리초 안의 다른 판도 가른다(마이크로초까지 견준다)', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ created: false })));
    vi.stubGlobal('fetch', fetchMock);
    const res = await call({ revision: '2026-11-12T03:04:05.123000+00:00' }); // 지금 판은 .123456
    expect(res.status).toBe(409);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('성적 시스템 응답을 못 읽으면 반영 대기 표시를 지우지 않고 실패로 알린다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>oops')));
    const res = await call();
    expect((await res.json()).reason).toBe('intake_unreadable');
    expect(deletes).toEqual([]);
  });
});

