import { describe, it, expect, vi, beforeEach } from 'vitest';

const { upsert, fetchMasterSchoolName } = vi.hoisted(() => ({
  upsert: vi.fn(),
  fetchMasterSchoolName: vi.fn(),
}));

vi.mock('../supabase', () => ({ supabase: { from: () => ({ upsert }) } }));
vi.mock('../naesin-scope/fetch', () => ({ fetchMasterSchoolName, fetchMasterSchools: vi.fn() }));

const { ensureSchoolMirror } = await import('./schools');

describe('ensureSchoolMirror', () => {
  beforeEach(() => {
    upsert.mockReset().mockResolvedValue({ error: null });
    fetchMasterSchoolName.mockReset().mockResolvedValue(null);
  });

  it('화면이 든 이름이 아니라 **마스터의 지금 이름**으로 거울을 맞춘다', async () => {
    // 폼을 열어 둔 사이 관리자시스템에서 이름을 바꿨을 수 있다. 옛 이름을 되쓰면
    // sync_school_name 트리거가 categories·concept_sheets·print_bundles 를 통째로 되돌린다
    fetchMasterSchoolName.mockResolvedValue('선화예술중학교');
    const res = await ensureSchoolMirror({ id: 's1', name: '선화예중' });

    expect(res).toEqual({ id: 's1' });
    expect(upsert).toHaveBeenCalledWith(
      { id: 's1', name: '선화예술중학교' }, { onConflict: 'id', ignoreDuplicates: false },
    );
  });

  it('마스터에 없는 옛 학교는 들고 있던 이름으로 **넣기만** 한다', async () => {
    // '전체' 같은 보존 행은 거울이 곧 원본이라, 화면 값으로 덮어쓸 근거가 없다
    await ensureSchoolMirror({ id: 'x', name: '전체' });
    expect(upsert).toHaveBeenCalledWith({ id: 'x', name: '전체' }, { onConflict: 'id', ignoreDuplicates: true });
  });

  it('이름을 정규화해 넣는다 — 표기 변형이 트리 폴더를 둘로 가른다', async () => {
    fetchMasterSchoolName.mockResolvedValue('  광희중학교  ');
    await ensureSchoolMirror({ id: 's1', name: '광희중학교' });
    expect(upsert).toHaveBeenCalledWith(
      { id: 's1', name: '광희중학교' }, { onConflict: 'id', ignoreDuplicates: false },
    );
  });

  it('이름이 겹치면 **다른 학교에 붙이지 않고** 말한다', async () => {
    // exam.schools.name 은 UNIQUE 인데 public.schools.name 은 아니다. 같은 이름의 다른 행에
    // 슬쩍 붙이면 프린트가 조용히 다른 학교 밑으로 들어간다 — 트리에서 안 보이는 것보다 나쁘다
    fetchMasterSchoolName.mockResolvedValue('대광중학교');
    upsert.mockResolvedValue({ error: { code: '23505', message: 'duplicate key' } });

    const res = await ensureSchoolMirror({ id: 's2', name: '대광중학교' });
    expect(res.id).toBeNull();
    expect(res.warning).toContain('대광중학교');
  });

  it('그 밖의 실패도 삼키지 않는다', async () => {
    upsert.mockResolvedValue({ error: { code: '42501', message: 'permission denied' } });
    const res = await ensureSchoolMirror({ id: 's1', name: '광희중학교' });
    expect(res.id).toBeNull();
    expect(res.warning).toContain('permission denied');
  });

  it('마스터 조회가 실패하면 거울은 만들되 **기존 이름은 덮지 않는다**', async () => {
    // 조회가 잠깐 실패한 것만으로 화면이 든 옛 이름이 실리면, 그 UPDATE 가 sync_school_name 을
    // 발화시켜 이미 만들어 둔 프린트·시험지의 학교명까지 통째로 되돌린다(코덱스 정지 리뷰)
    fetchMasterSchoolName.mockRejectedValue(new Error('network'));
    const res = await ensureSchoolMirror({ id: 's1', name: '옛이름중학교' });

    expect(res).toEqual({ id: 's1' });
    expect(upsert).toHaveBeenCalledWith(
      { id: 's1', name: '옛이름중학교' }, { onConflict: 'id', ignoreDuplicates: true },
    );
  });

  it('학교 id 가 없으면 아무것도 하지 않는다', async () => {
    expect(await ensureSchoolMirror({ id: '', name: '광희중학교' })).toEqual({ id: null });
    expect(upsert).not.toHaveBeenCalled();
  });
});
