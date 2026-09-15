import {
  CONCEPT_PICK_CONTEXT_MAX, CONCEPT_PICK_MAX_COUNT, CONCEPT_PICK_REASON_MAX,
  CONCEPT_PICK_TEXT_MAX, CONCEPT_PICK_TEXT_MIN,
} from './constants';
import { foldLoose } from './fold';
import type { ConceptPick } from './schema';

/**
 * 추천 응답을 검증한다 (순수 함수).
 *
 * 스키마는 모양만 강제하므로 **말이 되는지**는 여기서 본다. 특히 두 가지를 반드시 막는다:
 *  ① 본문에 없는 말 — 마킹할 자리가 없어 조용히 사라진다.
 *  ② 띄어쓰기가 든 말 — `extractMarks` 가 공백으로 쪼개 빈칸이 여러 개가 되고,
 *     마킹 수(= 문항 수 = 합격 기준의 분모)가 부풀어 학원 성적까지 어긋난다.
 */

/** 왜 버렸는지 — 사람에게 "몇 개는 왜 안 왔는지" 를 설명할 재료다 */
export interface ConceptPickDropped {
  /** 본문에 그 글자가 없었다 */
  notInText: number;
  /** 이미 마킹돼 있거나 같은 추천이 두 번 왔다 */
  duplicate: number;
  /** 모양이 안 맞는다(빈 값·공백 포함·너무 짧거나 김) */
  malformed: number;
}

export interface ConceptPickResult {
  picks: ConceptPick[];
  dropped: ConceptPickDropped;
}

export interface ConceptPickParseContext {
  /** 편집기 본문의 평문 — '본문에 있는가' 판정의 기준 */
  plain: string;
  /** 이미 마킹된 용어 */
  existing: readonly string[];
}

/**
 * 자리 힌트를 검증한다.
 *
 * 쓸 수 없는 힌트는 **빈 값으로 만들 뿐 추천을 버리지 않는다** — 자리 힌트는 '어느 쪽에
 * 뚫을까' 를 돕는 재료일 뿐이고, 없으면 마킹 쪽이 표를 먼저 보는 규칙으로 물러선다.
 * 공백과 `|` 를 접어 견주는 까닭: 평문에는 표 기호가 있고 모델은 그것을 빠뜨리거나
 * 줄바꿈을 공백으로 바꿔 적는다.
 * @param context - 모델이 준 구절
 * @param text - 고른 용어
 * @param plain - 본문 평문
 * @returns 쓸 수 있으면 그대로, 아니면 `''`
 */
function cleanContext(context: string, text: string, plain: string): string {
  const trimmed = context.trim().slice(0, CONCEPT_PICK_CONTEXT_MAX);
  if (trimmed === '') return '';
  // 자리를 **찾기 위한** 힌트라 느슨하게 본다 — 모델은 표 기호를 빠뜨리고 줄바꿈을 공백으로 적는다.
  // (뜻이 실제로 적혀 있는지 보는 자리와 달리, 여기서 좀 헐거워도 자리 하나를 고를 뿐이다)
  const folded = foldLoose(trimmed);
  // 용어를 안 담은 구절은 자리를 가리키지 못하고, 본문에 없는 구절은 지어낸 것이다
  if (!folded.includes(foldLoose(text))) return '';
  if (!foldLoose(plain).includes(folded)) return '';
  return trimmed;
}

/**
 * 응답 JSON 을 검증해 마킹할 목록으로.
 * @param raw - 검증 전 JSON 문자열
 * @param ctx - 본문·기존 마킹
 * @returns 고른 용어와 버린 이유. 모양이 깨졌으면 null. 빈 목록은 정상이다(AI 가 더 고를 게 없다고 본 것)
 */
export function parseConceptPicks(
  raw: string,
  ctx: ConceptPickParseContext,
): ConceptPickResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const value = parsed as Record<string, unknown>;
  if (!Array.isArray(value.picks)) return null;

  const seen = new Set(ctx.existing.map((t) => t.trim()).filter(Boolean));
  const picks: ConceptPick[] = [];
  const dropped: ConceptPickDropped = { notInText: 0, duplicate: 0, malformed: 0 };

  for (const item of value.picks) {
    // 스키마 maxItems 가 막지만 파서는 스키마를 믿지 않는다 — 순수 함수 쪽에서도 상한을 지킨다
    if (picks.length >= CONCEPT_PICK_MAX_COUNT) break;
    if (!item || typeof item !== 'object') {
      dropped.malformed += 1;
      continue;
    }
    const row = item as Record<string, unknown>;
    const text = typeof row.text === 'string' ? row.text.trim() : '';

    // 공백이 든 말은 빈칸이 여러 개가 된다 — 개수를 세는 모든 것이 어긋난다
    if (
      text.length < CONCEPT_PICK_TEXT_MIN
      || text.length > CONCEPT_PICK_TEXT_MAX
      || /\s/.test(text)
    ) {
      dropped.malformed += 1;
      continue;
    }
    if (seen.has(text)) {
      dropped.duplicate += 1;
      continue;
    }
    if (!ctx.plain.includes(text)) {
      dropped.notInText += 1;
      continue;
    }

    seen.add(text);
    picks.push({
      text,
      reason: typeof row.reason === 'string'
        ? row.reason.trim().slice(0, CONCEPT_PICK_REASON_MAX)
        : '',
      context: cleanContext(typeof row.context === 'string' ? row.context : '', text, ctx.plain),
    });
  }

  return { picks, dropped };
}
