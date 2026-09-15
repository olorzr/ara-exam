import { passagePickName, type PassagePickRow } from '@/lib/problem-bank/passage-search';
import { sourceLabel } from '@/lib/problem-bank/source-label';
import type { ReferenceTextListItem } from '@/types/reference-text';
import { QUIZ_REFERENCE_KIND_LABELS, type QuizReferenceKind } from './types';

/**
 * 참고자료의 이름과 부제 (순수 함수).
 *
 * ⚠️ 이름 앞에 **종류를 붙인다.** 이 이름이 정답표에 `[개념지 · 봄봄]` 으로 찍히는데,
 *    종류가 없으면 채점하는 사람이 어느 자료를 펴야 할지 모른다.
 */

/** 개념지 목록 줄 가운데 이름을 만드는 데 필요한 것만 */
export interface SheetLabelRow {
  title: string;
  year: string;
  grade: string;
  publisher: string;
  unit: string;
  subunit: string;
  school_name: string;
  print_bundle_id: string | null;
}

/**
 * 개념지 행이 개념지인가 학교 프린트인가.
 *
 * 한 표(`concept_sheets`)에 둘이 같이 사는데 화면에서는 다른 메뉴다 —
 * 이름에 '개념지' 라고 찍어 놓고 프린트 목록에서 찾게 하면 안 된다.
 * @param row - 개념지 행
 * @returns 자료 종류
 */
export function sheetKind(row: Pick<SheetLabelRow, 'print_bundle_id'>): QuizReferenceKind {
  return row.print_bundle_id ? 'print' : 'sheet';
}

/**
 * 개념지·프린트의 이름.
 * @param row - 개념지 행
 * @returns `개념지 · 봄봄`
 */
export function sheetLabel(row: SheetLabelRow): string {
  const name = row.title.trim() || row.unit.trim() || '제목 없는 개념지';
  return `${QUIZ_REFERENCE_KIND_LABELS[sheetKind(row)]} · ${name}`;
}

/**
 * 개념지·프린트의 부제 — 같은 이름이 여럿일 때 어느 것인지 가린다.
 * @param row - 개념지 행
 * @returns 한 줄
 */
export function sheetSubtitle(row: SheetLabelRow): string {
  return [row.year, row.grade, row.school_name || row.publisher, row.unit, row.subunit]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' · ');
}

/**
 * 기출 지문의 이름.
 * @param row - 지문 줄
 * @returns `기출 지문 · 봄봄`
 */
export function passageLabel(row: Pick<PassagePickRow, 'title' | 'label'>): string {
  return `${QUIZ_REFERENCE_KIND_LABELS.passage} · ${passagePickName(row)}`;
}

/**
 * 기출 지문의 부제.
 * @param row - 지문 줄
 * @returns 출처 한 줄
 */
export function passageSubtitle(row: PassagePickRow): string {
  return [sourceLabel(row.source), row.author.trim()].filter(Boolean).join(' · ');
}

/**
 * 작품 전문의 이름.
 * @param row - 전문 목록 줄
 * @returns `전문 · 봄봄`
 */
export function textLabel(row: Pick<ReferenceTextListItem, 'title'>): string {
  return `${QUIZ_REFERENCE_KIND_LABELS.text} · ${row.title.trim() || '제목 없는 전문'}`;
}

/**
 * 작품 전문의 부제.
 * @param row - 전문 목록 줄
 * @returns 지은이와 길이
 */
export function textSubtitle(row: Pick<ReferenceTextListItem, 'author' | 'char_count'>): string {
  return [row.author.trim(), `${row.char_count.toLocaleString()}자`].filter(Boolean).join(' · ');
}
