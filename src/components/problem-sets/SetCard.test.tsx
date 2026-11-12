import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { SourceSet } from '@/lib/problem-bank/source-sets';
import SetCard from './SetCard';

const school: SourceSet = {
  source_type: '내신기출', year: '2026', grade: '중2', semester: '1학기', exam_type: '중간', textbook: '',
  publisher: '', exam_count: 6, names: ['가중', '나중', '다중', '라중', '마중'],
};

describe('SetCard', () => {
  it('학년도·학년·학기 시험·교과서·학교를 적고 세트 한 장으로 간다', () => {
    render(<ul><SetCard set={school} no={1} /></ul>);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe(
      '/problems/sets/view?type=%EB%82%B4%EC%8B%A0%EA%B8%B0%EC%B6%9C&year=2026&grade=%EC%A4%912&exam=%EC%A4%91%EA%B0%84&sem=1%ED%95%99%EA%B8%B0&book=',
    );
    expect(link.textContent).toContain('2026');
    expect(link.textContent).toContain('1학기 중간고사');
    expect(link.textContent).toContain('교과서 미지정');
    // 학교 수(5곳)는 시험 건수(6건)와 다르다 — 같은 학교 두 건
    expect(link.textContent).toContain('5곳 · 가중, 나중, 다중, 라중 외');
  });

  it('영문 꾸밈은 화면 읽기 프로그램에 숨기고 한글 이름을 읽힌다', () => {
    const { container } = render(<ul><SetCard set={school} no={12} /></ul>);
    const hidden = [...container.querySelectorAll('[aria-hidden="true"]')].map((el) => el.textContent);
    expect(hidden).toEqual(expect.arrayContaining(['( SET )#12', 'TEXTBOOK', 'SCHOOLS']));
    expect([...container.querySelectorAll('.sr-only')].map((el) => el.textContent)).toEqual(['교과서 ', '학교 ']);
  });

  it('모의고사는 주관과 과목을 적는다', () => {
    const mock: SourceSet = {
      source_type: '모의고사', year: '2027', grade: '고3', semester: '', exam_type: '9월 모평', textbook: '',
      publisher: '평가원', exam_count: 2, names: ['2027 9월 (공통)', '2027 9월 (언어와 매체)'],
    };
    render(<ul><SetCard set={mock} no={1} /></ul>);
    const link = screen.getByRole('link');
    expect(link.textContent).toContain('9월 모평');
    expect(link.textContent).toContain('평가원');
    expect(link.textContent).toContain('공통, 언어와 매체');
    expect(link.textContent).toContain('( MOCK )');
  });
});
