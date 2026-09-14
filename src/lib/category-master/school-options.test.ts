import { describe, it, expect } from 'vitest';
import type { School } from '@/types';
import { LEGACY_SCHOOL_SUFFIX, mergeSchoolOptions, schoolOptionLabel } from './school-options';

const master = (id: string, name: string, level: string) => ({ id, name, level });
const mirror = (id: string, name: string): School => ({ id, name, created_at: '2026-01-01' });

describe('mergeSchoolOptions', () => {
  it('마스터 학교를 중등 → 고등, 이름순으로 전부 보여 준다', () => {
    const rows = mergeSchoolOptions(
      [master('h1', '도선고등학교', '고등'), master('m2', '행당중학교', '중등'), master('m1', '광희중학교', '중등')],
      [],
    );
    expect(rows.map((r) => r.name)).toEqual(['광희중학교', '행당중학교', '도선고등학교']);
  });

  it('이미 쓰인 학교가 마스터에도 있으면 한 줄이고, 이름은 마스터가 이긴다', () => {
    // 거울이 옛 이름을 들고 있을 수 있다 — 원본은 관리자시스템이다
    const rows = mergeSchoolOptions([master('s1', '선화예술중학교', '중등')], [mirror('s1', '선화예중')]);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('선화예술중학교');
    expect(rows[0].legacy).toBeUndefined();
  });

  it('마스터에 짝이 없는 옛 학교는 살아남고 맨 뒤로 간다', () => {
    // 지우면 그 학교로 만들어 둔 프린트를 고를 방법이 없어진다('전체' 같은 옛 임시 행)
    const rows = mergeSchoolOptions([master('m1', '광희중학교', '중등')], [mirror('x', '전체')]);
    expect(rows.map((r) => r.name)).toEqual(['광희중학교', '전체']);
    expect(rows[1].legacy).toBe(true);
    expect(rows[1].level).toBeUndefined();
  });

  it('마스터를 못 읽어도 이미 쓰인 학교는 사라지지 않는다', () => {
    const rows = mergeSchoolOptions([], [mirror('s1', '도선고등학교')]);
    expect(rows.map((r) => r.name)).toEqual(['도선고등학교']);
  });

  it('이름은 정규화를 거친다 — 표기 변형이 트리 폴더를 둘로 가른다', () => {
    const rows = mergeSchoolOptions([master('s1', '  선화예술중학교  ', '중등')], []);
    expect(rows[0].name).toBe('선화예술중학교');
  });

  it('학교급을 모르는 마스터 행도 떨어뜨리지 않는다', () => {
    const rows = mergeSchoolOptions([master('s1', '어떤학교', '')], []);
    expect(rows).toHaveLength(1);
  });
});

describe('schoolOptionLabel', () => {
  it('옛 항목만 꼬리표를 단다 — 마스터에 있는 학교로 오해하면 안 된다', () => {
    expect(schoolOptionLabel({ id: 'a', name: '광희중학교', level: '중등' })).toBe('광희중학교');
    expect(schoolOptionLabel({ id: 'x', name: '전체', legacy: true })).toBe(`전체${LEGACY_SCHOOL_SUFFIX}`);
  });
});
