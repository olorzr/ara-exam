import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  RINGS_TITLE_STEPS, SKETCH_GRID_TOPICS, basicCoverBudget, basicCoverScale,
  editorialTitleScale, ringsTitleScale, sketchGridTopics, sketchKicker, sketchTitleScale, sketchTopicScale,
} from './cover-fit';
import { SOFT_BODY_TOPICS, softBodyBudget, softFootNotes, softScales } from './cover-fit-soft';
import {
  SPINE_TITLE_BOXES, spinesCourseLines, spinesCourseScale, spinesHeadScale, spinesListBudget, spinesTitleScales,
  spinesTopicScale,
} from './cover-fit-spines';
import { textBlocksHeight, wrappedLineCount } from './cover-scale';
import { toCoverLayoutProps } from './cover-text';

const NORMAL = toCoverLayoutProps({
  title: '현대시 읽기',
  subtitle: '고등 1학년 · 국어 · 2학기\n화자와 정서\n이미지와 감각',
  showNameBox: true,
  year: '2026',
});
const word = (n: number, ch = '가') => ch.repeat(n);

describe('보통 표지는 시안 크기 그대로', () => {
  it('간단·에디토리얼·링·책등·블러·스케치', () => {
    expect(basicCoverScale(NORMAL)).toBe(1);
    expect(editorialTitleScale(NORMAL.title)).toBe(1);
    expect(ringsTitleScale(NORMAL.title)).toBe(1);
    // 굵은 책등(60px · 자간 0.35em)은 시안에서 '읽기' 두 글자만 담던 칸이라 여섯 자부터 줄어든다
    expect(spinesTitleScales('봄봄')).toEqual({ thin: 1, bold: 1, wide: 1 });
    expect(spinesTitleScales(NORMAL.title)).toMatchObject({ thin: 1, wide: 1 });
    expect(spinesTopicScale(NORMAL)).toBe(1);
    expect(sketchTitleScale(NORMAL)).toBe(1);
    expect(sketchTopicScale(sketchGridTopics(NORMAL.topics))).toBe(1);
    expect(softScales(NORMAL).title).toBe(1);
  });
});

describe('간단 — 제목과 부제를 함께 줄여 이름 칸을 종이 안에 둔다(코덱스 2R)', () => {
  // 13자 낱말 일곱(97자) 제목 + 과정 · 17자 낱말 둘짜리 단원 다섯 · 17자 단원 하나(200자 안)
  const title = Array.from({ length: 7 }, () => word(13)).join(' ');
  const subtitle = ['과정', ...Array.from({ length: 5 }, () => `${word(17, '나')} ${word(17, '다')}`), word(17, '라')]
    .join('\n');
  const p = toCoverLayoutProps({ title, subtitle, showNameBox: true, year: '2026' });

  it('입력이 상한 안이다', () => {
    expect(title.length).toBe(97);
    expect(subtitle.length).toBeLessThanOrEqual(200);
  });

  it('배율을 줄이고, 그 배율의 높이가 자리 안이다', () => {
    const scale = basicCoverScale(p);
    expect(scale).toBeLessThan(1);
    const { blocks, height } = basicCoverBudget(p);
    expect(textBlocksHeight(blocks, 1)).toBeGreaterThan(height);
    expect(textBlocksHeight(blocks, scale)).toBeLessThanOrEqual(height);
  });

  it('이름 칸을 끄면 자리가 넓다', () => {
    expect(basicCoverBudget({ ...p, showNameBox: false }).height).toBeGreaterThan(basicCoverBudget(p).height);
  });
});

describe('블러 — 제목과 단원 줄을 함께 바닥 글 위에 둔다(코덱스 2R)', () => {
  const long = Array(6).fill(word(15)).join(' ');
  const p = toCoverLayoutProps({ title: long, subtitle: `과정\n${long}\n${long}`, showNameBox: true, year: '2026' });

  it('셋을 함께 줄이고, 그 크기의 높이가 자리 안이다', () => {
    const { title, topic } = softScales(p);
    const budget = softBodyBudget(p);
    expect(title).toBeLessThan(budget.title);
    const k = title / budget.title;
    expect(textBlocksHeight(budget.blocks, k)).toBeLessThanOrEqual(budget.height);
    expect(topic).toBeLessThanOrEqual(title);
  });

  it('바닥 글은 컴포넌트와 같은 줄이다 — 셋째 단원부터 잇는다', () => {
    const q = { ...NORMAL, topics: ['가', '나', '다', '라'] };
    expect(SOFT_BODY_TOPICS).toBe(2);
    expect(softFootNotes(q)).toEqual(['아라국어논술 · 고등 1학년 · 국어 · 2학기', '2026학년도', '다 · 라', '수업용 문제지 · 외부 배포 금지']);
    expect(softFootNotes({ ...q, year: '', course: '', topics: [] })).toEqual(['아라국어논술', '수업용 문제지 · 외부 배포 금지']);
  });
});

describe('스케치·에디토리얼·링 — 긴 낱말 제목도 띠 안에', () => {
  const title = Array.from({ length: 7 }, () => word(13)).join(' ');

  it('단계표만 쓸 때보다 더 줄인다', () => {
    expect(sketchTitleScale({ title, course: '' })).toBeLessThan(0.5);
    expect(editorialTitleScale(title)).toBeLessThan(0.5);
    expect(ringsTitleScale(title)).toBeLessThanOrEqual(RINGS_TITLE_STEPS[RINGS_TITLE_STEPS.length - 1].scale);
  });

  it('스케치 단원은 넷을 넘으면 마지막 칸에 잇고, 긴 칸은 글자를 줄인다', () => {
    expect(SKETCH_GRID_TOPICS).toBe(4);
    expect(sketchGridTopics(['가', '나', '다', '라', '마'])).toEqual(['가', '나', '다', '라 · 마']);
    expect(sketchTopicScale([word(190)])).toBeLessThan(0.5);
  });
});

describe('코덱스 3R — 제목 아래·위의 다른 글줄이 늘면 그만큼 자리를 줄인다', () => {
  it('스케치: 과정 줄이 길어 여러 줄이면 제목을 더 줄인다', () => {
    const title = Array.from({ length: 5 }, () => word(17)).join(' ');
    const short = sketchTitleScale({ title, course: '고등 1학년' });
    const long = sketchTitleScale({ title, course: word(195, '나') });
    expect(long).toBeLessThan(short);
    expect(sketchKicker('')).toBe('아라국어논술');
    expect(sketchKicker('고등')).toBe('아라국어논술 · 고등');
  });

  it('책등: 과정 조각이 많으면 과정 상자 글을 줄인다', () => {
    expect(spinesCourseScale(spinesCourseLines('고등 1학년 · 국어 · 2학기'))).toBe(1);
    const many = spinesCourseLines(Array(25).fill('국어').join(' · '));
    expect(many).toHaveLength(25);
    expect(spinesCourseScale(many)).toBeLessThan(1);
    expect(spinesCourseLines('')).toEqual(['국어', '논술']);
  });

  it('책등: 머리 제목·정보 줄이 길면 단원 목록 자리가 준다', () => {
    const base = spinesListBudget(NORMAL);
    // 머리 줄이 세 줄이 되는 제목(13자 낱말 일곱 + 꼬리) — 두 줄까지는 최소 높이 70px 안이다
    expect(spinesListBudget({ ...NORMAL, title: word(100) })).toBe(base);
    const threeLines = `${Array.from({ length: 7 }, () => word(13)).join(' ')} - 교사용`;
    expect(spinesListBudget({ ...NORMAL, title: threeLines })).toBeLessThan(base);
    expect(spinesListBudget({ ...NORMAL, course: word(195, '나') })).toBeLessThan(base);
    // 이름·날짜 칸이 없으면 정보 줄이 넓어 같은 과정이 한 줄에 든다
    expect(spinesListBudget({ ...NORMAL, showNameBox: false, course: word(40, '나') }))
      .toBeGreaterThan(spinesListBudget({ ...NORMAL, course: word(40, '나') }));
  });
});

describe('책등 세로 제목 — 어떤 낱말 모양의 100자 제목 + 꼬리도 세 책 모두 칸 안에(코덱스 4R)', () => {
  it.each(Object.keys(SPINE_TITLE_BOXES) as (keyof typeof SPINE_TITLE_BOXES)[])('%s', (key) => {
    const box = SPINE_TITLE_BOXES[key];
    for (let len = 1; len <= 40; len += 1) {
      const words: string[] = [];
      while (words.join(' ').length + len + 1 <= 100) words.push(word(len));
      const title = `${words.join(' ')} - 교사용`;
      const size = box.fontSize * spinesTitleScales(title)[key];
      const columns = Math.max(1, Math.floor(box.width / (size * box.lineHeight)));
      expect(wrappedLineCount(title, box.height / (size * (1 + box.letterSpacing))), `낱말 ${len}자`)
        .toBeLessThanOrEqual(columns);
    }
  });
});

describe('표지 제목을 비우고 문제지 제목이 아주 길 때(길이 상한 없음, 코덱스 5R)', () => {
  const long = `${word(500)} - 교사용`;
  const p = toCoverLayoutProps({ title: long, subtitle: '과정\n단원', showNameBox: true, year: '2026' });

  it('책등 셋 모두 칸 안에', () => {
    const scales = spinesTitleScales(long);
    for (const key of Object.keys(SPINE_TITLE_BOXES) as (keyof typeof SPINE_TITLE_BOXES)[]) {
      const box = SPINE_TITLE_BOXES[key];
      const size = box.fontSize * scales[key];
      expect(wrappedLineCount(long, box.height / (size * (1 + box.letterSpacing))), key)
        .toBeLessThanOrEqual(Math.max(1, Math.floor(box.width / (size * box.lineHeight))));
    }
  });

  it('간단 표지도 자리 안에', () => {
    const { blocks, height } = basicCoverBudget(p);
    expect(textBlocksHeight(blocks, basicCoverScale(p))).toBeLessThanOrEqual(height);
  });

  it('블러도 자리 안에', () => {
    const budget = softBodyBudget(p);
    const k = softScales(p).title / budget.title;
    expect(textBlocksHeight(budget.blocks, k)).toBeLessThanOrEqual(budget.height);
  });
});

describe('책등 — 아주 긴 제목·과정에도 단원 목록과 책장 자리가 남는다(코덱스 6R)', () => {
  const title = Array(24).fill(word(28)).join(' ');
  const subtitle = `${Array(11).fill(word(16, '나')).join(' ')}\n단원`;
  const p = toCoverLayoutProps({ title: `${title} - 교사용`, subtitle, showNameBox: true, year: '2026' });

  it('머리·정보 줄을 줄여 목록 자리를 270px 넘게 남기고, 단원 글자는 시안 크기 그대로', () => {
    expect(spinesHeadScale(p)).toBeLessThan(1);
    expect(spinesListBudget(p)).toBeGreaterThan(270);
    expect(spinesTopicScale(p)).toBe(1);
  });

  it('보통 표지는 머리·정보 줄을 줄이지 않는다', () => {
    expect(spinesHeadScale(NORMAL)).toBe(1);
    expect(spinesHeadScale({ ...NORMAL, course: word(40, '나') })).toBe(1);
  });
});

describe('자리 수치가 CSS 와 같다', () => {
  const css = (f: string) => readFileSync(join(process.cwd(), 'src/styles', f), 'utf8');
  it('간단 여백 · 에디토리얼 제목 띠 · 블러 제목 띠 · 스케치 칸 폭', () => {
    expect(css('paper-cover.css')).toContain('padding: 72px 76px 60px');
    expect(css('paper-covers/editorial.css')).toMatch(/height: 330px;\s+padding: 40px 32px 0;/);
    expect(css('paper-covers/soft.css')).toMatch(/left: 40px;\s+right: 40px;\s+top: 470px;/);
    // 블러 태그라인 높이(위 여백 64px)는 SOFT_TAGLINE_H 와 같고, 제목 뒤 번짐 모서리는 고정 px 다(% 면 긴 제목에서 커진다)
    expect(css('paper-covers/soft.css')).toMatch(/\.pbc-soft__tagline \{\s+padding-top: 64px;/);
    expect(css('paper-covers/soft.css')).toMatch(/\.pbc-soft__headline::before \{[^}]*border-radius: \d+px;/);
    expect(css('paper-covers/sketch.css')).toContain('max-width: 190px');
    expect(css('paper-covers/sketch.css')).toMatch(/top: 210px;/);
  });
});
