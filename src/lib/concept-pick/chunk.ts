/**
 * 본문 평문을 **묶음**으로 나눈다 (순수 함수).
 *
 * 왜 나누는가: 선생님 기준(설명 100자에 5개)대로 뚫으면 시험지 한 장에 수백 개가 된다.
 * 한 응답에 그만큼을 담으면 스키마 상한에 잘려 **뒤쪽 본문이 통째로 빈칸 없이** 남는다.
 * 묶음마다 따로 물으면 상한이 묶음마다 새로 주어지고, 받는 즉시 마킹하므로 중간에 멈춰도
 * 거기까지는 남는다.
 *
 * ⚠️ **줄 경계로만 자른다.** `htmlToPlainText` 가 표 한 행을 `| 칸 | 칸 |` 한 줄로 만들어
 *    두었는데 줄 중간에서 자르면 행의 짝이 깨져, 모델에게 시어 풀이표가 무관한 조각으로 보인다
 *    (`plain-text.ts` 가 애써 남긴 구조가 여기서 죽는다).
 * ⚠️ 한 줄이 상한보다 길어도 **쪼개지 않는다** — 그 줄 하나가 한 묶음이다. 표 한 행이
 *    상한보다 길 수 있는데, 자르면 위와 같은 이유로 그 행을 못 쓰게 된다.
 *    대가를 알고 받아들인 것이다(코덱스 리뷰): 아주 긴 줄 하나는 `CONCEPT_PICK_MAX_COUNT`
 *    때문에 밀도만큼 못 뚫을 수 있다. 운영 데이터 121장에서 가장 긴 줄은 358자로 상한 안이라
 *    지금은 일어나지 않는다 — 실제로 잘리기 시작하면 그때는 **줄을 쪼갤 게 아니라 표 행을
 *    묶음으로 보내는 방법**(행 단위 재귀)을 찾아야 한다.
 */

/**
 * 평문을 묶음으로 나눈다.
 * @param plain - `htmlToPlainText` 가 만든 줄 단위 평문
 * @param maxChars - 묶음 하나의 목표 길이(글자). 한 줄이 이보다 길면 그 줄만으로 한 묶음이 된다
 * @returns 묶음 목록. 내용이 없으면 빈 배열
 */
export function chunkPlainText(plain: string, maxChars: number): string[] {
  const lines = plain.split('\n');
  const chunks: string[] = [];
  let current: string[] = [];
  let length = 0;

  const flush = () => {
    const text = current.join('\n').trim();
    if (text !== '') chunks.push(text);
    current = [];
    length = 0;
  };

  for (const line of lines) {
    // ⚠️ 줄바꿈은 **줄과 줄 사이**에만 있다(코덱스 리뷰 2R). 마지막 줄에까지 한 글자를 물리면
    //    딱 맞는 본문이 공연히 두 묶음으로 갈려 AI 호출이 한 번 더 늘고 앞뒤 문맥이 끊긴다
    const joinCost = current.length > 0 ? 1 : 0;
    if (current.length > 0 && length + joinCost + line.length > maxChars) {
      flush();
      current.push(line);
      length = line.length;
      continue;
    }
    current.push(line);
    length += joinCost + line.length;
  }
  flush();

  return chunks;
}
