import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { layoutPhraseNotes, layoutPhraseNotesForPrint } from '@/lib/reference-texts/phrase-note-dom';
import { usePhraseNoteLayout } from './usePhraseNoteLayout';

vi.mock('@/lib/reference-texts/phrase-note-dom', async (original) => ({
  ...await original<typeof import('@/lib/reference-texts/phrase-note-dom')>(),
  layoutPhraseNotes: vi.fn(),
  layoutPhraseNotesForPrint: vi.fn(),
}));

const NOTE = '<p><span data-note="가">갑</span></p>';

function Sheet({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  usePhraseNoteLayout(ref, html);
  return <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />;
}

let resize: () => void = () => {};
let width = 500;

beforeEach(() => {
  vi.mocked(layoutPhraseNotes).mockClear();
  vi.mocked(layoutPhraseNotesForPrint).mockClear();
  width = 500;
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resize = callback; }
    observe() {}
    disconnect() {}
  });
  vi.stubGlobal('requestAnimationFrame', (run: FrameRequestCallback) => { run(0); return 1; });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ width } as DOMRect));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('usePhraseNoteLayout', () => {
  it('그릴 때 재고, 본문이 바뀌면 다시 잰다', () => {
    const { rerender } = render(<Sheet html={NOTE} />);
    expect(layoutPhraseNotes).toHaveBeenCalledTimes(1);
    rerender(<Sheet html={NOTE} />);
    expect(layoutPhraseNotes).toHaveBeenCalledTimes(1);
    rerender(<Sheet html={'<p><span data-note="나">을</span></p>'} />);
    expect(layoutPhraseNotes).toHaveBeenCalledTimes(2);
  });

  it('⚠️ 폭이 그대로면 다시 재지 않는다 — 받침이 높이를 바꿔 되먹임이 된다', () => {
    render(<Sheet html={NOTE} />);
    vi.mocked(layoutPhraseNotes).mockClear();
    resize();
    expect(layoutPhraseNotes).not.toHaveBeenCalled();
    width = 400;
    resize();
    expect(layoutPhraseNotes).toHaveBeenCalledTimes(1);
  });

  it('폭이 0 이면 재지 않는다 — 숨은 화면이다', () => {
    render(<Sheet html={NOTE} />);
    vi.mocked(layoutPhraseNotes).mockClear();
    width = 0;
    resize();
    expect(layoutPhraseNotes).not.toHaveBeenCalled();
  });

  it('인쇄 앞에 인쇄 치수로 재고, 그동안은 화면 치수로 덮지 않고, 끝나면 되돌린다', () => {
    render(<Sheet html={NOTE} />);
    vi.mocked(layoutPhraseNotes).mockClear();
    act(() => { window.dispatchEvent(new Event('beforeprint')); });
    expect(layoutPhraseNotesForPrint).toHaveBeenCalledTimes(1);
    width = 300;
    resize();
    expect(layoutPhraseNotes).not.toHaveBeenCalled();
    act(() => { window.dispatchEvent(new Event('afterprint')); });
    expect(layoutPhraseNotes).toHaveBeenCalledTimes(1);
  });

  it('풀이가 없는 본문은 인쇄에 끼어들지 않는다', () => {
    render(<Sheet html="<p>가</p>" />);
    act(() => { window.dispatchEvent(new Event('beforeprint')); });
    expect(layoutPhraseNotesForPrint).not.toHaveBeenCalled();
  });

  it('낱말 뜻풀이뿐인 본문도 인쇄에 끼어들지 않는다 — 잴 풀이가 없다', () => {
    render(<Sheet html={'<p><span data-note="뜻" data-note-kind="vocab">갑</span></p>'} />);
    act(() => { window.dispatchEvent(new Event('beforeprint')); });
    expect(layoutPhraseNotesForPrint).not.toHaveBeenCalled();
  });

  it('화면을 떠나면 인쇄를 듣지 않는다', () => {
    const { unmount } = render(<Sheet html={NOTE} />);
    unmount();
    act(() => { window.dispatchEvent(new Event('beforeprint')); });
    expect(layoutPhraseNotesForPrint).not.toHaveBeenCalled();
  });
});
