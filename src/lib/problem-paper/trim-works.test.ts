import { describe, it, expect } from 'vitest';
import { trimmableGroupCount, trimmedFigurePaths, trimPassageToAskedWorks } from './trim-works';
import type { PaperItemSnapshot, PaperPassageSnapshot, PassageWork } from '@/types/problem-bank';

const WORKS: PassageWork[] = [
  { label: '가', title: '서시', author: '윤동주' },
  { label: '나', title: '광야', author: '이육사' },
];
const HTML = '<p>(가)와 (나)를 읽고 물음에 답하시오.</p>'
  + '<blockquote data-box="가"><p>죽는 날까지 하늘을 우러러</p></blockquote>'
  + '<blockquote data-box="나"><p>까마득한 날에</p></blockquote>'
  + '<blockquote data-box="보기"><p>보기 글</p></blockquote>';

function passage(over: Partial<PaperPassageSnapshot> = {}): PaperPassageSnapshot {
  return {
    id: 'p1', label: '', title: '서시 · 광야', author: '윤동주 · 이육사', html: HTML,
    render_mode: 'text', image_path: '', works: WORKS, ...over,
  };
}

function item(workTitles: string[] | undefined, over: Partial<PaperItemSnapshot> = {}): PaperItemSnapshot {
  return {
    number: 1, question_type: '객관식', stem_html: '<p>물음</p>', choices: [], answer: '1', score: null,
    explanation_html: '', area_path: [], work_title: (workTitles ?? []).join(' · '),
    work_titles: workTitles, render_mode: 'text', image_path: '', figure_paths: [],
    passage: passage(),
    source: { source_type: '내신기출', title: '', school_name: '', year: '', grade: '', exam_type: '', publisher: '' },
    ...over,
  };
}

describe('trimPassageToAskedWorks', () => {
  it('(가)만 묻는 묶음이면 (나) 구역을 빼고, 머리 문단과 〈보기〉는 남긴다', () => {
    const out = trimPassageToAskedWorks(passage(), [item(['서시'])]);
    expect(out?.dropped.map((w) => w.title)).toEqual(['광야']);
    expect(out?.html).toContain('data-box="가"');
    expect(out?.html).not.toContain('data-box="나"');
    expect(out?.html).toContain('읽고 물음에 답하시오');
    expect(out?.html).toContain('data-box="보기"');
  });

  it('묶음 안 문항들이 묻는 작품의 합집합을 남긴다 — 둘 다 묻게 되면 빼지 않는다', () => {
    expect(trimPassageToAskedWorks(passage(), [item(['서시']), item(['광야'])])).toBeNull();
  });

  it('작품 목록이 빈 문항(지문 전체)이 하나라도 있으면 빼지 않는다', () => {
    expect(trimPassageToAskedWorks(passage(), [item(['서시']), item([])])).toBeNull();
  });

  it('제목은 열쇠로 견준다 — 띄어쓰기만 달라도 같은 작품이다', () => {
    const out = trimPassageToAskedWorks(
      passage({ works: [{ ...WORKS[0], title: '엄마 걱정' }, WORKS[1]] }), [item(['엄마걱정'])],
    );
    expect(out?.dropped.map((w) => w.title)).toEqual(['광야']);
  });

  it('지문에 없는 작품을 물으면 어느 구역인지 몰라 빼지 않는다', () => {
    expect(trimPassageToAskedWorks(passage(), [item(['진달래꽃'])])).toBeNull();
  });

  it('옛 스냅샷(works 없음)은 지문 전체다', () => {
    expect(trimPassageToAskedWorks(passage({ works: undefined }), [item(['서시'])])).toBeNull();
  });

  it('옛 스냅샷의 문항은 파생 문자열로 물러선다', () => {
    const out = trimPassageToAskedWorks(passage(), [item(undefined, { work_title: '서시' })]);
    expect(out?.dropped.map((w) => w.title)).toEqual(['광야']);
  });

  it('범위 표시(가~라)·빈 표시·겹친 표시면 빼지 않는다', () => {
    const range = [{ ...WORKS[0], label: '가~라' }, WORKS[1]];
    expect(trimPassageToAskedWorks(passage({ works: range }), [item(['서시'])])).toBeNull();
    const blank = [{ ...WORKS[0], label: '' }, WORKS[1]];
    expect(trimPassageToAskedWorks(passage({ works: blank }), [item(['서시'])])).toBeNull();
    const dup = [WORKS[0], { ...WORKS[1], label: '가' }];
    expect(trimPassageToAskedWorks(passage({ works: dup }), [item(['서시'])])).toBeNull();
  });

  it('구역 상자가 최상위에 하나씩 있지 않으면(글자 (가) 표기·상자 안의 상자) 빼지 않는다', () => {
    const literal = '<p>(가) 죽는 날까지</p><p>(나) 까마득한 날에</p>';
    expect(trimPassageToAskedWorks(passage({ html: literal }), [item(['서시'])])).toBeNull();
    const nested = '<blockquote data-box="가"><p>가</p><blockquote data-box="나"><p>나</p></blockquote></blockquote>';
    expect(trimPassageToAskedWorks(passage({ html: nested }), [item(['서시'])])).toBeNull();
  });

  it('작품으로 등록되지 않은 구역은 남긴다 — 무엇인지 모르는 글은 빼지 않는다', () => {
    const html = `${HTML}<blockquote data-box="다"><p>학생 감상문</p></blockquote>`;
    const out = trimPassageToAskedWorks(passage({ html }), [item(['서시'])]);
    expect(out?.html).toContain('data-box="다"');
    expect(out?.html).not.toContain('data-box="나"');
  });

  it('작품 상자 안에 (가)~(차) 상자가 또 있으면 어느 작품 글인지 몰라 빼지 않는다', () => {
    const html = '<blockquote data-box="가"><p>가</p></blockquote>'
      + '<blockquote data-box="나"><p>나</p><blockquote data-box="다"><p>학생 감상문</p></blockquote></blockquote>';
    expect(trimPassageToAskedWorks(passage({ html }), [item(['서시'])])).toBeNull();
    // [A]·〈보기〉 는 그 작품의 일부라 막지 않는다
    const bracket = '<blockquote data-box="가"><p>가</p></blockquote>'
      + '<blockquote data-box="나"><blockquote data-box="A"><p>나의 한 구간</p></blockquote></blockquote>';
    expect(trimPassageToAskedWorks(passage({ html: bracket }), [item(['서시'])])?.html)
      .not.toContain('나의 한 구간');
  });

  it('DOM 을 만들기 전에 정화한다 — 스냅샷에 섞인 이벤트 속성이 남지 않는다', () => {
    const html = HTML.replace('<p>죽는 날까지', '<p><img src="x" onerror="alert(1)">죽는 날까지');
    const out = trimPassageToAskedWorks(passage({ html }), [item(['서시'])]);
    expect(out?.html).not.toContain('onerror');
    expect(out?.html).toContain('죽는 날까지');
  });

  it('뺀 구역에만 있던 그림을 알려 준다 — 남은 글이 쓰는 그림은 빼지 않는다', () => {
    const html = '<blockquote data-box="가"><p>가</p><figure data-figure="1"></figure></blockquote>'
      + '<blockquote data-box="나"><p>나</p><figure data-figure="2"></figure></blockquote>';
    const out = trimPassageToAskedWorks(
      passage({ html, figure_paths: ['f1.jpg', 'f2.jpg'] }), [item(['서시'])],
    );
    expect(out?.droppedFigures).toEqual(['f2.jpg']);
    expect(trimmedFigurePaths([item(['서시'], { passage: passage({ html, figure_paths: ['f1.jpg', 'f2.jpg'] }) })]))
      .toEqual(new Map([['p1', new Set(['f2.jpg'])]]));
  });

  it('남은 그림이 같은 경로를 쓰면 그 경로는 빼지 않는다 — 자리표시자 없이 끝에 붙는 그림도 남은 그림이다', () => {
    const html = '<blockquote data-box="가"><p>가</p><figure data-figure="1"></figure></blockquote>'
      + '<blockquote data-box="나"><p>나</p><figure data-figure="2"></figure></blockquote>';
    const same = trimPassageToAskedWorks(passage({ html, figure_paths: ['x.jpg', 'x.jpg'] }), [item(['서시'])]);
    expect(same?.droppedFigures).toEqual([]);
    // 3번은 자리표시자가 없어 지문 끝에 붙는다 — 2번과 같은 경로면 빼지 않는다
    const unplaced = trimPassageToAskedWorks(
      passage({ html, figure_paths: ['a.jpg', 'b.jpg', 'b.jpg'] }), [item(['서시'])],
    );
    expect(unplaced?.droppedFigures).toEqual([]);
  });

  it('이미지로 출제하는 지문은 건드리지 않는다', () => {
    expect(trimPassageToAskedWorks(
      passage({ render_mode: 'image', image_path: 'x.jpg' }), [item(['서시'])],
    )).toBeNull();
  });
});

describe('trimmableGroupCount', () => {
  it('뺄 수 있는 지문 묶음만 센다', () => {
    const other = passage({ id: 'p2' });
    expect(trimmableGroupCount([
      item(['서시']), item(['서시']),
      item(['서시', '광야'], { passage: other }),
      item([], { passage: null }),
    ])).toBe(1);
    expect(trimmableGroupCount([])).toBe(0);
  });
});
