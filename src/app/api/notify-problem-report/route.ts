import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/require-session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { reportSourceLabel } from '@/lib/problem-report/display';
import { REPORT_CATEGORY_LABELS, isReportCategory, withOriginalNumber } from '@/lib/problem-report/types';

/**
 * 문제 은행 오류 신고 → 원장 웍스 DM (sql/113, 2026-11-22).
 *
 * 신고는 브라우저가 RPC 로 **먼저 저장**한다. 이 라우트는 그 신고를 다시 읽어 관리자센터 인테이크
 * (`/api/integrations/problem-report`, 성적 등록과 같은 서버 간 공유 비밀)로 보내고, 닿았으면 `notified_at` 을 남긴다.
 * · 신고한 본인만 부를 수 있다(남의 신고로 원장에게 알림을 되풀이하지 못하게). 이미 닿았으면 다시 보내지 않는다.
 * · ⚠️ **보내기 전에 `notified_at` 을 조건부로 잡는다**(비어 있을 때만) — 겹친 두 요청이 둘 다 '아직' 을 읽고 DM 을 두 번
 *   보내지 않게(코덱스 1R). 못 닿으면 **내가 잡은 값일 때만** 되돌려 다시 부를 수 있게 한다.
 * · 실패는 던지지 않고 `{ ok:false, reason }` — 신고는 이미 저장돼 있다(화면이 '알림은 못 보냈어요' 로 알린다).
 * · 구조는 sync-paper-to-grades/route.ts 와 같다(env · requireSession · service_role · 같은 인테이크 주소 규약).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DETAIL_MAX = 300;

interface ReportRow {
  id: string;
  user_id: string;
  notified_at: string | null;
  category: string;
  note: string;
  paper_title: string | null;
  printed_no: number | null;
  source_label: string | null;
  /** 신고 때 스냅샷의 원래 번호(`snapshot->number`) — 카드의 출처 줄에 붙인다 */
  original_no: unknown;
  /** 신고 때 스냅샷의 출처(`snapshot->source`) — 출처 줄을 카드와 같은 규칙으로 만든다 */
  source: unknown;
}

export async function POST(request: NextRequest) {
  const intakeUrl = process.env.ARA_SYSTEM_INTAKE_URL;
  const intakeSecret = process.env.ARA_SYSTEM_INTAKE_SECRET;
  if (!intakeUrl || !intakeSecret) {
    console.error('[notify-problem-report] ARA_SYSTEM_INTAKE_URL/ARA_SYSTEM_INTAKE_SECRET 미설정 — 알림 skip');
    return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 503 });
  }

  const session = await requireSession(request);
  if (!session.ok) return session.response;

  let reportId: unknown;
  try {
    reportId = (await request.json())?.reportId;
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_body' }, { status: 400 });
  }
  if (typeof reportId !== 'string' || !UUID_RE.test(reportId)) {
    return NextResponse.json({ ok: false, reason: 'bad_reportId' }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('problem_reports')
      .select('id, user_id, notified_at, category, note, paper_title, printed_no, source_label, original_no:snapshot->number, source:snapshot->source')
      .eq('id', reportId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const row = data as ReportRow | null;
    if (!row) return NextResponse.json({ ok: false, reason: 'not_found' }, { status: 404 });
    if (row.user_id !== session.user.id) return NextResponse.json({ ok: false, reason: 'forbidden' }, { status: 403 });
    if (row.notified_at) return NextResponse.json({ ok: true, reached: true, already: true });

    const claimedAt = new Date().toISOString();
    const { data: claimed, error: claimError } = await supabaseAdmin.from('problem_reports')
      .update({ notified_at: claimedAt }).eq('id', row.id).is('notified_at', null).select('id');
    if (claimError) throw new Error(claimError.message);
    // 다른 요청이 먼저 잡았다 — 그쪽이 보내는 중이거나 이미 보냈다
    if (!claimed || claimed.length === 0) return NextResponse.json({ ok: true, reached: true, already: true });
    const release = () => supabaseAdmin.from('problem_reports').update({ notified_at: null })
      .eq('id', row.id).eq('notified_at', claimedAt);

    const res = await fetch(`${intakeUrl.replace(/\/$/, '')}/api/integrations/problem-report`, {
      method: 'POST',
      headers: { authorization: `Bearer ${intakeSecret}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        reportId: row.id,
        reporterId: row.user_id,
        paperTitle: row.paper_title ?? undefined,
        printedNo: row.printed_no ?? undefined,
        // 원본 시험지의 번호까지 — 원장이 원본에서 바로 짚게(2026-11-22). 인테이크는 80자에서 자른다
        // 출처 줄은 신고 스냅샷의 출처로 카드·교사용과 같은 규칙(모의고사는 제목 — 저장된 줄은 과목이 뭉개진다, sql/114 코덱스 1R)
        sourceLabel: withOriginalNumber(reportSourceLabel(row.source, row.source_label), row.original_no) || undefined,
        category: isReportCategory(row.category) ? REPORT_CATEGORY_LABELS[row.category] : row.category,
        note: row.note || undefined,
      }),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, DETAIL_MAX);
      console.error(`[notify-problem-report] 인테이크 거절 ${res.status}: ${detail}`);
      await release();
      return NextResponse.json({ ok: false, reason: 'intake_failed', status: res.status }, { status: 502 });
    }
    const result: unknown = await res.json().catch(() => null);
    const reached = typeof result === 'object' && result !== null && (result as { reached?: unknown }).reached === true;
    // 못 닿았으면 잡은 표시를 푼다 — 목록에 '알림 안 감' 이 남아 원장이 그 신고를 놓치지 않게(다시 불러도 된다)
    if (!reached) await release();
    return NextResponse.json({ ok: true, reached });
  } catch (error) {
    // 보내는 중 예외(네트워크 등)면 잡은 표시가 남을 수 있다 — 푸는 것은 위 두 갈래뿐이라 여기선 알리기만 한다
    const message = error instanceof Error ? error.message : 'unknown';
    console.error(`[notify-problem-report] 예외: ${message}`);
    return NextResponse.json({ ok: false, reason: 'exception' }, { status: 500 });
  }
}
