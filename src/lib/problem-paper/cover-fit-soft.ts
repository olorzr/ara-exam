import { COVER_COPY } from './cover-copy';
import { COVER_FIT_PAGE_H, type CoverFitBudget } from './cover-fit';
import {
  fitTextScale, titleLengthOf, titleScale, wrappedLineCount, type TitleScaleStep,
} from './cover-scale';
import { brandLine, topicsLine, type CoverLayoutProps } from './cover-text';

/**
 * D 블러의 글 크기 (순수 함수) — 제목·단원 줄이 함께 바닥 글 위에 들도록. 자리 px 는 soft.css 와 같다.
 */

// ---- D 블러 — 본문 top 520px · 폭 706px(오른쪽 세로 글 자리를 비운다), 바닥 글 bottom 40px ----
/** 블러 제목의 단계 — 112px 에서 7자 한 줄 */
export const SOFT_TITLE_STEPS: readonly TitleScaleStep[] = [
  { maxLength: 7, scale: 1 },
  { maxLength: 12, scale: 0.8 },
  { maxLength: 20, scale: 0.6 },
  { maxLength: 32, scale: 0.45 },
  { maxLength: Infinity, scale: 0.36 },
];
/** 본문 자리(soft.css `__body`) */
export const SOFT_BODY = { top: 520, width: 794 - 40 - 48 };
/** 제목과 단원 줄 사이(단원 줄의 위 여백) */
const SOFT_TOPIC_GAP = 22;
/** 태그라인(위 여백 80px + 22px) — soft.css 와 같다(시안은 단원 줄 아래 80px 쯤에 둔다) */
const SOFT_TAGLINE_H = 80 + 22;
const SOFT_FOOT_BOTTOM = 40;
/** 바닥 글 한 줄(12px × 1.7) · 폭 */
const SOFT_NOTE_LINE_H = 12 * 1.7;
const SOFT_NOTE_WIDTH = 260;
/** 본문과 바닥 글 사이 */
const SOFT_BREATH = 20;

/**
 * 블러의 바닥 글 줄 — 컴포넌트가 그리는 것과 같은 줄이다(높이를 같은 글로 잰다).
 * @param p - 표지 값
 * @returns 바닥 글 줄(선생님 줄은 이름이 있을 때만)
 */
export function softFootNotes(p: Pick<CoverLayoutProps, 'teacher' | 'course' | 'year'>): string[] {
  return [
    ...(p.teacher ? [`${COVER_COPY.teacherLabel}  ${p.teacher}`] : []),
    brandLine(p.course, p.year),
  ];
}

/**
 * 블러에서 제목·단원 줄이 함께 들어갈 자리 — 본문 위(520px)부터 태그라인과 바닥 글 위까지.
 * @param p - 표지 값
 * @returns 단계표로 고른 제목 배율과, 그 크기의 글 덩어리·높이
 */
export function softBodyBudget(p: CoverLayoutProps): CoverFitBudget & { title: number } {
  const title = titleScale(titleLengthOf(p.title), SOFT_TITLE_STEPS);
  const line = topicsLine(p.topics);
  const noteLines = softFootNotes(p).reduce((n, text) => n + wrappedLineCount(text, SOFT_NOTE_WIDTH / 12), 0);
  const foot = Math.max(noteLines, p.showNameBox ? 1 : 0) * SOFT_NOTE_LINE_H;
  return {
    title,
    blocks: [
      { text: p.title, fontSize: 112 * title, lineHeight: 0.95, width: SOFT_BODY.width },
      ...(line ? [{ text: line, fontSize: 28, lineHeight: 1.1, width: SOFT_BODY.width }] : []),
    ],
    height: COVER_FIT_PAGE_H - SOFT_BODY.top - SOFT_TAGLINE_H - SOFT_FOOT_BOTTOM - foot - SOFT_BREATH,
  };
}

/**
 * 블러의 제목·단원 배율 — 둘이 **함께** 바닥 글 위에 들도록 줄인다(따로 줄이면 합이 넘친다, 코덱스 2R).
 * @param p - 표지 값
 * @returns 제목·단원 배율
 */
export function softScales(p: CoverLayoutProps): { title: number; topic: number } {
  const { blocks, height, title } = softBodyBudget(p);
  const k = fitTextScale(blocks, height, SOFT_TOPIC_GAP);
  return { title: title * k, topic: k };
}
