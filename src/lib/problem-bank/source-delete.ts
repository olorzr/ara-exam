import type { ProblemSourceStatus } from '@/types/problem-bank';

/**
 * 출처 삭제에 딸린 **순수 로직** — 확인 문구와, 지운 뒤 다시 읽을 범위 나누기.
 *
 * 조회하는 쪽(`source-list.ts`)과 갈라 둔 이유는 테스트 때문이다. 그쪽은 supabase 를
 * 불러오는데 이 저장소에는 그걸 목으로 감싸 테스트한 전례가 없다 — 값만 다루는 부분을
 * 떼어 두면 클라이언트 없이 그대로 검증할 수 있다.
 */

/**
 * 출처 삭제 확인 문구 (순수 함수).
 *
 * `selection.ts` 의 `bulkDeleteConfirmMessage` 와 같은 규약이다 — 확인 문구를 화면에
 * 인라인으로 쓰지 않고 여기 모아 두는 이유는 **문장마다 조건이 있어서** 다. 조건을 화면에
 * 흩어 두면 "문제지가 0개인데 문제지 얘기가 나오는" 거짓말이 조용히 생긴다.
 */

/** 확인 문구를 만들 때 필요한 것 */
export interface SourceDeleteConfirmInput {
  title: string;
  status: ProblemSourceStatus;
  /** 이 출처에서 읽어 낸 문항 수 */
  problemCount: number;
  /** 그 문항들이 담긴 문제지 수 (0 이면 알리지 않는다) */
  paperCount: number;
}

/**
 * 출처 삭제 확인 문구.
 *
 * 세 문장의 조건이 각각 다르다:
 *  - 문항 수는 **0 일 때도 적는다** — 취소된 업로드를 지우는 것이 이 기능의 본래 용도라
 *    "0개" 가 곧 "지울 게 없으니 안심하세요" 라는 정보다.
 *  - 문제지 문장은 담긴 문제지가 있을 때만. `selection.ts` 와 **같은 문장**을 쓴다 —
 *    문제지는 스냅샷이라 원본이 사라져도 그대로 인쇄된다(sql/17 의 `problem_id` 는
 *    ON DELETE SET NULL). 이 말이 없으면 "인쇄물이 망가지나?" 하고 멈춘다.
 *  - '추출중' 문장은 그 상태일 때만. 다른 탭에서 아직 읽기가 돌고 있으면 그 결과는
 *    사라진 출처에 매달리지 못해(FK) 저장에 실패한다 — 지우기 전에 알려야 한다.
 * @param input - 제목·상태·문항 수·문제지 수
 * @returns window.confirm 에 넣을 문구
 */
export function sourceDeleteConfirmMessage(input: SourceDeleteConfirmInput): string {
  const { title, status, problemCount, paperCount } = input;
  return [
    `'${title}'을(를) 지울까요?`,
    `읽어 둔 지문과 문항 ${problemCount}개가 함께 사라지고, 되돌릴 수 없어요.`,
    paperCount > 0
      ? `이 중 일부는 문제지 ${paperCount}개에 담겨 있어요. 문제지는 스냅샷이라 그대로 인쇄됩니다.`
      : null,
    status === '추출중'
      ? '다른 탭에서 읽기가 아직 돌고 있다면 그 결과는 저장되지 못해요.'
      : null,
  ].filter(Boolean).join('\n');
}

/** 다시 읽을 한 요청의 범위 */
export interface SourceRefetchChunk {
  /** 시작 쪽 (0-based) */
  page: number;
  /** 이 요청이 받을 쪽 수 */
  span: number;
}

/**
 * 지운 뒤 다시 읽을 범위를 **상한 이하의 요청들로 나눈다** (순수 함수).
 *
 * ⚠️ 한 번에 달라고 하면 안 된다 — PostgREST 는 기본 1,000행에서 **말없이** 자른다.
 *    34쪽(1,020행)을 한 번에 청하면 20행이 조용히 빠지고, 그 뒤 '더 보기' 는 1,020 부터
 *    이어 받아 **빠진 20행이 영영 안 보인다**(코덱스 리뷰 P2).
 * @param pageCount - 지금까지 펼친 쪽 수
 * @param maxPagesPerRequest - 한 요청이 받을 수 있는 쪽 수 상한
 * @returns 앞에서부터 순서대로 보낼 요청 범위들 (적어도 하나)
 */
export function sourceRefetchChunks(
  pageCount: number,
  maxPagesPerRequest: number,
): SourceRefetchChunk[] {
  const want = Math.max(1, Math.floor(pageCount));
  const step = Math.max(1, Math.floor(maxPagesPerRequest));
  const chunks: SourceRefetchChunk[] = [];
  for (let page = 0; page < want; page += step) {
    chunks.push({ page, span: Math.min(step, want - page) });
  }
  return chunks;
}
