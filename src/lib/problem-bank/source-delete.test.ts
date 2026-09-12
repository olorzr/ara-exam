import { describe, it, expect } from 'vitest';
import { sourceDeleteConfirmMessage, sourceRefetchChunks } from './source-delete';

const base = {
  title: '상현중 2학기 기말',
  status: '검수중' as const,
  problemCount: 12,
  paperCount: 0,
};

describe('sourceDeleteConfirmMessage', () => {
  it('제목과 문항 수를 적는다', () => {
    const msg = sourceDeleteConfirmMessage(base);
    expect(msg).toContain('상현중 2학기 기말');
    expect(msg).toContain('12개');
  });

  it('문항이 0개여도 개수를 적는다 — 취소된 업로드를 지울 때 그게 안심할 근거다', () => {
    expect(sourceDeleteConfirmMessage({ ...base, problemCount: 0 })).toContain('0개');
  });

  it('담긴 문제지가 없으면 문제지 얘기를 꺼내지 않는다', () => {
    expect(sourceDeleteConfirmMessage(base)).not.toContain('문제지');
  });

  it('담긴 문제지가 있으면 개수와 스냅샷 안내를 붙인다', () => {
    const msg = sourceDeleteConfirmMessage({ ...base, paperCount: 3 });
    expect(msg).toContain('문제지 3개');
    expect(msg).toContain('스냅샷이라 그대로 인쇄됩니다');
  });

  it("'추출중' 일 때만 아직 도는 읽기를 알린다", () => {
    expect(sourceDeleteConfirmMessage({ ...base, status: '추출중' }))
      .toContain('저장되지 못해요');
    expect(sourceDeleteConfirmMessage({ ...base, status: '완료' }))
      .not.toContain('저장되지 못해요');
  });

  it('되돌릴 수 없다는 말은 늘 있다', () => {
    for (const status of ['업로드', '추출중', '검수중', '완료'] as const) {
      expect(sourceDeleteConfirmMessage({ ...base, status })).toContain('되돌릴 수 없어요');
    }
  });
});

describe('sourceRefetchChunks', () => {
  it('상한 안이면 한 번에 받는다', () => {
    expect(sourceRefetchChunks(1, 33)).toEqual([{ page: 0, span: 1 }]);
    expect(sourceRefetchChunks(33, 33)).toEqual([{ page: 0, span: 33 }]);
  });

  it('상한을 넘으면 나눈다 — 한 번에 청하면 1,000행에서 말없이 잘린다', () => {
    expect(sourceRefetchChunks(34, 33)).toEqual([
      { page: 0, span: 33 },
      { page: 33, span: 1 },
    ]);
  });

  it('여러 번 나눠도 범위가 이어지고 겹치지 않는다', () => {
    const chunks = sourceRefetchChunks(70, 33);
    expect(chunks).toEqual([
      { page: 0, span: 33 },
      { page: 33, span: 33 },
      { page: 66, span: 4 },
    ]);
    // 합이 원래 범위와 같아야 한 쪽도 빠지지 않는다
    expect(chunks.reduce((sum, c) => sum + c.span, 0)).toBe(70);
    chunks.forEach((c, i) => {
      if (i > 0) expect(c.page).toBe(chunks[i - 1].page + chunks[i - 1].span);
    });
  });

  it('0 이나 음수여도 최소 한 쪽은 읽는다 — 빈 목록을 띄우면 안 된다', () => {
    expect(sourceRefetchChunks(0, 33)).toEqual([{ page: 0, span: 1 }]);
    expect(sourceRefetchChunks(-5, 33)).toEqual([{ page: 0, span: 1 }]);
  });
});
