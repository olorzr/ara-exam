import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ADMIN_EMAIL } from '@/lib/constants';

describe('sql/84 거울 — 작품 전문 · 개념 쓰기는 원장만', () => {
  const sql = readFileSync(path.resolve(__dirname, '../../../sql/84_reference_texts_owner_writes.sql'), 'utf8');
  const literal = `(select auth.jwt() ->> 'email') = '${ADMIN_EMAIL}'`;

  it('쓰기 정책 넷 자리(올리기 · 고치기 USING·WITH CHECK · 지우기)가 원장 이메일(ADMIN_EMAIL)에만 열린다', () => {
    expect(sql.split(literal).length - 1).toBe(4);
  });

  it('읽기 정책은 도메인 조건뿐이다 — 선생님이 계속 읽는다', () => {
    const read = sql.slice(sql.indexOf('CREATE POLICY "Authenticated users can read reference_texts"'));
    const stmt = read.slice(0, read.indexOf(';'));
    expect(stmt).toContain('FOR SELECT');
    expect(stmt).not.toContain(ADMIN_EMAIL);
  });

  it('FOR ALL 정책을 지운다', () => {
    expect(sql).toContain('DROP POLICY IF EXISTS "Authenticated users can manage reference_texts"');
  });
});
