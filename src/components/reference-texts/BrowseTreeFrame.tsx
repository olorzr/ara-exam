'use client';

import type { ReactNode } from 'react';

interface BrowseTreeFrameProps {
  /** 머리글 */
  title: string;
  /** 이 트리의 축이 걸려 있는가 — 그때만 '해제' 를 보여 준다 */
  active: boolean;
  onClear: () => void;
  /** 머리글 옆에 둘 것 (정렬 칸 등) */
  toolbar?: ReactNode;
  children: ReactNode;
}

/**
 * 작품 전문 왼쪽 패널의 트리 한 칸의 테두리 — 머리글 · 해제 · 스크롤 상자.
 *
 * 문제 은행 아카이브의 트리 패널들과 같은 모양이다(`WorkTreePanel` 등). 세 탭이 같은 테두리를
 * 쓰므로 한 곳에 둔다.
 * @param props - 머리글·해제·내용
 * @returns 테두리
 */
export default function BrowseTreeFrame({
  title, active, onClear, toolbar, children,
}: BrowseTreeFrameProps) {
  return (
    <div className="rounded-lg border border-gray-200 p-2">
      <div className="flex items-center justify-between gap-2 px-2 py-1">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-gray-500">{title}</p>
          {toolbar}
        </div>
        {active && (
          <button
            type="button"
            className="shrink-0 text-xs text-primary underline underline-offset-2"
            onClick={onClear}
          >
            해제
          </button>
        )}
      </div>
      <div className="max-h-[70vh] overflow-y-auto">{children}</div>
    </div>
  );
}
