import type { PageOrientation } from '@/lib/page-orientation';

/**
 * 프린트 읽기의 실행 환경 타입.
 *
 * `run.ts` 에서 떼어 둔 까닭: 묶음 읽기(`read-bundle.ts`)와 상태 전이(`run.ts`)가 같은
 * 환경을 받는데, 타입을 한쪽에 두면 다른 쪽이 그 파일을 **값으로** import 하게 되어
 * 순환이 된다(`src/lib/__checks/import-cycles.test.ts` 가 잡는 그 모양이다).
 */

/** 읽기 환경 — 화면(훅)이 정한다 */
export interface PrintRunEnv {
  port: number;
  pref: { model: string | null; effort: string | null };
  /**
   * **본문 읽기 턴에만** 쓸 모델·노력(해석이 끝난 값).
   *
   * 없으면 `pref` 를 그대로 쓴다. ⚠️ 방향 판정·단어 등록에는 넣지 않는다 —
   * 싸야 하는 단계까지 높은 노력으로 돌리면 한도만 태운다.
   */
  ocrPref?: { model: string | null; effort: string | null };
  signal?: AbortSignal;
  onProgress?: (p: PrintRunProgress) => void;
  /**
   * 읽기가 남긴 경고 — **완료를 알리기 전에** 부른다.
   *
   * 경고를 `ocr_meta` 에만 넣고 끝내면 화면은 "다 됐어요" 만 말한다. 쪽이 빠졌거나 본문이
   * 잘렸어도 선생님은 완성본으로 알고 그대로 인쇄한다.
   */
  onWarnings?: (warnings: string[]) => void;
  /**
   * 미리 확인해 둔 쪽 방향. 없으면 이 묶음의 쪽만 여기서 확인한다.
   *
   * 스캔 전체를 한 번에 확인한 값을 넘기는 쪽이 싸다 — 여러 묶음이 같은 문서를 나눠 쓴다.
   */
  orientation?: PageOrientation;
}

export interface PrintRunProgress {
  phase: 'upload' | 'orient' | 'page' | 'ocr' | 'save' | 'words';
  done: number;
  total: number;
  /** 여러 묶음을 이어 읽을 때 지금 몇 번째인지 */
  bundle?: { index: number; total: number; name: string };
}
