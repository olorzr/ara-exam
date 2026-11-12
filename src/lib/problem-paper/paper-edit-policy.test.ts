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

/** sql/104 ↔ 앱 거울 — 지우기는 만든 선생님과 원장만 */
describe('sql/104 거울 — 문제지 지우기', () => {
  const sql = readFileSync(path.resolve(__dirname, '../../../sql/104_problem_paper_delete_owner.sql'), 'utf8');

  it('원장 판정이 ADMIN_EMAIL 리터럴 한 곳이고, 작성자 조건과 OR 로 묶인다', () => {
    expect(sql.split(`(select auth.jwt() ->> 'email') = '${ADMIN_EMAIL}'`).length - 1).toBe(1);
    expect(sql).toMatch(/user_id = \(select auth\.uid\(\)\)\s+OR \(select auth\.jwt\(\) ->> 'email'\)/);
  });

  it('sql/17 · 65 를 다시 돌려도 옛 전원 삭제 정책을 되살리지 않는다', () => {
    for (const file of ['17_problem_bank.sql', '65_exam_rls_initplan.sql']) {
      const old = readFileSync(path.resolve(__dirname, `../../../sql/${file}`), 'utf8');
      const guard = old.indexOf("policyname = 'Owner or director can delete problem_papers'");
      const create = old.indexOf('CREATE POLICY "Authenticated users can delete problem_papers"');
      expect(guard).toBeGreaterThan(-1);
      expect(create).toBeGreaterThan(guard);
    }
  });
});
