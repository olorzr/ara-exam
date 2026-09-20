'use client';

import { useRef, useState } from 'react';
import { pixelRectToBbox } from '@/lib/problem-ocr/crop';
import type { Bbox } from '@/types/problem-bank';

/** 이보다 작게 끌면 그냥 누른 것으로 본다 (px) */
const MIN_CAPTURE_PX = 8;

/** 화면에 그릴 영역 하나 */
export interface BoxOverlay {
  id: string;
  bbox: Bbox;
  label: string;
  kind: 'passage' | 'problem';
}

interface PageImageWithBoxesProps {
  /** 페이지 이미지 서명 URL */
  src: string | null;
  boxes: BoxOverlay[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /**
   * 그림으로 잘라 낼 영역을 **끌어 잡는 중**인가. 켜져 있으면 영역 단추 대신
   * 드래그를 받는다 — 겹쳐 두면 상자를 누르려다 그림이 잡힌다.
   */
  capturing?: boolean;
  /** 끌어 잡기가 끝났을 때. 0~1 정규화 사각형이 온다 */
  onCapture?: (bbox: Bbox) => void;
  /**
   * 이 쪽 이미지를 **다시 받아 온다**(서명 URL 재발급). 없으면 실패해도 단추를 안 낸다.
   */
  onReloadSrc?: () => void;
  /**
   * 잡는 중에 **자리만 알려 줄** 항목. 그 영역을 점선으로 남겨 어느 문항의 그림을
   * 잡는 중인지 보여 준다 — 단추는 드래그를 먹으므로 그리지 않는다.
   */
  highlightId?: string | null;
}

/**
 * 원본 페이지 이미지 위에 문항·지문 영역을 겹쳐 보여 준다.
 *
 * 검수의 핵심은 **원본과 대조**하는 것이다 — AI 가 옮겨 적은 글만 보면
 * 빠뜨린 문장이나 잘못 읽은 글자를 알아챌 수 없다.
 */
export default function PageImageWithBoxes({
  src, boxes, selectedId, onSelect, capturing, onCapture, highlightId, onReloadSrc,
}: PageImageWithBoxesProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  /** 끌고 있는 중의 사각형 (화면 좌표, wrap 기준) */
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  // 어느 이미지가 실제로 로드됐는지 기억한다. 불리언 + 효과로 되돌리면
  // 쪽을 넘길 때 옛 이미지 크기에 맞춰 영역이 잠깐 어긋난 자리에 그려진다
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  // 못 불러온 쪽도 기억한다 — 잡기가 조용히 안 되는 까닭을 말해 줘야 한다(코덱스 리뷰 2R)
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const ready = loadedSrc === src;
  const failed = failedSrc === src;

  if (!src) {
    // ⚠️ 여기도 다시 받을 길을 낸다(코덱스 리뷰 4R). 처음 서명에 실패하면 주소가 아예
    //    없어 `<img>` 의 onError 조차 안 나므로, 이 자리에 단추가 없으면 그 쪽은
    //    **새로고침 말고는** 되살릴 수 없다
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 rounded border border-dashed border-gray-300 text-sm text-gray-400">
        <span>페이지 이미지가 없어요</span>
        {onReloadSrc && (
          <button
            type="button"
            onClick={onReloadSrc}
            className="text-primary underline underline-offset-2"
          >
            다시 불러오기
          </button>
        )}
      </div>
    );
  }

  /** 포인터 자리를 wrap 안 좌표로 */
  const pointAt = (e: React.PointerEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, w: rect.width, h: rect.height };
  };

  const startDrag = (e: React.PointerEvent) => {
    // ⚠️ 그림이 뜨기 전에는 받지 않는다. 쪽을 넘긴 직후에는 `<img>` 가 아직 비어 있어
    //    감싼 칸이 접혀 있고, 그 좌표로 자르면 **엉뚱한 자리**가 새 쪽에서 잘려 나온다
    //    (다시 자르기가 쪽을 자동으로 넘기면서 이 창이 실제로 열렸다 — 코덱스 1R)
    if (!capturing || !ready) return;
    const at = pointAt(e);
    if (!at) return;
    // ⚠️ 기본 동작을 막아야 한다. 안 막으면 브라우저가 **이미지 끌어놓기**를 시작하면서
    //    포인터 흐름이 끊겨 `pointercancel` 로 끝난다 — 끌어 잡기가 아예 안 된다
    e.preventDefault();
    // 포인터를 잡아 둔다 — 이미지 밖으로 끌고 나가도 끝까지 따라온다
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ x0: at.x, y0: at.y, x1: at.x, y1: at.y });
  };

  const moveDrag = (e: React.PointerEvent) => {
    if (!drag) return;
    const at = pointAt(e);
    if (at) setDrag((d) => (d ? { ...d, x1: at.x, y1: at.y } : d));
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!drag) return;
    const at = pointAt(e);
    setDrag(null);
    if (!at || !onCapture) return;
    const rect = {
      x: Math.min(drag.x0, drag.x1),
      y: Math.min(drag.y0, drag.y1),
      w: Math.abs(drag.x1 - drag.x0),
      h: Math.abs(drag.y1 - drag.y0),
    };
    // 너무 작으면 그냥 누른 것이다 — 점만 한 그림을 만들지 않는다
    if (rect.w < MIN_CAPTURE_PX || rect.h < MIN_CAPTURE_PX) return;
    onCapture(pixelRectToBbox(rect, at.w, at.h));
  };

  // 잡는 중에 자리를 알려 줄 영역 — 이 쪽에 없으면(쪽을 넘어가는 지문) 아무것도 안 그린다
  const hint = capturing && highlightId
    ? boxes.find((box) => box.id === highlightId)
    : undefined;

  const live = drag && {
    left: Math.min(drag.x0, drag.x1),
    top: Math.min(drag.y0, drag.y1),
    width: Math.abs(drag.x1 - drag.x0),
    height: Math.abs(drag.y1 - drag.y0),
  };

  return (
    <div
      ref={wrapRef}
      className={`relative inline-block w-full${capturing ? ' cursor-crosshair select-none' : ''}`}
      // ⚠️ 손가락으로 끌면 브라우저가 **화면을 스크롤**하며 포인터 흐름을 끊는다
      //    (`pointercancel`). 기본 끌어놓기를 막는 것만으로는 안 되고 이것까지 꺼야
      //    태블릿에서 그림 잡기가 끝까지 간다
      style={capturing ? { touchAction: 'none' } : undefined}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={() => setDrag(null)}
    >
      {/* 원본 대조용이라 지연 로딩·최적화가 필요 없고, 서명 URL 이라 next/image 로는 다루기 번거롭다 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={src}
        src={src}
        alt="원본 페이지"
        className="block w-full rounded border border-gray-200"
        // 끌어 잡기와 부딪히는 브라우저 기본 끌어놓기를 아예 끈다
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        onLoad={() => setLoadedSrc(src)}
        onError={() => setFailedSrc(src)}
      />

      {/* 잡으라고 해 놓고 아무 일도 안 나면 고장인 줄 안다 */}
      {(failed || (capturing && !ready)) && (
        <div className="absolute inset-x-0 top-2 flex justify-center">
          <span className="flex items-center gap-2 rounded bg-black/70 px-2 py-1 text-[11px] text-white">
            {failed ? '원본을 불러오지 못했어요.' : '원본을 불러오는 중이에요…'}
            {/* ⚠️ 서명 URL 은 한 시간이면 만료된다 — 같은 주소를 다시 불러선 못 살린다.
                부르는 쪽이 **새로 서명해** src 를 갈아 끼운다(코덱스 리뷰 3R) */}
            {failed && onReloadSrc && (
              <button
                type="button"
                onClick={onReloadSrc}
                className="underline underline-offset-2"
              >
                다시 불러오기
              </button>
            )}
          </span>
        </div>
      )}
      {/* 끌어 잡는 중에는 영역 단추를 걷어 낸다 — 겹치면 드래그가 상자에 먹힌다 */}
      {ready && !capturing && boxes.map((box) => {
        const selected = box.id === selectedId;
        return (
          <button
            key={box.id}
            type="button"
            onClick={() => onSelect(box.id)}
            className={`absolute rounded border-2 transition ${
              selected
                ? 'border-primary bg-primary/10'
                : box.kind === 'passage'
                  ? 'border-amber-400/70 hover:bg-amber-400/10'
                  : 'border-sky-400/70 hover:bg-sky-400/10'
            }`}
            style={{
              left: `${box.bbox.x * 100}%`,
              top: `${box.bbox.y * 100}%`,
              width: `${box.bbox.w * 100}%`,
              height: `${box.bbox.h * 100}%`,
            }}
            aria-label={`${box.label} 영역`}
          >
            <span className="absolute left-0 top-0 rounded-br bg-black/60 px-1 text-[10px] text-white">
              {box.label}
            </span>
          </button>
        );
      })}

      {/* 드래그를 먹지 않게 pointer-events 를 끈다 — 단추로 두면 그림을 못 잡는다 */}
      {ready && hint && (
        <div
          className="pointer-events-none absolute rounded border-2 border-dashed border-primary/60"
          style={{
            left: `${hint.bbox.x * 100}%`,
            top: `${hint.bbox.y * 100}%`,
            width: `${hint.bbox.w * 100}%`,
            height: `${hint.bbox.h * 100}%`,
          }}
        >
          <span className="absolute left-0 top-0 rounded-br bg-primary px-1 text-[10px] text-white">
            {hint.label}
          </span>
        </div>
      )}

      {live && (
        <div
          className="pointer-events-none absolute border-2 border-primary bg-primary/20"
          style={{ left: live.left, top: live.top, width: live.width, height: live.height }}
        />
      )}
    </div>
  );
}
