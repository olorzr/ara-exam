import { foldStrict, foldWithMap } from '@/lib/concept-pick/fold';
import type { PrintQaItem } from '@/types/print-scan';
import { standsAlone } from './redact-scan';
import { betweenLead, innerLead, preambleLead } from './lead';
import { trailingMark } from './marks';
import type { HandwrittenRange } from './handwriting';

/**
 * 물음·답이 **원문 어디에 있는지** 찾는 일 (순수 함수).
 *
 * `parse-split.ts` 에서 떼어 둔 까닭: 자리 찾기는 값만 다루는 계산이고, 파서 쪽은 그 자리로
 * 무엇을 할지(앞글·중복·손글씨)를 정한다. 한 파일에 두면 300줄을 넘는다.
 */

/** 원문에서의 자리 */
export type Span = HandwrittenRange;

/** 접어 둔 본문과 원문 자리 표 */
export type FoldedPlain = ReturnType<typeof foldWithMap>;

/** 접은 본문에서 찾은 자리 (원문 좌표와 접힌 좌표 둘 다) */
export interface Placement {
  span: Span;
  foldedStart: number;
  foldedEnd: number;
}

/**
 * 본문을 대조용으로 접는다.
 * @param plain - 프린트 본문 평문
 * @returns 접은 글과 원문 자리 표
 */
export function foldPlain(plain: string): FoldedPlain {
  return foldWithMap(plain, 'strict');
}

/**
 * 접어 둔 본문에서 이 말이 **어디에 있는지** 원문 좌표로 찾는다.
 *
 * ⚠️ **범위를 넘어선 자리는 못 찾은 것으로 본다.** 답을 문서 전체에서 찾으면 한참 뒤 문항의
 *    답에 걸려, 그 사이 문항들이 통째로 차례에서 밀려난다(코덱스 2R).
 * @param folded - `foldPlain` 결과
 * @param needle - 찾을 말 (접기 전)
 * @param from - 접힌 좌표에서 이 자리부터
 * @param to - 접힌 좌표에서 이 자리까지 (넘으면 못 찾은 것이다)
 * @returns 자리. 못 찾으면 null
 */
export function locate(
  folded: FoldedPlain,
  needle: string,
  from: number,
  to: number = folded.text.length,
): Placement | null {
  const target = foldStrict(needle);
  if (target === '') return null;
  const index = folded.text.indexOf(target, from);
  if (index < 0) return null;
  const end = index + target.length;
  if (end > to) return null;
  return {
    span: { start: folded.map[index], end: folded.map[end - 1] + 1 },
    foldedStart: index,
    foldedEnd: end,
  };
}

/**
 * **답**을 찾을 때는 낱말로 서 있는 자리를 먼저 고른다.
 *
 * ⚠️ 글자만 찾으면 답 `소설` 이 지문의 `소설가` 안에서 잡힌다(코덱스 17R). 그 자리를
 *    문항의 끝으로 삼으면 **지문에서 낱말 하나가 잘려 나가고**(`가 김 씨는…`) 아무도
 *    그 사실을 모른다.
 * ⚠️ **낱말로 선 자리가 없으면 못 찾은 것이다**(코덱스 18R — 17R 의 '첫 자리로 물러선다' 를
 *    뒤집음). 물러서면 그 자리가 다시 지문을 깎는다. 그때 부르는 쪽은 답을 비우고 세므로
 *    (`answerNotInText`) **모델이 풀어 버린 답**이 '인쇄된 답' 으로 들어가지도 않는다.
 * @param plain - 본문 평문
 * @param folded - 접어 둔 본문
 * @param needle - 찾을 답
 * @param from - 접힌 좌표에서 이 자리부터
 * @param to - 접힌 좌표에서 이 자리까지
 * @returns 자리. 못 찾으면 null
 */
export function locateAnswer(
  plain: string,
  folded: FoldedPlain,
  needle: string,
  from: number,
  to: number = folded.text.length,
): Placement | null {
  let plainFirst: Placement | null = null;
  for (let at = from; ;) {
    const hit = locate(folded, needle, at, to);
    if (hit === null) return plainFirst;
    if (standsAlone(plain, hit.span)) {
      // ⚠️ **답 표시가 붙은 자리를 먼저 고른다**(코덱스 20R). 지문에 같은 낱말이 먼저 나오면
      //    (`소설 한 편을 읽던 나는…\n답: 소설`) 그 자리를 답으로 삼아 **지문의 첫 낱말이
      //    문항 안으로 먹히고**, 정작 적힌 답은 앞글에 그대로 남는다
      if (markedBefore(plain, hit.span.start)) return hit;
      plainFirst ??= hit;
    }
    at = hit.foldedStart + 1;
  }
}

/**
 * 그 답이 **낱말로 서 있는 모든 자리**.
 *
 * ⚠️ 물음 밖에 답이 또 있는지 볼 때도 **낱말 경계를 본다**(코덱스 22R). 글자만 세면
 *    지문의 `소설가` 가 '따로 적힌 답' 으로 잡혀, 물음 속 `(소설)` 을 **주어진 값으로 오인해
 *    그대로 인쇄한다**.
 * @param plain - 본문 평문
 * @param folded - 접어 둔 본문
 * @param needle - 찾을 답
 * @returns 낱말로 서 있는 자리들
 */
export function locateAllAnswers(
  plain: string,
  folded: FoldedPlain,
  needle: string,
): Placement[] {
  return locateAll(folded, needle).filter((hit) => standsAlone(plain, hit.span));
}

/**
 * 그 자리 **바로 앞에 답 표시가 붙어 있는가** (같은 줄에서).
 * @param plain - 본문 평문
 * @param at - 답이 시작하는 자리
 * @returns `답:`·`→` 뒤에 바로 놓였으면 true
 */
function markedBefore(plain: string, at: number): boolean {
  const lineStart = plain.lastIndexOf('\n', Math.max(at - 1, 0)) + 1;
  // ⚠️ 여는 따옴표·괄호는 걷어내고 본다(코덱스 21R) — `답: “소설”` 도 표시가 붙은 답이다
  return trailingMark(plain.slice(lineStart, at)) !== null;
}

/** 자리까지 정해진 문항 하나 */
export interface PlacedItem {
  item: PrintQaItem;
  /** 물음이 시작하는 원문 자리. 못 찾았으면 null */
  start: number | null;
  /** 이 문항이 끝나는 원문 자리(답이 있으면 답의 끝). 못 찾았으면 null */
  end: number | null;
  /**
   * 물음과 그 답 **사이**에 있던 글의 자리 (없으면 null).
   *
   * 지문을 물음 뒤에 싣는 프린트가 흔하다 — 이 글은 앞뒤 어느 문항의 틈에도 들지 않아
   * 따로 챙기지 않으면 통째로 사라진다(코덱스 14R).
   */
  gap: Span | null;
}

/** 앞글을 붙인 결과 */
export interface LeadResult {
  items: PrintQaItem[];
  /** 자리를 몰라 **가져오지 못한** 앞글 수 */
  droppedLeads: number;
  /** 너무 길어 앞부분을 **잘라 낸** 앞글 수 */
  truncatedLeads: number;
}

/**
 * 문항마다 **앞에 있던 글**을 원문에서 잘라 붙인다.
 *
 * ⚠️⚠️ **버리지 않고 붙여 둔다**(코덱스 11R — 앞선 열 라운드의 '버리는' 규칙들을 뒤집음).
 *    이 글이 지문인지 아직 안 옮긴 답인지는 글자로 못 가린다. 예전에는 그래서 **버렸는데**,
 *    그 바람에 멀쩡한 지문(설의법이 든 시·표가 든 자료)이 아무에게도 안 보이고 사라졌다.
 *    이제 **학생 문제지에 싣는 데에 사람의 확인이 필요하므로**(`leadApproved`) 버릴 이유가
 *    없다 — 붙여 두고 교사용에 보여 주면 선생님이 한 번 눌러 고른다.
 * @param placed - 자리까지 찾아 둔 문항들
 * @param plain - 본문 평문
 * @returns 앞글이 채워진 문항들과, 못 가져온/잘린 앞글 수
 */
export function withLeads(
  placed: readonly PlacedItem[],
  plain: string,
): LeadResult {
  let dropped = 0;
  let truncated = 0;
  let prevEnd = 0;
  /** 마지막으로 자리를 찾은 문항 — 그 뒤에 남은 글을 맡는다 */
  let last = -1;

  const items = placed.map((row, index) => {
    if (row.start === null) {
      // 자리를 모르면 어디부터 어디까지가 이 문항 앞인지 가릴 수 없다 — 그것만 센다
      dropped += 1;
      return row.item;
    }
    const cut = index === 0
      ? preambleLead(plain, row.start, row.item.label)
      : betweenLead(plain, prevEnd, row.start, row.item.label);
    // 물음과 답 사이의 글도 **같은 승인 게이트**에 얹는다 — 그 자리가 이 문항의 지문이다
    const inner = row.gap === null
      ? { lead: '', truncated: false }
      : innerLead(plain, row.gap.start, row.gap.end);
    prevEnd = Math.max(prevEnd, row.end ?? row.start);
    last = index;
    if (cut.truncated || inner.truncated) truncated += 1;
    const lead = [cut.lead, inner.lead].filter((part) => part !== '').join('\n');
    return lead === '' ? row.item : { ...row.item, lead };
  });

  // ⚠️ **마지막 문항 뒤에 남은 글도 챙긴다**(코덱스 15R). 지문을 물음 뒤에 싣는 프린트에서
  //    마지막 문항의 지문이 바로 이 자리인데, 뒤에 문항이 없어 아무도 가져가지 않았다 —
  //    편집 화면에도 교사용에도 안 남고 **경고도 없이 사라졌다**
  if (last >= 0 && prevEnd < plain.length) {
    const tail = innerLead(plain, prevEnd, plain.length);
    if (tail.truncated) truncated += 1;
    if (tail.lead !== '') {
      const lead = [items[last].lead, tail.lead].filter((part) => part !== '').join('\n');
      items[last] = { ...items[last], lead };
    }
  }
  return { items, droppedLeads: dropped, truncatedLeads: truncated };
}

/**
 * 한 물음이 본문에 나올 수 있는 최대 횟수 — 끝없이 도는 것을 막는 안전장치.
 *
 * 본문 상한이 40,000자라 두 글자짜리 물음도 이 수를 넘을 수 없다. 낮게 잡으면 앞쪽 문항이
 * 자리를 다 먹어 **뒤 문항이 중복으로 지워진다**(코덱스 4R).
 */
const MAX_OCCURRENCES = 2_000;


/**
 * 번호 모양은 [label.ts](./label.ts) 한곳에서 정한다 — 알아보는 곳(`hasLabelBefore`)과
 * 지켜 주는 곳(`carriesLabel`)이 **같은 범위**를 봐야 하기 때문이다(코덱스 14R).
 */

/**
 * 그 말이 나오는 **모든 자리**를 찾는다.
 * @param folded - 접어 둔 본문
 * @param needle - 찾을 말
 * @returns 앞에서부터의 자리들 (없으면 빈 배열)
 */
export function locateAll(folded: FoldedPlain, needle: string): Placement[] {
  const out: Placement[] = [];
  let from = 0;
  while (out.length < MAX_OCCURRENCES) {
    const hit = locate(folded, needle, from);
    if (hit === null) break;
    out.push(hit);
    from = hit.foldedStart + 1;
  }
  return out;
}

/**
 * 그 말이 **손글씨가 아닌 자리**에 있는가.
 *
 * ⚠️ 모범답안의 근거를 대조할 때 쓴다(코덱스 3R). 프린트 평문에는 **학생이 연필로 적은 답**도
 *    들어 있어서, AI 가 그 말을 근거라고 적어 오면 '프린트에 그렇게 적혀 있다' 로 통과한다 —
 *    틀렸을지 모르는 아이 답이 **근거로 둔갑한다.**
 * @param folded - 접어 둔 본문
 * @param needle - 찾을 말
 * @param handwritten - 손글씨 구간들 (평문 좌표)
 * @returns 손글씨 밖에서 찾았으면 true
 */
export function existsOutsideHandwriting(
  folded: FoldedPlain,
  needle: string,
  handwritten: readonly HandwrittenRange[],
): boolean {
  let from = 0;
  for (;;) {
    const hit = locate(folded, needle, from);
    if (hit === null) return false;
    const inside = handwritten.some(
      (range) => range.start < hit.span.end && hit.span.start < range.end,
    );
    if (!inside) return true;
    from = hit.foldedStart + 1;
  }
}
