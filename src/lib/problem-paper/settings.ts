import type { PaperSettings } from '@/types/problem-bank';

/**
 * 문제지 인쇄 설정 (순수 함수).
 *
 * DB 의 `create_problem_paper` RPC 가 저장 직전에 **같은 화이트리스트로 재조립**한다.
 * 여기서만 걸러도 RPC 직접 호출을 막지 못하고, RPC 에서만 걸러도 화면이 잘못된 값을
 * 들고 있게 되므로 양쪽 다 필요하다.
 */

/**
 * 기본값 — 2단이 A4 를 가장 덜 쓴다.
 * `showScore` 는 더 이상 쓰지 않는다(배점을 인쇄하지 않는다). RPC 화이트리스트가
 * 이 키를 계속 조립하므로 자리만 남기고 false 로 둔다.
 */
export const DEFAULT_PAPER_SETTINGS: PaperSettings = {
  columns: 2,
  showScore: false,
  showSource: false,
};

/**
 * 저장된 jsonb 를 화면이 믿을 수 있는 설정으로 바꾼다.
 * @param raw - DB 에서 읽은 값 (모양을 믿을 수 없다)
 * @returns 기본값으로 채운 설정
 */
export function normalizePaperSettings(raw: unknown): PaperSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_PAPER_SETTINGS };
  const value = raw as Record<string, unknown>;
  return {
    columns: value.columns === 1 ? 1 : 2,
    // 옛 문제지에 true 로 저장돼 있어도 인쇄에는 쓰지 않는다(렌더러가 보지 않는다)
    showScore: value.showScore === true,
    showSource: value.showSource === true,
  };
}

/**
 * 지문이 길면 2단 칸(≈328px)에서 읽기 어렵다 — 1단을 권한다.
 *
 * 강제하지 않고 **권하기만** 하는 이유: 선생님이 종이 수를 우선할 수 있고,
 * 인쇄 엔진이 지문을 문단 단위로 쪼개 흘려 주므로 2단에서도 내용이 잘리지는 않는다.
 * @param longestPassageChars - 가장 긴 지문의 글자 수
 * @returns 1단을 권하면 true
 */
export function suggestsSingleColumn(longestPassageChars: number): boolean {
  return longestPassageChars >= SINGLE_COLUMN_HINT_CHARS;
}

/** 이 글자 수를 넘는 지문이 있으면 1단을 권한다(개념지의 300자 기준보다 넉넉하다) */
export const SINGLE_COLUMN_HINT_CHARS = 900;
