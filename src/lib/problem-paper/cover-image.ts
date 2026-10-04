/**
 * 표지 그림을 버킷에 올릴 수 있는 JPEG 로 바꾼다(브라우저 전용).
 *
 * ⚠️ 버킷 `exam-problem-bank` 는 `application/pdf`·`image/jpeg` 만 받는다(sql/17).
 *    선생님이 만든 표지는 PNG 가 많아 그대로 올리면 거부되므로 **늘 다시 인코딩**한다.
 * ⚠️ Blob 은 `canvas.toBlob` 으로 만든다 — data URL 을 `fetch()` 로 Blob 으로 바꾸면 CSP
 *    `connect-src` 가 막는다(답지 사진·그림 자르기와 같은 규약).
 * `createImageBitmap` 은 EXIF 회전을 반영해 휴대폰 사진도 바로 선다.
 */

/** 긴 변 상한 — A4 297mm 를 200dpi 로 그린 크기. 인쇄에 넉넉하고 파일이 커지지 않는다 */
export const COVER_MAX_SIDE_PX = 2339;

/** JPEG 품질 — 표지는 큰 글씨·색면이 많아 높게 둔다 */
const COVER_JPEG_QUALITY = 0.9;

/**
 * 긴 변이 상한을 넘으면 비율을 지켜 줄인 크기.
 * @param width - 원본 폭(px)
 * @param height - 원본 높이(px)
 * @returns 그릴 크기 (넘지 않으면 원본 그대로)
 */
export function fitCoverSize(width: number, height: number): { width: number; height: number } {
  const longSide = Math.max(width, height);
  if (longSide <= COVER_MAX_SIDE_PX) return { width, height };
  const scale = COVER_MAX_SIDE_PX / longSide;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * 고른 그림 파일을 JPEG Blob 으로 다시 인코딩한다.
 * @param file - 사용자가 고른 그림
 * @returns JPEG Blob
 * @throws 그림을 읽거나 그리지 못하면
 */
export async function encodeCoverJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const size = fitCoverSize(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('그림을 그릴 수 없는 브라우저예요.');
    // 투명한 PNG 는 JPEG 로 바꾸면 검게 칠해진다 — 흰 종이 위에 놓는다
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', COVER_JPEG_QUALITY);
    });
    if (!blob) throw new Error('그림을 JPEG 로 바꾸지 못했어요.');
    return blob;
  } finally {
    bitmap.close();
  }
}
