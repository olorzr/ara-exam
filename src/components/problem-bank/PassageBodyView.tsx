'use client';

import { sanitizeProblemHTML } from '@/lib/sanitize-problem';
import { BodyWithFigures } from './ProblemBodyView';
import type { Passage } from '@/types/problem-bank';

/** 그리는 데 필요한 만큼만 — 목록 조회가 컬럼을 좁혀 오는 자리도 있다 */
export type PassageBody = Pick<
  Passage, 'html' | 'render_mode' | 'image_path' | 'title' | 'label'
> & {
  /** 본문 제자리에 끼울 그림들. 옛 스냅샷·좁힌 조회에는 없을 수 있다 */
  figure_paths?: string[];
};

interface PassageBodyViewProps {
  passage: PassageBody;
  /** `image_path` 의 서명 URL. 이미지 지문인데 없으면 자리표시자를 그린다 */
  imageUrl?: string | null;
  /** 본문에 끼울 그림들의 서명 URL (Storage 경로 → URL) */
  figureUrls?: Map<string, string>;
}

/**
 * 지문 본문을 **읽기 전용**으로 그린다.
 *
 * 인쇄와 **같은 CSS 스코프**(`.pb-sheet`)를 쓴다 — 〈보기〉 상자·(가) 머리글·[A] 세로선의
 * 규칙이 이미 인쇄와 편집기 두 벌이라, 세 번째 사본을 만들면 어느 한 벌만 고쳐져
 * 화면과 인쇄가 조용히 갈라진다(box-labels.ts 의 경고와 같은 이유).
 *
 * ⚠️ 저장 시점에 이미 정화했더라도 여기서 **한 번 더** 정화한다 — 진입이
 *    `dangerouslySetInnerHTML` 이고, DB 를 직접 건드린 값이 섞일 수 있다(개념지와 같은 다층 방어).
 */
export default function PassageBodyView({
  passage, imageUrl, figureUrls,
}: PassageBodyViewProps) {
  if (passage.render_mode === 'image' && passage.image_path) {
    if (!imageUrl) {
      // 조용히 비우면 "지문이 원래 없는 문항" 처럼 보인다
      return (
        <p className="rounded border border-dashed border-amber-400 p-4 text-center text-xs text-amber-700">
          지문 이미지를 불러오지 못했어요
        </p>
      );
    }
    return (
      // 서명 URL 이라 next/image 로 다룰 수 없다
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={passage.title || passage.label || '지문'}
        className="max-w-full rounded border border-gray-200"
      />
    );
  }

  return (
    <div className="pb-sheet pb-sheet--screen">
      <div className="pb-passage-part pb-passage-part--first pb-passage-part--last">
        <BodyWithFigures
          html={sanitizeProblemHTML(passage.html)}
          paths={passage.figure_paths ?? []}
          urls={figureUrls ?? new Map()}
        />
      </div>
    </div>
  );
}
