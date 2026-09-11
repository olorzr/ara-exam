import { OCR_MAX_WARNINGS } from './constants';
import { int, isRecord, normalizeChoice, str } from './parse-values';
import type { AnswerKeyDraft, AnswerKeyRow } from './schema';
import { pushDraftWarning, type DraftWarning } from './warnings';

/**
 * 정답표 응답(JSON 문자열) → 검증된 번호·정답 목록.
 *
 * 본문 파서(`parse.ts`)에서 떼어 둔 이유: 정답표는 **다른 프롬프트·다른 스키마**로 읽는
 * 별개의 경로이고(모델이 문제를 풀지 못하게 갈라 둔 것이다), 본문 파서가 300줄 규칙에
 * 걸렸다. 규칙은 같다 — **구조는 엄격, 항목은 관대**.
 */

/**
 * 정답표 응답 원문을 검증한다.
 * @param raw - 검증 전 JSON 문자열
 * @param opts - 문항 번호 상한 (원본 시험지의 마지막 번호). 넘으면 버린다
 * @returns 정답 목록. 전체 모양이 깨졌으면 null
 */
export function parseAnswerKeyDraft(
  raw: string,
  opts: { maxNumber?: number } = {},
): AnswerKeyDraft | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.answers)) return null;

  const warnings: DraftWarning[] = Array.isArray(parsed.warnings)
    ? parsed.warnings
      .map((w) => str(w, 300)).filter(Boolean)
      .slice(0, OCR_MAX_WARNINGS)
      .map((message) => ({ message }))
    : [];

  const seen = new Set<number>();
  const answers: AnswerKeyRow[] = [];

  for (const raw of parsed.answers) {
    if (!isRecord(raw)) continue;
    const no = int(raw.no);
    if (no === null || no < 1) continue;
    if (opts.maxNumber !== undefined && no > opts.maxNumber) {
      pushDraftWarning(warnings, { message: `정답표의 ${no}번은 이 시험지의 문항 범위를 벗어나 버렸어요.` });
      continue;
    }
    // 같은 번호가 두 번 오면 먼저 온 것을 남긴다(정답표는 보통 한 번만 인쇄된다)
    if (seen.has(no)) {
      pushDraftWarning(warnings, { message: `정답표에 ${no}번이 두 번 나와 먼저 읽은 값을 남겼어요.` });
      continue;
    }
    const answer = normalizeChoice(str(raw.answer, 200));
    if (!answer) continue;
    seen.add(no);
    answers.push({ no, answer });
  }

  return { answers, warnings: warnings.slice(0, OCR_MAX_WARNINGS) };
}
