'use client';

import { sanitizeProblemHTML } from '@/lib/sanitize-problem';
import { sourceLabel } from '@/lib/problem-bank/source-label';
import { formatAnswer } from '@/lib/problem-paper/answers';
import type { PaperItemSnapshot } from '@/types/problem-bank';

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
export function SourceLine({ source }: { source: PaperItemSnapshot['source'] }) {
  const text = sourceLabel(source);
  if (!text) return null;
  return <p className="pb-q__source">{text}</p>;
}

/**
 * 교사용에서 문항 바로 밑에 붙는 답과 해설.
 *
 * ⚠️ 이것은 **문항과 같은 블록 안**에 있어야 한다(`.pb-q`). 따로 블록으로 내보내면
 *    쪽이나 단이 갈릴 때 물음과 답이 다른 장에 찍혀, 채점하며 장을 넘겨야 한다
 *    (학교 프린트 문답의 교사용과 같은 규약).
 */
export function TeacherAnswer({ snapshot }: { snapshot: PaperItemSnapshot }) {
  const answer = formatAnswer(snapshot.question_type, snapshot.answer);
  const explanation = snapshot.explanation_html?.trim() ?? '';

  return (
    <>
      <p className="pb-q__answer">
        <span className="pb-q__answer-label">정답</span>
        {answer}
      </p>
      {explanation && (
        <div
          className="pb-q__explanation"
          // 저장할 때 이미 걸렀지만 스냅샷은 jsonb 라 DB 를 직접 건드린 값이 섞일 수 있다
          dangerouslySetInnerHTML={{ __html: sanitizeProblemHTML(explanation) }}
        />
      )}
    </>
  );
}
