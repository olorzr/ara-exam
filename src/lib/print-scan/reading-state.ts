import type { PrintBundle } from '@/types/print-scan';
import { PRINT_READ_STALE_MS } from './constants';

/**
 * 묶음의 '읽는중' 이 진짜 도는 중인지, 멈춰 버린 것인지 (순수 함수).
 *
 * 화면에서 떼어 둔 까닭은 `bundles.ts` 와 같다 — 값만 다루는 판단이라
 * supabase·DOM 없이 검증돼야 한다.
 */

/**
 * 읽다 만 채 잠긴 묶음인가.
 *
 * ⚠️ 이 판단이 **유일한 복구 경로**다. 탭이 닫히면 `runBundle` 의 `catch` 가 돌지 못해
 *    행이 '읽는중' 으로 남는데, 그걸 '다른 탭이 읽는 중' 과 구분하지 못하면 '읽기' 버튼이
 *    영영 잠긴다.
 * @param bundle - 묶음 (상태와 마지막 갱신 시각만 본다)
 * @param now - 지금 (테스트가 고정한다)
 * @returns 멈춘 것으로 봐도 되는가
 */
export function isStalledReading(
  bundle: Pick<PrintBundle, 'status' | 'updated_at'>,
  now: number = Date.now(),
): boolean {
  if (bundle.status !== '읽는중') return false;
  const startedAt = Date.parse(bundle.updated_at ?? '');
  // 시각을 모르면 멈춘 것으로 본다 — 영영 잠긴 줄로 두는 쪽이 더 나쁘다(확인창이 한 번 더 묻는다)
  if (Number.isNaN(startedAt)) return true;
  // 기기 시계가 앞서 있으면 음수가 된다 — 그때는 '방금 시작' 으로 본다
  return now - startedAt >= PRINT_READ_STALE_MS;
}

/**
 * 읽기가 남긴 경고들.
 *
 * `ocr_meta` 는 DB 에서 null 로 올 수 있어 한 곳에서만 풀어 준다 —
 * 호출부마다 `?? []` 를 적으면 한 곳이 빠지고 그 화면만 조용히 경고를 잃는다.
 * @param bundle - 묶음
 * @returns 경고 문자열들 (없으면 빈 배열)
 */
export function bundleWarnings(bundle: Pick<PrintBundle, 'ocr_meta'>): string[] {
  return bundle.ocr_meta?.warnings ?? [];
}
