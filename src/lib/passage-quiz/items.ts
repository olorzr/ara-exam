import type { PassageQuizResult } from './parse';

/**
 * 화면에서 다루는 문항 — O,X 와 단답형을 **한 모양**으로 눕힌 것.
 *
 * 둘을 각각의 타입으로 들고 다니면 목록·수정·삭제·번호 매기기가 전부 두 벌이 된다.
 * 인쇄에서만 유형별로 갈라 그리면 된다.
 */
export type QuizItemKind = 'ox' | 'short';

export interface QuizItem {
  /** 화면에서만 쓰는 id (저장하지 않는다) */
  id: string;
  kind: QuizItemKind;
  /** O,X 는 진술, 단답형은 질문 */
  text: string;
  /** O,X 는 'O'|'X', 단답형은 답 */
  answer: string;
  /** 지문·참고자료에서 옮겨 온 근거 구절 */
  evidence: string;
  /** 근거를 찾은 곳. `''` 는 지문, 그 밖은 참고자료 이름 */
  source: string;
}

/**
 * 검증을 거친 결과를 화면용 목록으로 (O,X 먼저, 단답형 다음).
 * @param result - 검증 결과
 * @param seed - id 앞머리 (실행마다 달라야 옛 목록의 id 와 섞이지 않는다)
 * @returns 화면용 문항 목록
 */
export function toQuizItems(result: PassageQuizResult, seed: string): QuizItem[] {
  return [
    ...result.ox.map((item, i) => ({
      id: `${seed}-ox-${i}`,
      kind: 'ox' as const,
      text: item.statement,
      answer: item.answer,
      evidence: item.evidence,
      source: item.source,
    })),
    ...result.short.map((item, i) => ({
      id: `${seed}-short-${i}`,
      kind: 'short' as const,
      text: item.question,
      answer: item.answer,
      evidence: item.evidence,
      source: item.source,
    })),
  ];
}

/** 번호가 매겨진 문항 */
export interface NumberedQuizItem {
  item: QuizItem;
  /** 시험지에 인쇄되는 번호 (1부터) */
  number: number;
}

/**
 * 문제지 순서(O,X → 단답형)대로 1번부터 번호를 매긴다.
 *
 * ⚠️ 문제지와 정답표가 **이 함수 하나**를 쓴다. 각자 세면 문항을 하나 지웠을 때
 *    두 인쇄물의 번호가 어긋나고, 그 사실은 채점할 때에야 드러난다.
 * @param items - 화면 목록 (유형이 섞여 있어도 된다)
 * @returns O,X 먼저, 단답형 다음으로 번호를 매긴 목록
 */
export function numberQuizItems(items: readonly QuizItem[]): NumberedQuizItem[] {
  const ordered = [
    ...items.filter((i) => i.kind === 'ox'),
    ...items.filter((i) => i.kind === 'short'),
  ];
  return ordered.map((item, index) => ({ item, number: index + 1 }));
}
