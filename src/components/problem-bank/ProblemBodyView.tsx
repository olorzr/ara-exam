'use client';

import { choiceGlyph } from '@/lib/problem-bank/choices';
import { stripTrailingEmptyParagraphs } from '@/lib/problem-paper/html-trim';
import { sanitizeInlineHTML, sanitizeProblemHTML } from '@/lib/sanitize-problem';
import type { Problem } from '@/types/problem-bank';

/** 그리는 데 필요한 만큼만 */
export type ProblemBody = Pick<
  Problem,
  'number' | 'question_type' | 'stem_html' | 'choices' | 'answer'
  | 'explanation_html' | 'render_mode' | 'image_path' | 'figure_paths'
>;

interface ProblemBodyViewProps {
  problem: ProblemBody;
  /** Storage 경로 → 서명 URL */
  imageUrls: Map<string, string>;
}

/**
 * 문항 하나를 **읽기 전용**으로 그린다 (발문·선지·정답·해설).
 *
 * 인쇄용 렌더러(`renderPaperBlocks`)를 재사용하지 않는 이유가 둘 있다:
 *  - 그쪽은 문제지 자리 순서로 번호를 **다시 매긴다**(7번 문항이 01 로 나온다).
 *  - 정답 강조·해설이 없다(시험지에 정답을 인쇄할 수는 없으니 당연하다).
 * 대신 CSS 스코프(`.pb-sheet`)는 그대로 공유해 모양이 갈라지지 않게 한다.
 */
export default function ProblemBodyView({ problem, imageUrls }: ProblemBodyViewProps) {
  const objective = problem.question_type === '객관식' && problem.choices.length > 0;
  const answer = problem.answer.trim();

  return (
    <div className="pb-sheet pb-sheet--screen">
      <div className="pb-q">
        <div className="pb-q__head">
          {problem.number !== null && (
            <span className="q-num q-num--mint">{String(problem.number).padStart(2, '0')}</span>
          )}
          <div
            className="pb-q__stem"
            dangerouslySetInnerHTML={{
              __html: stripTrailingEmptyParagraphs(sanitizeProblemHTML(problem.stem_html)),
            }}
          />
        </div>

        {problem.figure_paths.length > 0 && (
          <div className="pb-figure">
            {problem.figure_paths.map((path) => (
              <FigureImage key={path} path={path} urls={imageUrls} alt="자료" />
            ))}
          </div>
        )}

        {objective && (
          <div className="pb-q__choices">
            {problem.choices.map((choice, i) => {
              const isAnswer = answer === String(i + 1);
              return (
                <span
                  key={i}
                  className={`pb-q__choice${isAnswer ? ' pb-q__choice--answer' : ''}`}
                >
                  <span className="pb-q__choice-glyph">{choiceGlyph(i)}</span>
                  <span dangerouslySetInnerHTML={{ __html: sanitizeInlineHTML(choice) }} />
                  {/* 색만으로 알리지 않는다 — 글자로도 정답임을 말한다 */}
                  {isAnswer && <span className="pb-q__choice-answer-mark">정답</span>}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* 객관식은 위에서 선지에 표시했다 — 여기서 또 적으면 두 번 말하는 셈이다 */}
      {!objective && (
        <p className="mt-2 text-sm">
          <span className="font-semibold text-gray-500">정답 </span>
          {answer || <span className="text-amber-600">미입력</span>}
        </p>
      )}

      {problem.explanation_html.trim() && (
        <details className="mt-2 rounded border border-gray-200 p-2">
          <summary className="cursor-pointer text-sm font-medium text-gray-700">해설</summary>
          <div
            className="mt-1"
            dangerouslySetInnerHTML={{ __html: sanitizeProblemHTML(problem.explanation_html) }}
          />
        </details>
      )}
    </div>
  );
}

/** 문항에 딸린 자료 그림 */
function FigureImage({ path, urls, alt }: { path: string; urls: Map<string, string>; alt: string }) {
  const src = urls.get(path);
  if (!src) {
    return (
      <p className="rounded border border-dashed border-amber-400 p-2 text-center text-xs text-amber-700">
        {alt} 이미지를 불러오지 못했어요
      </p>
    );
  }
  // 서명 URL 이라 next/image 로 다룰 수 없다
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className="max-w-full rounded border border-gray-200" />;
}
