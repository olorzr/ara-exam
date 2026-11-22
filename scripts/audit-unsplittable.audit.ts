import { readFileSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import {
  UNSPLITTABLE_OVERFLOW_LINES, auditRecords, summarizeAudit, type AuditRecord,
} from '@/lib/problem-paper/unsplittable-audit';

/**
 * 쪼갤 수 없는 큰 덩어리 감사 — 인쇄와 같은 조각 함수로 문제 은행 덤프를 훑는다(unsplittable-audit.ts).
 *
 *   AUDIT_INPUT=<덤프.json> [AUDIT_OUTPUT=<결과.json>] [AUDIT_STRICT=1] npm run audit:unsplittable
 *
 * 덤프는 `AuditRecord[]`(지문 `{ key, passage: { html, figure_paths } }` · 문항 `{ key, question: 스냅샷 }`)이다.
 * 이 저장소에는 DB 접속 정보가 없어 덤프는 밖에서 만든다 — CLAUDE.md 0.9.92 항목. `AUDIT_STRICT` 면 한 단을 넘는
 * 덩어리가 하나라도 있을 때 실패한다(적재 문에서 쓸 자리).
 */
it('쪼갤 수 없는 큰 덩어리', () => {
  const input = process.env.AUDIT_INPUT;
  if (!input) {
    process.stdout.write('AUDIT_INPUT=<덤프.json> 을 주세요 — 덤프 모양은 이 파일 머리말에 있다.\n');
    return;
  }
  const records = JSON.parse(readFileSync(input, 'utf8')) as AuditRecord[];
  const findings = auditRecords(records);
  const summary = summarizeAudit(findings);
  process.stdout.write(`기록 ${records.length}개 · 큰 덩어리 ${findings.length}개\n${JSON.stringify(summary)}\n`);
  for (const f of findings.slice(0, 30)) {
    process.stdout.write(`  ${f.estLines}줄 ${f.reason} ${f.where}#${f.index} ${f.key} ${f.head}\n`);
  }
  if (process.env.AUDIT_OUTPUT) writeFileSync(process.env.AUDIT_OUTPUT, JSON.stringify(findings, null, 1));
  if (process.env.AUDIT_STRICT) {
    expect(findings.filter((f) => f.estLines >= UNSPLITTABLE_OVERFLOW_LINES).map((f) => f.key)).toEqual([]);
  }
});
