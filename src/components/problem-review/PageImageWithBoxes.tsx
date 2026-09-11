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
}

/**
 * 원본 페이지 이미지 위에 문항·지문 영역을 겹쳐 보여 준다.
 *
 * 검수의 핵심은 **원본과 대조**하는 것이다 — AI 가 옮겨 적은 글만 보면
 * 빠뜨린 문장이나 잘못 읽은 글자를 알아챌 수 없다.
 */
export default function PageImageWithBoxes({
  src, boxes, selectedId, onSelect, capturing, onCapture,
}: PageImageWithBoxesProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  /** 끌고 있는 중의 사각형 (화면 좌표, wrap 기준) */
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  // 어느 이미지가 실제로 로드됐는지 기억한다. 불리언 + 효과로 되돌리면
  // 쪽을 넘길 때 옛 이미지 크기에 맞춰 영역이 잠깐 어긋난 자리에 그려진다
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const ready = loadedSrc === src;

  if (!src) {
    return (
      <div className="flex h-64 items-center justify-center rounded border border-dashed border-gray-300 text-sm text-gray-400">
        페이지 이미지가 없어요
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
    if (!capturing) return;
    const at = pointAt(e);
    if (!at) return;
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
        onLoad={() => setLoadedSrc(src)}
      />
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

      {live && (
        <div
          className="pointer-events-none absolute border-2 border-primary bg-primary/20"
          style={{ left: live.left, top: live.top, width: live.width, height: live.height }}
        />
      )}
    </div>
  );
}
