import { sourceAnswerKeyPath } from '@/lib/problem-bank/storage-paths';
import { planPageBatches } from './batch-plan';
import { ANSWER_KEY_PAGES_PER_BATCH } from './constants';

/**
 * 별도로 올리는 답지 파일의 검증·계획 (순수 함수).
 *
 * 답지는 두 모습으로 온다: 별지 **PDF 한 개**, 또는 휴대폰으로 찍은 **사진 여러 장**.
 * 둘을 섞어 받지 않는다 — 사진과 PDF 를 함께 주면 어느 순서로 읽어야 할지 알 수 없고,
 * 정답표는 **순서가 곧 문항 번호**라 잘못 섞이면 정답이 통째로 밀린다.
 *
 * ⚠️ 버킷(`exam-problem-bank`)이 받는 MIME 은 `application/pdf` 와 `image/jpeg` 뿐이다.
 *    PNG 도 고를 수 있게 하되 **올리기 전에 JPEG 로 바꾼다**(imageToJpeg.ts).
 */

/** 사진으로 받을 수 있는 최대 장수 — 정답표가 이보다 길 일은 없다 */
export const ANSWER_KEY_MAX_IMAGES = 10;

/** 고른 답지 */
export type AnswerKeyInput =
  | { kind: 'pdf'; file: File; pageCount: number }
  | { kind: 'images'; files: File[] };

/** 파일을 골랐을 때의 판정 결과 (쪽 수는 아직 모른다 — PDF 를 열어 봐야 안다) */
export type AnswerKeyPick =
  | { ok: true; kind: 'pdf'; file: File }
  | { ok: true; kind: 'images'; files: File[] }
  | { ok: false; error: string };

/** 저장할 파일 한 개의 계획 */
export interface AnswerKeyStorageItem {
  path: string;
  contentType: 'application/pdf' | 'image/jpeg';
}

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png'];

/**
 * 이 파일이 PDF 인지 사진인지.
 *
 * MIME 을 먼저 보되 **확장자로 한 번 더 본다** — 어떤 운영체제·브라우저 조합은
 * `File.type` 을 빈 문자열로 준다(특히 아이폰에서 공유한 파일).
 * @param file - 고른 파일
 * @returns 'pdf' · 'image' · 지원하지 않으면 null
 */
export function answerKeyFileKind(file: File): 'pdf' | 'image' | null {
  const type = file.type.toLowerCase();
  if (type === 'application/pdf') return 'pdf';
  if (type === 'image/jpeg' || type === 'image/png') return 'image';

  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return 'pdf';
  if (IMAGE_EXTENSIONS.some((ext) => name.endsWith(ext))) return 'image';
  return null;
}

/**
 * 고른 파일들이 답지로 쓸 수 있는지 본다.
 * @param files - 파일 입력이 준 목록
 * @returns 종류별로 나눈 결과, 또는 사람에게 보여 줄 오류
 */
export function pickAnswerKeyFiles(files: readonly File[]): AnswerKeyPick {
  if (files.length === 0) return { ok: false, error: '답지 파일을 고르지 못했어요.' };

  const pdfs: File[] = [];
  const images: File[] = [];
  for (const file of files) {
    const kind = answerKeyFileKind(file);
    if (kind === 'pdf') pdfs.push(file);
    else if (kind === 'image') images.push(file);
    else return { ok: false, error: '답지는 PDF 하나 또는 사진(JPG·PNG)만 올릴 수 있어요.' };
  }

  if (pdfs.length > 0 && images.length > 0) {
    return { ok: false, error: 'PDF 와 사진을 함께 올릴 수 없어요. 하나만 골라 주세요.' };
  }
  if (pdfs.length > 1) {
    return { ok: false, error: '답지 PDF 는 하나만 올릴 수 있어요.' };
  }
  if (images.length > ANSWER_KEY_MAX_IMAGES) {
    return { ok: false, error: `답지 사진은 최대 ${ANSWER_KEY_MAX_IMAGES}장까지 올릴 수 있어요.` };
  }

  return pdfs.length === 1
    ? { ok: true, kind: 'pdf', file: pdfs[0] }
    : { ok: true, kind: 'images', files: images };
}

/**
 * 답지를 Storage 어디에 어떤 형식으로 올릴지.
 *
 * 사진은 PNG 로 골랐어도 **전부 JPEG 로 올린다**(버킷 제한). 변환은 업로드 쪽이 한다.
 * @param sourceId - 출처 id
 * @param input - 고른 답지
 * @returns 파일 순서대로의 경로·형식
 */
export function answerKeyStoragePlan(
  sourceId: string,
  input: AnswerKeyInput,
): AnswerKeyStorageItem[] {
  if (input.kind === 'pdf') {
    return [{ path: sourceAnswerKeyPath(sourceId, 1, 'pdf'), contentType: 'application/pdf' }];
  }
  return input.files.map((_, i) => ({
    path: sourceAnswerKeyPath(sourceId, i + 1, 'jpg'),
    contentType: 'image/jpeg' as const,
  }));
}

/**
 * AI 에 보낼 이미지 장수 (PDF 는 쪽 수).
 * @param input - 고른 답지 (없으면 0)
 * @returns 장수
 */
export function answerKeyImageCount(input: AnswerKeyInput | null): number {
  if (!input) return 0;
  return input.kind === 'pdf' ? Math.max(0, input.pageCount) : input.files.length;
}

/**
 * 정답표를 읽는 데 드는 ChatGPT 횟수.
 *
 * 원본 PDF 안의 정답표 쪽과 별도 답지는 **따로 묶는다** — 서로 다른 문서라
 * 한 묶음에 섞어 보내면 "보낸 이미지는 N쪽" 안내가 거짓이 된다.
 * @param answerPages - 원본 PDF 안에서 정답표로 지정한 쪽
 * @param input - 별도 답지 (없으면 null)
 * @returns 묶음 수
 */
export function answerKeyBatchCount(
  answerPages: number[],
  input: AnswerKeyInput | null,
): number {
  const inDoc = planPageBatches(answerPages, {
    size: ANSWER_KEY_PAGES_PER_BATCH,
    overlap: 0,
  }).length;
  const separate = Math.ceil(answerKeyImageCount(input) / ANSWER_KEY_PAGES_PER_BATCH);
  return inDoc + separate;
}

/**
 * 화면에 보여 줄 한 줄 요약.
 * @param input - 고른 답지
 * @returns '답지 PDF 3쪽' · '답지 사진 4장' · 없으면 ''
 */
export function answerKeySummary(input: AnswerKeyInput | null): string {
  if (!input) return '';
  return input.kind === 'pdf'
    ? `답지 PDF ${input.pageCount}쪽`
    : `답지 사진 ${input.files.length}장`;
}
