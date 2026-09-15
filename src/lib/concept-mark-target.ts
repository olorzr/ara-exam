import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { foldWithMap, type FoldMode } from '@/lib/concept-pick/fold';

/**
 * 마킹할 **자리**를 고른다 (순수 함수).
 *
 * 예전에는 문서에서 처음 나오는 자리에 무조건 붙였는데, 개념지는 같은 시어가 **작품 원문과
 * 풀이 표에 둘 다** 있는 것이 보통이라 늘 원문에 구멍이 났다. 학생이 외울 것은 작품의
 * 글귀가 아니라 해설이므로 순서를 바꾼다:
 *   ① AI 가 준 자리 힌트(`context`)가 **실제로 덮는 구간** 안의 자리
 *   ② 표 칸 안의 첫 자리 — 풀이·정리는 거의 표에 있다
 *   ③ 그래도 없으면 첫 자리
 *
 * ⚠️ 힌트 판정은 '조상이 그 글을 담고 있는가' 로는 모자라다(코덱스 리뷰 2R). 한 문단에
 *    같은 말이 두 번 나오면 두 자리가 **똑같은 조상**을 가져 앞것이 늘 이긴다. 그래서
 *    힌트가 덮는 **구간의 글자 범위**를 되찾아 그 안에 있는 자리만 고른다.
 * ⚠️ 견주는 세기가 **셋이고 글자 그대로가 먼저**다. 접으면 기호가 사라져
 *    '가 | 나의 대비' 와 '가 나의 대비' 가, '가-나의 대비' 와 '가나의 대비' 가 같아진다 —
 *    글자 그대로 맞는 자리가 있으면 **언제나 그쪽**이다(코덱스 리뷰).
 * ⚠️ 한 텍스트 노드 안에서만 찾는 한계는 그대로다. 서식(굵게)으로 쪼개진 구절은 못 찾고,
 *    호출부가 그 개수를 사람에게 알린다.
 */

/** 표의 칸으로 볼 노드 이름 */
const CELL_NODES = new Set(['tableCell', 'tableHeader']);

/** 자리 힌트를 견줄 때 거슬러 올라갈 조상의 깊이 (문단 → 칸 → 행) */
const CONTEXT_ANCESTOR_DEPTH = 3;

/**
 * 견주는 차례 — **글자 그대로가 먼저**이고 느슨한 쪽이 맨 뒤다.
 *
 * ⚠️ `literal` 을 빼지 말 것(코덱스 리뷰). `strict` 도 `|` 를 공백으로 바꾸므로
 *    `'가 | 나의 대비'`(앞 문단)와 `'가 나의 대비'`(뒤 문단)가 **같은 점수**가 되어,
 *    힌트가 뒤 문단을 정확히 가리켜도 앞 문단이 이긴다.
 */
const FOLD_ORDER: FoldMode[] = ['literal', 'strict', 'loose'];

/** 문서 안의 한 구간 */
export interface MarkTarget {
  from: number;
  to: number;
}

/** 후보를 감싸는 조상 하나 */
interface Ancestor {
  /** 조상이 담은 글자 */
  text: string;
  /** 그 글자 안에서 후보가 시작하는 자리 */
  offset: number;
}

/** 찾은 후보 하나 */
interface Candidate extends MarkTarget {
  inCell: boolean;
  /** 가까운 쪽부터 */
  ancestors: Ancestor[];
}

/** 힌트가 얼마나 잘 맞았는가 — 작을수록 좋다 */
interface Score {
  /** 0 = 글자 그대로 맞음, 1 = 기호·공백을 무시하고 맞음 */
  tier: number;
  /** 몇 촌 조상에서 맞았는가 */
  distance: number;
}

/**
 * 후보를 감싸는 조상들을 모은다 (가까운 쪽부터).
 * @param doc - 문서
 * @param pos - 후보가 시작하는 위치
 * @returns 조상 글자와 그 안에서의 자리, 표 칸 여부
 */
function describePosition(
  doc: ProseMirrorNode,
  pos: number,
): { ancestors: Ancestor[]; inCell: boolean } {
  const ancestors: Ancestor[] = [];
  let inCell = false;
  try {
    const $pos = doc.resolve(pos);
    for (let depth = $pos.depth; depth > 0; depth -= 1) {
      const node = $pos.node(depth);
      if (CELL_NODES.has(node.type.name)) inCell = true;
      if (ancestors.length >= CONTEXT_ANCESTOR_DEPTH) continue;
      // 조상 글자 안에서 후보가 몇 번째 글자인지 — 구간 판정의 기준이다
      const relative = pos - $pos.start(depth);
      ancestors.push({ text: node.textContent, offset: node.textBetween(0, relative).length });
    }
  } catch {
    // 위치를 풀지 못하면 힌트 없이 쓴다 — 마킹 자체를 막을 이유는 없다
  }
  return { ancestors, inCell };
}

/**
 * 힌트가 이 조상의 어디를 덮는지 찾아, 후보가 그 안에 있는지 본다.
 * @param ancestor - 조상 글자와 후보의 자리
 * @param context - 자리 힌트
 * @param mode - 견주는 세기
 * @returns 후보가 힌트 구간 안에 있으면 true
 */
function coversCandidate(ancestor: Ancestor, context: string, mode: FoldMode): boolean {
  const wanted = foldWithMap(context, mode).text;
  if (wanted === '') return false;

  const folded = foldWithMap(ancestor.text, mode);
  const at = folded.text.indexOf(wanted);
  if (at === -1) return false;

  // 접은 자리를 원본 자리로 되돌린다 — 그래야 '문단 안 어디인지' 를 말할 수 있다
  const start = folded.map[at];
  const end = folded.map[at + wanted.length - 1] + 1;
  return ancestor.offset >= start && ancestor.offset < end;
}

/**
 * 이 후보가 힌트에 얼마나 맞는가.
 * @param candidate - 후보
 * @param context - 자리 힌트
 * @returns 점수. 안 맞으면 null
 */
function scoreOf(candidate: Candidate, context: string): Score | null {
  for (let tier = 0; tier < FOLD_ORDER.length; tier += 1) {
    for (let distance = 0; distance < candidate.ancestors.length; distance += 1) {
      if (coversCandidate(candidate.ancestors[distance], context, FOLD_ORDER[tier])) {
        return { tier, distance };
      }
    }
  }
  return null;
}

/**
 * 이 글자가 든 자리를 모두 찾는다 (문서 순서).
 * @param doc - 문서
 * @param text - 찾을 글자
 * @returns 후보들
 */
function collectCandidates(doc: ProseMirrorNode, text: string): Candidate[] {
  const candidates: Candidate[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText) return;
    const value = node.text ?? '';
    // 한 노드 안에 같은 말이 여러 번 나올 수 있다 — 힌트가 뒤쪽을 가리킬 수도 있다
    for (let idx = value.indexOf(text); idx !== -1; idx = value.indexOf(text, idx + 1)) {
      const from = pos + idx;
      candidates.push({ from, to: from + text.length, ...describePosition(doc, from) });
    }
  });
  return candidates;
}

/**
 * 용어를 마킹할 자리를 고른다.
 * @param doc - 편집기 문서
 * @param text - 붙일 글자
 * @param context - AI 가 준 자리 힌트 (없으면 빈 문자열)
 * @returns 마킹할 구간. 그 글자가 아예 없으면 null
 */
export function findMarkTarget(
  doc: ProseMirrorNode,
  text: string,
  context = '',
): MarkTarget | null {
  if (text === '') return null;

  const candidates = collectCandidates(doc, text);
  if (candidates.length === 0) return null;

  let best: Candidate | null = null;
  let bestScore: Score | null = null;
  if (context !== '') {
    for (const candidate of candidates) {
      const score = scoreOf(candidate, context);
      if (!score) continue;
      if (!bestScore
        || score.tier < bestScore.tier
        || (score.tier === bestScore.tier && score.distance < bestScore.distance)) {
        best = candidate;
        bestScore = score;
      }
    }
  }

  // 힌트가 없거나 맞는 자리가 없으면 표를 먼저 본다 — 원문에 구멍을 내는 것보다 낫다
  const chosen = best ?? candidates.find((c) => c.inCell) ?? candidates[0];
  return { from: chosen.from, to: chosen.to };
}
