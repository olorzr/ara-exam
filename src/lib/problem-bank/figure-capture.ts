'use client';

import type { Bbox } from '@/types/problem-bank';
import { bboxToPixelRect } from '@/lib/problem-ocr/crop';
import {
  figurePlaceholder, MAX_FIGURES, removeFigureAt,
} from './figure-placeholders';
import { capturedFigurePath, newFigureToken } from './storage-paths';
import { uploadProblemFile } from './storage';

/**
 * 검수 화면에서 **사람이 끌어 잡은 영역**을 그림으로 잘라 본문에 붙인다 (브라우저 전용).
 *
 * AI 가 그림을 못 찾았거나 엉뚱하게 잡았을 때 고칠 길이다. 이게 없으면 잘못 잡힌 그림을
 * 되돌릴 방법이 없어 문항을 통째로 버려야 한다.
 *
 * ⚠️ 원본 쪽 이미지는 **서명 URL** 이라 캔버스가 오염될 수 있다. `crossOrigin`
 *    을 걸어야 `toBlob` 이 `SecurityError` 로 죽지 않는다.
 */

/** 잘라 낸 그림의 화질 — 원본 대조용 크롭과 같은 값 */
const FIGURE_QUALITY = 0.85;

/**
 * 서명 URL 의 이미지에서 영역을 잘라 JPEG 로.
 * @param url - 쪽 이미지 서명 URL
 * @param bbox - 0~1 정규화 영역
 * @returns Blob. 못 만들면 null
 */
export async function cropImageUrl(url: string, bbox: Bbox): Promise<Blob | null> {
  const image = await loadImage(url);
  if (!image) return null;

  const rect = bboxToPixelRect(bbox, image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = rect.w;
  canvas.height = rect.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // JPEG 는 투명을 모른다 — 안 칠하면 검게 나온다
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, rect.w, rect.h);
  ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);

  try {
    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', FIGURE_QUALITY);
    });
  } catch {
    // 오염된 캔버스 — crossOrigin 이 안 먹은 경우다
    return null;
  }
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    // ⚠️ src 보다 **먼저** 걸어야 한다. 뒤에 걸면 이미 오염된 채로 읽힌다
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

export interface CaptureInput {
  kind: 'passage' | 'problem';
  id: string;
  /** 자를 원본 쪽 이미지의 서명 URL */
  pageUrl: string;
  bbox: Bbox;
  /** 지금 달려 있는 그림 경로들 */
  paths: readonly string[];
  /** 지금 본문 — 끝에 자리표시자를 붙여 돌려준다 */
  html: string;
}

/**
 * 영역을 잘라 올리고 본문 **끝에** 자리표시자를 붙인다.
 *
 * 자리는 끝이다 — 우리가 짐작해 문단 사이에 꽂으면 엉뚱한 데 들어간다.
 * 사람이 편집기에서 '그림 n' 칩을 끌어 옮긴다.
 * @param input - 무엇을 어디서 자를지
 * @returns 새 경로 목록과 본문. 실패하면 null
 * @throws 상한을 넘겼을 때
 */
export async function captureFigure(
  input: CaptureInput,
): Promise<{ paths: string[]; html: string } | null> {
  if (input.paths.length >= MAX_FIGURES) {
    throw new Error(`그림은 ${MAX_FIGURES}개까지 붙일 수 있어요.`);
  }

  const blob = await cropImageUrl(input.pageUrl, input.bbox);
  if (!blob) return null;

  // ⚠️ 이름은 **한 번만 쓴다.** 순번으로 지으면 가운데 그림을 뺀 뒤 다음에 붙이는 그림이
  //    같은 이름을 골라, 이미 만든 문제지가 스냅샷으로 들고 있는 파일을 덮어쓴다 —
  //    그러면 인쇄물에서만 그 그림이 딴 것으로 바뀐다. 늘 새 이름이라 upsert 도 필요 없다
  const path = capturedFigurePath(input.kind, input.id, newFigureToken());
  await uploadProblemFile(path, blob, 'image/jpeg');

  return {
    paths: [...input.paths, path],
    html: `${input.html}${figurePlaceholder(input.paths.length + 1)}`,
  };
}


/**
 * 그림 하나를 뺀다 — 자리표시자와 경로를 **함께** 고친다.
 *
 * ⚠️ **Storage 파일은 지우지 않는다.** 이미 만든 문제지가 그 경로를 스냅샷에 들고 있어서,
 *    지우면 **인쇄물에서 그 자리가 빈칸**이 된다(선택 삭제·출처 삭제와 같은 규약 —
 *    mutations.ts 참조). 고아 파일은 감수한 값이다.
 *    파일 이름은 한 번만 쓰므로(`capturedFigurePath`) 남겨 둬도 다음 그림과 부딪히지 않는다.
 * @param input - 뺄 그림과 지금 상태
 * @returns 새 경로 목록과 본문
 */
export function dropFigure(input: {
  index: number;
  paths: readonly string[];
  html: string;
}): { paths: string[]; html: string } {
  return removeFigureAt(input.html, input.paths, input.index);
}
