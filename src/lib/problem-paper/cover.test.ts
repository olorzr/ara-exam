import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  COVER_COLUMNS, COVER_LAYOUT_LABELS, COVER_LAYOUTS, COVER_SUBTITLE_MAX, COVER_TITLE_MAX,
  DEFAULT_SIMPLE_COVER, coverTitleFor, isCoverLayout, normalizePaperCover, toCoverRow,
} from './cover';

const ROW = {
  paper_id: 'p', kind: 'simple', layout: 'basic', title: ' 1학기 중간 대비 ', subtitle: '3회',
  show_name_box: false, image_path: 'papers/p/cover-x.jpg', user_id: 'u',
};

describe('normalizePaperCover', () => {
  it('간단 표지 — 글자를 다듬고 그림 경로는 버린다', () => {
    expect(normalizePaperCover(ROW)).toEqual({
      kind: 'simple', layout: 'basic', title: '1학기 중간 대비', subtitle: '3회', showNameBox: false, imagePath: '',
    });
  });

  it('그림 표지 — 경로를 그대로 둔다', () => {
    expect(normalizePaperCover({ ...ROW, kind: 'image' })?.imagePath).toBe('papers/p/cover-x.jpg');
  });

  it('행이 없거나 모르는 종류면 표지 없음', () => {
    expect(normalizePaperCover(null)).toBeNull();
    expect(normalizePaperCover({ ...ROW, kind: 'none' })).toBeNull();
  });

  it('그림인데 경로가 없으면 표지 없음 — 빈 종이가 첫 장으로 나가면 안 된다', () => {
    expect(normalizePaperCover({ ...ROW, kind: 'image', image_path: '' })).toBeNull();
  });

  it('이름 칸 값이 불리언이 아니면 기본(보임)', () => {
    expect(normalizePaperCover({ ...ROW, show_name_box: null })?.showNameBox).toBe(true);
  });

  it('상한을 넘는 글자는 자른다', () => {
    const cover = normalizePaperCover({ ...ROW, title: '가'.repeat(150), subtitle: '나'.repeat(300) });
    expect(cover?.title).toHaveLength(COVER_TITLE_MAX);
    expect(cover?.subtitle).toHaveLength(COVER_SUBTITLE_MAX);
  });
});

describe('normalizePaperCover — 디자인', () => {
  it('간단 표지는 고른 디자인을 그대로 둔다', () => {
    expect(normalizePaperCover({ ...ROW, layout: 'spines' })?.layout).toBe('spines');
  });

  it('모르는 디자인이거나 칸이 없으면(sql/70 전의 행) 표지는 살리고 기본 디자인이다', () => {
    expect(normalizePaperCover({ ...ROW, layout: 'nope' })).toMatchObject({ kind: 'simple', layout: 'basic' });
    const { layout: _drop, ...old } = ROW;
    void _drop;
    expect(normalizePaperCover(old)).toMatchObject({ kind: 'simple', layout: 'basic', title: '1학기 중간 대비' });
  });

  it('그림 표지에는 디자인이 없다', () => {
    expect(normalizePaperCover({ ...ROW, kind: 'image', layout: 'rings' })?.layout).toBe('basic');
  });

  it('디자인 목록과 이름표가 한 벌이다', () => {
    expect(Object.keys(COVER_LAYOUT_LABELS).sort()).toEqual([...COVER_LAYOUTS].sort());
    expect(COVER_LAYOUT_LABELS.basic).toBe('간단');
    expect(isCoverLayout('soft')).toBe(true);
    expect(isCoverLayout('Soft')).toBe(false);
    expect(isCoverLayout(3)).toBe(false);
  });
});

describe('coverTitleFor', () => {
  it('제목이 비었으면 문제지 제목 + 꼬리', () => {
    expect(coverTitleFor(DEFAULT_SIMPLE_COVER, '상현중 기출', ' - 교사용')).toBe('상현중 기출 - 교사용');
  });

  it('적은 제목이 있으면 그 제목 + 꼬리', () => {
    const cover = { ...DEFAULT_SIMPLE_COVER, title: '여름 특강' };
    expect(coverTitleFor(cover, '상현중 기출', ' - 답지')).toBe('여름 특강 - 답지');
    expect(coverTitleFor(cover, '상현중 기출', '')).toBe('여름 특강');
  });
});

describe('toCoverRow', () => {
  it('user_id 를 싣지 않는다 — 트리거가 채운다', () => {
    expect(toCoverRow('p', DEFAULT_SIMPLE_COVER)).not.toHaveProperty('user_id');
  });

  it('간단 표지면 그림 경로를 비운다(옛 그림 경로가 남지 않게)', () => {
    const row = toCoverRow('p', { ...DEFAULT_SIMPLE_COVER, imagePath: 'papers/p/cover-x.jpg' });
    expect(row.image_path).toBe('');
  });

  it('디자인을 싣되 그림 표지면 기본 디자인을 저장한다', () => {
    expect(toCoverRow('p', { ...DEFAULT_SIMPLE_COVER, layout: 'soft' }).layout).toBe('soft');
    expect(toCoverRow('p', { ...DEFAULT_SIMPLE_COVER, kind: 'image', layout: 'soft', imagePath: 'x' }).layout)
      .toBe('basic');
  });

  it('조회 컬럼이 저장하는 칸을 전부 담는다 — 빠지면 저장한 값을 다시 읽지 못한다', () => {
    const columns = COVER_COLUMNS.split(',').map((c) => c.trim());
    expect(columns.sort()).toEqual(Object.keys(toCoverRow('p', DEFAULT_SIMPLE_COVER)).sort());
  });
});

describe('sql/70 거울', () => {
  it('디자인 CHECK 와 기본값이 앱 목록과 같다', () => {
    const sql = readFileSync(path.resolve(__dirname, '../../../sql/70_problem_paper_cover_layout.sql'), 'utf8');
    expect(sql).toContain(`CHECK (layout IN (${COVER_LAYOUTS.map((l) => `'${l}'`).join(', ')}))`);
    expect(sql).toContain(`DEFAULT '${DEFAULT_SIMPLE_COVER.layout}'`);
  });
});

describe('sql/61 거울', () => {
  it('글자 수 상한이 DB CHECK 와 같다', () => {
    const sql = readFileSync(path.resolve(__dirname, '../../../sql/61_problem_paper_covers.sql'), 'utf8');
    expect(sql).toContain(`CHECK (length(title) <= ${COVER_TITLE_MAX})`);
    expect(sql).toContain(`CHECK (length(subtitle) <= ${COVER_SUBTITLE_MAX})`);
  });
});
