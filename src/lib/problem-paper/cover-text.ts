import { COVER_COPY } from './cover-copy';

/**
 * 디자인 표지에 글을 나눠 싣는 규칙 (순수 함수).
 *
 * 표지 칸은 제목·부제·이름 칸·선생님 이름뿐이다(사용자 결정 2026-10-13 — 회차·단원·날짜 칸을 따로 두지 않는다,
 * 2026-10-25 — 시안의 '선생님 송알' 줄은 문제지를 만든 선생님 이름으로 채우고 표지 창에서 고칠 수 있다).
 * 시안의 '과정' 줄과 '단원' 목록은 **부제의 줄**로 채운다 — 첫 줄이 과정, 둘째 줄부터 단원이다.
 * 연도는 문제지를 만든 해다(새로 적을 칸이 없다).
 */

/**
 * 따로 싣는 단원 수의 상한 — 넘치면 마지막 단원 줄에 ` · ` 로 잇는다(글자는 버리지 않는다).
 * 부제 칸이 여러 줄을 받게 되면서 한 글자짜리 줄을 수십 개 적을 수 있다 — 상한이 없으면 간단 표지의
 * 이름 칸이 종이 밖으로 밀리고 책등 목록이 책장을 덮는다(코덱스 1R).
 */
export const COVER_TOPICS_MAX = 6;

/** 부제를 나눈 결과 */
export interface SubtitleParts {
  /** 첫 줄 — 과정(예: '고등 1학년 · 국어 · 2학기'). 비었으면 '' */
  course: string;
  /** 둘째 줄부터 — 단원·주제를 줄마다 하나씩 */
  topics: string[];
}

/** 디자인 표지 하나가 받는 값 — 일곱 디자인이 모두 같은 모양을 받는다 */
export interface CoverLayoutProps {
  /** 찍을 제목(교사용·답지 꼬리까지 붙은 값 — `coverTitleFor`) */
  title: string;
  /** 부제 원문 — 간단 디자인은 줄을 나누지 않고 통째로 찍는다 */
  subtitle: string;
  course: string;
  topics: string[];
  /** 학생 이름 빈칸(간단 디자인은 학교·학년 반·이름 칸)을 그리는가 */
  showNameBox: boolean;
  /** 문제지를 만든 해('2026'). 모르면 '' 이고 그 조각은 그리지 않는다 */
  year: string;
  /** 선생님 이름(`coverTeacherName`). 비었으면 디자인 표지의 '선생님' 줄을 그리지 않는다 */
  teacher: string;
}

/**
 * 부제를 과정 한 줄과 단원 목록으로 나눈다. 빈 줄은 버리고 줄마다 앞뒤 공백을 걷는다.
 * 옛 한 줄 부제는 통째로 과정이 된다. 단원이 `COVER_TOPICS_MAX` 를 넘으면 넘친 것을 마지막 단원에 잇는다.
 * @param subtitle - 부제(여러 줄일 수 있다)
 * @returns 과정과 단원 목록
 */
export function splitSubtitle(subtitle: string): SubtitleParts {
  const lines = subtitle.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const all = lines.slice(1);
  const topics = all.length <= COVER_TOPICS_MAX
    ? all
    : [...all.slice(0, COVER_TOPICS_MAX - 1), all.slice(COVER_TOPICS_MAX - 1).join(' · ')];
  return { course: lines[0] ?? '', topics };
}

/**
 * 문제지를 만든 해.
 * @param createdAt - 문제지 `created_at`(ISO 시각)
 * @returns 'YYYY'. 읽을 수 없으면 ''
 */
export function coverYearOf(createdAt: string | null | undefined): string {
  if (!createdAt) return '';
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? '' : String(date.getFullYear());
}

/**
 * 디자인 표지가 받는 값을 만든다.
 * @param input - 찍을 제목·부제 원문·이름 칸·연도
 * @returns 디자인 컴포넌트의 props
 */
export function toCoverLayoutProps(input: {
  title: string; subtitle: string; showNameBox: boolean; year: string; teacher?: string;
}): CoverLayoutProps {
  const { course, topics } = splitSubtitle(input.subtitle);
  return { ...input, teacher: (input.teacher ?? '').trim(), course, topics };
}

/**
 * 표지에 찍을 선생님 이름 — 표지 창에 적은 이름이 있으면 그것, 없으면 문제지를 만든 선생님.
 * @param cover - 표지(적은 이름) — 없으면 null
 * @param creatorName - 문제지를 만든 선생님 이름(관리자시스템 profiles, 못 읽으면 '')
 * @returns 이름. 둘 다 비면 ''(선생님 줄을 그리지 않는다)
 */
export function coverTeacherName(cover: { teacher: string } | null, creatorName: string): string {
  return cover?.teacher.trim() || creatorName.trim();
}

/**
 * 단원을 한 줄로 잇는다.
 * @param topics - 단원
 * @returns `'화자와 정서 · 이미지와 감각'` (없으면 '')
 */
export function topicsLine(topics: readonly string[]): string {
  return topics.join(' · ');
}

/**
 * 과정 자리 글 — 시안의 '국어 · 논술' 자리에 과정(부제 첫 줄)을 싣고, 비면 시안 문구 그대로.
 * @param course - 과정
 * @returns 찍을 글
 */
export function courseOrSubject(course: string): string {
  return course || COVER_COPY.subject;
}

/**
 * 상표 줄 — `아라국어논술 · 과정 · 2026` 처럼 빈 조각을 건너뛰고 잇는다.
 * @param parts - 상표 뒤에 이을 조각
 * @returns 이은 글
 */
export function brandLine(...parts: readonly string[]): string {
  return [COVER_COPY.brandKo, ...parts].filter(Boolean).join(' · ');
}
