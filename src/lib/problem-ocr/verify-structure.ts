import { normalizeLabel } from './merge-keys';
import type { MergeResult, PassageDraft, ProblemDraft } from './merge';
import { itemTargetLabel, listSome, pageTarget, type OcrWarning } from './warnings';

/**
 * 읽어 낸 결과를 **기계적으로 대조해** 확인거리를 찾아낸다 (순수 함수).
 *
 * 지금까지 검수 화면의 경고는 **모델이 스스로 적은 것**뿐이었다. 모델은 자기가 빠뜨린
 * 것을 모르므로, 못 읽은 문항·빠진 선지는 아무 표시 없이 지나갔다 — 그래서 선생님이
 * 30문항을 처음부터 끝까지 원본과 대조해야 했다.
 *
 * 여기서 찾는 것은 전부 **셈으로 드러나는 것**들이다: 번호가 건너뛴 자리, 선지 수가
 * 다른 문항, 머리글이 가리키는 문항이 실제로 붙었는지. 판단이 필요한 것(오탈자·밑줄)은
 * 다루지 않는다 — 그건 사람이 봐야 한다.
 *
 * ⚠️ 확실할 때만 말한다. 틀린 경고가 섞이면 선생님이 경고 전체를 안 믿게 되고,
 *    그러면 진짜 문제까지 함께 묻힌다.
 */

/** 선지가 이보다 적으면 무언가 잘못됐다 — 2지선다 시험지는 없다 */
const MIN_CHOICES = 2;

/**
 * '이 시험지의 보통 선지 수' 로 인정할 최소값.
 *
 * 4~5지선다가 아니면(예: 문제집의 O/X 절) 애초에 비교 기준이 못 된다.
 */
const TYPICAL_CHOICES_MIN = 4;

/** 머리글이 가리키는 문항 범위. `1~3` 처럼 두 수 사이 */
const RANGE_RE = /^(\d{1,3})~(\d{1,3})$/;

/**
 * 지문 머리글이 가리키는 문항 번호들.
 * @param label - 지문 머리글 (`[1~3]`)
 * @returns 번호 배열. 범위 표기가 아니면 빈 배열
 */
export function labelRange(label: string): number[] {
  const m = RANGE_RE.exec(normalizeLabel(label));
  if (!m) return [];
  const from = Number(m[1]);
  const to = Number(m[2]);
  // 뒤집혔거나 터무니없이 넓으면 잘못 읽은 머리글이다 — 그걸로 경고를 만들지 않는다
  if (to < from || to - from > 20) return [];
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/** 경고가 가리킬 문항 */
function problemTarget(problem: ProblemDraft) {
  return {
    kind: 'problem' as const,
    id: problem.id,
    page: problem.page_no,
    label: itemTargetLabel({ kind: 'problem', page: problem.page_no, number: problem.number }),
  };
}

/** 경고가 가리킬 지문 */
function passageTarget(passage: PassageDraft) {
  return {
    kind: 'passage' as const,
    id: passage.id,
    page: passage.page_no,
    label: itemTargetLabel({ kind: 'passage', page: passage.page_no }),
  };
}

/**
 * 이 시험지에서 가장 흔한 선지 수.
 * @param problems - 문항들
 * @returns 흔한 수. 기준으로 삼을 만하지 않으면 null
 */
function typicalChoiceCount(problems: readonly ProblemDraft[]): number | null {
  const counts = new Map<number, number>();
  for (const p of problems) {
    if (p.question_type !== '객관식' || p.choices.length === 0) continue;
    counts.set(p.choices.length, (counts.get(p.choices.length) ?? 0) + 1);
  }
  let best: { size: number; seen: number } | null = null;
  for (const [size, seen] of counts) {
    if (!best || seen > best.seen) best = { size, seen };
  }
  if (!best || best.size < TYPICAL_CHOICES_MIN) return null;
  // 과반이 아니면 '보통' 이라고 할 수 없다 — 절마다 형식이 다른 문제집이 그렇다
  const total = [...counts.values()].reduce((n, v) => n + v, 0);
  return best.seen * 2 > total ? best.size : null;
}

/**
 * 번호가 건너뛴 자리를 찾는다.
 *
 * ⚠️ 번호가 **한 번이라도 겹치면 검사하지 않는다.** 문제집·프린트는 절마다 1번부터
 *    다시 세므로(sql/17 의 유니크 없음 주석), 그런 자료에 이 검사를 돌리면
 *    있지도 않은 빠짐이 수십 개 잡혀 경고 전체를 못 믿게 된다.
 */
function missingNumbers(problems: readonly ProblemDraft[]): number[] {
  const numbers = problems.map((p) => p.number).filter((n): n is number => n !== null);
  if (numbers.length < 3) return [];
  const unique = new Set(numbers);
  if (unique.size !== numbers.length) return [];

  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  // 번호가 너무 띄엄띄엄하면 애초에 통째로 읽은 시험지가 아니다(쪽을 골라 읽었을 수 있다)
  if (max - min + 1 > numbers.length * 2) return [];

  const gaps: number[] = [];
  for (let n = min; n <= max; n += 1) if (!unique.has(n)) gaps.push(n);
  return gaps;
}

/**
 * 읽어 낸 결과에서 확인거리를 찾는다.
 * @param merged - 병합이 끝난 지문·문항
 * @returns 카드에 붙일 경고들 (없으면 빈 배열)
 */
export function verifyStructure(merged: Pick<MergeResult, 'passages' | 'problems'>): OcrWarning[] {
  const { passages, problems } = merged;
  const out: OcrWarning[] = [];

  // 1) 번호가 건너뛴 자리 — 못 읽은 문항이 있다는 가장 분명한 신호다
  const gaps = missingNumbers(problems);
  if (gaps.length > 0) {
    // 빠진 번호의 **앞뒤 문항이 있는 쪽**을 가리킨다 — 빠진 문항에는 카드가 없다
    const pages = [...new Set(problems
      .filter((p) => p.number !== null && gaps.some((g) => Math.abs(g - p.number!) === 1))
      .map((p) => p.page_no))];
    out.push({
      message: `${listSome(gaps)}번이 안 보여요. 그 문항을 못 읽었는지 원본과 맞춰 봐 주세요.`,
      ...(pages.length > 0 ? { targets: pages.map(pageTarget) } : {}),
    });
  }

  // 2) 선지 수
  const typical = typicalChoiceCount(problems);
  for (const problem of problems) {
    if (problem.question_type !== '객관식') continue;
    const count = problem.choices.length;
    if (count === 0) continue; // 정답표만 읽힌 문항 — 다른 경고가 이미 붙는다
    if (count < MIN_CHOICES) {
      out.push({
        message: `선지를 ${count}개만 읽었어요. 원본과 맞춰 채워 주세요.`,
        targets: [problemTarget(problem)],
      });
      continue;
    }
    if (typical !== null && count !== typical) {
      out.push({
        message: `선지가 ${count}개예요. 이 시험지는 보통 ${typical}개라 빠졌을 수 있어요.`,
        targets: [problemTarget(problem)],
      });
    }
  }

  // 3) 머리글이 가리키는 문항이 실제로 그 지문에 붙었는가
  const byNumber = new Map<number, ProblemDraft[]>();
  for (const p of problems) {
    if (p.number === null) continue;
    const list = byNumber.get(p.number);
    if (list) list.push(p);
    else byNumber.set(p.number, [p]);
  }

  for (const passage of passages) {
    const wanted = labelRange(passage.label);
    if (wanted.length === 0) continue;

    const loose: number[] = [];
    for (const number of wanted) {
      const candidates = byNumber.get(number) ?? [];
      // 번호가 겹치는 자료에서는 하나라도 이 지문에 붙었으면 됐다
      if (candidates.length === 0) continue;
      if (!candidates.some((p) => p.passage_id === passage.id)) loose.push(number);
    }
    if (loose.length > 0) {
      out.push({
        message: `머리글은 ${normalizeLabel(passage.label)}번을 가리키는데 `
          + `${listSome(loose)}번이 이 지문에 붙어 있지 않아요.`,
        targets: [
          passageTarget(passage),
          ...loose.flatMap((n) => (byNumber.get(n) ?? []).map(problemTarget)),
        ],
      });
    }
  }

  return out;
}
