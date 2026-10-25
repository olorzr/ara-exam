import { supabase } from '@/lib/supabase';
import { uploadProblemFile } from '@/lib/problem-bank/storage';
import { bookCoverPath, newFigureToken } from '@/lib/problem-bank/storage-paths';
import { escapeIlike } from '@/lib/problem-bank/query-chain';
import { normalizePaperSettings } from '@/lib/problem-paper/settings';
import type { PaperItemSnapshot, ProblemPaper } from '@/types/problem-bank';
import { bookCoverOf, type BookCoverJson } from './cover';
import { normalizeBookSettings, normalizePageCounts, type BookPageCounts, type BookSettings } from './settings';
import { normalizeBookKind, type Book, type BookChapter, type BookKind, type BookListItem } from './types';

/**
 * 책 읽기·쓰기 (`exam.books` · `exam.book_chapters`, sql/76 · sql/77).
 *
 * 두 표 모두 RLS 가 **원장 이메일**에만 열려 있다 — 다른 선생님은 읽기조차 0행이다(화면 게이트는 보조).
 * 원장님 혼자 쓰므로 낙관적 동시성은 두지 않는다(문제지 표지와 같은 판단 — 나중 저장이 이긴다).
 */

/** 책 조회 컬럼 — ⚠️ 한 줄 리터럴이어야 PostgREST 행 타입 추론이 풀리지 않는다 */
const BOOK_COLUMNS = 'id, title, kind, finished_at, settings, page_counts, cover, user_id, created_at, updated_at';

/** 목록 상한 */
export const BOOK_LIST_LIMIT = 200;

/** 장 고르기 창에 보여 줄 문제지 수 */
export const PAPER_PICKER_LIMIT = 200;

/** 문제지 한 장에서 읽는 항목 상한 — 문제지는 200문항까지라 넉넉하다(문제지 보기 화면과 같은 값) */
const PAPER_ITEMS_LIMIT = 300;

interface BookRow {
  id: string;
  title: string;
  kind: unknown;
  finished_at: string | null;
  settings: unknown;
  page_counts: unknown;
  cover: unknown;
  user_id: string;
  created_at: string;
  updated_at: string;
}

function toBook(row: BookRow): Book {
  return {
    id: row.id,
    title: row.title,
    kind: normalizeBookKind(row.kind),
    finishedAt: row.finished_at ?? null,
    settings: normalizeBookSettings(row.settings),
    pageCounts: normalizePageCounts(row.page_counts),
    cover: bookCoverOf(row.cover),
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPaper(row: ProblemPaper): ProblemPaper {
  return { ...row, settings: normalizePaperSettings(row.settings) };
}

/** 목록 조건 — 사이드바 세 화면(표지 만들기 · 내지 만들기 · 다 만든 책)이 이것으로 갈린다 */
export interface BookListQuery {
  /** 종류 — 비우면 둘 다 */
  kind?: BookKind;
  /** 다 만든 것만(true) / 만드는 중인 것만(false) */
  finished: boolean;
}

/**
 * 책 목록 — 장 수도 함께 센다. 만드는 중이면 최근에 만든 것부터, 다 만든 책이면 최근에 끝낸 것부터.
 * @param query - 목록 조건
 * @returns 책들
 * @throws 조회 실패 시
 */
export async function fetchBooks(query: BookListQuery): Promise<BookListItem[]> {
  let request = supabase.from('books').select(`${BOOK_COLUMNS}, book_chapters(count)`);
  if (query.kind) request = request.eq('kind', query.kind);
  request = query.finished
    ? request.not('finished_at', 'is', null).order('finished_at', { ascending: false })
    : request.is('finished_at', null);
  const { data, error } = await request
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(BOOK_LIST_LIMIT);
  if (error) throw error;
  return ((data ?? []) as (BookRow & { book_chapters: { count: number }[] })[]).map((row) => ({
    ...toBook(row),
    chapterCount: row.book_chapters?.[0]?.count ?? 0,
  }));
}

/**
 * 새 항목을 만든다. 종류는 만들 때만 정한다(뒤에 바꾸는 길은 두지 않는다 — 표지만 항목에 장이 담기면 안 된다).
 * @param title - 제목
 * @param kind - 종류
 * @returns 만든 항목
 * @throws 저장 실패 시
 */
export async function createBook(title: string, kind: BookKind): Promise<Book> {
  const { data, error } = await supabase.from('books').insert({ title, kind }).select(BOOK_COLUMNS).single();
  if (error) throw error;
  return toBook(data as BookRow);
}

/** 책에서 고칠 수 있는 칸 */
export interface BookPatch {
  title?: string;
  settings?: BookSettings;
  page_counts?: BookPageCounts;
  cover?: BookCoverJson | null;
  /** 다 만든 때(ISO) — null 이면 다시 만드는 중 */
  finished_at?: string | null;
}

/**
 * 책을 고친다.
 * @param id - 책 id
 * @param patch - 바꿀 칸
 * @returns DB 에 실제로 들어간 책
 * @throws 저장 실패·0행이면
 */
export async function updateBook(id: string, patch: BookPatch): Promise<Book> {
  const { data, error } = await supabase.from('books').update(patch).eq('id', id).select(BOOK_COLUMNS).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('책을 찾지 못했어요. 지워졌는지 목록에서 확인해 주세요.');
  return toBook(data as BookRow);
}

/**
 * 책을 지운다. 장은 함께 지워지고 담긴 문제지는 그대로 남는다.
 * ⚠️ `delete()` 는 0행을 지워도 error 가 null 이라 지운 행을 돌려받아 확인한다.
 * @param id - 책 id
 * @throws 지우지 못했으면
 */
export async function deleteBook(id: string): Promise<void> {
  const { data, error } = await supabase.from('books').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('이미 지워졌거나 지울 수 없는 책이에요.');
}

interface ChapterRow {
  id: string;
  book_id: string;
  paper_id: string;
  order_index: number;
  title_override: string;
  paper: ProblemPaper | null;
}

const CHAPTER_COLUMNS = 'id, book_id, paper_id, order_index, title_override, paper:problem_papers(*)';

function toChapter(row: ChapterRow): BookChapter {
  return {
    id: row.id,
    bookId: row.book_id,
    paperId: row.paper_id,
    orderIndex: row.order_index,
    titleOverride: row.title_override ?? '',
    paper: row.paper ? toPaper(row.paper) : null,
  };
}

/**
 * 책 한 권과 장들(차례대로)을 읽는다.
 * @param id - 책 id
 * @returns 책(없으면 null)과 장
 * @throws 조회 실패 시
 */
export async function fetchBook(id: string): Promise<{ book: Book | null; chapters: BookChapter[] }> {
  const [bookRes, chapterRes] = await Promise.all([
    supabase.from('books').select(BOOK_COLUMNS).eq('id', id).maybeSingle(),
    supabase.from('book_chapters').select(CHAPTER_COLUMNS).eq('book_id', id)
      .order('order_index').order('created_at'),
  ]);
  if (bookRes.error) throw bookRes.error;
  if (chapterRes.error) throw chapterRes.error;
  return {
    book: bookRes.data ? toBook(bookRes.data as BookRow) : null,
    chapters: ((chapterRes.data ?? []) as unknown as ChapterRow[]).map(toChapter),
  };
}

/**
 * 장(문제지)마다 항목 스냅샷을 읽는다 — 문제지마다 **따로** 묻는다(한 번에 `.in()` 으로 받으면 PostgREST
 * 기본 상한 1,000행에 말없이 잘린다).
 * @param paperIds - 문제지 id 들
 * @returns 문제지 id → 항목(차례대로)
 * @throws 하나라도 못 읽으면 — 장 하나가 빈 채로 인쇄되면 안 된다
 */
export async function fetchChapterItems(paperIds: readonly string[]): Promise<Map<string, PaperItemSnapshot[]>> {
  const unique = [...new Set(paperIds)];
  const results = await Promise.all(unique.map(async (paperId) => {
    const { data, error } = await supabase.from('problem_paper_items').select('order_index, snapshot')
      .eq('paper_id', paperId).order('order_index').limit(PAPER_ITEMS_LIMIT);
    if (error) throw error;
    return [paperId, ((data ?? []) as { snapshot: PaperItemSnapshot }[]).map((r) => r.snapshot)] as const;
  }));
  return new Map(results);
}

/**
 * 장을 더한다(맨 뒤).
 * @param bookId - 책 id
 * @param paperId - 문제지 id
 * @param orderIndex - 자리(맨 뒤 번호)
 * @returns 더한 장
 * @throws 저장 실패 시(같은 문제지를 두 번 담으면 23505)
 */
export async function addChapter(bookId: string, paperId: string, orderIndex: number): Promise<BookChapter> {
  const { data, error } = await supabase.from('book_chapters')
    .insert({ book_id: bookId, paper_id: paperId, order_index: orderIndex })
    .select(CHAPTER_COLUMNS).single();
  if (error) throw error;
  return toChapter(data as unknown as ChapterRow);
}

/**
 * 장을 뺀다(문제지는 그대로).
 * @param id - 장 id
 * @throws 지우지 못했으면
 */
export async function removeChapter(id: string): Promise<void> {
  const { data, error } = await supabase.from('book_chapters').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('이미 빠졌거나 뺄 수 없는 장이에요.');
}

/**
 * 장 차례를 한 번에 다시 매긴다 — 넘긴 차례대로 0, 1, 2 …
 * `(book_id, order_index)` 유일 제약이 DEFERRABLE 이라 한 문장 upsert 안에서 자리를 맞바꿔도 된다(sql/76).
 * ⚠️ 장 제목은 보내지 않는다 — upsert 는 보낸 칸만 고치므로, 제목을 실으면 그 사이 고친 제목을 옛 값으로 되돌린다(코덱스 2R).
 * @param chapters - 새 차례의 장들
 * @throws 저장 실패 시
 */
export async function reorderChapters(chapters: readonly BookChapter[]): Promise<void> {
  if (chapters.length === 0) return;
  const rows = chapters.map((c, i) => ({ id: c.id, book_id: c.bookId, paper_id: c.paperId, order_index: i }));
  const { error } = await supabase.from('book_chapters').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
}

/**
 * 장 제목을 바꾼다(비우면 문제지 제목).
 * @param id - 장 id
 * @param title - 제목
 * @throws 저장 실패 시
 */
export async function updateChapterTitle(id: string, title: string): Promise<void> {
  const { data, error } = await supabase.from('book_chapters').update({ title_override: title }).eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('장을 찾지 못했어요.');
}

/** 장 고르기 창의 문제지 한 줄 */
export type PickerPaper = Pick<ProblemPaper, 'id' | 'title' | 'total_questions' | 'source_labels' | 'created_at'>;

/**
 * 장으로 담을 문제지 — 누가 만들었든 전부(학원 공유), 최근 것부터. 제목 검색은 서버에서 한다.
 * @param search - 제목 검색어(비우면 전부)
 * @returns 문제지들
 * @throws 조회 실패 시
 */
export async function fetchPapersForPicker(search: string): Promise<PickerPaper[]> {
  let request = supabase.from('problem_papers').select('id, title, total_questions, source_labels, created_at');
  const keyword = search.trim();
  if (keyword) request = request.ilike('title', `%${escapeIlike(keyword)}%`);
  const { data, error } = await request
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(PAPER_PICKER_LIMIT);
  if (error) throw error;
  return (data ?? []) as PickerPaper[];
}

/**
 * 책 표지 그림을 올리고 경로를 돌려준다. 이름은 한 번만 쓰는 것이라 옛 그림을 덮지 않는다.
 * @param bookId - 책 id
 * @param jpeg - 다시 인코딩한 JPEG (`encodeCoverJpeg`)
 * @returns 버킷 기준 경로
 */
export async function uploadBookCoverImage(bookId: string, jpeg: Blob): Promise<string> {
  const path = bookCoverPath(bookId, newFigureToken());
  await uploadProblemFile(path, jpeg, 'image/jpeg');
  return path;
}
