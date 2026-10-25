import {
  DEFAULT_SIMPLE_COVER, normalizePaperCover, toCoverRow, type PaperCover, type PaperCoverRow,
} from '@/lib/problem-paper/cover';

/**
 * 책 표지 — 문제지 표지와 **같은 모양**을 `exam.books.cover`(jsonb) 한 칸에 담는다.
 *
 * 표지 창(`PaperCoverDialog`)·디자인 일곱 가지·뒷표지·그리기(`renderCoverSlots`)를 그대로 쓰려고 문제지 표지
 * 모델(`PaperCover`)을 빌린다. 칸마다 CHECK 를 두는 대신 읽을 때 `normalizePaperCover` 가 모르는 값을 걸러 낸다
 * (디자인 목록을 SQL 에 한 벌 더 베끼지 않는다 — 원장님 혼자 쓰는 표라 앱 정규화로 충분하다).
 */

/** jsonb 에 담는 모양 — `problem_paper_covers` 한 행에서 `paper_id` 만 뺀 것 */
export type BookCoverJson = Omit<PaperCoverRow, 'paper_id'>;

/**
 * 저장된 표지를 읽는다.
 * @param raw - `books.cover` (null 이면 표지 없음)
 * @returns 표지. 없거나 모양이 틀리면 null
 */
export function bookCoverOf(raw: unknown): PaperCover | null {
  return normalizePaperCover(raw);
}

/**
 * 저장할 표지 모양을 만든다 — 문제지 표지와 같은 다듬기(`toCoverRow`)를 거친다.
 * @param cover - 표지
 * @returns jsonb 본문
 */
export function toBookCoverJson(cover: PaperCover): BookCoverJson {
  const {
    kind, layout, title, subtitle, show_name_box, image_path, teacher, back_kind, back_image_path,
  } = toCoverRow('', cover);
  return { kind, layout, title, subtitle, show_name_box, image_path, teacher, back_kind, back_image_path };
}

/**
 * 표지를 고르지 않은 책의 앞표지 — 간단 디자인에 책 제목만(이름 칸 없음). 펼침면 앞면이 빈 종이로 나가지 않게.
 */
export const DEFAULT_BOOK_COVER: PaperCover = { ...DEFAULT_SIMPLE_COVER, showNameBox: false };
