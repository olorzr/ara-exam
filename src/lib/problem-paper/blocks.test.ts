import { describe, it, expect } from 'vitest';
import {
  buildAnswerRows,
  buildPaperBlocks,
  imagePathsOf,
  longestPassageChars,
  renumberedImageItems,
  MISSING_ANSWER_LABEL,
} from './blocks';
import type { PaperItemSnapshot } from '@/types/problem-bank';

function snap(over: Partial<PaperItemSnapshot> = {}): PaperItemSnapshot {
  return {
    number: 1, question_type: '객관식', stem_html: '<p>물음</p>',
    choices: ['가', '나', '다', '라', '마'], answer: '1', score: 3,
    explanation_html: '', area_path: [], work_title: '', render_mode: 'text',
    image_path: '', figure_paths: [], passage: null,
    source: {
      source_type: '내신기출', title: '상현중 중간', school_name: '상현중',
      year: '2026', grade: '중2', exam_type: '중간', publisher: '',
    },
    ...over,
  };
}

const passage = (id: string, html = '<p>지문 한 문단</p>') => ({
  id, label: '', title: '소나기', author: '황순원', html,
  render_mode: 'text' as const, image_path: '',
});

const build = (items: PaperItemSnapshot[]) => buildPaperBlocks(items);

describe('buildPaperBlocks', () => {
  it('지문 없는 문항은 문항 블록만 만든다', () => {
    const blocks = build([snap(), snap()]);
    expect(blocks.map((b) => b.kind)).toEqual(['problem', 'problem']);
    expect(blocks[1]).toMatchObject({ number: 2 });
  });

  it('지문 묶음마다 머리글을 앞에 붙이고 번호 범위를 적는다', () => {
    const p = passage('P1');
    const blocks = build([snap({ passage: p }), snap({ passage: p }), snap({ passage: p })]);
    expect(blocks[0]).toMatchObject({ kind: 'passage-header', text: '[1~3] 다음 글을 읽고 물음에 답하시오.' });
  });

  it('문항이 하나면 범위 대신 번호 하나를 적는다', () => {
    const blocks = build([snap({ passage: passage('P1') })]);
    expect(blocks[0]).toMatchObject({ text: '[1] 다음 글을 읽고 물음에 답하시오.' });
  });

  it('지문을 문단 단위로 쪼갠다 — 통째로 넣으면 한 쪽을 넘을 때 깨알같이 줄어든다', () => {
    const p = passage('P1', '<p>첫 문단</p><p>둘째 문단</p><p>셋째 문단</p>');
    const parts = build([snap({ passage: p })]).filter((b) => b.kind === 'passage-part');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toMatchObject({ first: true, last: false });
    expect(parts[2]).toMatchObject({ first: false, last: true });
  });

  it("'이미지로 출제' 지문은 조각내지 않고 이미지 블록 하나로 낸다", () => {
    const p = { ...passage('P1'), render_mode: 'image' as const, image_path: 'passages/x/region.jpg' };
    const blocks = build([snap({ passage: p })]);
    expect(blocks.map((b) => b.kind)).toEqual(['passage-header', 'passage-image', 'problem']);
  });

  it("'이미지로 출제' 문항은 이미지 블록이 된다", () => {
    const blocks = build([snap({ render_mode: 'image', image_path: 'problems/x/region.jpg' })]);
    expect(blocks[0]).toMatchObject({ kind: 'problem-image', number: 1 });
  });

  it('이미지 문항도 출처 스냅샷을 들고 간다 — 출처 표시가 그림 문항만 빠지면 안 된다', () => {
    const blocks = build([snap({ render_mode: 'image', image_path: 'p/x.jpg' })]);
    expect(blocks[0]).toMatchObject({
      kind: 'problem-image',
      source: expect.objectContaining({ school_name: '상현중' }),
    });
  });

  it('이미지 문항 블록에 배점을 싣지 않는다 — 인쇄에서 배점을 쓰지 않는다', () => {
    const blocks = build([snap({ render_mode: 'image', image_path: 'p/x.jpg', score: 4 })]);
    expect(blocks[0]).not.toHaveProperty('score');
  });

  it('지문 앞뒤의 빈 문단은 버리고 가운데 빈 줄은 남긴다', () => {
    const p = passage('P1', '<p></p><p>연 하나</p><p></p><p>연 둘</p><p><br></p>');
    const parts = build([snap({ passage: p })]).filter((b) => b.kind === 'passage-part');
    expect(parts.map((b) => b.html)).toEqual(['<p>연 하나</p>', '<p></p>', '<p>연 둘</p>']);
    expect(parts[0]).toMatchObject({ first: true });
    expect(parts[2]).toMatchObject({ last: true });
  });

  it('지문 본문을 정화한다 — 스냅샷은 jsonb 라 나중에 오염될 수 있다', () => {
    const p = passage('P1', '<p onclick="alert(1)">지문</p><script>x</script>');
    const parts = build([snap({ passage: p })]).filter((b) => b.kind === 'passage-part');
    expect(JSON.stringify(parts)).not.toContain('onclick');
    expect(JSON.stringify(parts)).not.toContain('script');
  });

  it('여러 지문이 섞여도 묶음마다 머리글이 하나씩 나온다', () => {
    const p1 = passage('P1');
    const p2 = passage('P2');
    const blocks = build([snap({ passage: p1 }), snap({ passage: p1 }), snap({ passage: p2 })]);
    const headers = blocks.filter((b) => b.kind === 'passage-header');
    expect(headers).toHaveLength(2);
    expect(headers[1]).toMatchObject({ text: '[3] 다음 글을 읽고 물음에 답하시오.' });
  });

  it('블록 key 가 겹치지 않는다 — React 목록이 뒤섞이면 안 된다', () => {
    const p = passage('P1', '<p>가</p><p>나</p>');
    const blocks = build([snap({ passage: p }), snap({ passage: p }), snap()]);
    const keys = blocks.map((b) => b.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('빈 목록이면 블록도 없다', () => {
    expect(build([])).toEqual([]);
  });
});

describe('renumberedImageItems', () => {
  it('자리가 바뀐 이미지 문항을 찾아낸다 — 이미지에 원본 번호가 찍혀 있다', () => {
    const rows = renumberedImageItems([
      snap({ number: 17, render_mode: 'image', image_path: 'a.jpg' }),
      snap({ number: 2, render_mode: 'image', image_path: 'b.jpg' }),
    ]);
    expect(rows).toEqual([{ printed: 1, original: 17 }]);
  });

  it('글로 출제한 문항은 세지 않는다 — 번호를 우리가 그린다', () => {
    expect(renumberedImageItems([snap({ number: 17, render_mode: 'text' })])).toEqual([]);
  });

  it('원본 번호를 모르면 알릴 것이 없다', () => {
    expect(renumberedImageItems([
      snap({ number: null, render_mode: 'image', image_path: 'a.jpg' }),
    ])).toEqual([]);
  });
});

describe('imagePathsOf', () => {
  it('문항·지문·삽화 경로를 중복 없이 모은다', () => {
    const p = { ...passage('P1'), render_mode: 'image' as const, image_path: 'a.jpg' };
    const paths = imagePathsOf([
      snap({ passage: p, figure_paths: ['f1.jpg', 'f1.jpg'] }),
      snap({ passage: p, render_mode: 'image', image_path: 'b.jpg' }),
    ]);
    expect(paths.sort()).toEqual(['a.jpg', 'b.jpg', 'f1.jpg']);
  });

  it('텍스트 출제 문항의 image_path 는 인쇄에 쓰지 않는다', () => {
    expect(imagePathsOf([snap({ render_mode: 'text', image_path: 'x.jpg' })])).toEqual([]);
  });
});

describe('buildAnswerRows', () => {
  it('정답표는 1번부터 다시 센다', () => {
    const rows = buildAnswerRows([snap({ number: 7, answer: '3' }), snap({ number: 9, answer: '1' })]);
    expect(rows.map((r) => r.number)).toEqual([1, 2]);
  });

  it("정답이 비면 '미입력' 이라고 적는다 — 빈칸이면 누락과 구분되지 않는다", () => {
    expect(buildAnswerRows([snap({ answer: '  ' })])[0].answer).toBe(MISSING_ANSWER_LABEL);
  });

  it('정답표 줄에 배점을 담지 않는다', () => {
    expect(buildAnswerRows([snap({ score: 3 })])[0]).not.toHaveProperty('score');
  });
});

describe('longestPassageChars', () => {
  it('태그를 빼고 센다', () => {
    const p = passage('P1', '<p>가나다</p><p>라마</p>');
    expect(longestPassageChars([snap({ passage: p })])).toBe(5);
  });

  it('같은 지문을 두 번 세지 않는다', () => {
    const p = passage('P1', '<p>가나다</p>');
    expect(longestPassageChars([snap({ passage: p }), snap({ passage: p })])).toBe(3);
  });

  it('지문이 없으면 0', () => {
    expect(longestPassageChars([snap()])).toBe(0);
  });
});

describe('buildPaperBlocks — 지문 안 그림', () => {
  const fig = (n: number) => `<figure data-figure="${n}"></figure>`;

  it('자리표시자 자리에 그림 블록을 끼운다 — 그림이 밀려 나오면 지문이 안 읽힌다', () => {
    const p = {
      ...passage('p1', `<p>앞 문단</p>${fig(1)}<p>뒤 문단</p>`),
      figure_paths: ['graph.jpg'],
    };
    const kinds = build([snap({ passage: p })]).map((b) => b.kind);
    expect(kinds).toEqual([
      'passage-header', 'passage-part', 'passage-figure', 'passage-part', 'problem',
    ]);
  });

  it('빈 <figure> 를 문단 조각으로 남기지 않는다 — 인쇄물에서 빈 줄이 된다', () => {
    const p = { ...passage('p1', `<p>글</p>${fig(1)}`), figure_paths: ['g.jpg'] };
    const parts = build([snap({ passage: p })])
      .filter((b) => b.kind === 'passage-part') as { html: string }[];
    expect(parts.every((b) => !b.html.includes('figure'))).toBe(true);
  });

  it('상자 테두리는 **글 조각**의 처음·끝에만 붙인다 — 그림에 붙으면 상자가 갈라 보인다', () => {
    const p = {
      ...passage('p1', `<p>앞</p>${fig(1)}<p>뒤</p>`),
      figure_paths: ['g.jpg'],
    };
    const parts = build([snap({ passage: p })])
      .filter((b) => b.kind === 'passage-part') as { first: boolean; last: boolean }[];
    expect(parts[0].first).toBe(true);
    expect(parts[0].last).toBe(false);
    expect(parts[parts.length - 1].last).toBe(true);
  });

  it('경로가 없는 자리표시자는 건너뛴다 — 못 잘라 낸 그림이다', () => {
    const p = { ...passage('p1', `<p>글</p>${fig(1)}`), figure_paths: [''] };
    expect(build([snap({ passage: p })]).some((b) => b.kind === 'passage-figure')).toBe(false);
  });

  it('자리표시자가 없는 그림도 본문 끝에 붙인다 — 화면에만 나오고 인쇄에서 빠지면 안 된다', () => {
    // 검수에서 편집기의 '그림 1' 칩만 지우고 저장한 지문이 이렇게 된다
    const p = { ...passage('p1', '<p>글</p>'), figure_paths: ['orphan.jpg'] };
    const blocks = build([snap({ passage: p })]);
    expect(blocks.some((b) => b.kind === 'passage-figure')).toBe(true);
    // 글 뒤에 온다
    const kinds = blocks.map((b) => b.kind);
    expect(kinds.indexOf('passage-figure')).toBeGreaterThan(kinds.indexOf('passage-part'));
  });

  it('자리에 놓인 그림은 끝에 또 붙이지 않는다', () => {
    const p = { ...passage('p1', `<p>글</p>${fig(1)}`), figure_paths: ['g.jpg'] };
    const count = build([snap({ passage: p })]).filter((b) => b.kind === 'passage-figure').length;
    expect(count).toBe(1);
  });

  it('그림이 없는 지문은 예전과 똑같이 쪼갠다', () => {
    const p = passage('p1', '<p>한 문단</p><p>두 문단</p>');
    const kinds = build([snap({ passage: p })]).map((b) => b.kind);
    expect(kinds).toEqual(['passage-header', 'passage-part', 'passage-part', 'problem']);
  });

  it('지문 그림도 서명할 경로에 담는다 — 빠지면 인쇄물에서만 빈칸이 된다', () => {
    const p = { ...passage('p1'), figure_paths: ['pg.jpg'] };
    expect(imagePathsOf([snap({ passage: p })])).toContain('pg.jpg');
  });
});
