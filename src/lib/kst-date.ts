/**
 * UTC 시각(ISO 문자열)을 **한국 시간 날짜**(`YYYY-MM-DD`)로 바꾼다.
 *
 * 성적 등록 라우트 둘(`sync-to-grades`·`sync-paper-to-grades`)이 시험일로 쓴다 — `toISOString()` 을
 * 자르면 오전 9시 전에 만든 시험이 어제 날짜가 된다.
 * @param iso - `created_at` 같은 시각. 없으면 null
 * @returns `YYYY-MM-DD`, 읽을 수 없으면 null
 */
export function toKstDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  // en-CA 로케일은 YYYY-MM-DD 형식을 준다
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}
