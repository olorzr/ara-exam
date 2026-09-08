'use client';

import { useRef, useState } from 'react';
import type { Bbox } from '@/types/problem-bank';

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
}

/**
 * 원본 페이지 이미지 위에 문항·지문 영역을 겹쳐 보여 준다.
 *
 * 검수의 핵심은 **원본과 대조**하는 것이다 — AI 가 옮겨 적은 글만 보면
 * 빠뜨린 문장이나 잘못 읽은 글자를 알아챌 수 없다.
 */
export default function PageImageWithBoxes({
  src, boxes, selectedId, onSelect,
}: PageImageWithBoxesProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
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

  return (
    <div ref={wrapRef} className="relative inline-block w-full">
      {/* 원본 대조용이라 지연 로딩·최적화가 필요 없고, 서명 URL 이라 next/image 로는 다루기 번거롭다 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={src}
        src={src}
        alt="원본 페이지"
        className="block w-full rounded border border-gray-200"
        onLoad={() => setLoadedSrc(src)}
      />
      {ready && boxes.map((box) => {
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
    </div>
  );
}
