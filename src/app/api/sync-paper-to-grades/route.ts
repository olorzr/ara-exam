import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireSession } from '@/lib/require-session';
import { resolveSingleDivision } from '@/lib/grade-division';
import { toKstDate } from '@/lib/kst-date';
import { normalizePaperSettings } from '@/lib/problem-paper/settings';
import { buildOmrAnswerKey, describeOmrBlockers } from '@/lib/problem-paper/omr-payload';
import type { PaperItemSnapshot } from '@/types/problem-bank';

/**
 * 문제은행 문제지 → ara-system(학원 관리 시스템) 성적 등록 브릿지 — 발신부 (2026-09-29).
 *
 * 선생님이 문제지를 만들 때 **'OMR 채점' 을 골랐을 때만** 부른다(`settings.omr`). 저장 직후 조합 화면이
 * 한 번 쏘고, 상세 화면의 '학원 성적에 등록' 단추가 다시 보낼 수 있다(수신부는 멱등).
 * 수신부는 ara-system `integrations/problem-paper`(그쪽 mig519) — 학교급별 '문제은행 시험지' 분류 >
 * 만든 선생님 폴더 > 문제지 하나가 시험 하나(회차 없음)로 들어가고 90A 양식이 붙는다.
 *
 * 정답표는 **저장된 스냅샷**으로 만든다(화면이 들고 있던 값이 아니다) — 인쇄되는 문제지와 같은 값이어야
 * 한다. 조합 화면과 같은 함수(`buildOmrAnswerKey`)라 거기서 통과한 문제지는 여기서도 통과한다.
 *
 * 실패해도 throw 하지 않는다 — `{ ok:false, reason }` 로만 알린다(`sync-to-grades` 와 같은 규약).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** 문제지 문항 상한(RPC 가 200 으로 막는다) 위로 넉넉히 — 잘려 읽히면 아래 개수 대조가 잡는다 */
const ITEMS_READ_LIMIT = 300;
const DETAIL_MAX = 300;

interface PaperRow {
  id: string;
  title: string;
  settings: unknown;
  total_questions: number;
  created_at: string | null;
  /** 항목을 읽기 **전에** 읽은 문제지 판 — 이 판 이전에 고친 '반영 대기' 만 지운다 */
  updated_at: string;
  user_id: string;
}

/** 수신부 오류 본문에서 `code` 를 꺼낸다 — 같은 409 라도 사유가 다르다 */
function intakeCodeOf(detail: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(detail);
    if (parsed && typeof parsed === 'object' && 'code' in parsed && typeof parsed.code === 'string') {
      return parsed.code;
    }
  } catch {
    // 본문이 JSON 이 아니면 코드가 없다
  }
  return undefined;
}

/** 만든 선생님의 이메일 — 수신부가 직원을 이메일로도 찾는다(못 읽으면 id 만 보낸다) */
async function creatorEmail(userId: string): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

/**
 * 고친 OMR 문제지의 '정답표 반영 대기' 표시를 지운다(sql/103) — 성적 시스템이 **새 정답표를 받았을 때만**.
 *
 * 정답표가 얼었으면(그 사이 채점이 시작됐다) 지우지 않는다 — 보기 화면이 계속 경고해야 한다.
 * 지우는 조건은 `edited_at <= 이번에 읽은 문제지 판` 이다 — 보내는 사이 또 고쳤으면 그 표시는 남는다.
 * 지우기에 실패해도 등록은 이미 됐다 — 기록만 남기고 응답은 그대로 성공이다(경고가 한 번 더 뜰 뿐이다).
 */
async function clearSyncPending(paper: PaperRow, result: unknown): Promise<void> {
  const flags = (result && typeof result === 'object' ? result : {}) as { answerKeyFrozen?: unknown; stale?: unknown };
  // 얼었거나(채점 시작) 더 새 판이 이미 들어가 있으면(stale — 이 요청은 아무것도 안 바꿨다) 지우지 않는다
  if (flags.answerKeyFrozen === true || flags.stale === true) return;
  const { error } = await supabaseAdmin
    .from('problem_paper_sync_pending')
    .delete()
    .eq('paper_id', paper.id)
    .lte('edited_at', paper.updated_at);
  if (error) console.error(`[sync-paper-to-grades] 반영 대기 표시를 못 지웠다 paper=${paper.id}: ${error.message}`);
}

/** 시각 글자 → 마이크로초(Date.parse 는 밀리초까지라 같은 밀리초 안의 두 판을 같다고 본다, 코덱스 5R). 못 읽으면 null */
function toMicros(value: string): number | null {
  const m = /^(.*T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(.*)$/.exec(value);
  if (!m) return null;
  const base = Date.parse(m[1] + m[3]);
  return Number.isFinite(base) ? base * 1000 + Number((m[2] ?? '').padEnd(6, '0')) : null;
}

/** 두 판이 같은 시각인가 — 글자가 같으면 같고, 아니면 마이크로초까지 견준다(같은 값의 다른 표기) */
function sameInstant(a: string, b: string): boolean {
  if (a === b) return true;
  const ta = toMicros(a);
  return ta !== null && ta === toMicros(b);
}

/** 항목을 읽은 뒤에도 문제지 판이 그대로인가 — 못 읽으면 바뀐 것으로 친다(보내지 않는 쪽이 안전하다) */
async function sameRevision(paper: PaperRow): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from('problem_papers').select('updated_at').eq('id', paper.id).maybeSingle();
  if (error || !data) return false;
  return (data as { updated_at: string }).updated_at === paper.updated_at;
}

export async function POST(request: NextRequest) {
  const intakeUrl = process.env.ARA_SYSTEM_INTAKE_URL;
  const intakeSecret = process.env.ARA_SYSTEM_INTAKE_SECRET;
  if (!intakeUrl || !intakeSecret) {
    console.error('[sync-paper-to-grades] ARA_SYSTEM_INTAKE_URL/ARA_SYSTEM_INTAKE_SECRET 미설정 — 성적 등록 skip');
    return NextResponse.json({ ok: false, skipped: true, reason: 'not_configured' }, { status: 503 });
  }

  const session = await requireSession(request);
  if (!session.ok) return session.response;

  let paperId: unknown;
  let revision: unknown;
  try {
    const body = await request.json();
    paperId = body?.paperId;
    revision = body?.revision;
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_body' }, { status: 400 });
  }
  if (typeof paperId !== 'string' || !UUID_RE.test(paperId)) {
    return NextResponse.json({ ok: false, reason: 'bad_paperId' }, { status: 400 });
  }

  try {
    const { data: paperData } = await supabaseAdmin
      .from('problem_papers')
      .select('id, title, settings, total_questions, created_at, updated_at, user_id')
      .eq('id', paperId)
      .maybeSingle();
    const paper = paperData as PaperRow | null;
    if (!paper) return NextResponse.json({ ok: false, reason: 'paper_not_found' }, { status: 404 });
    // OMR 을 고르지 않은 문제지는 보내지 않는다 — 직접 호출로 성적 시스템에 시험을 늘리지 못하게
    if (!normalizePaperSettings(paper.settings).omr) {
      return NextResponse.json({ ok: false, reason: 'omr_not_enabled' }, { status: 400 });
    }
    // 보낸 화면이 보고 있는 판이 지금 판이 아니면 등록하지 않는다 — 다른 곳에서 고친 뒤 옛 화면에서 보내면 그 화면의
    // 인쇄물과 다른 정답표가 올라간다(코덱스 4R). 판을 안 실은 호출(옛 탭)은 예전처럼 지금 판을 보낸다
    if (typeof revision === 'string' && !sameInstant(revision, paper.updated_at)) {
      return NextResponse.json({ ok: false, reason: 'paper_changed' }, { status: 409 });
    }

    const { data: itemRows, error: itemsErr } = await supabaseAdmin
      .from('problem_paper_items')
      .select('order_index, snapshot')
      .eq('paper_id', paperId)
      .order('order_index')
      .limit(ITEMS_READ_LIMIT);
    if (itemsErr) return NextResponse.json({ ok: false, reason: 'items_read_failed' }, { status: 500 });
    const snapshots = ((itemRows ?? []) as { snapshot: PaperItemSnapshot }[]).map((r) => r.snapshot);
    // ⚠️ 항목을 읽는 사이 문제지가 고쳐졌으면 보내지 않는다 — 판(updated_at)과 정답표가 어긋난 채 실리면, 성적 시스템의
    //    판 대조(Ara-system mig599)가 옛 내용을 새 판으로 받아 버린다. 문제지는 행을 먼저, 항목을 그 뒤에 읽었다
    if (!(await sameRevision(paper))) {
      return NextResponse.json({ ok: false, reason: 'paper_changed' }, { status: 409 });
    }
    // 번호가 곧 답안지 칸이다 — 하나라도 빠지면 뒤 문항의 정답이 한 칸씩 밀린다
    if (snapshots.length !== paper.total_questions) {
      console.error(`[sync-paper-to-grades] 문항 수 불일치 paper=${paperId} ${snapshots.length}/${paper.total_questions}`);
      return NextResponse.json({ ok: false, reason: 'items_mismatch' }, { status: 500 });
    }

    const plan = buildOmrAnswerKey(snapshots);
    if (plan.blockers.length > 0) {
      const message = `OMR 로 채점할 수 없는 문항이 있어요 — ${describeOmrBlockers(plan.blockers)}`;
      return NextResponse.json({ ok: false, reason: 'omr_blocked', blockers: plan.blockers, message }, { status: 400 });
    }
    if (plan.objectiveCount === 0) {
      return NextResponse.json({ ok: false, reason: 'omr_no_objective' }, { status: 400 });
    }

    // 학교급 — 출처 학년('중2')으로 가른다. 여러 학교급이 섞이면 빼서 수신부 기본(중등부)에 맡긴다
    const division = resolveSingleDivision(snapshots.map((s) => ({ level: '', grade: s.source?.grade ?? '' })));

    const payload = {
      sourceExamId: paper.id,
      title: paper.title,
      totalQuestions: paper.total_questions,
      items: plan.items,
      ...(division ? { division } : {}),
      examDate: toKstDate(paper.created_at),
      createdBy: { id: paper.user_id, email: await creatorEmail(paper.user_id) },
      // 이 정답표가 문제지의 어느 판인가 — 성적 시스템이 더 옛 판이면 덮지 않는다(겹친 전송, Ara-system mig599)
      sourceRevision: paper.updated_at,
    };

    const res = await fetch(`${intakeUrl.replace(/\/$/, '')}/api/integrations/problem-paper`, {
      method: 'POST',
      headers: { authorization: `Bearer ${intakeSecret}`, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, DETAIL_MAX);
      console.error(`[sync-paper-to-grades] 인테이크 거절 ${res.status}: ${detail}`);
      return NextResponse.json(
        { ok: false, reason: 'intake_failed', status: res.status, detail, intakeCode: intakeCodeOf(detail) },
        { status: 502 },
      );
    }
    const result: unknown = await res.json().catch(() => null);
    // ⚠️ 응답을 못 읽으면 반영됐는지(얼었는지·밀렸는지) 모른다 — 반영 대기 표시를 남기고 실패로 알린다(코덱스 5R)
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      console.error(`[sync-paper-to-grades] 인테이크 응답을 읽지 못했다 paper=${paperId}`);
      return NextResponse.json({ ok: false, reason: 'intake_unreadable' }, { status: 502 });
    }
    await clearSyncPending(paper, result);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    console.error(`[sync-paper-to-grades] 예외: ${message}`);
    return NextResponse.json({ ok: false, reason: 'exception', message }, { status: 500 });
  }
}
