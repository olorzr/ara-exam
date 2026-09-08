'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import {
  buildNavSections,
  isAdminEmail,
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

/** 메뉴 항목 하나(링크). 그룹 하위인지 여부는 감싸는 목록이 들여쓰기로 표현한다. */
function NavLink({ item, active, onNavigate }: NavLinkProps) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-primary/15 font-semibold text-gray-900'
          : 'font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900',
      )}
    >
      {Icon && <Icon className={cn('h-4 w-4 shrink-0', active && 'text-primary')} />}
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
  const Icon = section.icon;
  const listId = `nav-group-${section.id}`;

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={listId}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
          !open && active ? 'bg-primary/15 text-gray-900' : 'text-gray-700 hover:bg-gray-50',
        )}
      >
        <Icon className={cn('h-4 w-4 shrink-0', !open && active && 'text-primary')} />
        <span className="truncate">{section.label}</span>
        <ChevronDown
          className={cn('ml-auto h-4 w-4 shrink-0 text-gray-400 transition-transform', !open && '-rotate-90')}
        />
      </button>

      {open && (
        <ul id={listId} className="mt-0.5 ml-4 space-y-0.5 border-l border-gray-200 pl-2">
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

  const renderSection = (section: NavSection) => {
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
    return section.items.map((item) => (
      <li key={item.href}>
        <NavLink item={item} active={isNavItemActive(pathname, item)} onNavigate={onNavigate} />
      </li>
    ));
  };

  const mainSections = sections.filter((section) => !section.footer);
  const footerSections = sections.filter((section) => section.footer);

  return (
    <div className="flex h-full flex-col bg-white">
      {/* 브랜드 */}
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="flex h-16 shrink-0 items-center gap-2 border-b border-gray-200 px-4"
      >
        <Image src="/logo.png" alt="아라국어논술" width={32} height={32} />
        <span
          className="truncate text-base font-bold text-gray-900"
          style={{ fontFamily: "'Gmarket Sans', sans-serif" }}
        >
          아라국어논술
        </span>
      </Link>

      {/* 메뉴 */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <ul className="space-y-1">{mainSections.map(renderSection)}</ul>
      </nav>

      {/* 관리자 메뉴 + 계정 */}
      <div className="shrink-0 border-t border-gray-200 px-3 py-3">
        {footerSections.length > 0 && (
          <ul className="mb-2 space-y-1">{footerSections.map(renderSection)}</ul>
        )}
        <p className="truncate px-3 pb-1 text-xs text-gray-400">{user?.email}</p>
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-red-600"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          로그아웃
        </button>
      </div>
    </div>
  );
}
