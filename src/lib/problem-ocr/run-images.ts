'use client';

import type { OpenPdf } from '@/lib/pdf/pdfPages';
import { uploadProblemFile } from '@/lib/problem-bank/storage';
import {
  passageRegionPath, problemRegionPath, sourcePagePath,
} from '@/lib/problem-bank/storage-paths';
import { boxToBbox } from './crop';
import { PageCropper } from './crop-dom';
import type { MergeResult } from './merge';
import type { OcrRunProgress } from './run';
import { itemTargetLabel, listSomeLabels, type OcrWarning, type OcrWarningTarget } from './warnings';

/** 쪽 이미지를 올리는 데 필요한 것만 — run.ts 를 되참조하지 않으려고 좁혀 둔다 */
export interface PageUploadInput {
  sourceId: string;
  problemPages: number[];
  answerPages: number[];
}

/**
 * OCR 이 만드는 **이미지** 쪽 일 — 원본 쪽 저장과 문항 영역 크롭 (브라우저 전용).
 *
 * 본문 읽기(run.ts)와 떼어 둔 이유: 여기서 실패해도 **본문 저장을 막지 않는다**는
 * 규칙이 달라서다. 다만 그림이 있는 항목만은 예외라 반드시 경고로 드러낸다.
 */

type PassageBox = MergeResult['passages'][number]['box'];

/**
 * 검수용 페이지 이미지를 Storage 에 올린다.
 *
 * 정답표 쪽까지 함께 올린다 — 정답이 이상할 때 어디서 읽었는지 봐야 한다.
 * 한 장이 실패해도 다음 장을 계속 올린다(원본 대조가 부분적으로라도 되는 편이 낫다).
 */
export async function uploadPageImages(
  input: PageUploadInput,
  doc: OpenPdf,
  signal: AbortSignal | undefined,
  onProgress?: (p: OcrRunProgress) => void,
): Promise<void> {
  const pages = [...new Set([...input.problemPages, ...input.answerPages])]
    .filter((n) => Number.isInteger(n) && n >= 1)
    .sort((a, b) => a - b);
  if (pages.length === 0) return;

  // 캔버스 캐시를 쓰는 도구를 재사용한다. data URL → fetch → Blob 수법은
  // CSP connect-src 가 `data:` 를 막아 **전부 실패**한다(코덱스 리뷰 2R)
  const cropper = new PageCropper(doc);
  let done = 0;
  try {
    for (const page of pages) {
      if (signal?.aborted) return;
      const blob = await cropper.pageBlob(page);
      if (blob) {
        try {
          await uploadProblemFile(sourcePagePath(input.sourceId, page), blob, 'image/jpeg');
        } catch {
          // 원본 이미지가 없어도 문항은 읽힌다 — 여기서 멈추지 않는다
        }
      }
      done += 1;
      onProgress?.({ phase: 'page', done, total: pages.length });
    }
  } finally {
    cropper.dispose();
  }
}

/** 문항·지문 영역을 잘라 올린다. 실패한 것은 경로 없이 두고 넘어간다 */
export async function cropRegions(
  doc: OpenPdf,
  merged: MergeResult,
  signal: AbortSignal | undefined,
  onProgress?: (p: OcrRunProgress) => void,
): Promise<{
  passageImages: Map<string, string>;
  problemImages: Map<string, string>;
  warnings: OcrWarning[];
}> {
  const cropper = new PageCropper(doc);
  const passageImages = new Map<string, string>();
  const problemImages = new Map<string, string>();
  const warnings: OcrWarning[] = [];

  interface CropTarget {
    id: string;
    page: number;
    box: NonNullable<PassageBox>;
    kind: 'passage' | 'problem';
    /** 그림·표가 있어 **글만으로는 온전하지 않은** 항목 — 실패를 조용히 넘기면 안 된다 */
    needsImage: boolean;
    label: string;
  }

  /** 크롭 대상 → 경고가 가리킬 항목. 이름만이 아니라 **행 id 까지** 넘겨야 카드를 짚을 수 있다 */
  const targetOf = (t: Pick<CropTarget, 'id' | 'page' | 'kind' | 'label'>): OcrWarningTarget => ({
    kind: t.kind, id: t.id, page: t.page, label: t.label,
  });

  const targets: CropTarget[] = [
    ...merged.passages.filter((p) => p.box).map((p) => ({
      id: p.id, page: p.page_no, box: p.box!, kind: 'passage' as const,
      needsImage: p.has_figure, label: itemTargetLabel({ kind: 'passage', page: p.page_no }),
    })),
    ...merged.problems.filter((p) => p.box).map((p) => ({
      id: p.id, page: p.page_no, box: p.box!, kind: 'problem' as const,
      needsImage: p.has_figure,
      label: itemTargetLabel({ kind: 'problem', page: p.page_no, number: p.number }),
    })),
  ];

  // 그림이 있다고 표시됐는데 좌표가 없으면 애초에 자를 수가 없다 — 그것도 알린다
  const noBox: OcrWarningTarget[] = [
    ...merged.passages.filter((p) => p.has_figure && !p.box).map((p) => targetOf({
      id: p.id, page: p.page_no, kind: 'passage',
      label: itemTargetLabel({ kind: 'passage', page: p.page_no }),
    })),
    ...merged.problems.filter((p) => p.has_figure && !p.box).map((p) => targetOf({
      id: p.id, page: p.page_no, kind: 'problem',
      label: itemTargetLabel({ kind: 'problem', page: p.page_no, number: p.number }),
    })),
  ];
  const failed: OcrWarningTarget[] = [...noBox];

  try {
    let done = 0;
    for (let i = 0; i < targets.length; i += 1) {
      const target = targets[i];
      if (signal?.aborted) {
        // ⚠️ 취소로 멈춰도 **남은 그림 항목은 경고에 넣는다.** 호출부는 여기까지 읽은
        //    결과를 그대로 저장하는데, 이미지 없이 저장된 그림 문항은 글만으로는
        //    내용이 빠진 상태다 — 조용히 아카이브에 들어가면 안 된다(코덱스 리뷰 19R)
        failed.push(...targets.slice(i).filter((t) => t.needsImage).map(targetOf));
        break;
      }
      const blob = await cropper.crop(target.page, boxToBbox(target.box));
      let ok = false;
      if (blob) {
        const path = target.kind === 'passage'
          ? passageRegionPath(target.id)
          : problemRegionPath(target.id);
        try {
          await uploadProblemFile(path, blob, 'image/jpeg');
          (target.kind === 'passage' ? passageImages : problemImages).set(target.id, path);
          ok = true;
        } catch {
          // 이미지가 없어도 본문은 멀쩡하다 — 저장을 막지 않는다
        }
      }
      // ⚠️ 그림이 있는 항목은 다르다. 프롬프트가 "옮길 수 있는 글자만 적으라" 고 시켰으므로
      //    글만으로는 온전하지 않다. 이미지를 못 만들었으면 **반드시 알린다**(코덱스 리뷰 17R)
      if (!ok && target.needsImage) failed.push(targetOf(target));
      done += 1;
      onProgress?.({ phase: 'crop', done, total: targets.length });
    }
  } finally {
    cropper.dispose();
  }

  if (failed.length > 0) {
    // 메시지에는 몇 개만 적고(줄줄이 나오면 안 읽는다) 대상은 **전부** 싣는다 —
    // 카드마다 '확인 필요' 표시가 붙어야 하나도 놓치지 않는다
    warnings.push({
      message: `그림·표가 있는 항목의 이미지를 만들지 못했어요(${listSomeLabels(failed.map((t) => t.label))}). `
        + '글만으로는 내용이 빠질 수 있으니 검수에서 확인해 주세요.',
      targets: failed,
    });
  }

  return { passageImages, problemImages, warnings };
}
