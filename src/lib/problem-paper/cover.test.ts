import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  COVER_SUBTITLE_MAX, COVER_TITLE_MAX, DEFAULT_SIMPLE_COVER,
  coverTitleFor, normalizePaperCover, toCoverRow,
} from './cover';

const ROW = {
  paper_id: 'p', kind: 'simple', title: ' 1학기 중간 대비 ', subtitle: '3회',
  show_name_box: false, image_path: 'papers/p/cover-x.jpg', user_id: 'u',
};

describe('normalizePaperCover', () => {
  it('간단 표지 — 글자를 다듬고 그림 경로는 버린다', () => {
    expect(normalizePaperCover(ROW)).toEqual({
      kind: 'simple', title: '1학기 중간 대비', subtitle: '3회', showNameBox: false, imagePath: '',
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
});

describe('sql/61 거울', () => {
  it('글자 수 상한이 DB CHECK 와 같다', () => {
    const sql = readFileSync(path.resolve(__dirname, '../../../sql/61_problem_paper_covers.sql'), 'utf8');
    expect(sql).toContain(`CHECK (length(title) <= ${COVER_TITLE_MAX})`);
    expect(sql).toContain(`CHECK (length(subtitle) <= ${COVER_SUBTITLE_MAX})`);
  });
});
