'use client';

import { choiceGlyph } from '@/lib/problem-bank/choices';
import { splitByFigurePlaceholders } from '@/lib/problem-bank/figure-placeholders';
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
  /**
   * 이미지로 출제하는 문항인가.
   *
   * ⚠️ 이때 글은 **온전하지 않다.** 프롬프트가 "옮길 수 있는 글자만 적으라" 고 시켰고
   *    OCR 이 그림·표가 있는 문항을 이미지 출제로 저장한다(save.ts). 글만 보여 주면
   *    그림이 통째로 빠진 문항을 보고 문제지에 담게 된다 — 인쇄와 같은 것을 보여 준다.
   */
  const asImage = problem.render_mode === 'image' && Boolean(problem.image_path);
  const objective = !asImage && problem.question_type === '객관식' && problem.choices.length > 0;
  const answer = problem.answer.trim();

  return (
    <div className="pb-sheet pb-sheet--screen">
      <div className="pb-q">
        <div className="pb-q__head">
          {problem.number !== null && (
            <span className="q-num q-num--mint">{String(problem.number).padStart(2, '0')}</span>
          )}
          {!asImage && (
            <div className="pb-q__stem">
              <BodyWithFigures
                html={stripTrailingEmptyParagraphs(sanitizeProblemHTML(problem.stem_html))}
                paths={problem.figure_paths}
                urls={imageUrls}
              />
            </div>
          )}
        </div>

        {asImage && (
          <FigureImage path={problem.image_path} urls={imageUrls} alt="문항" />
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

/**
 * 본문을 그리되 **그림 자리표시자 자리에 그림을 끼운다.**
 *
 * ⚠️ 자리표시자가 없는데 그림이 있으면(옛 행이나 검수에서 갓 붙인 것) **본문 끝에** 붙인다.
 *    안 그리면 그림이 어디에도 안 나와 있는 줄도 모른다.
 */
export function BodyWithFigures({
  html, paths, urls,
}: { html: string; paths: readonly string[]; urls: Map<string, string> }) {
  const chunks = splitByFigurePlaceholders(html);
  const placed = new Set(
    chunks.filter((c) => c.kind === 'figure').map((c) => (c as { index: number }).index),
  );
  const trailing = paths
    .map((path, i) => ({ path, index: i + 1 }))
    .filter(({ path, index }) => Boolean(path) && !placed.has(index));

  return (
    <>
      {chunks.map((chunk, i) => (chunk.kind === 'html' ? (
        <div key={i} dangerouslySetInnerHTML={{ __html: chunk.html }} />
      ) : (
        <FigureImage
          key={i}
          path={paths[chunk.index - 1] ?? ''}
          urls={urls}
          alt={`자료 ${chunk.index}`}
        />
      )))}
      {trailing.length > 0 && (
        <div className="pb-figure">
          {trailing.map(({ path, index }) => (
            <FigureImage key={path} path={path} urls={urls} alt={`자료 ${index}`} />
          ))}
        </div>
      )}
    </>
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
