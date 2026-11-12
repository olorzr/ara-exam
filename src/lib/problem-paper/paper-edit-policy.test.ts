import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ADMIN_EMAIL } from '@/lib/constants';
import { PAPER_MAX_ITEMS } from './bulk-add';
import { PAPER_EDIT_BLOCKS, PAPER_EDIT_STATES_MAX } from './paper-edit';

/** sql/103 ↔ 앱 거울 — 한쪽만 고치면 화면과 DB 가 다른 판정을 한다 */
describe('sql/103 거울 — 문제지 고치기', () => {
  const sql = readFileSync(path.resolve(__dirname, '../../../sql/103_problem_paper_edit.sql'), 'utf8');

  it('원장 판정이 ADMIN_EMAIL 리터럴 한 곳이다', () => {
    expect(sql.split(`(select auth.jwt() ->> 'email') = '${ADMIN_EMAIL}'`).length - 1).toBe(1);
  });

  it('막힘 HINT 토큰이 앱의 까닭 목록과 같다', () => {
    for (const reason of PAPER_EDIT_BLOCKS) {
      expect(sql).toMatch(new RegExp(`(HINT = '${reason}'|'${reason}')`));
    }
    expect(sql).toContain("HINT = 'conflict'");
    expect(sql).toContain("HINT = 'missing'");
  });

  it('문항 상한·상태 RPC 상한이 같다', () => {
    expect(sql).toContain(`v_count > ${PAPER_MAX_ITEMS}`);
    expect(sql).toContain(`cardinality(p_paper_ids), 0) > ${PAPER_EDIT_STATES_MAX}`);
  });

  it('설정은 columns · showSource 만 받고 omr · showScore 는 저장값을 지킨다', () => {
    expect(sql).toContain("jsonb_build_object('omr', v_old_settings -> 'omr', 'showScore', v_old_settings -> 'showScore')");
  });
});
