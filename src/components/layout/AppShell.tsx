'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useBuildWatch } from '@/hooks/useBuildWatch';
import Sidebar from './Sidebar';

/**
 * 인증된 영역의 앱 셸. 좌측 사이드바(lg 이상 고정 / 그 미만 오버레이 드로어)와
 * 본문을 배치한다. 사이드바·상단 바는 인쇄에서 제외된다(data-no-print).
 *
 * ⚠️ 바깥 상자·`main` 에 배경을 깔지 말 것 — 민트 책상 색은 body(--background)에만 둔다. 인쇄 CSS 는
 *    body 배경만 흰색으로 덮고 모든 요소에 `print-color-adjust: exact` 를 걸어서, 인쇄 대상을 감싼 상자에
 *    색이 있으면 그대로 종이에 찍힌다(2026-11-12 민트 잡지 테마).
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  useBuildWatch();

  return (
    <div className="min-h-screen lg:flex">
      {/* 데스크톱 고정 사이드바 — 잡지 목차처럼 오른쪽에 잉크 줄 하나 */}
      <aside
        data-no-print
        className="sticky top-0 hidden h-screen w-60 shrink-0 overflow-y-auto border-r border-ink lg:block"
      >
        <Sidebar />
      </aside>

      <div className="min-w-0 flex-1">
        {/* lg 미만 상단 바 — 높이는 --app-topbar-h(56px) 와 맞춰야 한다 */}
        <div
          data-no-print
          className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-ink bg-background/90 px-3 backdrop-blur-sm lg:hidden"
        >
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="메뉴 열기"
            className="rounded-full p-2 text-ink hover:bg-ink/5"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Image src="/logo.png" alt="" width={28} height={28} />
          <span
            className="text-sm font-bold text-ink"
            style={{ fontFamily: "'Gmarket Sans', sans-serif" }}
          >
            아라국어논술
          </span>
        </div>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </div>

      {/* 모바일 드로어 */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-64 border-ink p-0 sm:max-w-64" data-no-print>
          <SheetTitle className="sr-only">메뉴</SheetTitle>
          <Sidebar onNavigate={() => setDrawerOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
