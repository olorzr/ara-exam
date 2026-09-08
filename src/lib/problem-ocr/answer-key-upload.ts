'use client';

import { imageFileToJpegBlob } from '@/lib/pdf/imageToJpeg';
import { uploadProblemFile } from '@/lib/problem-bank/storage';
import { answerKeyStoragePlan, type AnswerKeyInput } from './answer-key-input';

/**
 * 별도 답지 파일을 Storage 에 올린다 (브라우저 전용).
 *
 * 사진은 올리기 전에 JPEG 로 바꾼다 — 버킷이 `application/pdf` 와 `image/jpeg` 만 받는다.
 * 한 장이라도 실패하면 **통째로 던진다**: 정답표는 순서가 곧 문항 번호라
 * 중간이 빠진 채로 올라가면 그 뒤 정답이 전부 밀린다.
 * @param sourceId - 출처 id
 * @param input - 고른 답지
 * @returns 올린 경로들 (파일 순서 그대로)
 * @throws 변환·업로드 실패 시
 */
export async function uploadAnswerKey(
  sourceId: string,
  input: AnswerKeyInput,
): Promise<string[]> {
  const plan = answerKeyStoragePlan(sourceId, input);
  const files = input.kind === 'pdf' ? [input.file] : input.files;
  const paths: string[] = [];

  for (let i = 0; i < plan.length; i += 1) {
    const { path, contentType } = plan[i];
    const file = files[i];
    let body: Blob = file;

    if (contentType === 'image/jpeg') {
      const jpeg = await imageFileToJpegBlob(file);
      if (!jpeg) throw new Error(`답지 사진을 변환하지 못했어요: ${file.name}`);
      body = jpeg;
    }

    await uploadProblemFile(path, body, contentType);
    paths.push(path);
  }

  return paths;
}
