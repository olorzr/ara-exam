'use client';

import type { Bbox } from '@/types/problem-bank';
import { bboxToPixelRect } from '@/lib/problem-ocr/crop';
import {
  figurePlaceholder, MAX_FIGURES, removeFigureAt,
} from './figure-placeholders';
import { passageFigurePath, problemFigurePath } from './storage-paths';
import { removeProblemFiles, replaceProblemFile } from './storage';

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

  // ⚠️ 파일 이름을 **배열 길이로 정하면 안 된다.** 가운데 그림을 지우면 배열은 줄지만
  //    남은 파일 이름(figure-3.jpg)은 그대로라, 다음에 붙이는 그림이 같은 이름을 골라
  //    **쓰고 있는 파일을 덮어쓴다.** 비어 있는 이름을 찾아 쓴다
  const pathOf = input.kind === 'passage' ? passageFigurePath : problemFigurePath;
  const path = freeFigurePath(input.id, input.paths, pathOf);

  // ⚠️ 같은 자리에 다시 올릴 수 있다(잘못 잡아 지웠다가 다시 잡는 경우).
  //    버킷에 UPDATE 정책이 없으므로 지우고 새로 올린다
  await replaceProblemFile(path, blob, 'image/jpeg');

  return {
    paths: [...input.paths, path],
    html: `${input.html}${figurePlaceholder(input.paths.length + 1)}`,
  };
}

/**
 * 아직 안 쓰는 그림 파일 이름을 고른다.
 * @param id - 항목 id
 * @param paths - 지금 쓰고 있는 경로들
 * @param pathOf - 경로 만드는 함수
 * @returns 빈 자리의 경로
 * @throws 자리가 없을 때
 */
function freeFigurePath(
  id: string,
  paths: readonly string[],
  pathOf: (id: string, index: number) => string,
): string {
  const used = new Set(paths.filter(Boolean));
  for (let n = 1; n <= MAX_FIGURES; n += 1) {
    const candidate = pathOf(id, n);
    if (!used.has(candidate)) return candidate;
  }
  throw new Error(`그림은 ${MAX_FIGURES}개까지 붙일 수 있어요.`);
}

/**
 * 그림 하나를 뺀다 — 자리표시자·경로를 함께 고치고 **그 파일만** 지운다.
 *
 * ⚠️ 지우는 것은 **빠지는 그 파일 하나**다. 남은 경로에 아직 있으면 지우지 않는다 —
 *    자리표시자 번호는 당겨지지만 파일 이름은 그대로라, 이름만 보고 지우면
 *    **쓰고 있는 그림이 사라진다.**
 * ⚠️ 문항·출처 삭제는 파일을 **남긴다**(이미 만든 문제지의 스냅샷이 그 경로를 들고
 *    있어서다 — mutations.ts 참조). 여기만 예외인 이유는 방금 붙였다 무르는 자리라
 *    문제지에 실릴 틈이 없기 때문이다.
 * @param input - 뺄 그림과 지금 상태
 * @returns 새 경로 목록과 본문
 */
export async function dropFigure(input: {
  index: number;
  paths: readonly string[];
  html: string;
}): Promise<{ paths: string[]; html: string }> {
  const next = removeFigureAt(input.html, input.paths, input.index);

  const gone = input.paths[input.index - 1];
  if (gone && !next.paths.includes(gone)) await removeProblemFiles([gone]);

  return next;
}
