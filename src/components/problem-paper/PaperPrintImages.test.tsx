import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildPaperBlocks, imagePathsOf } from '@/lib/problem-paper/blocks';
import type { PaperItemSnapshot, PaperPassageSnapshot, PaperSettings } from '@/types/problem-bank';
import { renderPaperBlocks } from './PaperPrintBlocks';

/**
 * 인쇄 준비가 기다리는 그림 = 인쇄물에 실제로 그려지는 그림 (2026-10-15 리뷰 10번).
 *
 * 둘이 갈리면 두 방향으로 깨진다 — 더 기다리면 쓰지도 않는 그림 하나가 깨졌다고 인쇄 단추가
 * 잠기고, 덜 기다리면 서명 없는 그림이 빈칸으로 인쇄된다. 그래서 블록을 실제로 그려 본 결과와
 * `imagePathsOf` 를 **같은 집합으로** 맞춰 본다(문제지·교사용 모두).
 */

const SETTINGS: PaperSettings = { columns: 2, showScore: false, showSource: false, omr: false };

/** 자리표시자가 놓인 본문 — 글로 그릴 때 그 자리에 그림이 들어간다 */
const FIGURE_1 = '<figure data-figure="1"></figure>';

function snapshot(over: Partial<PaperItemSnapshot> = {}): PaperItemSnapshot {
  return {
    number: 1, question_type: '객관식', stem_html: `<p>물음</p>${FIGURE_1}`,
    choices: ['가', '나', '다', '라', '마'], answer: '1', score: 3, explanation_html: '',
    area_path: [], work_title: '', render_mode: 'text', image_path: '', figure_paths: [],
    passage: null,
    source: {
      source_type: '내신기출', title: '', school_name: '합성중', year: '2026', grade: '중2',
      exam_type: '중간', publisher: '',
    },
    ...over,
  };
}

function passage(over: Partial<PaperPassageSnapshot> = {}): PaperPassageSnapshot {
  return {
    id: 'p1', label: '', title: '합성 지문', author: '', html: `<p>지문</p>${FIGURE_1}`,
    render_mode: 'text', image_path: '', ...over,
  };
}

/** 그려진 HTML 에 실린 이미지 경로들 — URL 을 `https://img/{경로}` 로 서명했다고 친다 */
function renderedPaths(items: PaperItemSnapshot[], showAnswers: boolean): string[] {
  const wanted = imagePathsOf(items);
  const urls = new Map(wanted.map((p) => [p, `https://img/${p}`]));
  // 서명하지 않은 경로도 그려지는지 보려면 지도에 없는 경로까지 알아야 한다 — 모든 후보를 넣는다
  for (const item of items) {
    for (const p of [item.image_path, ...item.figure_paths, item.passage?.image_path ?? '',
      ...(item.passage?.figure_paths ?? [])]) {
      if (p) urls.set(p, `https://img/${p}`);
    }
  }
  const html = renderToStaticMarkup(<>{renderPaperBlocks({
    blocks: buildPaperBlocks(items, showAnswers), settings: SETTINGS, imageUrls: urls, showAnswers,
  })}</>);
  return [...html.matchAll(/https:\/\/img\/([^"]+)"/g)].map((m) => m[1]).filter((p, i, a) => a.indexOf(p) === i);
}

const CASES: { name: string; items: PaperItemSnapshot[] }[] = [
  {
    name: '이미지 출제 문항 + 안 쓰는 삽화',
    items: [snapshot({ render_mode: 'image', image_path: 'main.jpg', figure_paths: ['unused.jpg'] })],
  },
  {
    name: '이미지 출제 지문 + 안 쓰는 삽화',
    items: [snapshot({
      passage: passage({ render_mode: 'image', image_path: 'p-main.jpg', figure_paths: ['p-unused.jpg'] }),
    })],
  },
  {
    name: '글 출제 문항·지문 + 쓰는 삽화',
    items: [snapshot({ figure_paths: ['q-fig.jpg'], passage: passage({ figure_paths: ['p-fig.jpg'] }) })],
  },
  {
    name: '이미지 출제인데 잘라 둔 이미지가 없음(글로 폴백)',
    items: [snapshot({
      render_mode: 'image', image_path: '', figure_paths: ['q-fig.jpg'],
      passage: passage({ render_mode: 'image', image_path: '', figure_paths: ['p-fig.jpg'] }),
    })],
  },
];

describe('인쇄 준비 경로 ↔ 실제로 그려지는 그림', () => {
  for (const { name, items } of CASES) {
    for (const showAnswers of [false, true]) {
      it(`${name} — ${showAnswers ? '교사용' : '문제지'}`, () => {
        expect(renderedPaths(items, showAnswers).sort()).toEqual(imagePathsOf(items).sort());
      });
    }
  }

  it('⚠️ 이미지 출제에서 안 쓰는 삽화는 그려지지도, 기다려지지도 않는다', () => {
    const items = CASES[0].items;
    expect(renderedPaths(items, false)).not.toContain('unused.jpg');
    expect(imagePathsOf(items)).not.toContain('unused.jpg');
  });
});
