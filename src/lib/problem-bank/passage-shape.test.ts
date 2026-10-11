import { describe, it, expect } from 'vitest';
import { areaTopDiffers, passageShapeChanged, workTitlesDiffer } from './passage-shape';
import type { Passage, PassageWork } from '@/types/problem-bank';

const work = (title: string, label = ''): PassageWork => ({ label, title, author: '' });
const passage = (over: Partial<Passage> = {}): Passage => ({
  works: [work('서시', '가'), work('광야', '나')],
  area_path: ['문학', '운문 문학'],
  ...over,
} as Passage);

describe('passage-shape', () => {
  it('제목 목록이 같으면 지은이·구분 표시가 달라도 움직이지 않는다', () => {
    expect(workTitlesDiffer([work('서시', '(가)')], [work('서시', '나')])).toBe(false);
    expect(workTitlesDiffer([work('서시')], [work('광야')])).toBe(true);
  });

  it('대영역이 바뀔 때만 참이다 — 소영역만 바뀌면 트리거가 움직이지 않는다', () => {
    expect(areaTopDiffers(['화법과 언어', '언어'], ['문학', '운문 문학'])).toBe(true);
    expect(areaTopDiffers(['문학', '산문 문학'], ['문학', '운문 문학'])).toBe(false);
    expect(areaTopDiffers([], ['문학'])).toBe(true);
    expect(areaTopDiffers(undefined, ['문학'])).toBe(false);
  });

  it('작품명이나 대영역이 바뀌면 딸린 문항을 다시 읽는다', () => {
    const target = passage();
    expect(passageShapeChanged({ html: '<p>고친 글</p>' }, target)).toBe(false);
    expect(passageShapeChanged({ area_path: ['문학', '산문 문학'] }, target)).toBe(false);
    expect(passageShapeChanged({ area_path: ['화법과 언어'] }, target)).toBe(true);
    expect(passageShapeChanged({ works: [work('서시', '가')] }, target)).toBe(true);
    // 편집기는 전체 저장마다 둘 다 싣는다 — 값이 같으면 움직이지 않는다
    expect(passageShapeChanged({ works: target.works, area_path: target.area_path }, target)).toBe(false);
  });
});
