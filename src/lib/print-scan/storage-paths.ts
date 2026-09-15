/**
 * 학교 프린트 스캔의 Storage 경로 규약 (순수 함수).
 *
 * 버킷은 기출과 **같은 것**(`exam-problem-bank`)을 쓴다 — 정책이 버킷 단위라
 * 새 버킷을 만들면 정책 세 벌을 더 관리해야 하고, 허용 MIME(pdf·jpeg)도 똑같다.
 * 경로 가족만 `print-scans/` 로 갈라 둔다.
 *
 * ⚠️ 객체 키에 **한글·공백을 넣지 말 것.** Storage 키 정규식이 ASCII 기준이라
 *    한글이 섞이면 업로드가 거부된다. 그래서 경로는 UUID + 고정 영문 이름뿐이다
 *    (프린트명·학교명은 절대 경로에 넣지 않는다).
 */

/** 앱이 만드는 모든 키는 이 모양이어야 한다 */
const SAFE_SEGMENT = /^[0-9a-zA-Z_-]{1,64}$/;

function assertSafe(segment: string, what: string): string {
  if (!SAFE_SEGMENT.test(segment)) {
    throw new Error(`${what} 가 저장소 경로로 쓸 수 없는 값이에요: ${segment}`);
  }
  return segment;
}

/**
 * 스캔 폴더.
 * @param scanId - 스캔 id (UUID)
 * @returns 버킷 기준 경로
 */
export function printScanFolder(scanId: string): string {
  return `print-scans/${assertSafe(scanId, '스캔 id')}`;
}

/**
 * 원본 PDF 경로. **'다시 읽기' 가 이 파일에 달려 있다** — 실패한 묶음을 파일 없이
 * 다시 읽을 방법이 없다.
 * @param scanId - 스캔 id (UUID)
 * @returns 버킷 기준 경로
 */
export function printScanPdfPath(scanId: string): string {
  return `${printScanFolder(scanId)}/original.pdf`;
}

/**
 * 쪽 이미지 경로. 시험지를 고칠 때 원본과 대조하는 데 쓴다.
 * @param scanId - 스캔 id (UUID)
 * @param page - 1-based 쪽 번호
 * @param version - 다시 만든 판을 가르는 꼬리표 (빈 값이면 처음 올리는 경로)
 * @returns 버킷 기준 경로
 */
export function printScanPagePath(scanId: string, page: number, version = ''): string {
  if (!Number.isInteger(page) || page < 1) {
    throw new Error(`쪽 번호가 올바르지 않아요: ${page}`);
  }
  // 판 번호가 붙으면 **다른 파일**이다 — 다시 만들 때 옛 파일을 지우지 않고 새로 올리기 위해서다.
  // 버킷에 UPDATE 정책이 없어(제자리 덮어쓰기 금지) 같은 경로를 두 번 쓸 수 없다
  const suffix = version === '' ? '' : `-${version.replace(/[^a-z0-9]/gi, '')}`;
  return `${printScanFolder(scanId)}/pages/${page}${suffix}.jpg`;
}
