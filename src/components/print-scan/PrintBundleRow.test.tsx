import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PrintBundleRow from './PrintBundleRow';
import type { PrintBundleRow as BundleRow } from '@/types/print-scan';

const row = (over: Partial<BundleRow> = {}): BundleRow => ({
  id: 'b1', scan_id: 's1', name: '2026 상현중 중2 봄봄', school_id: 'x', school_name: '상현중',
  year: '2026', grade: '중2', semester: '1학기', exam_type: '중간',
  include_handwriting: false, register_words: false, source: 'scan', pages: [1, 2], page_paths: ['', ''],
  ocr_html: '<p>본문</p>', ocr_meta: {}, words_meta: {}, qa_items: [], qa_meta: {},
  status: '읽기완료', user_id: 'u', updated_by: null, created_at: '', updated_at: '',
  sheetId: null, markCount: 0, ...over,
});

const noop = vi.fn();
const renderRow = (bundle: BundleRow) => render(
  <PrintBundleRow
    bundle={bundle} no={1} busy={false} aiEnabled
    onRead={noop} onCreateSheet={noop} onRegisterWords={noop} onDelete={noop}
  />,
);

describe('PrintBundleRow — 직접 입력한 프린트', () => {
  it("상태 대신 '직접 입력' 을 보이고 쪽 수를 적지 않는다", () => {
    renderRow(row({ source: 'typed', pages: [], page_paths: [], ocr_html: '' }));
    expect(screen.getByText('직접 입력')).toBeTruthy();
    expect(screen.queryByText('읽기완료')).toBeNull();
    expect(screen.queryByText(/쪽/)).toBeNull();
  });

  it("시험지가 없으면 '읽기' 가 아니라 '시험지 만들기' 다 — 읽을 원본이 없다", () => {
    renderRow(row({ source: 'typed', pages: [], page_paths: [], ocr_html: '' }));
    expect(screen.getByRole('button', { name: /시험지 만들기/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /읽기/ })).toBeNull();
    // 단어 등록·문답은 읽어 둔 원문을 쓴다 — 직접 입력에는 없다
    expect(screen.queryByRole('button', { name: /단어/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /문답/ })).toBeNull();
  });

  it("시험지가 있으면 '시험지 열기' 다", () => {
    renderRow(row({ source: 'typed', pages: [], page_paths: [], ocr_html: '', sheetId: 'c1' }));
    expect(screen.getByRole('button', { name: /시험지 열기/ })).toBeTruthy();
  });
});

describe('PrintBundleRow — 스캔 프린트(그대로)', () => {
  it('상태와 쪽 수를 보인다', () => {
    renderRow(row());
    expect(screen.getByText('읽기완료')).toBeTruthy();
    expect(screen.getByText(/2쪽/)).toBeTruthy();
  });

  it("원문이 없으면 '읽기' 를 내민다", () => {
    renderRow(row({ status: '대기', ocr_html: '' }));
    expect(screen.getByRole('button', { name: /읽기/ })).toBeTruthy();
    expect(screen.queryByText('직접 입력')).toBeNull();
  });
});

describe('PrintBundleRow — 모양(2026-11-14)', () => {
  it('번호를 달고, 띄어쓰기 없는 긴 이름도 칸 안에서 줄을 바꾼다(단추와 겹치지 않게)', () => {
    renderRow(row({ name: '가'.repeat(60) }));
    expect(screen.getByText('01').getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByText('가'.repeat(60)).className).toContain('[overflow-wrap:anywhere]');
  });

  it('좁은 화면에서는 단추 묶음이 이름 아래 줄로 내려간다(넓으면 오른쪽)', () => {
    const { container } = renderRow(row());
    const rowEl = container.firstElementChild!;
    expect(rowEl.className).toContain('flex-col');
    expect(rowEl.className).toContain('sm:flex-row');
  });
});
