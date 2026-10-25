import { COVER_COPY } from './cover-copy';
import { fitTextScale } from './cover-scale';
import { courseOrSubject, topicsLine, type CoverLayoutProps } from './cover-text';

/**
 * F 라인드로잉의 글 크기 (순수 함수) — 제목 한 줄, 상자 모서리 라벨, 정보 격자. 자리 px 는 zine.css 와 같다.
 */

/** 제목 줄: 폭 686px − 연필통 44px − 간격 16px · 60px(자간 0.1em) · 위 50px 에서 상자(150px) 위까지 */
export const ZINE_TITLE = { width: 686 - 44 - 16, fontSize: 60, tracking: 1.1, height: 70 };
/** 상자 모서리 라벨: 38px(자간 0.02em) · 폭 상한 480px · 두 줄까지 */
export const ZINE_LABEL = { fontSize: 38, tracking: 1.02, maxWidth: 480, height: 80 };
/** 정보 격자(top 374px · 폭 686px · 칸 사이 20px · 1.3fr 1fr 1.2fr .8fr): 16px × 1.55, 상자2(470px) 위까지 */
export const ZINE_INFO = { fontSize: 16, lineHeight: 1.55, height: 470 - 374 - 12, teacherWidth: 189, courseWidth: 174 };

/**
 * 라인드로잉 제목 배율 — 한 줄(길면 두 줄)에 담는다.
 * @param title - 제목
 * @returns 배율
 */
export function zineTitleScale(title: string): number {
  return fitTextScale([{
    text: title, fontSize: ZINE_TITLE.fontSize, lineHeight: 1, width: ZINE_TITLE.width / ZINE_TITLE.tracking,
  }], ZINE_TITLE.height);
}

/**
 * 상자 모서리 라벨 — 단원 줄, 없으면 과정, 그마저 없으면 '문제지'.
 * @param p - 표지 값
 * @returns 라벨 글
 */
export function zineLabel(p: Pick<CoverLayoutProps, 'topics' | 'course'>): string {
  return topicsLine(p.topics) || p.course || COVER_COPY.sheet;
}

/**
 * 라벨 배율 — 상자 그림을 덮지 않게 두 줄까지.
 * @param label - `zineLabel`
 * @returns 배율
 */
export function zineLabelScale(label: string): number {
  // 자간만큼 한 줄에 덜 든다 — 빼먹으면 두 줄로 잰 라벨이 세 줄로 찍혀 상자 그림을 덮는다(코덱스 1R)
  return fitTextScale([{
    text: label, fontSize: ZINE_LABEL.fontSize, lineHeight: 1, width: ZINE_LABEL.maxWidth / ZINE_LABEL.tracking,
  }], ZINE_LABEL.height);
}

/**
 * 정보 격자 배율 — 선생님 이름·과정이 길어도 상자2 위에 든다(칸마다 재고 가장 작은 값을 함께 쓴다).
 * @param p - 표지 값
 * @returns 배율
 */
export function zineInfoScale(p: Pick<CoverLayoutProps, 'teacher' | 'course'>): number {
  const cell = (text: string, width: number) => fitTextScale(
    [{ text, fontSize: ZINE_INFO.fontSize, lineHeight: ZINE_INFO.lineHeight, width }], ZINE_INFO.height,
  );
  return Math.min(
    p.teacher ? cell(`${COVER_COPY.teacherLabel}\n${p.teacher}`, ZINE_INFO.teacherWidth) : 1,
    cell(`${COVER_COPY.brandKo}\n${courseOrSubject(p.course)}`, ZINE_INFO.courseWidth),
  );
}
