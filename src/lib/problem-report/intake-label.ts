import { withOriginalNumber } from './types';

/**
 * 원장 웍스 알림에 보낼 출처 글 줄이기 — 관리자센터 인테이크의 글자 수 상한에 맞춘다(신고 창 확인 코드와 따로 둔다, 코덱스 11R).
 * 신고 창의 '굳힐 상태' 읽기·그리기는 display.ts 다.
 */

/** 관리자센터 인테이크가 출처 글을 자르는 길이 — Ara-system `lib/problemReportIntake` 의 `LIMITS.sourceLabel` 과 같은 값 */
export const INTAKE_SOURCE_LABEL_MAX = 80;

/**
 * 출처 끝의 괄호 꼬리(과목·형) — 앞 공백까지 함께. 겹괄호('(국어 영역 (A형))')도 짝을 세어 통째로 잡는다(코덱스 10R —
 * 안쪽 괄호 없는 꼴만 잡으면 A형·B형이 같은 글로 잘렸다). 짝이 안 맞으면 빈 글.
 * @param base - 출처 글
 * @returns 꼬리(없으면 빈 글)
 */
function sectionTail(base: string): string {
  if (!base.endsWith(')')) return '';
  let depth = 0;
  for (let i = base.length - 1; i >= 0; i -= 1) {
    if (base[i] === ')') depth += 1;
    else if (base[i] === '(') depth -= 1;
    if (depth === 0) {
      let start = i;
      while (start > 0 && base[start - 1] === ' ') start -= 1;
      return start > 0 ? base.slice(start) : '';
    }
  }
  return '';
}

/** 괄호 꼬리를 지키고도 앞에 남겨야 할 최소 글자 수 — 이보다 좁으면 꼬리를 포기한다(앞이 안 보이면 무슨 시험인지 모른다) */
const MIN_HEAD_CHARS = 12;

/**
 * 원장 웍스 알림에 보낼 출처 글 — 원래 번호 꼬리(' · 원래 35번')는 지키고 앞의 출처만 줄인다.
 * 인테이크는 넘치면 끝을 자르는데, 모의고사·평가문제집 제목(120자까지)이면 원래 번호가 잘려 문제지 신고에 인쇄 번호만 남는다(코덱스 2R).
 * @param label - 출처 줄(`reportSourceLabel`)
 * @param number - 원래 번호(`snapshot->number`)
 * @param max - 상한(기본 인테이크 상한)
 * @returns 상한 안의 출처 글
 */
/**
 * UTF-16 단위 상한 안에서 글자(코드 포인트) 경계로 자른다 — 이모지 같은 보충 평면 글자를 반으로 가르면 외짝 대리 글자가 남아
 * 관리자센터의 밤 보관함(jsonb)이 거절한다(코덱스 7R). 상한은 인테이크와 같은 단위(`length`)로 잰다.
 * @param text - 글
 * @param maxUnits - UTF-16 단위 상한
 * @returns 상한 안의 앞부분
 */
export function sliceUnits(text: string, maxUnits: number): string {
  let out = '';
  for (const ch of text) {
    if (out.length + ch.length > maxUnits) break;
    out += ch;
  }
  return out;
}

export function intakeSourceLabel(label: string, number: unknown, max: number = INTAKE_SOURCE_LABEL_MAX): string {
  const base = label.trim();
  const full = withOriginalNumber(base, number);
  if (full.length <= max) return full;
  const tail = full.slice(base.length);
  // 끝의 괄호 꼬리('(언어와 매체)')는 같은 시험의 과목을 가른다 — 가운데를 줄이고 꼬리를 지킨다(코덱스 3R).
  // 꼬리를 남기면 앞에 둘 자리가 너무 좁을 때만 꼬리를 포기한다
  const section = sectionTail(base);
  const head = base.slice(0, base.length - section.length).trimEnd();
  const room = max - tail.length - section.length - 1;
  if (section && room >= MIN_HEAD_CHARS) return `${sliceUnits(head, room)}…${section}${tail}`;
  return `${sliceUnits(base, Math.max(max - tail.length - 1, 0))}…${tail}`;
}
