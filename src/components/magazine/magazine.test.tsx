import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { IssueStamp, Masthead, PageTitle, SectionLabel, StatGrid, issueLines } from './index';

describe('잡지 부품', () => {
  it('PageTitle — h1 의 이름은 한글 제목뿐이다(영문 라벨은 꾸밈이라 읽지 않는다)', () => {
    render(<PageTitle eyebrow="PROBLEM BANK">올라간 기출</PageTitle>);
    expect(screen.getByRole('heading', { level: 1, name: '올라간 기출' })).toBeTruthy();
    expect(screen.getByText('PROBLEM BANK').getAttribute('aria-hidden')).toBe('true');
  });

  it('PageTitle — header 태그를 쓰지 않는다(인쇄 CSS 가 header 를 숨긴다)', () => {
    const { container } = render(<PageTitle eyebrow="WORDS">단어 관리</PageTitle>);
    expect(container.querySelector('header')).toBeNull();
  });

  it('SectionLabel — h2 의 읽히는 이름은 한글이다', () => {
    render(<SectionLabel en="QUICK START">빠른 실행</SectionLabel>);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.textContent).toContain('빠른 실행');
    expect(screen.getByText('QUICK START').getAttribute('aria-hidden')).toBe('true');
  });

  it('StatGrid — 이름과 숫자를 짝지어 그리고 숫자에 천 단위 쉼표를 단다', () => {
    render(<StatGrid items={[{ en: 'PROBLEMS', label: '총 문제 수', value: 39988 }, { en: 'WORDS', label: '총 단어 수', value: 7 }]} />);
    expect(screen.getByText('총 문제 수').tagName).toBe('DT');
    expect(screen.getByText('39,988').tagName).toBe('DD');
    expect(screen.getByText('7')).toBeTruthy();
  });

  it('issueLines — 달이 곧 호수다', () => {
    expect(issueLines(new Date(2026, 10, 12))).toEqual(['NO. 11', '2026 NOVEMBER']);
    expect(issueLines(new Date(2027, 0, 3))).toEqual(['NO. 01', '2027 JANUARY']);
  });

  it('IssueStamp — 정적 사전 렌더(서버)에서는 비우고 브라우저에서 오늘로 채운다(빌드한 날로 굳지 않게)', () => {
    const html = renderToString(<IssueStamp />);
    expect(html).not.toContain('NO.');
    const { container } = render(<IssueStamp />);
    const [issue, month] = issueLines(new Date());
    expect(container.textContent).toContain(issue);
    expect(container.textContent).toContain(month);
  });

  it('IssueStamp — 날짜를 정해 주면 그 달이다', () => {
    const { container } = render(<IssueStamp date={new Date(2026, 0, 5)} />);
    expect(container.textContent).toContain('NO. 01');
    expect(container.textContent).toContain('2026 JANUARY');
  });

  it('Masthead — 제호가 h1 이고 section 으로 감싼다', () => {
    const { container } = render(
      <Masthead title="아라국어논술" subtitle="시험 관리 시스템" note="환영해요" date={new Date(2026, 10, 12)} />,
    );
    expect(screen.getByRole('heading', { level: 1, name: '아라국어논술' })).toBeTruthy();
    expect(container.querySelector('header')).toBeNull();
    expect(screen.getByText('환영해요')).toBeTruthy();
  });
});
