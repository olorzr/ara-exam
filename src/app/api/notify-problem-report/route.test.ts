// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 오류 신고 알림 — 신고한 본인만 부를 수 있고, 닿았을 때만 notified_at 을 남긴다. 인테이크가 실패해도
 * 신고는 이미 저장돼 있어 ok:false 로만 알린다.
 */

const REPORT_ID = '22222222-2222-4222-8222-222222222222';
const baseRow = {
  id: REPORT_ID, user_id: 'u1', notified_at: null as string | null, category: 'answer', note: '정답이 ④예요',
  paper_title: '형태소 복합어 단일어', printed_no: 17, source_label: '2025 중1 압구정중학교 2학기 기말',
  original_no: 12 as unknown,
  source: null as unknown,
};
let row: typeof baseRow | null = baseRow;
/** 조건부로 잡기(`update … is null … select`)가 돌려줄 행 — 비면 다른 요청이 먼저 잡은 것 */
let claimData: unknown[] = [{ id: REPORT_ID }];
interface UpdateRecord { set: Record<string, unknown> | null; eq: [string, unknown][]; is: [string, unknown][] }
const updates: UpdateRecord[] = [];

vi.mock('@/lib/require-session', () => ({ requireSession: async () => ({ ok: true, user: { id: 'u1' } }) }));
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: () => {
      const record: UpdateRecord = { set: null, eq: [], is: [] };
      const chain: Record<string, unknown> = {
        select: () => (record.set ? Promise.resolve({ data: claimData, error: null }) : chain),
        update: (set: Record<string, unknown>) => { record.set = set; updates.push(record); return chain; },
        eq: (c: string, v: unknown) => { record.eq.push([c, v]); return chain; },
        is: (c: string, v: unknown) => { record.is.push([c, v]); return chain; },
        maybeSingle: async () => ({ data: row, error: null }),
        then: (yes: (r: unknown) => unknown) => Promise.resolve({ error: null }).then(yes),
      };
      return chain;
    },
  },
}));

const { POST } = await import('./route');

function call(body: unknown = { reportId: REPORT_ID }) {
  return POST(new Request('http://x/api/notify-problem-report', {
    method: 'POST', body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0]);
}

beforeEach(() => {
  row = { ...baseRow };
  claimData = [{ id: REPORT_ID }];
  updates.length = 0;
  vi.stubEnv('ARA_SYSTEM_INTAKE_URL', 'http://intake/');
  vi.stubEnv('ARA_SYSTEM_INTAKE_SECRET', 's');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('POST /api/notify-problem-report', () => {
  it('보내기 전에 notified_at 을 비어 있을 때만 잡고, 닿았으면 그대로 둔다', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, reached: true })));
    vi.stubGlobal('fetch', fetchMock);
    const res = await call();
    expect(await res.json()).toEqual({ ok: true, reached: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://intake/api/integrations/problem-report');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer s');
    expect(JSON.parse(String(init.body))).toMatchObject({
      reportId: REPORT_ID, reporterId: 'u1', paperTitle: '형태소 복합어 단일어', printedNo: 17, category: '정답 오류',
      sourceLabel: '2025 중1 압구정중학교 2학기 기말 · 원래 12번',
    });
    expect(updates).toHaveLength(1);
    expect(typeof updates[0].set?.notified_at).toBe('string');
    expect(updates[0].is).toEqual([['notified_at', null]]);
  });

  it('스냅샷에 원래 번호가 없으면 출처 줄만 보낸다', async () => {
    row = { ...baseRow, original_no: null };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, reached: true })));
    vi.stubGlobal('fetch', fetchMock);
    await call();
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).sourceLabel).toBe('2025 중1 압구정중학교 2학기 기말');
  });

  it('출처 줄은 스냅샷 출처로 카드와 같은 규칙 — 모의고사는 제목(저장된 줄은 과목이 뭉개진다)', async () => {
    row = {
      ...baseRow, source_label: '2026 고3 수능', original_no: 35,
      source: { source_type: '모의고사', title: '2026학년도 수능 (언어와 매체)', school_name: '', year: '2026', grade: '고3', exam_type: '수능', publisher: '' },
    };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, reached: true })));
    vi.stubGlobal('fetch', fetchMock);
    await call();
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).sourceLabel).toBe('2026학년도 수능 (언어와 매체) · 원래 35번');
  });

  it('다른 요청이 먼저 잡았으면 보내지 않는다(겹친 두 요청이 DM 을 두 번 보내지 않게)', async () => {
    claimData = [];
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await (await call()).json()).toMatchObject({ ok: true, reached: true, already: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(updates).toHaveLength(1);
  });

  it('못 닿았으면 내가 잡은 값일 때만 notified_at 을 되돌린다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true, reached: false }))));
    expect((await (await call()).json()).reached).toBe(false);
    expect(updates).toHaveLength(2);
    const claimedAt = updates[0].set?.notified_at;
    expect(updates[1].set).toEqual({ notified_at: null });
    expect(updates[1].eq).toEqual([['id', REPORT_ID], ['notified_at', claimedAt]]);
  });

  it('인테이크가 거절하면 502 — 잡은 표시를 되돌리고 신고는 그대로 남는다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Unauthorized', { status: 401 })));
    const res = await call();
    expect(res.status).toBe(502);
    expect(updates).toHaveLength(2);
    expect(updates[1].set).toEqual({ notified_at: null });
  });

  it('남의 신고로는 부를 수 없다', async () => {
    row = { ...baseRow, user_id: 'someone-else' };
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await call()).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('이미 닿은 신고는 다시 보내지 않는다', async () => {
    row = { ...baseRow, notified_at: '2026-11-22T01:00:00Z' };
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await (await call()).json()).toMatchObject({ ok: true, reached: true, already: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('id 가 이상하면 400, 신고가 없으면 404, 연동 설정이 없으면 503', async () => {
    expect((await call({ reportId: 'x' })).status).toBe(400);
    row = null;
    expect((await call()).status).toBe(404);
    vi.stubEnv('ARA_SYSTEM_INTAKE_SECRET', '');
    expect((await call()).status).toBe(503);
  });
});
