import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ADMIN_EMAIL } from '@/lib/constants';
import { DEFAULT_SIMPLE_COVER } from '@/lib/problem-paper/cover';
import { bookCoverOf, DEFAULT_BOOK_COVER, toBookCoverJson } from './cover';
import { BOOK_TITLE_MAX, CHAPTER_TITLE_MAX } from './types';

describe('sql/76 거울', () => {
  const sql = readFileSync(path.resolve(__dirname, '../../../sql/76_books.sql'), 'utf8');

  it('제목 상한이 앱 상수와 같다', () => {
    expect(sql).toContain(`CHECK (length(btrim(title)) BETWEEN 1 AND ${BOOK_TITLE_MAX})`);
    expect(sql).toContain(`CHECK (length(title_override) <= ${CHAPTER_TITLE_MAX})`);
  });

  it('두 표의 정책(USING·WITH CHECK)과 저장소 books/ 정책 셋이 원장 이메일(ADMIN_EMAIL)에만 열린다', () => {
    const literal = `(select auth.jwt() ->> 'email') = '${ADMIN_EMAIL}'`;
    expect(sql.split(literal).length - 1).toBe(4 + 3);
    const storage = `name NOT LIKE 'books/%' OR ${literal}`;
    expect(sql.split(storage).length - 1).toBe(3);
  });

  it('책에 담긴 문제지는 지울 수 없다(RESTRICT)', () => {
    expect(sql).toContain('REFERENCES exam.problem_papers(id) ON DELETE RESTRICT');
  });
});

describe('책 표지 jsonb', () => {
  it('문제지 표지와 같은 모양으로 저장했다가 그대로 읽는다', () => {
    const cover = { ...DEFAULT_SIMPLE_COVER, layout: 'zine' as const, title: '국어', backKind: 'design' as const };
    const json = toBookCoverJson(cover);
    expect(json).not.toHaveProperty('paper_id');
    expect(bookCoverOf(json)).toEqual(cover);
  });

  it('비었거나 모양이 틀리면 표지 없음', () => {
    expect(bookCoverOf(null)).toBeNull();
    expect(bookCoverOf({ kind: 'what' })).toBeNull();
  });

  it('기본 책 표지는 간단 디자인이고 이름 칸이 없다', () => {
    expect(DEFAULT_BOOK_COVER.kind).toBe('simple');
    expect(DEFAULT_BOOK_COVER.showNameBox).toBe(false);
  });
});
