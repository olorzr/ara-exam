import { describe, it, expect, vi } from 'vitest';

const removed: string[][] = [];
vi.mock('./storage', () => ({
  uploadProblemFile: vi.fn(async () => {}),
  removeProblemFiles: vi.fn(async (paths: string[]) => { removed.push(paths); }),
}));

const { dropFigure } = await import('./figure-capture');

const fig = (n: number) => `<figure data-figure="${n}"></figure>`;
const ID = '0f9c2b1a-1111-4222-8333-444455556666';

describe('dropFigure', () => {
  it('자리표시자와 경로를 함께 뺀다', () => {
    const res = dropFigure({
      index: 2,
      paths: [`problems/${ID}/figure-1.jpg`, `problems/${ID}/figure-2.jpg`],
      html: `${fig(1)}<p>글</p>${fig(2)}`,
    });
    expect(res.paths).toEqual([`problems/${ID}/figure-1.jpg`]);
    expect(res.html).toBe(`${fig(1)}<p>글</p>`);
  });

  it('⚠️ Storage 파일은 지우지 않는다 — 이미 만든 문제지가 그 경로를 스냅샷에 들고 있다', () => {
    dropFigure({
      index: 1,
      paths: [`problems/${ID}/figure-abc123def456.jpg`],
      html: fig(1),
    });
    expect(removed).toEqual([]);
  });

  it('가운데를 빼면 뒷번호가 당겨진다 — 파일 이름은 그대로다', () => {
    const paths = [
      `problems/${ID}/figure-1.jpg`,
      `problems/${ID}/figure-2.jpg`,
      `problems/${ID}/figure-3.jpg`,
    ];
    const res = dropFigure({ index: 2, paths, html: `${fig(1)}${fig(2)}${fig(3)}` });
    // 자리표시자는 1·2 로 당겨지지만, 2번이 가리키는 파일은 figure-3.jpg 다
    expect(res.html).toBe(`${fig(1)}${fig(2)}`);
    expect(res.paths).toEqual([`problems/${ID}/figure-1.jpg`, `problems/${ID}/figure-3.jpg`]);
  });

  it('못 만든 빈 자리도 뺄 수 있다', () => {
    expect(dropFigure({ index: 1, paths: [''], html: fig(1) }).paths).toEqual([]);
  });
});

describe('capturedFigurePath', () => {
  it('한 번만 쓰는 이름을 붙인다 — 순번으로 지으면 이미 만든 문제지의 그림을 덮어쓴다', async () => {
    const { capturedFigurePath, newFigureToken } = await import('./storage-paths');
    const a = capturedFigurePath('problem', ID, newFigureToken());
    const b = capturedFigurePath('problem', ID, newFigureToken());
    expect(a).not.toBe(b);
    expect(a).toMatch(new RegExp(`^problems/${ID}/figure-[0-9a-z]{12}\\.jpg$`));
  });

  it('지문은 다른 가족을 쓴다', async () => {
    const { capturedFigurePath } = await import('./storage-paths');
    expect(capturedFigurePath('passage', ID, 'abc123')).toBe(`passages/${ID}/figure-abc123.jpg`);
  });

  it('이름이 규약을 벗어나면 막는다 — 경로에 그대로 들어가는 값이다', async () => {
    const { capturedFigurePath } = await import('./storage-paths');
    expect(() => capturedFigurePath('problem', ID, '../../x')).toThrow();
    expect(() => capturedFigurePath('problem', ID, 'AB')).toThrow();
  });
});
