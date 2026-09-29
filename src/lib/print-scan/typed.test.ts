import { describe, expect, it } from 'vitest';
import { UNSPECIFIED_OPTION } from '@/lib/external-category';
import type { ScanMetaValues } from './scan-meta';
import {
  isTypedBundle, toTypedBundleInsert, toTypedScanInsert, validateTypedSheet,
} from './typed';

const meta = (over: Partial<ScanMetaValues> = {}): ScanMetaValues => ({
  level: '중등', schoolId: 'school-1', schoolName: '상현중', year: '2026', grade: '중2',
  semester: '1학기', examType: '중간', title: '2026 상현중 중2 1학기 중간', ...over,
});

describe('validateTypedSheet', () => {
  it('학교를 안 골랐으면 막는다(이름이 아니라 id 로 본다)', () => {
    expect(validateTypedSheet(meta({ schoolId: '' }), '봄봄').school).toBeTruthy();
  });

  it('제목과 프린트 이름이 다 비면 막는다', () => {
    expect(validateTypedSheet(meta({ title: '  ' }), ' ').name).toBeTruthy();
  });

  it('프린트 이름은 비워도 제목이 있으면 된다 — 스캔 길과 같다', () => {
    expect(validateTypedSheet(meta(), '')).toEqual({});
  });
});

describe('toTypedBundleInsert', () => {
  it('직접 입력 · 쪽 없음 · 처음부터 읽기완료로 만든다', () => {
    const row = toTypedBundleInsert(meta(), '봄봄 학습지', { id: 'b1', scanId: 's1' });
    expect(row).toEqual({
      id: 'b1', scan_id: 's1', name: '2026 상현중 중2 1학기 중간 봄봄 학습지',
      school_id: 'school-1', school_name: '상현중', year: '2026', grade: '중2',
      semester: '1학기', exam_type: '중간', source: 'typed', pages: [], status: '읽기완료',
    });
  });

  it("'미지정' 표시값은 빈 저장값이 된다", () => {
    const row = toTypedBundleInsert(
      meta({ grade: UNSPECIFIED_OPTION, semester: UNSPECIFIED_OPTION, examType: UNSPECIFIED_OPTION }),
      '봄봄', { id: 'b1', scanId: 's1' },
    );
    expect([row.grade, row.semester, row.exam_type]).toEqual(['', '', '']);
  });

  it('스캔 제목도 같은 이름이다 — 목록 카드와 시험지 제목이 갈리지 않는다', () => {
    expect(toTypedScanInsert(meta(), '봄봄')).toEqual({
      title: '2026 상현중 중2 1학기 중간 봄봄', file_path: '', page_count: 0,
    });
  });
});

describe('isTypedBundle', () => {
  it('source 가 typed 일 때만 — 옛 행(값 없음)은 스캔이다', () => {
    expect(isTypedBundle({ source: 'typed' })).toBe(true);
    expect(isTypedBundle({ source: 'scan' })).toBe(false);
    expect(isTypedBundle({})).toBe(false);
  });
});
