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
  try {
    paperId = (await request.json())?.paperId;
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_body' }, { status: 400 });
  }
  if (typeof paperId !== 'string' || !UUID_RE.test(paperId)) {
    return NextResponse.json({ ok: false, reason: 'bad_paperId' }, { status: 400 });
  }

  try {
    const { data: paperData } = await supabaseAdmin
      .from('problem_papers')
      .select('id, title, settings, total_questions, created_at, user_id')
      .eq('id', paperId)
      .maybeSingle();
    const paper = paperData as PaperRow | null;
    if (!paper) return NextResponse.json({ ok: false, reason: 'paper_not_found' }, { status: 404 });
    // OMR 을 고르지 않은 문제지는 보내지 않는다 — 직접 호출로 성적 시스템에 시험을 늘리지 못하게
    if (!normalizePaperSettings(paper.settings).omr) {
      return NextResponse.json({ ok: false, reason: 'omr_not_enabled' }, { status: 400 });
    }

    const { data: itemRows, error: itemsErr } = await supabaseAdmin
      .from('problem_paper_items')
      .select('order_index, snapshot')
      .eq('paper_id', paperId)
      .order('order_index')
      .limit(ITEMS_READ_LIMIT);
    if (itemsErr) return NextResponse.json({ ok: false, reason: 'items_read_failed' }, { status: 500 });
    const snapshots = ((itemRows ?? []) as { snapshot: PaperItemSnapshot }[]).map((r) => r.snapshot);
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
    const result = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    console.error(`[sync-paper-to-grades] 예외: ${message}`);
    return NextResponse.json({ ok: false, reason: 'exception', message }, { status: 500 });
  }
}
