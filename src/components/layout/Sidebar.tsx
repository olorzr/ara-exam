'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { isAdminEmail } from '@/lib/constants';
import {
  buildNavSections,
  isNavItemActive,
  isNavSectionActive,
  type NavItem,
  type NavSection,
} from './nav-items';

interface NavLinkProps {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}

/**
 * 메뉴 항목 하나(링크). 잡지 목차처럼 글자만 둔다(2026-11-12 민트 잡지 테마 — 아이콘은 빼고,
 * 고른 항목은 옅은 민트 알약 + 굵은 글씨). 색만으로 알리지 않도록 굵기도 함께 바뀐다.
 */
function NavLink({ item, active, onNavigate }: NavLinkProps) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center rounded-full px-3 py-1.5 text-sm transition-colors',
        active
          ? 'bg-accent-soft font-bold text-ink'
          : 'font-medium text-gray-700 hover:bg-ink/5 hover:text-ink',
      )}
    >
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

interface NavGroupProps {
  section: Extract<NavSection, { kind: 'group' }>;
  pathname: string;
  open: boolean;
  /** 그룹 안에 현재 경로가 있는지 (접었을 때 표시를 잃지 않기 위해) */
  active: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}

/** 접기/펼치기가 되는 상위 카테고리와 그 하위 항목들 */
function NavGroup({ section, pathname, open, active, onToggle, onNavigate }: NavGroupProps) {
  const listId = `nav-group-${section.id}`;

  return (
    <li className="pt-3 first:pt-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={listId}
        className={cn(
          'flex w-full items-baseline gap-2 rounded-full px-3 py-1 text-left transition-colors',
          !open && active ? 'bg-accent-soft' : 'hover:bg-ink/5',
        )}
      >
        <span aria-hidden="true" className="font-label text-[10px] font-extrabold tracking-[0.18em] text-ink">
          {section.labelEn}
        </span>
        <span className={cn('truncate font-display text-[13px] text-gray-500', !open && active && 'font-bold text-ink')}>
          {section.label}
        </span>
        <ChevronDown
          className={cn('ml-auto h-3.5 w-3.5 shrink-0 self-center text-gray-400 transition-transform', !open && '-rotate-90')}
        />
      </button>

      {open && (
        <ul id={listId} className="mt-1 space-y-0.5">
          {section.items.map((item) => (
            <li key={item.href}>
              <NavLink item={item} active={isNavItemActive(pathname, item)} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * 좌측 사이드바 본문. 데스크톱 고정 사이드바와 모바일 드로어가 이것을 공유한다.
 * @param onNavigate - 항목 클릭 시 호출(모바일 드로어를 닫는 데 쓴다)
 */
export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, signOut } = useAuth();
  const pathname = usePathname() ?? '';
  const sections = useMemo(() => buildNavSections(isAdminEmail(user?.email)), [user?.email]);

  // 접은 그룹의 id → 접을 당시의 경로. 값이 없으면 펼친 상태(기본)다.
  // 경로를 같이 기억하는 이유는 아래 isOpen 주석 참고 — 이 한 값으로
  // "접힘 유지 / 들어오면 자동 펼침 / 안에서도 접을 수 있음" 이 전부 파생된다.
  const [collapsedAt, setCollapsedAt] = useState<Record<string, string>>({});

  /**
   * 그룹을 펼쳐 보일지 판정한다(effect 없이 현재 경로에서 파생).
   * 접은 적이 없으면 펼침. 접었다면, 접을 당시에는 그룹 밖이었는데 지금은
   * 그룹 안이라면 "사용자가 이 그룹으로 들어왔다" 는 뜻이라 자동으로 펼친다.
   * 그룹 안에서 직접 접은 경우는 그대로 접힌 채로 둔다(죽은 버튼 방지).
   */
  const isOpen = (section: NavSection) => {
    const at = collapsedAt[section.id];
    if (at === undefined) return true;
    return isNavSectionActive(pathname, section) && !isNavSectionActive(at, section);
  };

  const toggle = (section: NavSection) =>
    setCollapsedAt((prev) => {
      const next = { ...prev };
      if (isOpen(section)) next[section.id] = pathname;
      else delete next[section.id];
      return next;
    });

  const renderSection = (section: NavSection, index: number) => {
    if (section.kind === 'group') {
      return (
        <NavGroup
          key={section.id}
          section={section}
          pathname={pathname}
          open={isOpen(section)}
          active={isNavSectionActive(pathname, section)}
          onToggle={() => toggle(section)}
          onNavigate={onNavigate}
        />
      );
    }
    // 그룹 제목이 없는 구간은 앞 구간과 한 칸 띄운다(목차의 꼭지 사이)
    return section.items.map((item, i) => (
      <li key={item.href} className={i === 0 && index > 0 ? 'pt-3' : undefined}>
        <NavLink item={item} active={isNavItemActive(pathname, item)} onNavigate={onNavigate} />
      </li>
    ));
  };

  const mainSections = sections.filter((section) => !section.footer);
  const footerSections = sections.filter((section) => section.footer);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* 브랜드 — 학원 이름은 로고 글꼴(지마켓 산스) 그대로, 아래에 잡지 제호 같은 영문 한 줄 */}
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="mx-3 flex h-16 shrink-0 items-center gap-2.5 border-b-2 border-ink px-1"
      >
        <Image src="/logo.png" alt="" width={32} height={32} />
        <span className="flex min-w-0 flex-col">
          <span
            className="truncate text-base font-bold text-ink"
            style={{ fontFamily: "'Gmarket Sans', sans-serif" }}
          >
            아라국어논술
          </span>
          <span aria-hidden="true" className="font-label text-[9.5px] font-bold tracking-[0.22em] text-ink">
            EXAM DESK
          </span>
        </span>
      </Link>

      {/* 메뉴 */}
      <nav aria-label="메뉴" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">{mainSections.map(renderSection)}</ul>
      </nav>

      {/* 관리자 메뉴 + 계정 */}
      <div className="mx-3 shrink-0 border-t border-ink py-3">
        {footerSections.length > 0 && (
          <ul className="mb-2 space-y-0.5">{footerSections.map(renderSection)}</ul>
        )}
        <p className="truncate px-3 pb-1 text-xs text-gray-500">{user?.email}</p>
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:bg-ink/5 hover:text-red-700"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          로그아웃
        </button>
      </div>
    </div>
  );
}
