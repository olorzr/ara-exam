import { markBlanks } from '@/lib/problem-bank/blanks';
import { markFootnotes } from '@/lib/problem-bank/footnotes';
import { createHost } from '@/lib/print/table-dom';
import { sanitizeProblemHTML } from '@/lib/sanitize-problem';
import type { PaperItemSnapshot } from '@/types/problem-bank';
import { splitPassagePieces } from './box-parts';
import { cutCandidatesOf, cutParagraph, paragraphOf } from './part-cuts';
import { questionCuts, questionUnits, type QuestionUnit } from './question-units';

/**
 * 쪼갤 수 없는 큰 덩어리 찾기(감사, 순수 함수 — DOM 파싱은 쓴다).
 *
 * 인쇄 엔진은 블록을 쪽을 넘겨 쪼개지 못해, 한 단보다 큰 덩어리는 통째로 다음 단으로 밀리거나(앞 단이 빈다) 줄어
 * 찍힌다. 같은 부류의 제보가 세 번 있었다(2026-09-27 큰 (가) 상자, 2026-11-15 긴 줄바꿈 문단, 2026-11-22 (가) 안의 [A]).
 * 그래서 **인쇄와 같은 조각 함수**(`splitPassagePieces`·`questionUnits`)로 문제 은행 전체를 훑어, 쪼갤 수 없는 단위의
 * 어림 줄 수가 문턱을 넘는 지문·발문을 찾는다. 배치를 재지 않는 어림이라 정확한 높이는 아니다 — 고칠 후보를 고른다.
 * 실행은 `npm run audit:unsplittable`(scripts/audit-unsplittable.audit.ts).
 */

/** 2단 한 줄에 드는 글자 수 어림(10pt 본문, 단 폭 약 328px) */
export const UNIT_CHARS_PER_LINE = 24;

/** 이 줄 수를 넘으면 알린다 — 단의 3분의 1쯤. 밀리면 그만큼 빈다 */
export const UNSPLITTABLE_WARN_LINES = 15;

/** 이 줄 수를 넘으면 한 단에 안 들어가 줄어 찍힌다 — 첫 쪽 한 단 어림 */
export const UNSPLITTABLE_OVERFLOW_LINES = 38;

/** 쪼갤 수 없는 까닭 */
export type UnsplittableReason = 'nested-box' | 'box' | 'table' | 'list' | 'lines' | 'prose' | 'choice' | 'other';

/** 쪼갤 수 없는 단위 하나 */
export interface UnsplittableUnit {
  /** 어디의 단위인가 */
  where: 'passage' | 'stem' | 'choice';
  /** 그 안에서 몇 번째 조각·단위·선지인가(0부터) */
  index: number;
  reason: UnsplittableReason;
  /** 보이는 글자 수(공백 뺌) */
  chars: number;
  /** 어림 줄 수 */
  estLines: number;
  /** 앞 40자 — 사람이 찾아보게 */
  head: string;
}

/** 감사할 기록 하나 — 지문이나 문항 스냅샷 */
export interface AuditRecord {
  key: string;
  passage?: { html: string; figure_paths?: string[] };
  question?: PaperItemSnapshot;
}

/** 감사 결과 한 줄 */
export interface AuditFinding extends UnsplittableUnit {
  key: string;
}

/** 줄이 끝나는 자리 — 줄바꿈과 블록의 끝 */
const LINE_END = /<br\s*\/?>|<\/(?:p|li|tr|h3|h4|blockquote|table|ul|ol|figure|div)>/gi;

/**
 * HTML 의 글자 수와 어림 줄 수 — 줄마다 `UNIT_CHARS_PER_LINE` 자로 꺾인다고 본다.
 * @param html - 조각 HTML
 * @returns 글자 수(공백 뺌)와 줄 수
 */
export function estimateLines(html: string): { chars: number; lines: number } {
  const text = createHost(html.replace(LINE_END, '\n'))?.textContent ?? html.replace(/<[^>]*>/g, '');
  let chars = 0;
  let lines = 0;
  for (const line of text.split('\n')) {
    const visible = line.replace(/\s+/g, '');
    if (!visible) continue;
    chars += visible.length;
    lines += Math.ceil(line.trim().length / UNIT_CHARS_PER_LINE);
  }
  return { chars, lines };
}

/**
 * 조각이 왜 한 덩어리인가.
 * @param html - 조각 HTML
 * @returns 까닭
 */
function reasonOf(html: string): UnsplittableReason {
  const start = html.trimStart().slice(0, 12).toLowerCase();
  if (start.startsWith('<blockquote')) return 'box';
  if (start.startsWith('<table')) return 'table';
  if (start.startsWith('<ul') || start.startsWith('<ol')) return 'list';
  if (start.startsWith('<p')) return /<br\s*\/?>/i.test(html) ? 'lines' : 'prose';
  return 'other';
}

/**
 * 상자 조각 안에 남은 상자인가 — 바깥 상자를 터뜨린 조각(`box` 표시)인데 그 자체가 또 상자면 풀지 못한 안쪽 상자다
 * (문단 아닌 것이 끼었거나 세 겹째·속성 — box-parts.ts 의 `innerPieces`).
 */
function nestedReason(box: unknown, html: string): UnsplittableReason | undefined {
  return box && html.trimStart().toLowerCase().startsWith('<blockquote') ? 'nested-box' : undefined;
}

/** 앞 40자 — 사람이 찾아보게 */
function headOf(html: string): string {
  return (createHost(html)?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
}

/** 단위 하나를 감사 결과로 — 문턱 아래면 null */
function unitOf(where: UnsplittableUnit['where'], index: number, html: string, minLines: number, reason?: UnsplittableReason): UnsplittableUnit | null {
  const { chars, lines } = estimateLines(html);
  if (lines < minLines) return null;
  return { where, index, reason: reason ?? reasonOf(html), chars, estLines: lines, head: headOf(html) };
}

/**
 * 재서 자를 수 있는 문단에서 **자를 자리 사이의 가장 큰 조각** — 그 조각은 어디서도 못 자른다(코덱스 1R).
 * 문장 끝이 하나만 있어도 문단은 '자를 수 있다' 가 되지만, 4천 자 첫 문장은 여전히 한 덩어리로 줄어 찍힌다.
 * 2줄 규칙(`MIN_CHUNK_LINES`)이 작은 조각을 더 묶을 수는 있어도 이 조각보다 작아지지는 않는다 — 아래 끝 어림이다.
 * @param html - 조각 HTML (문단)
 * @returns 가장 큰 조각 HTML, 자를 자리가 없으면 null
 */
function largestSpanHtml(html: string): string | null {
  const p = paragraphOf(html);
  const candidates = p ? cutCandidatesOf(p) : [];
  if (!p || candidates.length === 0) return null;
  let best: string | null = null;
  let bestLines = -1;
  for (const span of cutParagraph(p, candidates, candidates.map((_, i) => i))) {
    const { lines } = estimateLines(span);
    if (lines > bestLines) [best, bestLines] = [span, lines];
  }
  return best;
}

/**
 * 지문에서 쪼갤 수 없는 큰 조각들 — 인쇄(`passage-blocks.ts`)와 같은 정화·표시·쪼개기를 거친다.
 * 그림 조각은 뺀다. 재서 자를 수 있는 문단은 자를 자리 사이의 가장 큰 조각으로 잰다(`largestSpanHtml`).
 * @param html - 지문 HTML
 * @param figures - 지문 그림 경로들
 * @param minLines - 이 줄 수 이상만
 * @returns 큰 조각들
 */
export function passageUnsplittables(html: string, figures: readonly string[] = [], minLines = UNSPLITTABLE_WARN_LINES): UnsplittableUnit[] {
  const pieces = splitPassagePieces(markBlanks(markFootnotes(sanitizeProblemHTML(html))), figures);
  return pieces.flatMap((piece, i) => {
    if (piece.figurePath) return [];
    const span = largestSpanHtml(piece.html);
    const unit = span
      ? unitOf('passage', i, span, minLines)
      : unitOf('passage', i, piece.html, minLines, nestedReason(piece.box, piece.html));
    return unit ? [unit] : [];
  });
}

/** 답 쓰는 빈칸 어림 줄 수(48px) */
const BLANK_LINES = 2;

/** 문항 단위 하나의 HTML 과 자리(어디의 몇 번째) — 줄 수를 셀 것이 없으면 null(그림·표 선지) */
function unitHtml(unit: QuestionUnit, index: number, snapshot: PaperItemSnapshot): { html: string; where: 'stem' | 'choice'; at: number } | null {
  if (unit.kind === 'head' || unit.kind === 'stem') return { html: unit.html, where: 'stem', at: index };
  if (unit.kind === 'choice') return { html: snapshot.choices[unit.index] ?? '', where: 'choice', at: unit.index };
  return null;
}

/**
 * 문항에서 쪼갤 수 없는 큰 덩어리들 — 문항은 **자를 수 있는 단위 경계**(`questionCuts`)에서만 갈린다.
 * 번호 머리와 다음 단위, 빈칸과 앞 단위는 못 떼므로 경계 사이를 한 덩어리로 더해 잰다(코덱스 1R — 따로 세면 25줄 둘이
 * 문턱 아래로 보이는데 실제로는 50줄이 한 번에 줄어 찍힌다). 까닭·자리는 그 덩어리에서 가장 큰 단위를 따른다.
 * @param snapshot - 문항 스냅샷
 * @param minLines - 이 줄 수 이상만
 * @returns 큰 덩어리들
 */
export function questionUnsplittables(snapshot: PaperItemSnapshot, minLines = UNSPLITTABLE_WARN_LINES): UnsplittableUnit[] {
  const units = questionUnits(snapshot, false);
  const edges = [0, ...questionCuts(units, { from: 0, to: units.length }), units.length];
  const found: UnsplittableUnit[] = [];
  for (let g = 0; g < edges.length - 1; g += 1) {
    let chars = 0;
    let lines = 0;
    let nested = false;
    let biggest: { html: string; where: 'stem' | 'choice'; at: number; lines: number } | null = null;
    for (let k = edges[g]; k < edges[g + 1]; k += 1) {
      const unit = units[k];
      if (unit.kind === 'blank') lines += BLANK_LINES;
      const part = unitHtml(unit, k, snapshot);
      if (!part) continue;
      const size = estimateLines(part.html);
      chars += size.chars;
      lines += part.where === 'choice' ? Math.max(1, size.lines) : size.lines;
      if ((unit.kind === 'head' || unit.kind === 'stem') && nestedReason(unit.box, unit.html)) nested = true;
      if (!biggest || size.lines > biggest.lines) biggest = { ...part, lines: size.lines };
    }
    if (lines < minLines || !biggest) continue;
    const reason: UnsplittableReason = nested ? 'nested-box' : biggest.where === 'choice' ? 'choice' : reasonOf(biggest.html);
    found.push({ where: biggest.where, index: biggest.at, reason, chars, estLines: lines, head: headOf(biggest.html) });
  }
  return found;
}

/**
 * 기록들을 감사한다 — 어림 줄 수가 큰 것부터.
 * @param records - 지문·문항 기록들
 * @param minLines - 이 줄 수 이상만
 * @returns 감사 결과
 */
export function auditRecords(records: readonly AuditRecord[], minLines = UNSPLITTABLE_WARN_LINES): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const record of records) {
    const units = [
      ...(record.passage ? passageUnsplittables(record.passage.html, record.passage.figure_paths ?? [], minLines) : []),
      ...(record.question ? questionUnsplittables(record.question, minLines) : []),
    ];
    findings.push(...units.map((unit) => ({ key: record.key, ...unit })));
  }
  return findings.sort((a, b) => b.estLines - a.estLines);
}

/**
 * 까닭별 건수 — 보고 첫 줄.
 * @param findings - 감사 결과
 * @returns 까닭 → 건수(넘침 문턱 이상은 따로)
 */
export function summarizeAudit(findings: readonly AuditFinding[]): Record<string, { warn: number; overflow: number }> {
  const summary: Record<string, { warn: number; overflow: number }> = {};
  for (const f of findings) {
    const row = summary[f.reason] ?? { warn: 0, overflow: 0 };
    if (f.estLines >= UNSPLITTABLE_OVERFLOW_LINES) row.overflow += 1;
    else row.warn += 1;
    summary[f.reason] = row;
  }
  return summary;
}
