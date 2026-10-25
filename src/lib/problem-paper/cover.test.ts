import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BACK_COVER_KINDS, COVER_COLUMNS, COVER_LAYOUT_LABELS, COVER_LAYOUTS, COVER_SUBTITLE_MAX, COVER_TEACHER_MAX,
  COVER_TITLE_MAX, DEFAULT_SIMPLE_COVER, coverTitleFor, effectiveBackKind, isBackCoverKind, isCoverLayout,
  normalizePaperCover, toCoverRow,
} from './cover';

const ROW = {
  paper_id: 'p', kind: 'simple', layout: 'basic', title: ' 1학기 중간 대비 ', subtitle: '3회',
  show_name_box: false, image_path: 'papers/p/cover-x.jpg', user_id: 'u',
};

describe('normalizePaperCover', () => {
  it('간단 표지 — 글자를 다듬고 그림 경로는 버린다', () => {
    expect(normalizePaperCover(ROW)).toEqual({
      kind: 'simple', layout: 'basic', title: '1학기 중간 대비', subtitle: '3회', showNameBox: false, imagePath: '',
      teacher: '', backKind: 'none', backImagePath: '',
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

describe('normalizePaperCover — 뒷표지 · 선생님 이름(sql/75)', () => {
  it('칸이 없으면(sql/75 전의 행) 뒷표지 없음 · 선생님 자동이고 앞표지는 그대로', () => {
    expect(normalizePaperCover(ROW)).toMatchObject({ kind: 'simple', backKind: 'none', backImagePath: '', teacher: '' });
  });

  it('디자인 뒷표지와 그림 뒷표지를 읽는다', () => {
    expect(normalizePaperCover({ ...ROW, layout: 'zine', back_kind: 'design' })).toMatchObject({
      layout: 'zine', backKind: 'design', backImagePath: '',
    });
    expect(normalizePaperCover({ ...ROW, back_kind: 'image', back_image_path: 'papers/p/cover-b.jpg' }))
      .toMatchObject({ backKind: 'image', backImagePath: 'papers/p/cover-b.jpg' });
  });

  it('붙일 수 없는 뒷표지는 뒷표지만 없앤다 — 앞표지를 버리면 첫 장이 빠진다', () => {
    expect(normalizePaperCover({ ...ROW, back_kind: 'image', back_image_path: '' }))
      .toMatchObject({ kind: 'simple', backKind: 'none' });
    expect(normalizePaperCover({ ...ROW, kind: 'image', back_kind: 'design' }))
      .toMatchObject({ kind: 'image', backKind: 'none' });
    expect(normalizePaperCover({ ...ROW, back_kind: 'both' })).toMatchObject({ backKind: 'none' });
  });

  it('뒷표지가 그림이 아니면 남은 경로를 버린다', () => {
    expect(normalizePaperCover({ ...ROW, back_kind: 'design', back_image_path: 'x' })?.backImagePath).toBe('');
  });

  it('선생님 이름을 다듬고 상한에서 자른다', () => {
    expect(normalizePaperCover({ ...ROW, teacher: ' 송알 ' })?.teacher).toBe('송알');
    expect(normalizePaperCover({ ...ROW, teacher: '가'.repeat(60) })?.teacher).toHaveLength(COVER_TEACHER_MAX);
  });

  it('뒷표지 종류 판정', () => {
    expect(BACK_COVER_KINDS).toEqual(['none', 'design', 'image']);
    expect(isBackCoverKind('design')).toBe(true);
    expect(isBackCoverKind('Design')).toBe(false);
    expect(effectiveBackKind('simple', 'design', '')).toBe('design');
    expect(effectiveBackKind('image', 'design', '')).toBe('none');
    expect(effectiveBackKind('image', 'image', '')).toBe('none');
    expect(effectiveBackKind('image', 'image', 'p')).toBe('image');
  });

  it('라인드로잉(zine)이 디자인 목록에 있다', () => {
    expect(COVER_LAYOUTS).toContain('zine');
    expect(COVER_LAYOUT_LABELS.zine).toBe('라인드로잉');
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

  it('뒷표지 — 그림 앞표지의 디자인 뒷표지는 없음으로, 그림이 아니면 경로를 비운다', () => {
    const image = { ...DEFAULT_SIMPLE_COVER, kind: 'image' as const, imagePath: 'x' };
    expect(toCoverRow('p', { ...image, backKind: 'design' }).back_kind).toBe('none');
    expect(toCoverRow('p', { ...DEFAULT_SIMPLE_COVER, backKind: 'design', backImagePath: 'y' }))
      .toMatchObject({ back_kind: 'design', back_image_path: '' });
    expect(toCoverRow('p', { ...image, backKind: 'image', backImagePath: 'y' }))
      .toMatchObject({ back_kind: 'image', back_image_path: 'y' });
  });

  it('선생님 이름을 다듬고 상한에서 자른다', () => {
    expect(toCoverRow('p', { ...DEFAULT_SIMPLE_COVER, teacher: ' 송알 ' }).teacher).toBe('송알');
    expect(toCoverRow('p', { ...DEFAULT_SIMPLE_COVER, teacher: '가'.repeat(60) }).teacher).toHaveLength(COVER_TEACHER_MAX);
  });

  it('조회 컬럼이 저장하는 칸을 전부 담는다 — 빠지면 저장한 값을 다시 읽지 못한다', () => {
    const columns = COVER_COLUMNS.split(',').map((c) => c.trim());
    expect(columns.sort()).toEqual(Object.keys(toCoverRow('p', DEFAULT_SIMPLE_COVER)).sort());
  });
});

describe('sql/70 거울', () => {
  it('디자인 기본값이 앱 기본값과 같다', () => {
    const sql = readFileSync(path.resolve(__dirname, '../../../sql/70_problem_paper_cover_layout.sql'), 'utf8');
    expect(sql).toContain(`DEFAULT '${DEFAULT_SIMPLE_COVER.layout}'`);
  });
});

describe('sql/75 거울', () => {
  const sql = readFileSync(path.resolve(__dirname, '../../../sql/75_problem_paper_cover_back_teacher.sql'), 'utf8');
  const list = (values: readonly string[]) => values.map((v) => `'${v}'`).join(', ');

  it('디자인 CHECK(정본) · 뒷표지 종류 CHECK 가 앱 목록과 같다', () => {
    expect(sql).toContain(`CHECK (layout IN (${list(COVER_LAYOUTS)}))`);
    expect(sql).toContain(`CHECK (back_kind IN (${list(BACK_COVER_KINDS)}))`);
  });

  it('기본값 · 선생님 이름 상한 · 그림 뒷표지 · 디자인 뒷표지 규칙이 앱과 같다', () => {
    expect(sql).toContain(`back_kind TEXT NOT NULL DEFAULT '${DEFAULT_SIMPLE_COVER.backKind}'`);
    expect(sql).toContain("teacher TEXT NOT NULL DEFAULT ''");
    expect(sql).toContain(`CHECK (length(teacher) <= ${COVER_TEACHER_MAX})`);
    expect(sql).toContain("CHECK (back_kind <> 'image' OR back_image_path <> '')");
    expect(sql).toContain("CHECK (back_kind <> 'design' OR kind = 'simple')");
  });
});

describe('sql/61 거울', () => {
  it('글자 수 상한이 DB CHECK 와 같다', () => {
    const sql = readFileSync(path.resolve(__dirname, '../../../sql/61_problem_paper_covers.sql'), 'utf8');
    expect(sql).toContain(`CHECK (length(title) <= ${COVER_TITLE_MAX})`);
    expect(sql).toContain(`CHECK (length(subtitle) <= ${COVER_SUBTITLE_MAX})`);
  });
});
