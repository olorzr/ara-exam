/**
 * KST(Asia/Seoul) 기준 올해 학년도를 반환한다.
 * 서버·클라이언트 타임존이 UTC 인 환경에서 `new Date().getFullYear()` 를 쓰면
 * 연말·연초 자정 부근에 한 해가 어긋나므로 항상 이 함수를 쓴다.
 * @returns 4자리 연도 (예: 2026)
 */
export function kstYear(): number {
  return Number(
    new Intl.DateTimeFormat('en', { timeZone: 'Asia/Seoul', year: 'numeric' }).format(new Date()),
  );
}
