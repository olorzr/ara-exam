'use client';

import type { ReactNode } from 'react';

interface TreeFrameProps {
  /** 머리글 */
  title: string;
  /** 이 트리의 축이 걸려 있는가 — 그때만 '해제' 를 보여 준다 */
  active: boolean;
  onClear: () => void;
  /** 머리글 옆에 둘 것 (정렬 칸 등) */
  toolbar?: ReactNode;
  /** 머리글 아래 짧은 안내 */
  note?: ReactNode;
  children: ReactNode;
}

/**
 * 왼쪽 패널의 트리 한 칸 — 머리글 · 해제 · 스크롤 상자.
 *
 * 문제 은행 네 트리와 작품 전문 세 트리가 함께 쓴다. 테두리 상자는 없다 — 패널 전체가 위 잉크 줄을 단 흰 종이 한 장이고
 * (`ArchiveSidePanel`·`ReferenceSidePanel`, 기출 공유 사이트 `.browse-side` 와 같은 결), 그 안에 상자를 또 두면
 * 0.9.89 가 걷어 낸 '상자 안의 상자' 가 된다. 머리글은 '해제' 가 나타나도 줄이 생기고 없어지지 않게 늘 남긴다.
 * @param props - 머리글·해제·내용
 * @returns 트리 칸
 */
export default function TreeFrame({ title, active, onClear, toolbar, note, children }: TreeFrameProps) {
  return (
    <section aria-label={title} className="space-y-1.5">
      <div className="flex min-h-8 items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="text-[11px] font-bold tracking-[0.04em] text-muted-foreground">{title}</p>
          {toolbar}
        </div>
        {active && (
          <button
            type="button"
            className="shrink-0 text-xs font-medium text-ink underline underline-offset-2 hover:text-primary"
            onClick={onClear}
          >
            해제
          </button>
        )}
      </div>
      {note}
      <div className="max-h-[70vh] overflow-y-auto">{children}</div>
    </section>
  );
}
