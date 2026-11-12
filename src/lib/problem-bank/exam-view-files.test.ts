import { describe, expect, it } from 'vitest';
import { examImagePaths, isPdfPath, sourcePagePaths } from './exam-view-files';

const ID = '24d7c451-ad55-5b4f-9a51-9e394c35491f';

describe('examImagePaths', () => {
  it('본문 그림 전부와 이미지 출제 항목의 원본만 — 중복 없이', () => {
    expect(examImagePaths([
      { figure_paths: ['f/1.jpg', ''], image_path: 'crop/a.jpg', render_mode: 'text' },
      { figure_paths: ['f/1.jpg', 'f/2.jpg'], image_path: 'crop/b.jpg', render_mode: 'image' },
      { figure_paths: [], image_path: '', render_mode: 'image' },
    ])).toEqual(['f/1.jpg', 'f/2.jpg', 'crop/b.jpg']);
  });
});

describe('sourcePagePaths', () => {
  it('1쪽부터 쪽 수만큼', () => {
    expect(sourcePagePaths({ id: ID, page_count: 2 })).toEqual([
      `sources/${ID}/pages/1.jpg`, `sources/${ID}/pages/2.jpg`,
    ]);
  });

  it('쪽 수가 없으면 빈 배열', () => {
    expect(sourcePagePaths({ id: ID, page_count: 0 })).toEqual([]);
    expect(sourcePagePaths({ id: ID, page_count: null as unknown as number })).toEqual([]);
  });
});

describe('isPdfPath', () => {
  it('확장자로 가른다(대소문자 무시)', () => {
    expect(isPdfPath('sources/x/answer-key/1.PDF')).toBe(true);
    expect(isPdfPath('sources/x/answer-key/1.jpg')).toBe(false);
  });
});
