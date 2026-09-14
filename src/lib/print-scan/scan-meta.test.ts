import { describe, it, expect } from 'vitest';
import { UNSPECIFIED_OPTION } from '@/lib/external-category';
import type { SelectableSchool } from '@/types';
import {
  applyScanMetaPatch, composePrintName, examTypeOptionsForScan, gradeOptionsForScan,
  initialScanMeta, schoolsForLevel, semesterOptionsForScan, suggestScanTitle, validateScanMeta,
  type ScanMetaState,
} from './scan-meta';

const meta = (over: Partial<ScanMetaState['values']> = {}): ScanMetaState => ({
  values: {
    level: '중등', schoolId: 's1', schoolName: '상현중',
    year: '2026', grade: '중2', semester: '1학기', examType: '중간',
    title: '2026 상현중 중2 1학기 중간',
    ...over,
  },
  titleAuto: true,
});

describe('initialScanMeta', () => {
  it('학교는 비우고 나머지는 미지정으로 시작한다 — 학교를 고르는 순간 다음 단계가 열린다', () => {
    const state = initialScanMeta('2026');
    expect(state.values.schoolId).toBe('');
    expect(state.values.level).toBe('중등');
    expect(state.values.year).toBe('2026');
    expect(state.values.grade).toBe(UNSPECIFIED_OPTION);
    expect(state.values.semester).toBe(UNSPECIFIED_OPTION);
    expect(state.values.examType).toBe(UNSPECIFIED_OPTION);
    expect(state.values.title).toBe('');
    expect(state.titleAuto).toBe(true);
  });
});

describe('suggestScanTitle', () => {
  it('학교를 고르기 전에는 빈 제목이다 — 학교 없는 "2026" 이 이름으로 박히면 안 된다', () => {
    expect(suggestScanTitle(initialScanMeta('2026').values)).toBe('');
  });

  it('학년도·학교·학년·학기·시험을 그 차례로 잇는다', () => {
    expect(suggestScanTitle(meta().values)).toBe('2026 상현중 중2 1학기 중간');
  });

  it("'미지정' 은 빼고 잇는다", () => {
    const values = meta({ semester: UNSPECIFIED_OPTION, examType: UNSPECIFIED_OPTION }).values;
    expect(suggestScanTitle(values)).toBe('2026 상현중 중2');
  });

  it('이름을 정규화한다 — 표기 변형이 섞이면 카테고리 폴더가 둘로 갈라진다', () => {
    expect(suggestScanTitle(meta({ schoolName: '천재 (정호웅)' }).values))
      .toBe('2026 천재(정호웅) 중2 1학기 중간');
  });
});

describe('applyScanMetaPatch', () => {
  it('직접 치기 전까지 제목이 고른 값을 따라간다', () => {
    const next = applyScanMetaPatch(meta(), { examType: '기말' });
    expect(next.values.title).toBe('2026 상현중 중2 1학기 기말');
    expect(next.titleAuto).toBe(true);
  });

  it('직접 친 제목은 다른 칸을 바꿔도 그대로 둔다', () => {
    const typed = applyScanMetaPatch(meta(), { title: '9월 2주 프린트 모음' });
    expect(typed.titleAuto).toBe(false);
    const after = applyScanMetaPatch(typed, { examType: '기말' });
    expect(after.values.title).toBe('9월 2주 프린트 모음');
  });

  it('제목을 비우면 다시 자동으로 돌아간다', () => {
    const typed = applyScanMetaPatch(meta(), { title: '직접 지은 이름' });
    const cleared = applyScanMetaPatch(typed, { title: '  ' });
    expect(cleared.titleAuto).toBe(true);
    expect(cleared.values.title).toBe('2026 상현중 중2 1학기 중간');
  });

  it('학교급을 바꾸면 학교·학년을 비운다 — 다른 급의 학교가 남으면 중1 이 고등학교에 붙는다', () => {
    const next = applyScanMetaPatch(meta(), { level: '고등' });
    expect(next.values.schoolId).toBe('');
    expect(next.values.schoolName).toBe('');
    expect(next.values.grade).toBe(UNSPECIFIED_OPTION);
    // 학년도·학기·시험은 학교급과 무관하다 — 비우면 다시 고르게 만든다
    expect(next.values.year).toBe('2026');
    expect(next.values.semester).toBe('1학기');
    expect(next.values.examType).toBe('중간');
    // 학교가 빠졌으니 자동 제목도 비어야 한다
    expect(next.values.title).toBe('');
  });

  it('같은 학교급을 다시 골라도 아무것도 비우지 않는다', () => {
    const next = applyScanMetaPatch(meta(), { level: '중등' });
    expect(next.values.schoolId).toBe('s1');
    expect(next.values.grade).toBe('중2');
  });
});

describe('schoolsForLevel', () => {
  const schools: SelectableSchool[] = [
    { id: 'm1', name: '상현중', level: '중등' },
    { id: 'h1', name: '도선고', level: '고등' },
    { id: 'x1', name: '전체', legacy: true },
  ];

  it('고른 급의 학교만 남긴다', () => {
    expect(schoolsForLevel(schools, '고등').map((s) => s.id)).toEqual(['h1', 'x1']);
  });

  it('마스터에 짝이 없는 옛 항목은 양쪽에 둔다 — 어느 급에서도 안 보이면 이어 올릴 수 없다', () => {
    expect(schoolsForLevel(schools, '중등').map((s) => s.id)).toEqual(['m1', 'x1']);
  });
});

describe('선택지', () => {
  it('학년은 학교급을 따른다', () => {
    expect(gradeOptionsForScan('고등')).toEqual(['고1', '고2', '고3', UNSPECIFIED_OPTION]);
  });

  it('학기·시험은 미지정이 맨 앞이다 — 모르겠다고 말할 수 있어야 한다', () => {
    expect(semesterOptionsForScan()[0]).toBe(UNSPECIFIED_OPTION);
    expect(examTypeOptionsForScan()).toEqual([UNSPECIFIED_OPTION, '중간', '기말']);
  });
});

describe('validateScanMeta', () => {
  it('학교 이름만 있고 id 가 없으면 막는다 — 트리에 못 올라가는 프린트가 만들어진다', () => {
    expect(validateScanMeta(meta({ schoolId: '', schoolName: '상현중' }).values).school)
      .toBeTruthy();
    expect(validateScanMeta(meta().values)).toEqual({});
  });
});

describe('composePrintName', () => {
  it('스캔 제목 뒤에 프린트별 이름을 붙인다', () => {
    expect(composePrintName('2026 상현중 중2 1학기 중간', '봄봄 학습지'))
      .toBe('2026 상현중 중2 1학기 중간 봄봄 학습지');
  });

  it('프린트별 이름을 비우면 스캔 제목이 곧 프린트 이름이다 — 한 장짜리 스캔', () => {
    expect(composePrintName('2026 상현중 중2 1학기 중간', '   '))
      .toBe('2026 상현중 중2 1학기 중간');
  });

  it('둘 다 비면 빈 문자열이다 (검증이 이것을 막는다)', () => {
    expect(composePrintName('', '')).toBe('');
  });

  it('합친 뒤 정규화한다 — 저장값과 미리보기가 갈라지면 안 된다', () => {
    expect(composePrintName('2026 상현중', '천재 (정호웅)  프린트'))
      .toBe('2026 상현중 천재(정호웅) 프린트');
  });
});
