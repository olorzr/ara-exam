import { describe, it, expect } from 'vitest';
import {
  buildNavSections,
  isAdminEmail,
  isNavItemActive,
  isNavSectionActive,
  type NavItem,
  type NavSection,
} from './nav-items';
import { ADMIN_EMAIL } from '@/lib/constants';

/** 구간 목록에서 href 로 항목을 찾는다 */
function findItem(sections: NavSection[], href: string): NavItem {
  for (const section of sections) {
    const hit = section.items.find((item) => item.href === href);
    if (hit) return hit;
  }
  throw new Error(`nav item not found: ${href}`);
}

const sections = buildNavSections(false);

describe('isNavItemActive', () => {
  it('경로가 정확히 같으면 활성이다', () => {
    expect(isNavItemActive('/words', findItem(sections, '/words'))).toBe(true);
  });

  it('하위 경로도 활성이다 (개념지 편집기, 단어 입력·단어장)', () => {
    const concept = findItem(sections, '/exam/builder');
    expect(isNavItemActive('/exam/builder/new', concept)).toBe(true);
    expect(isNavItemActive('/exam/builder/abc-123', concept)).toBe(true);

    const words = findItem(sections, '/words');
    expect(isNavItemActive('/words/new', words)).toBe(true);
    expect(isNavItemActive('/words/print', words)).toBe(true);
  });

  it('형제 경로를 잡지 않는다', () => {
    // 접두사 매칭이라 /exam/create 가 /exam/builder 를 켜면 안 된다
    expect(isNavItemActive('/exam/create', findItem(sections, '/exam/builder'))).toBe(false);
    expect(isNavItemActive('/exam/builder', findItem(sections, '/exam/create'))).toBe(false);
  });

  it('세그먼트 경계를 지킨다 — /wordsomething 은 /words 가 아니다', () => {
    expect(isNavItemActive('/wordsomething', findItem(sections, '/words'))).toBe(false);
  });

  it('extraPrefixes 로 저장된 시험지 보기가 시험 이력에 붙는다', () => {
    const history = findItem(sections, '/exam/history');
    expect(isNavItemActive('/exam/view', history)).toBe(true);
    expect(isNavItemActive('/exam/history', history)).toBe(true);
    // 같은 /exam 아래여도 다른 메뉴는 켜지지 않는다
    expect(isNavItemActive('/exam/view', findItem(sections, '/exam/create'))).toBe(false);
  });
});

describe('기출 문제 메뉴', () => {
  it('형제 경로가 서로를 켜지 않는다 — /problems 를 실제 경로로 두지 않은 이유', () => {
    const archive = findItem(sections, '/problems/archive');
    const upload = findItem(sections, '/problems/upload');
    const papers = findItem(sections, '/problems/papers');

    expect(isNavItemActive('/problems/upload', archive)).toBe(false);
    expect(isNavItemActive('/problems/archive', upload)).toBe(false);
    expect(isNavItemActive('/problems/papers/abc-123', papers)).toBe(true);
    expect(isNavItemActive('/problems/papers/new', archive)).toBe(false);
  });

  it('문항 편집(/problems/edit/[id])은 아카이브에 붙는다', () => {
    const archive = findItem(sections, '/problems/archive');
    expect(isNavItemActive('/problems/edit/abc-123', archive)).toBe(true);
    // 다른 메뉴로는 새지 않는다
    expect(isNavItemActive('/problems/edit/abc-123', findItem(sections, '/problems/sources'))).toBe(false);
  });

  it('출처 상세(검수 화면)는 출처·검수에 붙는다', () => {
    const sources = findItem(sections, '/problems/sources');
    expect(isNavItemActive('/problems/sources/abc-123', sources)).toBe(true);
  });
});

describe('isNavSectionActive', () => {
  it('그룹 안의 항목이 활성이면 그룹도 활성이다', () => {
    const wordsGroup = sections.find((s) => s.id === 'words')!;
    expect(isNavSectionActive('/exam/create', wordsGroup)).toBe(true);
    expect(isNavSectionActive('/words/new', wordsGroup)).toBe(true);
    expect(isNavSectionActive('/categories', wordsGroup)).toBe(false);
  });
});

describe('buildNavSections', () => {
  it('요청한 메뉴 구조를 순서대로 만든다', () => {
    expect(sections.map((s) => s.id)).toEqual(['home', 'concept', 'words', 'problems', 'etc']);

    const concept = sections.find((s) => s.id === 'concept')!;
    expect(concept.kind).toBe('group');
    expect(concept.items.map((i) => i.label)).toEqual(['개념지']);

    const words = sections.find((s) => s.id === 'words')!;
    expect(words.kind).toBe('group');
    expect(words.items.map((i) => i.label)).toEqual(['단어 관리', '단어 시험지 생성']);

    const problems = sections.find((s) => s.id === 'problems')!;
    expect(problems.kind).toBe('group');
    expect(problems.items.map((i) => i.label)).toEqual([
      '문제 아카이브', '기출 업로드', '출처·검수', '문제지 조합',
    ]);

    const etc = sections.find((s) => s.id === 'etc')!;
    expect(etc.items.map((i) => i.label)).toEqual(['카테고리 관리', '시험 이력', 'AI 연결']);
  });

  it('감사 로그는 관리자에게만, 하단 구간으로 나온다', () => {
    expect(sections.some((s) => s.id === 'admin')).toBe(false);

    const adminSections = buildNavSections(true);
    const admin = adminSections.at(-1)!;
    expect(admin.id).toBe('admin');
    expect(admin.footer).toBe(true);
    expect(admin.items.map((i) => i.href)).toEqual(['/admin/audit']);
  });
});

describe('isAdminEmail', () => {
  it('관리자 이메일만 true 다', () => {
    expect(isAdminEmail(ADMIN_EMAIL)).toBe(true);
    expect(isAdminEmail('someone@araeducation.co.kr')).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });
});
