import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireSession } from '@/lib/require-session';
import { DEFAULT_PASS_PERCENTAGE, EXTERNAL_LEVEL } from '@/lib/constants';
import { levelGradeToDivision } from '@/lib/grade-division';
import { passCountOf } from '@/lib/pass-count';

/**
 * ara-system 성적 개념 시험 자동 등록 — 발신부.
 *
 * 개념지 저장 직후 클라이언트가 `{ conceptSheetId }` 로 호출하면, 서버가 concept_sheets 를 읽어
 * 개념 단어(marks)를 정답으로, level/grade 를 학교급으로 삼아 ara-system 개념 엔드포인트로 보낸다.
 * ara-system 은 개념지 1개당 채점 회차 1개를 '개념시험 > 교과서 > 학년+학기' 폴더에 멱등 등록한다
 * (초성/글자수/빈칸은 인쇄물 구분일 뿐이라 회차를 나누지 않는다). 폴더 라우팅을 위해
 * publisher/grade/semester 와 단원 기반 표시명(unitTitle)을 함께 보낸다.
 *
 * 외부지문 및 프린트는 출판사·학기가 없으므로 **publisher 슬롯에 학교명을 보낸다** —
 * 안 보내면 학교가 무엇이든 전부 '기타' 그룹 한 곳에 뭉친다. 수신부 RPC
 * (ara-system register_concept_exam, mig257)에서 publisher 는 그룹 폴더명,
 * grade+semester 는 시리즈 폴더명으로 쓰이는 **표시용 문자열**이고 학교급 라우팅은
 * 별도 division 이 담당하므로 슬롯을 이렇게 재사용해도 안전하다. 년도는 시리즈에 넣지
 * 않는다 — ara-system 이 회차 라벨(YY-NN)을 연도별로 다시 세므로(mig343) 교과서
 * 시리즈도 년도 없이 해마다 재사용한다.
 *
 * 합격 기준(커트라인): 개념지에도 pass_percentage 가 있다(sql/25, 기본 80). 단어시험과 같은 규약으로
 * passPercentage·passCount 를 함께 보내면 ara-system 이 실컬럼(exam_subtype.pass_count)에 저장하고
 * 합격/불합격(exam_results.passed)을 판정한다. 개수 계산식(CEIL)은 passCountOf 한 곳이다.
 *
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
    // 연동 미설정. 저장은 이미 끝났으니 되돌리지 않지만 성공처럼 보이면 안 된다
    // (sync-to-grades 의 같은 분기 주석 참조 — 이 침묵이 두 달짜리 장애를 가렸다).
    console.error('[sync-concept-to-grades] ARA_SYSTEM_INTAKE_URL/ARA_SYSTEM_INTAKE_SECRET 미설정 — 성적 자동 등록 skip');
    return NextResponse.json({ ok: false, skipped: true, reason: 'not_configured' }, { status: 503 });
  }

  // 호출자 인증 — 로그인한 @araeducation.co.kr 사용자만.
  const session = await requireSession(request);
  if (!session.ok) return session.response;

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
      .select('id, title, level, grade, publisher, semester, unit, subunit, school_name, marks, pass_percentage')
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

    // 폴더 라우팅용 카테고리 + 단원 기반 표시명 (폴더가 교과서·학년을 표현하므로 접두사 불필요)
    const unitTitle = [sheet.unit, sheet.subunit]
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .filter(Boolean)
      .join(' ');

    // 그룹 폴더: 중등/고등은 출판사, 외부지문은 학교명 (위 JSDoc 참조)
    const groupName = sheet.level === EXTERNAL_LEVEL
      ? sheet.school_name ?? ''
      : sheet.publisher ?? '';

    // 합격 기준 — 개념지 값(없던 시절 행은 DEFAULT 80 이 채워져 있다).
    const passPercentage = typeof sheet.pass_percentage === 'number'
      ? sheet.pass_percentage
      : DEFAULT_PASS_PERCENTAGE;

    const payload = {
      sourceExamId: sheet.id,
      title: sheet.title || '개념',
      ...(division ? { division } : {}),
      publisher: groupName,
      grade: sheet.grade ?? '',
      semester: sheet.semester ?? '',
      ...(unitTitle ? { unitTitle } : {}),
      answers,
      passPercentage,
      passCount: passCountOf(passPercentage, answers.length),
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
      // 시크릿·토큰은 절대 찍지 않는다. 401 이면 주소나 시크릿 불일치다.
      console.error(`[sync-concept-to-grades] 인테이크 거절 ${res.status}: ${detail.slice(0, 300)}`);
      return NextResponse.json(
        { ok: false, reason: 'intake_failed', status: res.status, detail: detail.slice(0, 300) },
        { status: 502 },
      );
    }

    const result = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    console.error(`[sync-concept-to-grades] 예외: ${message}`);
    return NextResponse.json({ ok: false, reason: 'exception', message }, { status: 500 });
  }
}
