'use client';

import { encodeWithinBudget, MAX_PAGE_BYTES } from './pdfPages';

/**
 * 사진 파일을 JPEG 로 바꾼다 (브라우저 전용).
 *
 * 휴대폰으로 찍은 답지를 그대로 쓰지 않고 **늘 다시 인코딩한다**:
 *  · 버킷(`exam-problem-bank`)이 `image/jpeg` 만 받는다 — PNG 는 그대로 올리면 거부된다.
 *  · 요즘 휴대폰 사진은 4000px·5MB 가 예사라 AI 한 번에 실을 예산을 넘긴다.
 *  · `<img>` 로 그리면 EXIF 회전이 반영된다 — 옆으로 누운 정답표를 모델이 못 읽는다.
 *
 * ⚠️ Storage 로 올릴 때는 **`canvas.toBlob`** 을 쓴다. data URL 을 만들어 `fetch()` 로
 *    Blob 을 얻는 흔한 수법은 이 앱의 CSP `connect-src` 가 `data:` 를 막아 전부 실패한다
 *    (crop-dom.ts 의 `pageBlob` 과 같은 이유).
 */

/** 저장·전송용으로 줄일 긴 변 길이(px). A4 를 300dpi 로 찍은 사진도 글자가 남는다 */
export const PHOTO_MAX_SIDE = 2000;

/** 저장용 JPEG 화질 */
export const PHOTO_JPEG_QUALITY = 0.85;

/**
 * 사진을 캔버스에 그린다(긴 변을 maxSide 로 맞추고 흰 바탕을 깐다).
 * @param file - 사진 파일
 * @param maxSide - 긴 변 상한(px)
 * @returns 그려 낸 캔버스
 * @throws 이미지를 열지 못했을 때
 */
export async function imageFileToCanvas(
  file: File,
  maxSide = PHOTO_MAX_SIDE,
): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('이미지를 변환할 수 없어요.');
    // JPEG 는 투명을 모른다 — 안 칠하면 PNG 의 투명한 곳이 검게 나온다
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * 사진을 Storage 에 올릴 JPEG Blob 으로.
 * @param file - 사진 파일
 * @returns Blob. 만들지 못하면 null
 */
export async function imageFileToJpegBlob(file: File): Promise<Blob | null> {
  try {
    const canvas = await imageFileToCanvas(file);
    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', PHOTO_JPEG_QUALITY);
    });
  } catch {
    return null;
  }
}

/**
 * 사진을 AI 에 보낼 data URL 로 (쪽 이미지와 같은 예산 사다리를 쓴다).
 * @param file - 사진 파일
 * @param budget - data URL 글자 수 예산
 * @returns data URL. 예산 안에 못 넣거나 열지 못하면 null
 */
export async function imageFileToJpegDataUrl(
  file: File,
  budget = MAX_PAGE_BYTES,
): Promise<string | null> {
  try {
    const canvas = await imageFileToCanvas(file);
    return encodeWithinBudget(canvas, budget);
  } catch {
    return null;
  }
}

/** objectURL 하나를 <img> 로 읽어 들인다 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('사진을 열지 못했어요.'));
    image.src = url;
  });
}
