import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import ExamPrintHeader from './ExamPrintHeader';

/** 민트색 이중 테두리 정보 바 */
function infoBar(container: HTMLElement) {
  return container.querySelector('.border-\\[\\#B8EDE8\\]');
}

describe('ExamPrintHeader 정보 바', () => {
  /**
   * 기출 정답표는 출처·점수란·합격선이 전부 없다 — 바를 그대로 그리면 **내용 없는
   * 테두리 띠**만 인쇄된다(출처 줄을 뺀 2026-09-19 작업에서 드러난 자리, 코덱스 리뷰).
   */
  it('담을 것이 하나도 없으면 바 자체를 그리지 않는다', () => {
    const { container } = render(<ExamPrintHeader title="정답표" />);

    expect(infoBar(container)).toBeNull();
    expect(container.textContent).toContain('정답표');
  });

  it('점수란만 있으면 바는 그리되 아래 여백은 주지 않는다', () => {
    const { container } = render(<ExamPrintHeader title="문제지" showScoreRow totalCount={10} />);

    const bar = infoBar(container);
    expect(bar).not.toBeNull();
    expect(bar?.querySelector('.mb-2')).toBeNull();
    expect(bar?.textContent).toContain('/ 10개');
  });

  it('출처 라벨이 있으면 그대로 그린다 — 단어 시험지 머리글은 그대로다', () => {
    const { container } = render(
      <ExamPrintHeader title="단어 시험지" sourceLabels={['중2 1학기 1단원']} passCount={14} passPercentage={80} />,
    );

    const bar = infoBar(container);
    expect(bar?.textContent).toContain('중2 1학기 1단원');
    expect(bar?.textContent).toContain('합격');
  });
});
