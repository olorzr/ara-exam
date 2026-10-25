import type { CoverTitleSuffix } from '@/lib/problem-paper/cover';
import { DEFAULT_INNER_PAPER, isInnerPaperCode } from './inner-papers';

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
  /** 책등 바탕색 `#rrggbb` */
  spineColor: string;
  /** 책등 글자 — 비우면 책 제목 */
  spineText: string;
  /** 뒷표지가 없을 때 펼침면 뒷면의 바탕 */
  backFill: BackFill;
}

/** 책등 글자 상한 */
export const SPINE_TEXT_MAX = 60;

/** 책등 색 고르기 칸의 바로 고를 수 있는 색 — 남색 · 먹색 · 진녹 · 버건디 · 회색 · 검정 */
export const SPINE_COLOR_PRESETS: readonly { value: string; label: string }[] = [
  { value: '#1f3a5f', label: '남색' },
  { value: '#2f3437', label: '먹색' },
  { value: '#1f4d3a', label: '진녹' },
  { value: '#6b1e2e', label: '버건디' },
  { value: '#8a8f98', label: '회색' },
  { value: '#000000', label: '검정' },
];

/** 새 책의 설정 */
export const DEFAULT_BOOK_SETTINGS: BookSettings = {
  innerPaper: DEFAULT_INNER_PAPER,
  columns: 2,
  chapterStart: 'odd',
  trimWorks: true,
  spineColor: SPINE_COLOR_PRESETS[0].value,
  spineText: '',
  backFill: 'white',
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
    spineColor: typeof v.spineColor === 'string' && HEX_COLOR.test(v.spineColor)
      ? v.spineColor.toLowerCase() : d.spineColor,
    spineText: typeof v.spineText === 'string' ? v.spineText.trim().slice(0, SPINE_TEXT_MAX) : d.spineText,
    backFill: v.backFill === 'spine' || v.backFill === 'white' ? v.backFill : d.backFill,
  };
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
  settings: Pick<BookSettings, 'columns' | 'chapterStart' | 'trimWorks'>;
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
  ]);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
