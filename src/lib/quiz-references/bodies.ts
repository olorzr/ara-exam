import { supabase } from '@/lib/supabase';
import { htmlToPlainText } from '@/lib/concept-pick/plain-text';
import { fetchPassagesByIds } from '@/lib/problem-bank/detail-queries';
import { fetchReferenceBodies } from '@/lib/reference-texts/queries';
import type { QuizReferenceKind } from './types';

/**
 * 붙인 자료의 **본문만** 읽는다.
 *
 * 후보 목록과 갈라 둔 까닭: 후보는 스무 줄씩 오는데 본문은 한 편이 수만 자다. 실제로 붙인
 * 몇 건만 읽어야 목록이 가볍다(`passage-search.ts` ↔ `detail-queries.ts` 와 같은 규약).
 *
 * ⚠️ `htmlToPlainText` 를 **파일 경로로** 가져온다 — `@/lib/concept-pick` 배럴은 `run.ts` 를
 *    다시 내보내 순환이 된다(`import-cycles.test.ts` 가 잡는다).
 */

/** 본문을 읽을 자료 — 정체만 있으면 된다 */
export interface ReferenceBodyRef {
  key: string;
  kind: QuizReferenceKind;
  id: string;
}

/**
 * 자료들의 본문을 평문으로 읽는다.
 *
 * 개념지·프린트는 한 표에 살아 한 번에 읽는다. 지문·전문은 각자 표가 따로다.
 * @param refs - 본문을 읽을 자료들
 * @returns key → 평문 지도 (못 찾은 자료는 빠진다)
 * @throws 조회 실패 시
 */
export async function loadReferencePlain(
  refs: readonly ReferenceBodyRef[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (refs.length === 0) return out;

  // 개념지와 학교 프린트는 같은 표(concept_sheets)라 한 번에 읽는다
  const sheetIds = refs.filter((r) => r.kind === 'sheet' || r.kind === 'print').map((r) => r.id);
  const passageIds = refs.filter((r) => r.kind === 'passage').map((r) => r.id);
  const textIds = refs.filter((r) => r.kind === 'text').map((r) => r.id);

  const [sheets, passages, texts] = await Promise.all([
    sheetIds.length > 0
      ? supabase.from('concept_sheets').select('id, editor_html').in('id', [...new Set(sheetIds)])
      : Promise.resolve({ data: [], error: null }),
    passageIds.length > 0 ? fetchPassagesByIds([...new Set(passageIds)]) : Promise.resolve([]),
    textIds.length > 0 ? fetchReferenceBodies([...new Set(textIds)]) : Promise.resolve(new Map()),
  ]);
  if (sheets.error) throw sheets.error;

  const sheetPlain = new Map<string, string>();
  for (const row of (sheets.data ?? []) as { id: string; editor_html: string }[]) {
    sheetPlain.set(row.id, htmlToPlainText(row.editor_html ?? ''));
  }
  const passagePlain = new Map(passages.map((p) => [p.id, htmlToPlainText(p.html ?? '')]));

  for (const ref of refs) {
    const plain = ref.kind === 'passage'
      ? passagePlain.get(ref.id)
      : ref.kind === 'text'
        ? texts.get(ref.id)
        : sheetPlain.get(ref.id);
    if (plain !== undefined) out.set(ref.key, plain);
  }
  return out;
}
