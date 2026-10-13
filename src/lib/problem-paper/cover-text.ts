/**
 * 디자인 표지에 글을 나눠 싣는 규칙 (순수 함수).
 *
 * 표지 칸은 제목·부제·이름 칸뿐이다(사용자 결정 2026-10-13 — 회차·단원·날짜 칸을 따로 두지 않는다).
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

/** 디자인 표지 하나가 받는 값 — 여섯 디자인이 모두 같은 모양을 받는다 */
export interface CoverLayoutProps {
  /** 찍을 제목(교사용·답지 꼬리까지 붙은 값 — `coverTitleFor`) */
  title: string;
  /** 부제 원문 — 간단 디자인은 줄을 나누지 않고 통째로 찍는다 */
  subtitle: string;
  course: string;
  topics: string[];
  showNameBox: boolean;
  /** 문제지를 만든 해('2026'). 모르면 '' 이고 그 조각은 그리지 않는다 */
  year: string;
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
 * 표지 글자 깔림(시안의 옅은 회색 글 바탕)에 쓸 글. 표지 내용을 이어 붙여 `minChars` 를 넘을 때까지 되풀이한다.
 * @param parts - 이어 붙일 조각(빈 조각은 건너뛴다)
 * @param minChars - 적어도 이만큼은 채운다
 * @param fallback - 조각이 모두 비었을 때 쓸 글
 * @returns 되풀이한 글
 */
export function coverFillText(parts: readonly string[], minChars: number, fallback: string): string {
  const phrase = parts.map((p) => p.trim()).filter(Boolean).join(', ') || fallback;
  const unit = `${phrase}. `;
  const times = Math.max(1, Math.ceil(minChars / unit.length));
  return unit.repeat(times);
}

/**
 * 디자인 표지가 받는 값을 만든다.
 * @param input - 찍을 제목·부제 원문·이름 칸·연도
 * @returns 디자인 컴포넌트의 props
 */
export function toCoverLayoutProps(input: {
  title: string; subtitle: string; showNameBox: boolean; year: string;
}): CoverLayoutProps {
  const { course, topics } = splitSubtitle(input.subtitle);
  return { ...input, course, topics };
}
