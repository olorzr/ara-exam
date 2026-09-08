/**
 * Storage 경로 규약 (순수 함수).
 *
 * ⚠️ Storage 는 **프로젝트 전역**이다. `db: { schema: 'exam' }` 옵션은 from()/rpc() 에만
 *    적용되고 storage 에는 영향이 없어, 버킷 이름이 ara-system 과 겹치면 안 된다.
 *
 * ⚠️ 객체 키에 **한글·공백을 넣지 말 것.** Storage 키 정규식이 ASCII 기준이라
 *    한글 파일명은 업로드가 거부된다(ara-system mig334 에서 실제로 겪었고,
 *    그 버킷은 만들어진 뒤 한 번도 업로드에 성공하지 못했다).
 *    그래서 경로는 전부 **UUID + 고정 영문 이름**으로만 만든다.
 */

/** 기출 문제 은행 전용 버킷 (비공개) */
export const PROBLEM_BANK_BUCKET = 'exam-problem-bank';

/** 앱이 만드는 모든 키는 이 모양이어야 한다 */
const SAFE_SEGMENT = /^[0-9a-zA-Z_-]{1,64}$/;

function assertSafe(segment: string, what: string): string {
  if (!SAFE_SEGMENT.test(segment)) {
    throw new Error(`${what} 가 저장소 경로로 쓸 수 없는 값이에요: ${segment}`);
  }
  return segment;
}

/**
 * 원본 PDF 경로.
 * @param sourceId - 출처 id (UUID)
 * @returns 버킷 기준 경로
 */
export function sourcePdfPath(sourceId: string): string {
  return `sources/${assertSafe(sourceId, '출처 id')}/original.pdf`;
}

/**
 * 페이지 이미지 경로. 검수 화면에서 원본과 대조하는 데 쓴다.
 * @param sourceId - 출처 id (UUID)
 * @param page - 1-based 쪽 번호
 * @returns 버킷 기준 경로
 */
export function sourcePagePath(sourceId: string, page: number): string {
  if (!Number.isInteger(page) || page < 1) {
    throw new Error(`쪽 번호가 잘못됐어요: ${page}`);
  }
  return `sources/${assertSafe(sourceId, '출처 id')}/pages/${page}.jpg`;
}

/**
 * 별도로 올린 답지 파일 경로.
 *
 * ⚠️ 페이지 이미지(`pages/{n}.jpg`)와 **다른 가족**을 쓴다. 같은 자리에 넣으면
 *    답지 3장이 원본 1~3쪽을 덮어써 검수 화면의 원본 대조가 통째로 망가진다.
 * @param sourceId - 출처 id (UUID)
 * @param index - 1-based 파일 번호 (사진 여러 장이면 고른 순서)
 * @param ext - 'pdf' 또는 'jpg' (버킷이 이 둘만 받는다)
 * @returns 버킷 기준 경로
 */
export function sourceAnswerKeyPath(
  sourceId: string,
  index: number,
  ext: 'pdf' | 'jpg',
): string {
  if (!Number.isInteger(index) || index < 1) {
    throw new Error(`답지 번호가 잘못됐어요: ${index}`);
  }
  return `sources/${assertSafe(sourceId, '출처 id')}/answer-key/${index}.${ext}`;
}

/**
 * 문항 영역 이미지 경로 ('이미지로 출제' 와 목록 썸네일에 쓴다).
 * @param problemId - 문항 id (UUID)
 * @returns 버킷 기준 경로
 */
export function problemRegionPath(problemId: string): string {
  return `problems/${assertSafe(problemId, '문항 id')}/region.jpg`;
}

/**
 * 지문 영역 이미지 경로.
 * @param passageId - 지문 id (UUID)
 * @returns 버킷 기준 경로
 */
export function passageRegionPath(passageId: string): string {
  return `passages/${assertSafe(passageId, '지문 id')}/region.jpg`;
}

/**
 * 출처 하나가 쓰는 모든 경로의 접두사. 출처를 지울 때 통째로 정리하는 데 쓴다.
 * @param sourceId - 출처 id (UUID)
 * @returns 버킷 기준 폴더 경로
 */
export function sourceFolder(sourceId: string): string {
  return `sources/${assertSafe(sourceId, '출처 id')}`;
}
