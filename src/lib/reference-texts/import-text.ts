import { normalizeBody } from './form';

/**
 * 파일에서 가져온 글을 다루는 순수 함수들.
 *
 * 파일을 읽는 일(브라우저 API·pdf.js)은 `import.ts` 가 맡는다 — 여기는 값만 다뤄
 * 브라우저 없이 검증된다.
 */

/**
 * 가져온 글을 저장할 모양으로.
 * @param raw - 파일에서 읽은 글
 * @returns 평문
 */
export function normalizeImportedText(raw: string): string {
  return normalizeBody(raw);
}

/**
 * 쪽마다 뽑은 글을 한 편으로 잇는다.
 *
 * 빈 쪽(표지·간지)은 건너뛴다 — 그대로 이으면 빈 줄만 잔뜩 남는다.
 * 쪽과 쪽 사이는 빈 줄 하나다(문단이 바뀌었을 수도, 이어질 수도 있어 사람이 고친다).
 * @param pages - 쪽별 평문
 * @returns 이어 붙인 평문
 */
export function joinPageTexts(pages: readonly string[]): string {
  return normalizeBody(pages.map((p) => p.trim()).filter(Boolean).join('\n\n'));
}

/** 가져오기 결과를 사람에게 어떻게 말할 것인가 */
export interface PdfImportVerdict {
  level: 'error' | 'warning' | 'success';
  text: string;
}

/**
 * PDF 에서 얼마나 건졌는지 판정한다.
 *
 * ⚠️ **스캔본은 여기서 막고 갈 길을 알려 준다.** 글자 레이어가 없는 PDF 는 이 길로는
 *    한 글자도 못 읽는데, 학원에는 이미 그것을 읽는 기능이 있다(학교 프린트 시험지).
 *    "못 읽었어요" 로 끝내면 선생님은 파일이 잘못된 줄 안다.
 * @param input - 쪽 수와 글자를 건진 쪽 수
 * @returns 토스트 종류와 문구
 */
export function pdfImportVerdict(
  input: { pageCount: number; pagesWithText: number },
): PdfImportVerdict {
  if (input.pagesWithText === 0) {
    return {
      level: 'error',
      text: '이 PDF 에는 글자 데이터가 없어요(사진처럼 스캔한 파일이에요). '
        + '학교 프린트 시험지로 올리면 AI 가 읽어 드려요.',
    };
  }
  if (input.pagesWithText < input.pageCount) {
    const missing = input.pageCount - input.pagesWithText;
    return {
      level: 'warning',
      text: `${input.pageCount}쪽 가운데 ${missing}쪽은 글자가 없어 빠졌어요. 본문을 확인해 주세요.`,
    };
  }
  return { level: 'success', text: `${input.pageCount}쪽을 불러왔어요.` };
}
