import { signProblemFile } from './storage';

/** 새 탭 열기 결과 */
export type OpenSignedResult = 'opened' | 'blocked' | 'failed';

/**
 * 저장소 파일을 **누르는 순간 새로 서명해** 새 탭으로 연다(읽기 전용 시험 보기의 원본 PDF·답지).
 *
 * 서명 URL 은 한 시간이면 만료된다(`SIGN_TTL_SECONDS`). 화면을 열 때 받아 둔 주소를 `<a href>` 에 박아 두면 한 시간 뒤
 * 누른 링크가 오류 쪽을 연다(코덱스 2R). 그래서 누를 때 서명한다.
 * ⚠️ 빈 탭을 **먼저 동기로** 연다 — 서명을 기다린 뒤에 `window.open` 하면 팝업 차단이 막는다. 받은 뒤 그 탭을 옮기고
 *    `opener` 를 끊는다(되돌아 조작 방지 — `rel="noopener"` 와 같은 효과).
 * @param path - 버킷 기준 경로
 * @param sign - 서명 함수(테스트용)
 * @returns 열었으면 'opened', 팝업이 막혔으면 'blocked', 서명에 실패했으면 'failed'
 */
export async function openSignedInNewTab(
  path: string,
  sign: (path: string) => Promise<string | null> = signProblemFile,
): Promise<OpenSignedResult> {
  const win = window.open('about:blank', '_blank');
  if (!win) return 'blocked';
  const url = await sign(path).catch(() => null);
  if (!url) {
    win.close();
    return 'failed';
  }
  win.opener = null;
  win.location.href = url;
  return 'opened';
}
