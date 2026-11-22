'use client';

import { sourceLabelWithNumber } from '@/lib/problem-bank/source-label';
import { explanationHtml, formatAnswer, splitsExplanation } from '@/lib/problem-paper/answers';
import { yetHangulClass } from '@/lib/yet-hangul';
import type { PaperItemSnapshot, PaperSettings } from '@/types/problem-bank';

/**
 * 문제지 인쇄물의 작은 조각들 — 그림 한 장, 출처 한 줄, 교사용 답 한 덩어리.
 *
 * 블록을 그리는 곳(`PaperPrintBlocks`)에서 갈라 두었다: 글 문항과 그림 문항이 **같은
 * 조각**을 써야 두 문항의 출처·답 모양이 갈라지지 않는다.
 */

/**
 * 이미지 한 장.
 *
 * ⚠️ URL 이 없을 때 **빈 자리**를 두면 안 된다. 이미지로 출제한 문항은 그 이미지가
 *    본문 전체라, 조용히 비워 두면 문항이 통째로 빠진 시험지가 인쇄된다.
 *    눈에 보이는 자리표시자를 두고, 인쇄 자체는 호출부(문제지 화면)가 막는다.
 */
export function PrintImage({
  path, urls, alt,
}: { path: string; urls: Map<string, string>; alt: string }) {
  const src = urls.get(path);
  if (!src) {
    return (
      <div
        style={{
          border: '1px dashed #b45309', color: '#b45309', fontSize: '9pt',
          padding: '16px 8px', textAlign: 'center',
        }}
      >
        이미지를 불러오지 못했어요 ({alt})
      </div>
    );
  }
  // 서명 URL 이라 next/image 로 다룰 수 없고, 인쇄에서는 지연 로딩이 치명적이다
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} />;
}

/**
 * 문항 **위**에 붙는 출처 한 줄.
 *
 * ⚠️ 자리가 위인 것이 중요하다(2026-09-20, 사용자 결정). 아래에 있으면 선지 다음에 오는데,
 *    그 자리는 다음 문항의 머리와 붙어 보여 **어느 문항의 출처인지** 읽히지 않는다.
 * ⚠️ 라벨은 [sourceLabel](../../lib/problem-bank/source-label.ts) 한 곳에서 만든다 —
 *    예전에는 여기서 학년을 뺀 짧은 판을 따로 만들어, 같은 출처가 화면(카드·상세)에서는
 *    '2026 중2 상현중 중간' 인데 인쇄물에서는 '2026 상현중 중간' 으로 찍혔다.
 */
export function SourceLine({ source, number = null }: { source: PaperItemSnapshot['source']; number?: number | null }) {
  const text = sourceLabelWithNumber(source, number);
  if (!text) return null;
  return <p className="pb-q__source">{text}</p>;
}

/**
 * 문항 위 출처 줄을 찍을지·무엇을 찍을지 — 글 문항(`PaperQuestion`)과 그림 문항(`PaperPrintBlocks`)이 같이 쓴다.
 *
 * - 학생용: 문제지 설정(`showSource`, 툴바의 '출처 숨기기')대로, 원래 번호는 없다
 * - **교사용: 설정과 상관없이 출처 + 원래 번호**(2026-11-22 원장 요청 — "출처 숨기기 하면 교사용에서는 안 숨기게, 문제 오류 확인을 해야 해서",
 *   "원본에서는 그 시험지의 몇 번이었는지 교사용에서는 보여 줘"). 틀린 문항을 원본 시험지에서 바로 짚게 한다
 *
 * ⚠️ 규칙을 호출부(문제지 보기·책 내지)에 두지 말 것 — 기출 공유 사이트가 이 파일을 그대로 옮겨 쓰므로 여기 하나여야
 *    세 곳(문제지·책·공유 사이트)의 교사용이 같다. 쪼개기·쪽 나눔은 그려진 DOM 을 재므로 줄이 늘어도 따로 할 일이 없다.
 */
export function QuestionSource({
  snapshot, settings, showAnswers,
}: { snapshot: PaperItemSnapshot; settings: Pick<PaperSettings, 'showSource'>; showAnswers: boolean }) {
  if (showAnswers) return <SourceLine source={snapshot.source} number={snapshot.number} />;
  return settings.showSource ? <SourceLine source={snapshot.source} /> : null;
}

/**
 * 교사용에서 문항 바로 밑에 붙는 답과 해설.
 *
 * ⚠️ **답 줄은** 마지막 선지와 같은 조각 안에 있어야 한다(`.pb-q`, 2026-11-06 부터 문항은 단위 사이에서
 *    갈린다). 따로 블록으로 내보내면 쪽이나 단이 갈릴 때 답만 다른 장에 찍혀, 채점하며 장을 넘겨야 한다
 *    (학교 프린트 문답의 교사용과 같은 규약).
 * ⚠️ **해설은 짧을 때만** 여기 붙인다. 해설은 길이에 상한이 없어서, 긴 것을 이 블록에
 *    담으면 한 쪽을 넘기는 순간 인쇄 엔진이 **문항·선지·답까지 통째로 축소**해 찍는다
 *    (코덱스 정지 리뷰). 긴 해설은 `blocks.ts` 가 문단 단위 블록으로 갈라 흘려 보낸다 —
 *    **판정은 두 곳이 같은 `splitsExplanation`** 을 쓴다(갈리면 두 번 찍히거나 사라진다).
 */
export function TeacherAnswer({ snapshot }: { snapshot: PaperItemSnapshot }) {
  const answer = formatAnswer(snapshot.question_type, snapshot.answer, snapshot.choices.length);
  // ⚠️ 판정도 그릴 것도 **정화한 값** 기준이다 — 날글자로 재면 지워질 태그만 든 해설을
  //    '길다' 고 보고 갈라낸 뒤 그릴 것이 없어진다(코덱스 정지 리뷰 2R)
  const explanation = splitsExplanation(snapshot.explanation_html)
    ? '' : explanationHtml(snapshot.explanation_html);

  return (
    <>
      <p className="pb-q__answer">
        <span className="pb-q__answer-label">정답</span>
        <span className={yetHangulClass(answer)}>{answer}</span>
      </p>
      {explanation && (
        <div
          className="pb-q__explanation"
          // `explanationHtml` 이 이미 정화했다 — 여기서 또 하지 않는다
          dangerouslySetInnerHTML={{ __html: explanation }}
        />
      )}
    </>
  );
}
