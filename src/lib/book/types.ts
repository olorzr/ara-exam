import type { PaperCover } from '@/lib/problem-paper/cover';
import type { ProblemPaper } from '@/types/problem-bank';
import type { BookPageCounts, BookSettings } from './settings';

/**
 * 항목 종류(sql/77) — 책(장을 담아 내지까지 만든다) / 표지만(장이 없고 쪽 수를 직접 넣어 책등을 계산한다).
 * 원장님: "표지만 만들어야 할 수도 있거든"(2026-10-26).
 */
export const BOOK_KINDS = ['book', 'cover'] as const;

/** 항목 종류 */
export type BookKind = (typeof BOOK_KINDS)[number];

/** 화면에 보이는 종류 이름 */
export const BOOK_KIND_LABELS: Record<BookKind, string> = {
  book: '책',
  cover: '표지만',
};

/**
 * 저장된 종류를 믿을 수 있는 값으로 — 모르는 값은 책(sql/77 의 기본값과 같다).
 * @param raw - `books.kind`
 * @returns 종류
 */
export function normalizeBookKind(raw: unknown): BookKind {
  return raw === 'cover' ? 'cover' : 'book';
}

/** 책 한 권 — `exam.books`(sql/76·77)를 믿을 수 있게 읽은 값 */
export interface Book {
  id: string;
  title: string;
  /** 종류 — 표지만이면 장이 없다 */
  kind: BookKind;
  /** '다 만들었어요' 를 누른 때. null 이면 아직 만드는 중 */
  finishedAt: string | null;
  settings: BookSettings;
  pageCounts: BookPageCounts;
  /** 표지(앞·뒤). 없으면 null — 펼침면 앞면은 제목만 찍는 기본 */
  cover: PaperCover | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

/** 책 목록 한 줄 */
export interface BookListItem extends Book {
  chapterCount: number;
}

/** 장 하나 — 저장된 문제지 한 장(`exam.book_chapters`) */
export interface BookChapter {
  id: string;
  bookId: string;
  paperId: string;
  orderIndex: number;
  /** 장 제목 — 비우면 문제지 제목 */
  titleOverride: string;
  /** 담긴 문제지(못 읽었으면 null) */
  paper: ProblemPaper | null;
}

/** 장 제목 상한 — ⚠️ sql/76 의 CHECK(length(title_override) <= 100) 와 같아야 한다 */
export const CHAPTER_TITLE_MAX = 100;

/** 책 제목 상한 — ⚠️ sql/76 의 CHECK(length(title) BETWEEN 1 AND 100) 와 같아야 한다 */
export const BOOK_TITLE_MAX = 100;

/**
 * 한 책에 담는 장의 상한 — 내지 한 벌이 모든 장의 블록을 한 번에 재고 그리므로(측정 컨테이너 + 낱장 두 벌)
 * 너무 많으면 화면이 무거워진다. 문제지 한 장이 문항 200개까지라 이 상한이면 넉넉하다.
 */
export const BOOK_CHAPTERS_MAX = 40;

/**
 * 장 제목 — 적은 제목이 있으면 그것, 없으면 문제지 제목.
 * @param chapter - 장
 * @returns 제목('' 일 수 있다 — 문제지를 못 읽었고 제목도 안 적었을 때)
 */
export function chapterTitleOf(chapter: Pick<BookChapter, 'titleOverride' | 'paper'>): string {
  return chapter.titleOverride.trim() || chapter.paper?.title.trim() || '';
}
