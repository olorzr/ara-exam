import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isAllowedEmailDomain } from '@/lib/constants';
import { resolveSingleDivision } from '@/lib/grade-division';

/**
 * ara-system(학원 관리 시스템) 성적 자동 등록 브릿지 — 발신부.
 *
 * 시험 생성 직후 클라이언트가 `{ examId }` 로 이 라우트를 호출하면,
 * 서버가 exams + exam_words 스냅샷을 읽어 ara-system 의 인증 엔드포인트로 POST 한다.
 * 공유 시크릿(ARA_SYSTEM_INTAKE_SECRET)은 서버에만 두어 브라우저에 노출하지 않는다.
 * ara-system 쪽은 멱등이라 재호출/재시험도 안전하다.
 *
 * 실패해도 절대 throw 하지 않는다(시험 생성 UX 를 막지 않도록) — { ok:false } 로만 알린다.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ExamWordRow {
  word: string;
  meaning: string;
  order_index: number;
}

interface CategoryRow {
  level: string;
  grade: string;
}

/** created_at(UTC) → KST 기준 YYYY-MM-DD */
function toKstDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    // en-CA 로케일은 YYYY-MM-DD 형식을 준다.
    return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const intakeUrl = process.env.ARA_SYSTEM_INTAKE_URL;
  const intakeSecret = process.env.ARA_SYSTEM_INTAKE_SECRET;
  if (!intakeUrl || !intakeSecret) {
    // 연동 미설정 — 조용히 skip(성적 연동을 안 쓰는 배포에서도 시험 생성은 정상 동작)
    return NextResponse.json({ ok: false, skipped: true, reason: 'not_configured' });
  }

  // 호출자 인증 — service-role + 공유 시크릿으로 다운스트림 쓰기를 하는 특권 라우트이므로,
  // 반드시 로그인한 @araeducation.co.kr 사용자만 호출하게 한다(examId 만으로 아무나 트리거 방지).
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }
  const { data: authData, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !authData?.user || !isAllowedEmailDomain(authData.user.email)) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }

  let examId: string | undefined;
  try {
    const body = await request.json();
    examId = body?.examId;
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_body' }, { status: 400 });
  }
  if (typeof examId !== 'string' || !UUID_RE.test(examId)) {
    return NextResponse.json({ ok: false, reason: 'bad_examId' }, { status: 400 });
  }

  try {
    // 1) 시험 메타 + 단어 스냅샷 읽기(RLS 우회 admin)
    const { data: exam, error: examErr } = await supabaseAdmin
      .from('exams')
      .select('id, title, total_questions, pass_count, pass_percentage, category_ids, parent_exam_id, retake_number, created_at')
      .eq('id', examId)
      .maybeSingle();
    if (examErr || !exam) {
      return NextResponse.json({ ok: false, reason: 'exam_not_found' }, { status: 404 });
    }

    const { data: examWords, error: wordsErr } = await supabaseAdmin
      .from('exam_words')
      .select('word, meaning, order_index')
      .eq('exam_id', examId)
      .order('order_index');
    if (wordsErr) {
      return NextResponse.json({ ok: false, reason: 'words_read_failed' }, { status: 500 });
    }

    const words = (examWords as ExamWordRow[] | null) ?? [];

    // 학교급 도출 — 시험 카테고리의 level/grade 로 ara-system 학교급을 결정.
    // 조회 실패 시엔 임의 학교급으로 오등록하지 않도록 division 을 미상(null)으로 둔다.
    const categoryIds = (exam.category_ids as string[] | null) ?? [];
    let division: string | null = null;
    if (categoryIds.length > 0) {
      const { data: cats, error: catErr } = await supabaseAdmin
        .from('categories')
        .select('level, grade')
        .in('id', categoryIds);
      // 조회 실패면 학교급을 못 정하는데, division 을 빼면 ara-system 이 기본 중등부로 넣어
      // 고등 시험이 오등록될 수 있다. 외부지문(진짜 학교급 없음)과 구분해 sync 를 실패시킨다.
      if (catErr) {
        return NextResponse.json({ ok: false, reason: 'category_read_failed' }, { status: 500 });
      }
      division = resolveSingleDivision((cats as CategoryRow[] | null) ?? []);
    }

    // 2) ara-system 페이로드 조립.
    //   주관식(뜻 보고 단어 쓰기)이 기본 채점 형태 → answer = 단어(word), type='주관식'.
    const payload = {
      sourceExamId: exam.id,
      title: exam.title,
      totalQuestions: exam.total_questions,
      format: 'subjective',
      // division 미해석(null)이면 필드를 빼서 ara-system 기본 학교급(중등부)에 맡긴다
      ...(division ? { division } : {}),
      // 재시험이면 부모 exam id + 차수를 함께 보낸다. ara-system 은 부모의 등록 시리즈/학교급을
      // 그대로 상속하고(카테고리 삭제돼도 안전), 부모가 미등록(원본 opt-out)이면 재시험도 skip.
      // retake_number 로 '재시험 N차' 배지를 붙인다.
      ...(exam.parent_exam_id
        ? { parentSourceExamId: exam.parent_exam_id, retakeNumber: exam.retake_number ?? 1 }
        : {}),
      words: words.map((w) => ({
        no: (w.order_index ?? 0) + 1,
        answer: w.word,
        type: '주관식',
      })),
      passCount: exam.pass_count,
      passPercentage: exam.pass_percentage,
      examDate: toKstDate(exam.created_at),
    };

    // 3) ara-system 인증 엔드포인트로 전송
    const res = await fetch(`${intakeUrl.replace(/\/$/, '')}/api/integrations/vocab-exam`, {
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
