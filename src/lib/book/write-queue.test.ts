import { describe, expect, it } from 'vitest';
import { allBookWritesSettled, bookWritesSettled, enqueueBookWrite } from './write-queue';

function deferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('enqueueBookWrite', () => {
  it('같은 책·같은 줄은 차례대로, 앞 일이 실패해도 뒤 일은 돈다', async () => {
    const order: string[] = [];
    const first = deferred();
    const a = enqueueBookWrite('q1', 'fields', async () => { order.push('a 시작'); await first.promise; order.push('a 끝'); });
    const b = enqueueBookWrite('q1', 'fields', async () => { order.push('b'); });
    await flush();
    expect(order).toEqual(['a 시작']);
    first.reject(new Error('실패'));
    await expect(a).rejects.toThrow('실패');
    await b;
    expect(order).toEqual(['a 시작', 'b']);
  });

  it('다른 책·다른 줄은 서로 기다리지 않는다', async () => {
    const hold = deferred();
    void enqueueBookWrite('q2', 'fields', () => hold.promise);
    let other = false;
    let chapters = false;
    await enqueueBookWrite('q3', 'fields', async () => { other = true; });
    await enqueueBookWrite('q2', 'chapters', async () => { chapters = true; });
    expect(other).toBe(true);
    expect(chapters).toBe(true);
    hold.resolve();
  });
});

describe('bookWritesSettled', () => {
  it('그 책의 두 줄에 세워진 일이 다 끝나야 풀린다(실패해도 풀린다)', async () => {
    const fields = deferred();
    const chapters = deferred();
    void enqueueBookWrite('q4', 'fields', () => fields.promise).catch(() => {});
    void enqueueBookWrite('q4', 'chapters', () => chapters.promise);
    let settled = false;
    void bookWritesSettled('q4').then(() => { settled = true; });
    fields.reject(new Error('x'));
    await flush();
    expect(settled).toBe(false);
    chapters.resolve();
    await flush();
    expect(settled).toBe(true);
  });

  it('줄이 비었으면 바로 풀린다', async () => {
    await expect(bookWritesSettled('없는 책')).resolves.toBeUndefined();
  });
});

describe('allBookWritesSettled', () => {
  it('어느 책이든 세워진 일이 다 끝나야 풀린다', async () => {
    const hold = deferred();
    void enqueueBookWrite('q5', 'fields', () => hold.promise);
    let settled = false;
    void allBookWritesSettled().then(() => { settled = true; });
    await flush();
    expect(settled).toBe(false);
    hold.resolve();
    await flush();
    expect(settled).toBe(true);
  });
});
