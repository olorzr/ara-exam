import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  UNSPECIFIED_OPTION,
  EXTERNAL_GRADE_OPTIONS,
  toStoredValue,
  toOptionValue,
  buildYearOptions,
} from './external-category';

/** buildYearOptions 가 kstYear() 를 쓰므로 시스템 시각을 고정해 테스트한다 */
function withFixedYear(year: number, fn: () => void) {
  vi.useFakeTimers();
  // 연말·연초 경계를 피해 한여름 정오로 고정 (KST 변환에도 같은 해)
  vi.setSystemTime(new Date(`${year}-07-01T12:00:00Z`));
  try {
    fn();
  } finally {
    vi.useRealTimers();
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe('toStoredValue / toOptionValue', () => {
  it("'미지정' 을 빈 문자열로 저장한다", () => {
    expect(toStoredValue(UNSPECIFIED_OPTION)).toBe('');
  });

  it('실제 값은 그대로 통과시킨다', () => {
    expect(toStoredValue('2026')).toBe('2026');
    expect(toStoredValue('중2')).toBe('중2');
  });

  it("빈 문자열을 '미지정' 으로 표시한다", () => {
    expect(toOptionValue('')).toBe(UNSPECIFIED_OPTION);
  });

  it('왕복 변환이 원래 값을 보존한다', () => {
    for (const v of ['', '2026', '고3']) {
      expect(toStoredValue(toOptionValue(v))).toBe(v);
    }
  });
});

describe('EXTERNAL_GRADE_OPTIONS', () => {
  it('중등·고등 학년을 모두 포함하고 미지정으로 끝난다', () => {
    expect(EXTERNAL_GRADE_OPTIONS).toEqual(['중1', '중2', '중3', '고1', '고2', '고3', UNSPECIFIED_OPTION]);
  });
});

describe('buildYearOptions', () => {
  it('올해 기준 내년~4년 전 윈도를 내림차순으로 만들고 미지정을 마지막에 둔다', () => {
    withFixedYear(2026, () => {
      expect(buildYearOptions([])).toEqual([
        '2027', '2026', '2025', '2024', '2023', '2022', UNSPECIFIED_OPTION,
      ]);
    });
  });

  it('윈도 밖의 년도가 데이터에 있으면 합집합으로 포함한다', () => {
    withFixedYear(2026, () => {
      const options = buildYearOptions(['2019', '2030']);
      expect(options[0]).toBe('2030');
      expect(options).toContain('2019');
      expect(options.at(-1)).toBe(UNSPECIFIED_OPTION);
    });
  });

  it('빈 문자열(미지정)은 년도 항목으로 중복 추가하지 않는다', () => {
    withFixedYear(2026, () => {
      const options = buildYearOptions(['', '', '2026']);
      expect(options.filter((o) => o === UNSPECIFIED_OPTION)).toHaveLength(1);
      expect(options.filter((o) => o === '2026')).toHaveLength(1);
    });
  });
});
