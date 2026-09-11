import { describe, it, expect, vi, beforeEach } from 'vitest';

const removed: string[][] = [];
vi.mock('./storage', () => ({
  replaceProblemFile: vi.fn(async () => {}),
  removeProblemFiles: vi.fn(async (paths: string[]) => { removed.push(paths); }),
}));

const { dropFigure } = await import('./figure-capture');

const fig = (n: number) => `<figure data-figure="${n}"></figure>`;
const ID = '0f9c2b1a-1111-4222-8333-444455556666';

beforeEach(() => { removed.length = 0; });

describe('dropFigure', () => {
  it('자리표시자와 경로를 함께 빼고 그 파일만 지운다', async () => {
    const res = await dropFigure({
      index: 2,
      paths: [`problems/${ID}/figure-1.jpg`, `problems/${ID}/figure-2.jpg`],
      html: `${fig(1)}<p>글</p>${fig(2)}`,
    });
    expect(res.paths).toEqual([`problems/${ID}/figure-1.jpg`]);
    expect(res.html).toBe(`${fig(1)}<p>글</p>`);
    expect(removed).toEqual([[`problems/${ID}/figure-2.jpg`]]);
  });

  it('가운데를 빼면 뒷번호가 당겨진다 — 파일 이름은 그대로다', async () => {
    const paths = [
      `problems/${ID}/figure-1.jpg`,
      `problems/${ID}/figure-2.jpg`,
      `problems/${ID}/figure-3.jpg`,
    ];
    const res = await dropFigure({ index: 2, paths, html: `${fig(1)}${fig(2)}${fig(3)}` });
    // 자리표시자는 1·2 로 당겨지지만, 2번이 가리키는 파일은 figure-3.jpg 다
    expect(res.html).toBe(`${fig(1)}${fig(2)}`);
    expect(res.paths).toEqual([`problems/${ID}/figure-1.jpg`, `problems/${ID}/figure-3.jpg`]);
    // ⚠️ 쓰고 있는 figure-3.jpg 를 지우면 안 된다
    expect(removed).toEqual([[`problems/${ID}/figure-2.jpg`]]);
  });

  it('같은 파일이 남아 있으면 지우지 않는다', async () => {
    const res = await dropFigure({
      index: 1,
      paths: [`problems/${ID}/figure-1.jpg`, `problems/${ID}/figure-1.jpg`],
      html: `${fig(1)}${fig(2)}`,
    });
    expect(res.paths).toHaveLength(1);
    expect(removed).toEqual([]);
  });

  it('못 만든 빈 자리를 빼도 파일을 지우려 들지 않는다', async () => {
    await dropFigure({ index: 1, paths: [''], html: fig(1) });
    expect(removed).toEqual([]);
  });
});
