/**
 * Storage 오류를 뜻으로 읽는다 (순수 함수 — supabase 를 부르지 않는다).
 *
 * 업로드는 `upsert:false` 라 **이미 있는 자리**면 실패로 온다. 그 하나만 '성공과 같다' 로
 * 쳐야 하는데, 오류를 뭉뚱그려 그렇게 치면 네트워크·권한·용량 실패까지 '파일이 있다' 가 된다.
 */

/** 이미 있는 자리에 올렸을 때 Storage 가 주는 상태 코드 */
const DUPLICATE_STATUS = '409';

/**
 * '그 자리에 이미 파일이 있다' 는 뜻의 업로드 오류인가.
 *
 * ⚠️ 이것만 성공으로 쳐야 한다. 모든 오류를 중복으로 치면 **없는 경로**가 올라간 것처럼
 *    저장돼, 원본 칸은 영영 비어 있고 '다시 읽기' 도 (경로가 차 있으니) 그 쪽을 고치지 않는다.
 * @param e - 업로드가 던진 것
 * @returns 중복이면 true
 */
export function isDuplicateUploadError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const err = e as { statusCode?: unknown; status?: unknown; error?: unknown; message?: unknown };

  const status = err.statusCode ?? err.status;
  if (String(status) === DUPLICATE_STATUS) return true;
  if (typeof err.error === 'string' && err.error.toLowerCase() === 'duplicate') return true;

  return typeof err.message === 'string'
    && /already exists|resource already/i.test(err.message);
}
