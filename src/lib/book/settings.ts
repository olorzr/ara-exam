import type { CoverTitleSuffix } from '@/lib/problem-paper/cover';
import { DEFAULT_INNER_PAPER, isInnerPaperCode } from './inner-papers';
import { DEFAULT_SPINE_FONT, isSpineFontId, type SpineFontId } from './spine-fonts';

/**
 * 책 설정·판(에디션)·쪽 수 기록 (순수 함수).
 *
 * 설정은 `exam.books.settings`(jsonb) 한 칸이다 — 원장님 혼자 쓰는 표라 칸마다 CHECK 를 두지 않고
 * 읽을 때 `normalizeBookSettings` 가 모르는 값을 기본으로 되돌린다(문제지 `normalizePaperSettings` 와 같은 꼴).
 */

/**
 * 판 — 한 책을 셋으로 뽑는다(사용자 결정 2026-10-25): 학생용(문제만) · 교사용(정답 표시) · 정답 및 해설.
 * 판마다 내지 쪽 수가 달라 책등 두께와 표지 작업사이즈도 따로다.
 */
export const BOOK_EDITIONS = ['student', 'teacher', 'key'] as const;

/** 판 */
export type BookEdition = (typeof BOOK_EDITIONS)[number];

/** 화면에 보이는 판 이름 */
export const EDITION_LABELS: Record<BookEdition, string> = {
  student: '학생용',
  teacher: '교사용',
  key: '정답 및 해설',
};

/** 판마다 표지·머리글 제목 꼬리 — 문제지 인쇄물의 꼬리 규약(`CoverTitleSuffix`)을 함께 쓴다 */
export const EDITION_SUFFIX: Record<BookEdition, CoverTitleSuffix> = {
  student: '',
  teacher: ' - 교사용',
  key: ' - 정답 및 해설',
};

/**
 * 알려진 판인가.
 * @param value - 검사할 값
 * @returns `BOOK_EDITIONS` 의 하나면 true
 */
export function isBookEdition(value: unknown): value is BookEdition {
  return typeof value === 'string' && (BOOK_EDITIONS as readonly string[]).includes(value);
}

/** 장 시작 — 오른쪽 면(홀수 쪽) / 바로 다음 쪽 */
export type ChapterStart = 'odd' | 'page';

/** 뒷표지를 고르지 않았을 때 펼침면 뒷면의 바탕 */
export type BackFill = 'white' | 'spine';

/** 책 설정 */
export interface BookSettings {
  /** 내지 용지(열림인쇄 코드) — 책등 두께 계산에 쓴다 */
  innerPaper: string;
  /** 내지 단 수 — 모든 장에 함께 걸린다(엔진의 단 수는 문서 전체에 하나다) */
  columns: 1 | 2;
  /** 장 시작 */
  chapterStart: ChapterStart;
  /** (가)(나) 복합 지문에서 묻지 않는 작품의 구역을 빼고 인쇄한다(문제지 화면의 같은 선택) */
  trimWorks: boolean;
  /** 내지 첫 쪽에 목차(장 제목과 시작 쪽)를 넣는다 — 내지 배치를 바꾸므로 구성 지문에 든다 */
  toc: boolean;
  /** 책등 바탕색 `#rrggbb` */
  spineColor: string;
  /**
   * 책등 글자색(제목 · 학원 이름) — `'auto'` 면 바탕과 대비가 큰 쪽(검정/흰색, `spineInkFor`), 아니면 `#rrggbb`.
   * 그릴 때는 `resolveSpineInk` 한 함수로 정한다. 표지 전용이라 구성 지문에 넣지 않는다
   */
  spineInk: string;
  /** 책등 글자 — 비우면 책 제목 */
  spineText: string;
  /** 책등 제목 글꼴(아래쪽 학원 이름은 늘 지마켓 산스) — 표지 전용이라 구성 지문에 넣지 않는다 */
  spineFont: SpineFontId;
  /** 뒷표지가 없을 때 펼침면 뒷면의 바탕 */
  backFill: BackFill;
  /**
   * 표지만 항목의 판별 쪽 수(직접 넣은 값, 4의 배수로 올리기 전). 책은 쓰지 않는다 — 책은 내지 화면이 잰다.
   * ⚠️ 내지 구성 지문(`bookLayoutKey`)에 넣지 않는다 — 내지 배치를 바꾸지 않는 값이다.
   */
  manualPages: BookManualPages;
}

/** 판별 직접 넣은 쪽 수 */
export type BookManualPages = Partial<Record<BookEdition, number>>;

/**
 * 직접 넣는 쪽 수 상한 — 열림인쇄 무선제본 내지는 수백 쪽이 보통이라, 오타(0 하나 더)를 걸러 내는 값이다.
 * 이보다 크면 정규화가 버린다.
 */
export const MANUAL_PAGES_MAX = 2000;

/** 책등 글자 상한 */
export const SPINE_TEXT_MAX = 60;

/**
 * 책등 색 고르기 칸의 바로 고를 수 있는 색 — 파스텔 여덟 + 진한 색 둘(원장님 2026-10-26 "기본 색이 너무 칙칙해, 파스텔톤이 좋아").
 * 파스텔은 글자색이 검정으로 잡히고(`spineInkFor`) 진한 둘은 흰 글자다. ⚠️ 값은 소문자 — 정규화가 소문자로 바꾸고
 * 고르기 칸이 글자 그대로 견줘 고른 칸을 표시한다.
 */
export const SPINE_COLOR_PRESETS: readonly { value: string; label: string }[] = [
  { value: '#f6c6d0', label: '연분홍' },
  { value: '#f8d3b8', label: '살구' },
  { value: '#f7e6a6', label: '연노랑' },
  { value: '#d4e8b8', label: '연두' },
  { value: '#bfe5d9', label: '민트' },
  { value: '#bcd8f0', label: '하늘' },
  { value: '#d3cdef', label: '라벤더' },
  { value: '#e4c9e3', label: '연보라' },
  { value: '#1f3a5f', label: '남색' },
  { value: '#2f3437', label: '먹색' },
];

/** 책등 글자색 '자동'(바탕과 대비가 큰 쪽) */
export const SPINE_INK_AUTO = 'auto';

/**
 * 책등 글자색 바로 고르기 — 검정 · 흰색과, 파스텔 바탕에 어울리는 짙은 색(원장님 2026-10-26 "책등 글자 색도 바꿀 수 있으면").
 * ⚠️ 값은 소문자(고른 칸 표시가 글자 그대로 견준다).
 */
export const SPINE_INK_PRESETS: readonly { value: string; label: string }[] = [
  { value: '#111111', label: '검정' },
  { value: '#ffffff', label: '흰색' },
  { value: '#2f3437', label: '먹색' },
  { value: '#1f3a5f', label: '남색' },
  { value: '#5a3d8a', label: '진보라' },
  { value: '#a8325e', label: '진분홍' },
  { value: '#2f6b4f', label: '진초록' },
  { value: '#6b4630', label: '초코' },
];

/** 새 책의 설정 */
export const DEFAULT_BOOK_SETTINGS: BookSettings = {
  innerPaper: DEFAULT_INNER_PAPER,
  columns: 2,
  chapterStart: 'odd',
  trimWorks: true,
  toc: true,
  spineColor: SPINE_COLOR_PRESETS[0].value,
  spineInk: SPINE_INK_AUTO,
  spineText: '',
  spineFont: DEFAULT_SPINE_FONT,
  backFill: 'white',
  manualPages: {},
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/**
 * 저장된 설정을 믿을 수 있는 값으로 바꾼다 — 저장값은 존중하되 모르는 값·모양이 틀린 값은 기본으로.
 * @param raw - `books.settings`
 * @returns 설정
 */
export function normalizeBookSettings(raw: unknown): BookSettings {
  const v = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_BOOK_SETTINGS;
  return {
    innerPaper: isInnerPaperCode(v.innerPaper) ? v.innerPaper : d.innerPaper,
    columns: v.columns === 1 ? 1 : v.columns === 2 ? 2 : d.columns,
    chapterStart: v.chapterStart === 'page' || v.chapterStart === 'odd' ? v.chapterStart : d.chapterStart,
    trimWorks: typeof v.trimWorks === 'boolean' ? v.trimWorks : d.trimWorks,
    toc: typeof v.toc === 'boolean' ? v.toc : d.toc,
    spineColor: typeof v.spineColor === 'string' && HEX_COLOR.test(v.spineColor)
      ? v.spineColor.toLowerCase() : d.spineColor,
    spineInk: typeof v.spineInk === 'string' && HEX_COLOR.test(v.spineInk) ? v.spineInk.toLowerCase() : d.spineInk,
    spineText: typeof v.spineText === 'string' ? v.spineText.trim().slice(0, SPINE_TEXT_MAX) : d.spineText,
    spineFont: isSpineFontId(v.spineFont) ? v.spineFont : d.spineFont,
    backFill: v.backFill === 'spine' || v.backFill === 'white' ? v.backFill : d.backFill,
    manualPages: normalizeManualPages(v.manualPages),
  };
}

/**
 * 쪽 수 하나가 쓸 만한가 — 양의 정수이고 상한 안.
 * @param value - 검사할 값
 * @returns 쓸 만하면 true
 */
export function isManualPageCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= MANUAL_PAGES_MAX;
}

/**
 * 직접 넣은 쪽 수를 믿을 수 있는 값으로 — 알려진 판의 쓸 만한 값만 남긴다.
 * @param raw - `settings.manualPages`
 * @returns 판별 쪽 수
 */
function normalizeManualPages(raw: unknown): BookManualPages {
  const v = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: BookManualPages = {};
  for (const edition of BOOK_EDITIONS) {
    if (isManualPageCount(v[edition])) out[edition] = v[edition];
  }
  return out;
}

/**
 * 잰 쪽 수 한 판 — 4의 배수로 채운 총 쪽 수(PDF 에 담기는 수)와 그때의 구성 지문.
 * 표지 화면은 지문이 지금 구성과 같을 때만 이 쪽 수로 책등을 그린다(`bookLayoutKey`).
 */
export interface BookPageCount {
  pages: number;
  key: string;
}

/** 판별 잰 쪽 수 */
export type BookPageCounts = Partial<Record<BookEdition, BookPageCount>>;

/**
 * 저장된 쪽 수 기록을 믿을 수 있는 값으로 — 모양이 틀린 판은 버린다(다시 재면 된다).
 * @param raw - `books.page_counts`
 * @returns 판별 쪽 수
 */
export function normalizePageCounts(raw: unknown): BookPageCounts {
  const v = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: BookPageCounts = {};
  for (const edition of BOOK_EDITIONS) {
    const entry = v[edition];
    if (!entry || typeof entry !== 'object') continue;
    const { pages, key } = entry as Record<string, unknown>;
    if (typeof pages === 'number' && Number.isInteger(pages) && pages > 0 && typeof key === 'string' && key) {
      out[edition] = { pages, key };
    }
  }
  return out;
}

/** 내지 배치를 바꾸는 값 — 이것이 같으면 쪽 수도 같다 */
export interface BookLayoutInput {
  edition: BookEdition;
  /** 책 제목(머리글에 찍힌다) */
  title: string;
  settings: Pick<BookSettings, 'columns' | 'chapterStart' | 'trimWorks' | 'toc'>;
  /** 장 차례대로 — 문제지 id 와 장 제목(장 머리 블록 높이가 제목 길이를 따른다) */
  chapters: readonly { paperId: string; title: string }[];
}

/**
 * 내지 구성 지문 — 장 차례·제목·단 수 등 쪽 수를 바꾸는 값을 FNV-1a 로 줄인 글자.
 *
 * 쪽 수는 내지 화면이 재서 저장하고 표지 화면이 그 값으로 책등을 그린다. 그 사이 장을 바꾸면 옛 쪽 수로 책등이
 * **조용히** 틀린다 — 그래서 쪽 수와 함께 이 지문을 저장하고, 표지 화면은 지금 지문과 다르면 다시 재라고 막는다.
 * @param input - 내지 배치를 바꾸는 값
 * @returns 8자리 16진수
 */
export function bookLayoutKey(input: BookLayoutInput): string {
  const text = JSON.stringify([
    input.edition, input.title.trim(), input.settings.columns, input.settings.chapterStart, input.settings.trimWorks,
    input.chapters.map((c) => [c.paperId, c.title.trim()]),
    // 목차는 맨 뒤에 덧붙였다 — 앞 칸의 차례를 바꾸지 않으려고(지문은 어차피 달라진다: 2026-10-26 기존 책은 다시 잰다)
    input.settings.toc,
  ]);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
