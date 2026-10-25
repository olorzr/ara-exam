import type { ReactNode } from 'react';
import type { AnswerRow, ExplanationEntry } from '@/lib/problem-paper/answers';

/** 한 줄에 담을 문항 수 — 줄 하나가 인쇄 블록 하나다(쪽이 갈려도 줄은 안 쪼개진다) */
const ITEMS_PER_ROW = 5;

/**
 * 답지 블록 — 빠른 정답 격자(5개씩 한 줄) 다음에 해설·주관식 정답.
 *
 * 문제지 답지(`ProblemAnswerKeyView`)와 책의 '정답 및 해설' 판이 **같은 함수**를 쓴다 — 두 벌로 두면 한쪽만 고쳐져
 * 같은 문항이 두 인쇄물에서 다르게 찍힌다.
 * @param rows - `buildAnswerRows(items)`
 * @param explanations - `explanationEntries(items)`
 * @param keyPrefix - 블록 key 접두사(한 문서에 답지 여러 벌이 이어질 때 — 책의 장마다)
 * @returns 인쇄 블록
 */
export function renderAnswerKeyBlocks(
  rows: readonly AnswerRow[],
  explanations: readonly ExplanationEntry[],
  keyPrefix = '',
): ReactNode[] {
  const out: ReactNode[] = [];

  for (let i = 0; i < rows.length; i += ITEMS_PER_ROW) {
    const chunk = rows.slice(i, i + ITEMS_PER_ROW);
    const band = Math.floor(i / ITEMS_PER_ROW) % 2 === 1;
    out.push(
      // 줄무늬는 nth-child 가 아니라 줄 인덱스로 준다 — 쪽이 갈리면 nth-child 는 리셋된다
      <div key={`${keyPrefix}row-${i}`} className={`pb-answer-row${band ? ' pb-answer-row--band' : ''}`}>
        {chunk.map((row) => (
          <div key={row.number} className="pb-answer-cell">
            <span className="pb-answer-num">{row.number}</span>
            <span className={`pb-answer-value pb-answer-value--${row.kind}`}>
              {row.answer}
            </span>
          </div>
        ))}
      </div>,
    );
  }

  // ⚠️ 실을 것이 하나도 없으면 제목 줄도 내지 않는다 — 기출은 해설이 안 달린 문항이 흔해서,
  //    빈 '해설' 띠만 찍히면 "해설이 인쇄에서 빠졌나" 로 읽힌다.
  //    주관식 답이 들었으면 제목에 그것도 밝힌다 — 격자의 '해설 참조' 가 여기를 가리킨다
  const hasSubjective = explanations.some((e) => e.question_type !== '객관식');
  const bandTitle = hasSubjective ? '해설 · 주관식 정답' : '해설';
  explanations.forEach((entry, i) => {
    out.push(
      // 해설 한 덩어리가 한 블록 — 번호·정답·본문이 갈리면 어느 문항 것인지 알 수 없다.
      // ⚠️ '해설' 제목은 **첫 해설과 같은 블록**이다. 따로 내보내면 쪽·단 끝에 제목만
      //    혼자 남을 수 있는데, 그러면 다음 장 첫머리에 제목 없이 해설이 시작된다
      <div key={`${keyPrefix}exp-${entry.number}`}>
        {i === 0 && (
          <div className="section-bar section-bar--mint">
            <span>{bandTitle}</span>
          </div>
        )}
        <div className="pb-key-exp">
          <span className="pb-answer-num">{entry.number}</span>
          <div className="pb-key-exp__body">
            {/* 서술형 답은 문장이라 줄을 바꾼다 — 꼬리표만 한 덩이로 둔다 */}
            <div className={`pb-key-exp__answer pb-key-exp__answer--${entry.kind}`}>
              <span className="pb-key-exp__answer-label">정답</span>
              {entry.answer}
            </div>
            {entry.explanation_html && (
              <div
                // `explanationEntries` 가 정화한 값만 담아 준다 — 여기서 또 하지 않는다
                dangerouslySetInnerHTML={{ __html: entry.explanation_html }}
              />
            )}
          </div>
        </div>
      </div>,
    );
  });

  return out;
}
