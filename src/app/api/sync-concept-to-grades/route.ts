import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isAllowedEmailDomain } from '@/lib/constants';
import { levelGradeToDivision } from '@/lib/grade-division';

/**
 * ara-system 성적 개념 시험 자동 등록 — 발신부.
 *
 * 개념지 저장 직후 클라이언트가 `{ conceptSheetId }` 로 호출하면, 서버가 concept_sheets 를 읽어
 * 개념 단어(marks)를 정답으로, level/grade 를 학교급으로 삼아 ara-system 개념 엔드포인트로 보낸다.
 * ara-system 은 3단계(초성/글자수/빈칸) 시험으로 멱등 등록한다.
 * 실패해도 throw 하지 않는다(저장 UX 방해 금지). 공유 시크릿은 서버 env 에만 둔다.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface MarkRow {
  text?: string;
}

export async function POST(request: NextRequest) {
  const intakeUrl = process.env.ARA_SYSTEM_INTAKE_URL;
  const intakeSecret = process.env.ARA_SYSTEM_INTAKE_SECRET;
  if (!intakeUrl || !intakeSecret) {
    return NextResponse.json({ ok: false, skipped: true, reason: 'not_configured' });
  }

  // 호출자 인증 — 로그인한 @araeducation.co.kr 사용자만.
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }
  const { data: authData, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !authData?.user || !isAllowedEmailDomain(authData.user.email)) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }

  let conceptSheetId: string | undefined;
  try {
    const body = await request.json();
    conceptSheetId = body?.conceptSheetId;
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_body' }, { status: 400 });
  }
  if (typeof conceptSheetId !== 'string' || !UUID_RE.test(conceptSheetId)) {
    return NextResponse.json({ ok: false, reason: 'bad_conceptSheetId' }, { status: 400 });
  }

  try {
    const { data: sheet, error: sheetErr } = await supabaseAdmin
      .from('concept_sheets')
      .select('id, title, level, grade, marks')
      .eq('id', conceptSheetId)
      .maybeSingle();
    if (sheetErr || !sheet) {
      return NextResponse.json({ ok: false, reason: 'sheet_not_found' }, { status: 404 });
    }

    // 개념 단어(marks) → 정답. 빈 텍스트는 제외.
    const marks = (sheet.marks as MarkRow[] | null) ?? [];
    const answers = marks
      .map((m) => (typeof m?.text === 'string' ? m.text.trim() : ''))
      .filter((t) => t.length > 0);
    if (answers.length === 0) {
      // 마킹된 개념 단어가 없으면 채점할 게 없으니 등록하지 않는다.
      return NextResponse.json({ ok: false, skipped: true, reason: 'no_marks' });
    }

    const division = levelGradeToDivision(sheet.level ?? '', sheet.grade ?? '');

    const payload = {
      sourceExamId: sheet.id,
      title: sheet.title || '개념',
      ...(division ? { division } : {}),
      answers,
    };

    const res = await fetch(`${intakeUrl.replace(/\/$/, '')}/api/integrations/concept-exam`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${intakeSecret}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return NextResponse.json(
        { ok: false, reason: 'intake_failed', status: res.status, detail: detail.slice(0, 300) },
        { status: 502 },
      );
    }

    const result = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    return NextResponse.json({ ok: false, reason: 'exception', message }, { status: 500 });
  }
}
