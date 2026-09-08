import {
  BookOpen,
  ClipboardCheck,
  FolderCog,
  FolderOpen,
  History,
  Home,
  Layers,
  Library,
  Lightbulb,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import { ADMIN_EMAIL } from '@/lib/constants';

/** 사이드바의 개별 메뉴 항목 */
export interface NavItem {
  /** 이동할 경로 (활성 판정의 기본 접두사이기도 하다) */
  href: string;
  label: string;
  /** 그룹 하위 항목은 아이콘 없이 들여쓰기만 한다 */
  icon?: LucideIcon;
  /**
   * href 외에 이 항목을 활성으로 볼 추가 경로 접두사.
   * 목록 화면에서만 들어갈 수 있는 상세/보기 경로를 부모 메뉴에 붙일 때 쓴다.
   */
  extraPrefixes?: string[];
}

interface NavSectionBase {
  /** 접힘 상태 저장 키 */
  id: string;
  /** true 면 사이드바 하단(구분선 아래)에 렌더한다 */
  footer?: boolean;
  items: NavItem[];
}

/** 그룹 제목 없이 항목만 나열하는 구간 */
export interface NavItemsSection extends NavSectionBase {
  kind: 'items';
}

/** 접기/펼치기가 되는 상위 카테고리 */
export interface NavGroupSection extends NavSectionBase {
  kind: 'group';
  label: string;
  icon: LucideIcon;
}

export type NavSection = NavItemsSection | NavGroupSection;

/**
 * 경로가 접두사 아래에 있는지 검사한다(세그먼트 경계 기준).
 * 문자열 startsWith 만 쓰면 `/words` 가 `/wordsomething` 까지 잡는다.
 * @param pathname - 현재 경로
 * @param prefix - 비교할 경로 접두사
 * @returns 같은 경로이거나 그 하위 경로면 true
 */
function isPathUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * 메뉴 항목이 현재 경로에서 활성인지 판정한다.
 * @param pathname - 현재 경로 (usePathname 값)
 * @param item - 검사할 메뉴 항목
 * @returns 활성이면 true
 */
export function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (isPathUnder(pathname, item.href)) return true;
  return (item.extraPrefixes ?? []).some((prefix) => isPathUnder(pathname, prefix));
}

/**
 * 구간에 활성 항목이 하나라도 있는지 판정한다.
 * 접힌 그룹 안의 경로로 이동했을 때 그 그룹을 강제로 펼치는 데 쓴다.
 * @param pathname - 현재 경로
 * @param section - 검사할 구간
 * @returns 활성 항목이 있으면 true
 */
export function isNavSectionActive(pathname: string, section: NavSection): boolean {
  return section.items.some((item) => isNavItemActive(pathname, item));
}

/**
 * 사이드바 메뉴 구조를 만든다. 경로는 바뀌지 않고 이름만 기능 기준으로 묶여 있다.
 * @param isAdmin - 관리자 계정 여부 (감사 로그 노출 조건)
 * @returns 렌더 순서대로 정렬된 구간 목록
 */
export function buildNavSections(isAdmin: boolean): NavSection[] {
  return [
    {
      kind: 'items',
      id: 'home',
      items: [{ href: '/dashboard', label: '대시보드', icon: Home }],
    },
    {
      kind: 'group',
      id: 'concept',
      label: '개념 관리',
      icon: Lightbulb,
      // 개념지 편집기(/exam/builder/new, /exam/builder/[id])도 이 항목에 속한다
      items: [{ href: '/exam/builder', label: '개념지', icon: ScrollText }],
    },
    {
      kind: 'group',
      id: 'words',
      label: '단어',
      icon: BookOpen,
      items: [
        // /words/new(단어 입력), /words/print(단어장)도 이 항목에 속한다
        { href: '/words', label: '단어 관리', icon: FolderOpen },
        // 만든 시험지가 쌓이는 곳. 시험지 생성(/exam/create)은 이 목록의 버튼으로만,
        // 저장된 시험지 보기(/exam/view)도 목록에서만 들어가므로 활성 표시를 여기에 붙인다
        {
          href: '/exam/history',
          label: '단어 시험지',
          icon: History,
          extraPrefixes: ['/exam/view', '/exam/create'],
        },
      ],
    },
    {
      kind: 'group',
      id: 'problems',
      label: '기출 문제',
      icon: Library,
      items: [
        // 경로가 /problems 가 아니라 /problems/archive 인 이유: 활성 판정이 세그먼트
        // 접두사 비교라(isNavItemActive) /problems 로 두면 하위 메뉴와 늘 함께 켜진다.
        // 목록에서만 들어가는 문항 편집(/problems/edit/[id])은 여기에 붙인다.
        {
          href: '/problems/archive',
          label: '문제 아카이브',
          icon: FolderOpen,
          extraPrefixes: ['/problems/edit'],
        },
        { href: '/problems/upload', label: '기출 업로드', icon: Upload },
        // 출처 상세(/problems/sources/[id])가 검수 화면이다
        { href: '/problems/sources', label: '출처·검수', icon: ClipboardCheck },
        // 저장된 문제지 보기(/problems/papers/[id])도 이 항목 아래다
        { href: '/problems/papers', label: '문제지 조합', icon: Layers },
      ],
    },
    {
      kind: 'items',
      id: 'etc',
      items: [
        { href: '/categories', label: '카테고리 관리', icon: FolderCog },
        { href: '/settings/ai', label: 'AI 연결', icon: Sparkles },
      ],
    },
    ...(isAdmin
      ? ([
          {
            kind: 'items',
            id: 'admin',
            footer: true,
            items: [{ href: '/admin/audit', label: '감사 로그', icon: ShieldCheck }],
          },
        ] satisfies NavSection[])
      : []),
  ];
}

/**
 * 로그인 이메일이 관리자 계정인지 판정한다.
 * @param email - 로그인 사용자 이메일 (null/undefined 허용)
 * @returns 관리자면 true
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  return email === ADMIN_EMAIL;
}
