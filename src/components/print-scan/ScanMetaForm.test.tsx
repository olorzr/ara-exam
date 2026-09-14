import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { applyScanMetaPatch, initialScanMeta } from '@/lib/print-scan/scan-meta';
import type { SelectableSchool } from '@/types';
import ScanMetaForm from './ScanMetaForm';

const SCHOOLS: SelectableSchool[] = [
  { id: 'm1', name: '상현중', level: '중등' },
  { id: 'h1', name: '도선고', level: '고등' },
  { id: 'x1', name: '전체', legacy: true },
];

/** 닫힌 선택 칸에 보이는 글 (라벨로 찾는다 — 칸이 여섯이라 순서에 기대면 깨진다) */
function pickerText(label: string): string {
  return screen.getByRole('combobox', { name: label }).textContent ?? '';
}

describe('ScanMetaForm', () => {
  it('고른 값이 칸마다 이름으로 보인다 — 값(학교 id)이 새어 나오면 안 된다', () => {
    const state = applyScanMetaPatch(initialScanMeta('2026'), {
      schoolId: 'm1', schoolName: '상현중', grade: '중2', semester: '1학기', examType: '중간',
    });

    render(<ScanMetaForm state={state} schools={SCHOOLS} onChange={() => {}} />);

    expect(pickerText('학교급')).toContain('중등');
    expect(pickerText('학교')).toContain('상현중');
    expect(pickerText('학교')).not.toContain('m1');
    expect(pickerText('학년')).toContain('중2');
    expect(pickerText('학기')).toContain('1학기');
    expect(pickerText('시험')).toContain('중간');
  });

  it('학교를 고르면 제목이 자동으로 채워진다', () => {
    const state = applyScanMetaPatch(initialScanMeta('2026'), {
      schoolId: 'm1', schoolName: '상현중', grade: '중2', semester: '1학기', examType: '중간',
    });

    render(<ScanMetaForm state={state} schools={SCHOOLS} onChange={() => {}} />);

    const title = screen.getByLabelText('스캔 제목') as HTMLInputElement;
    expect(title.value).toBe('2026 상현중 중2 1학기 중간');
  });

  it('학교를 고르기 전에는 제목 칸이 비고 안내만 보인다', () => {
    render(
      <ScanMetaForm state={initialScanMeta('2026')} schools={SCHOOLS} onChange={() => {}} />,
    );

    const title = screen.getByLabelText('스캔 제목') as HTMLInputElement;
    expect(title.value).toBe('');
    expect(title.placeholder).toContain('학교를 고르면');
  });

  it('학교급을 바꾸면 학교·학년을 비운다 — 중1 이 고등학교에 붙으면 안 된다', () => {
    const onChange = vi.fn();
    const state = applyScanMetaPatch(initialScanMeta('2026'), {
      schoolId: 'm1', schoolName: '상현중', grade: '중2',
    });

    render(<ScanMetaForm state={state} schools={SCHOOLS} onChange={onChange} />);

    // 폼은 patch 만 올린다 — 비우는 규칙은 `applyScanMetaPatch` 가 갖고 있다
    const next = applyScanMetaPatch(state, { level: '고등' });
    expect(next.values.schoolId).toBe('');
    expect(next.values.grade).toBe('미지정');
  });
});
