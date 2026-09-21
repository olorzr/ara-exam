import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireSession } from '@/lib/require-session';
import { resolveSingleDivision } from '@/lib/grade-division';
import { buildVocabWords } from '@/lib/vocab-payload';

/**
 * ara-system(학원 관리 시스템) 성적 자동 등록 브릿지 — 발신부.
 *
 * 시험 생성 직후 클라이언트가 `{ examId }` 로 이 라우트를 호출하면,
 * 서버가 exams + exam_words 스냅샷을 읽어 ara-system 의 인증 엔드포인트로 POST 한다.
 * 공유 시크릿(ARA_SYSTEM_INTAKE_SECRET)은 서버에만 두어 브라우저에 노출하지 않는다.
 * ara-system 쪽은 멱등이라 재호출/재시험도 안전하다.
 *
 * ⚠️ **재시험은 ara-system 에서 회차를 만들지 않는다**(그쪽 mig477). 원본 회차에 딸린
 *   재시험지(exam_retake_papers)로 붙고, 학생별 차수는 채점할 때 exam_results.attempt_no 가 오른다.
 *   그래서 **원본이 아직 등록 전이면 409(parent_not_registered)** 가 돌아온다 — 예전처럼 별도
 *   회차로 폴백 등록하지 않는다(그렇게 만든 회차는 학생별 차수와 이어지지 않아 재시험 점수가
 *   원본과 따로 논다). 화면에는 경고 토스트가 뜨고, 밀린 건은 백필 스크립트가 원본을 먼저
 *   등록한 뒤 붙인다.
 *
 * 실패해도 절대 throw 하지 않는다(시험 생성 UX 를 막지 않도록) — { ok:false } 로만 알린다.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ExamWordRow {
  /** exam_words 행 PK. 객관식 선지 시드라 반드시 함께 읽어야 한다(word_id 아님). */
  id: string;
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
    // 연동 미설정. 시험 생성 자체는 이미 끝났으므로 되돌리지 않지만, **성공처럼 보이면 안 된다** —
    // 예전엔 여기서 HTTP 200 을 돌려줘 2026-07-19~09-13 두 달 동안 단어 시험 139건이 한 건도
    // 등록되지 않았는데도 상태 코드·로그·화면 어디에도 신호가 없었다. 이 저장소에는 전용 logger 가
    // 없어 console.error 로 남긴다(Vercel 함수 로그에서 보인다).
    console.error('[sync-to-grades] ARA_SYSTEM_INTAKE_URL/ARA_SYSTEM_INTAKE_SECRET 미설정 — 성적 자동 등록 skip');
    return NextResponse.json({ ok: false, skipped: true, reason: 'not_configured' }, { status: 503 });
  }

  // 호출자 인증 — service-role + 공유 시크릿으로 다운스트림 쓰기를 하는 특권 라우트이므로,
  // 반드시 로그인한 @araeducation.co.kr 사용자만 호출하게 한다(examId 만으로 아무나 트리거 방지).
  const session = await requireSession(request);
  if (!session.ok) return session.response;

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
      .select('id, word, meaning, order_index')
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
    //   여기에 **객관식 정답(보기 번호)과 선지**를 함께 실어 ara-system 이 두 벌을 보관하게 한다.
    //   어느 쪽으로 채점할지는 시험을 만들 때가 아니라 채점 화면에서 고른다(2026-09-21 사용자 결정).
    //   ⚠️ 객관식 정답은 DB 에 없고 매번 재계산되므로, 화면과 **같은 배열·같은 순서**를 넘겨야
    //     인쇄된 시험지와 정답표가 일치한다. buildVocabWords 가 그 전제를 검증하고 어긋나면 던진다.
    let vocabWords;
    try {
      vocabWords = buildVocabWords(words);
    } catch (error) {
      // 정답표가 시험지와 다를 수 있는 상태다 — 잘못된 정답표로 등록하느니 보내지 않는다.
      const message = error instanceof Error ? error.message : 'unknown';
      console.error(`[sync-to-grades] 객관식 정답 재현 실패 exam=${examId}: ${message}`);
      return NextResponse.json({ ok: false, reason: 'choices_rebuild_failed', message }, { status: 500 });
    }

    const payload = {
      sourceExamId: exam.id,
      title: exam.title,
      totalQuestions: exam.total_questions,
      format: 'subjective',
      // division 미해석(null)이면 필드를 빼서 ara-system 기본 학교급(중등부)에 맡긴다
      ...(division ? { division } : {}),
      // 재시험이면 부모 exam id + 차수를 함께 보낸다. ara-system 은 부모가 등록돼 있으면
      // 그 등록 시리즈/학교급을 상속(retake_of 연결). 부모를 못 찾으면 skip 하지 않고
      // division 으로 폴백 등록한다 — 이때 retake_of(원본 링크)만 생략하고 retake_seq 는
      // 유지해 '재시험 N차' 배지는 그대로 뜬다(재시험 유실 방지).
      ...(exam.parent_exam_id
        ? { parentSourceExamId: exam.parent_exam_id, retakeNumber: exam.retake_number ?? 1 }
        : {}),
      words: vocabWords,
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
      // 시크릿·토큰은 절대 찍지 않는다. 401 이면 주소(리다이렉트로 Authorization 유실)나 시크릿 불일치다.
      console.error(`[sync-to-grades] 인테이크 거절 ${res.status}: ${detail.slice(0, 300)}`);
      return NextResponse.json(
        { ok: false, reason: 'intake_failed', status: res.status, detail: detail.slice(0, 300) },
        { status: 502 },
      );
    }

    const result = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    console.error(`[sync-to-grades] 예외: ${message}`);
    return NextResponse.json({ ok: false, reason: 'exception', message }, { status: 500 });
  }
}
