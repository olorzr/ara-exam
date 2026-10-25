import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EDITORIAL_TITLE_WIDTH, RINGS_TEXT_WIDTH, RINGS_TITLE_STEPS, SKETCH_BREATH, SKETCH_HEAD, basicCoverBudget, basicCoverScale,
  editorialTitleScale, editorialTopicsHeight, ringsScales, sketchHeadHeight, sketchHeadScales, sketchKicker,
} from './cover-fit';
import { SOFT_BODY, softBodyBudget, softFootNotes, softScales } from './cover-fit-soft';
import {
  SPINES_BODY, SPINE_TITLE_BOXES, spinesBodyBudget, spinesBodyScale, spinesCourseLines, spinesCourseScale,
  spinesHeadInfoHeight, spinesTeacherText, spinesTitleScales,
} from './cover-fit-spines';
import { ZINE_INFO, zineInfoScale, zineLabel, zineLabelScale, zineTitleScale } from './cover-fit-zine';
import { textBlocksHeight, wrappedLineCount } from './cover-scale';
import { toCoverLayoutProps, type CoverLayoutProps } from './cover-text';

const NORMAL = toCoverLayoutProps({
  title: '현대시 읽기',
  subtitle: '고등 1학년 · 국어 · 2학기\n화자와 정서\n이미지와 감각',
  showNameBox: true,
  year: '2026',
  teacher: '송알',
});
const word = (n: number, ch = '가') => ch.repeat(n);
const with_ = (patch: Partial<CoverLayoutProps>): CoverLayoutProps => ({ ...NORMAL, ...patch });

describe('보통 표지는 시안 크기 그대로', () => {
  it('간단·에디토리얼·링·책등·블러·스케치·라인드로잉', () => {
    expect(basicCoverScale(NORMAL)).toBe(1);
    expect(editorialTitleScale(NORMAL)).toBe(1);
    expect(ringsScales(NORMAL)).toEqual({ title: 1, topic: 1 });
    // 굵은 책등(60px · 자간 0.35em)은 시안에서 '읽기' 두 글자만 담던 칸이라 여섯 자부터 줄어든다
    expect(spinesTitleScales('봄봄')).toEqual({ thin: 1, bold: 1, wide: 1 });
    expect(spinesTitleScales(NORMAL.title)).toMatchObject({ thin: 1, wide: 1 });
    expect(spinesBodyScale(NORMAL)).toEqual({ title: 1, topic: 1 });
    // 띄어쓰기를 글자 하나로 세는 보수적 계산이라 '현대시 읽기' 한 줄을 지키려고 조금(2%) 줄인다
    expect(sketchHeadScales(NORMAL).title).toBeGreaterThanOrEqual(0.98);
    expect(sketchHeadScales(NORMAL).sub).toBeGreaterThanOrEqual(0.98);
    expect(softScales(NORMAL)).toEqual({ title: 1, topic: 1 });
    expect(zineTitleScale(NORMAL.title)).toBe(1);
    expect(zineLabelScale(zineLabel(NORMAL))).toBe(1);
    expect(zineInfoScale(NORMAL)).toBe(1);
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

describe('에디토리얼 — 괄호 단원 줄과 제목이 띠(320px) 안에 함께 든다', () => {
  it('단원 줄이 늘면 제목 자리가 준다', () => {
    expect(editorialTopicsHeight([])).toBe(0);
    expect(editorialTopicsHeight(NORMAL.topics)).toBe(24 + 24);
    const many = Array.from({ length: 6 }, () => word(30, '나'));
    expect(editorialTopicsHeight(many)).toBeGreaterThan(editorialTopicsHeight(NORMAL.topics));
    expect(editorialTitleScale({ title: NORMAL.title, topics: many })).toBeLessThan(1);
  });

  it('긴 낱말 제목도 띠 안에', () => {
    const title = Array.from({ length: 7 }, () => word(13)).join(' ');
    const scale = editorialTitleScale({ title, topics: NORMAL.topics });
    expect(scale).toBeLessThan(0.5);
    const size = 146 * scale;
    expect(wrappedLineCount(title, EDITORIAL_TITLE_WIDTH / size) * size * 0.92).toBeLessThanOrEqual(320 - editorialTopicsHeight(NORMAL.topics));
  });
});

describe('링 — 제목 · × · 단원 줄이 함께 300px 안에', () => {
  it('긴 제목은 단계표 아래까지 줄이고, 단원 줄이 늘면 더 줄인다', () => {
    const title = Array.from({ length: 7 }, () => word(13)).join(' ');
    expect(ringsScales({ title, topics: [] }).title).toBeLessThanOrEqual(RINGS_TITLE_STEPS[RINGS_TITLE_STEPS.length - 1].scale);
    const long = { title: word(30), topics: [] as string[] };
    const withTopics = { ...long, topics: Array.from({ length: 6 }, () => word(30, '나')) };
    expect(ringsScales(withTopics).title).toBeLessThan(ringsScales(long).title);
    expect(RINGS_TEXT_WIDTH).toBe(594);
  });

  it('단원이 아주 길어도 제목이 읽을 크기로 남고 둘이 함께 자리 안이다(코덱스 2R)', () => {
    const p = toCoverLayoutProps({
      title: '현대시 읽기', subtitle: ['과정', ...Array(6).fill(word(30))].join('\n'), showNameBox: true, year: '2026',
    });
    const { title, topic } = ringsScales(p);
    expect(56 * title).toBeGreaterThan(30);
    expect(topic).toBeLessThan(1);
    const line = p.topics.join(' · ');
    const titleH = wrappedLineCount(p.title, RINGS_TEXT_WIDTH / (56 * title)) * 56 * title * 1.15;
    const topicH = wrappedLineCount(line, RINGS_TEXT_WIDTH / 1.04 / (22 * topic)) * 22 * topic * 1.3;
    expect(titleH + topicH + 32 + 6).toBeLessThanOrEqual(300);
  });
});

describe('스케치 — 윤곽선 제목과 아래 묶음이 선생님·학생 칸(470px) 위에 든다', () => {
  it('과정 줄은 상표 · 과정 · 연도이고 빈 조각은 건너뛴다', () => {
    expect(sketchKicker(NORMAL)).toBe('아라국어논술 · 고등 1학년 · 국어 · 2학기 · 2026');
    expect(sketchKicker({ course: '', year: '' })).toBe('아라국어논술');
  });

  it('아래 묶음이 길어지면 제목을 더 줄인다', () => {
    const title = word(12);
    const short = sketchHeadScales({ ...NORMAL, title }).title;
    const long = sketchHeadScales({ ...NORMAL, title, topics: Array.from({ length: 6 }, () => word(30, '나')) }).title;
    expect(long).toBeLessThan(short);
  });

  it.each([
    ['긴 제목 + 긴 과정', with_({ title: Array.from({ length: 7 }, () => word(13)).join(' '), course: word(195, '나') })],
    // 코덱스 1R — 제목만 줄이면 바닥까지 줄여도 단원 줄이 칸에 닿던 199자 부제
    ['아주 긴 단원 줄', toCoverLayoutProps({
      title: '현대시 읽기', subtitle: `과\n${Array(11).fill(word(17)).join(' ')}`, showNameBox: true, year: '2026', teacher: '송알',
    })],
    ['500자 제목', with_({ title: `${word(500)} - 교사용` })],
  ])('%s도 선생님·학생 칸 위에 든다', (_name, p) => {
    expect(SKETCH_HEAD.top + sketchHeadHeight(p) + SKETCH_BREATH).toBeLessThanOrEqual(SKETCH_HEAD.gridTop);
  });

  it('단원이 아주 길면 단원·과정 줄도 함께 줄인다', () => {
    const p = toCoverLayoutProps({
      title: '현대시 읽기', subtitle: `과\n${Array(11).fill(word(17)).join(' ')}`, showNameBox: true, year: '2026',
    });
    expect(sketchHeadScales(p).sub).toBeLessThan(1);
  });
});

describe('블러 — 제목과 단원 줄을 함께 바닥 글 위에 둔다(코덱스 2R)', () => {
  const long = Array(6).fill(word(15)).join(' ');
  const p = toCoverLayoutProps({ title: long, subtitle: `과정\n${long}\n${long}`, showNameBox: true, year: '2026' });

  it('둘을 함께 줄이고, 그 크기의 높이가 자리 안이다(사이 22px 포함)', () => {
    const { title, topic } = softScales(p);
    const budget = softBodyBudget(p);
    expect(title).toBeLessThan(budget.title);
    expect(textBlocksHeight(budget.blocks, topic) + 22).toBeLessThanOrEqual(budget.height);
    // 단원 줄 글자는 제목 글자보다 크지 않다
    expect(28 * topic).toBeLessThanOrEqual(112 * title);
  });

  it('바닥 글은 컴포넌트와 같은 줄이다 — 선생님 줄은 이름이 있을 때만', () => {
    expect(softFootNotes(NORMAL)).toEqual(['선생님  송알', '아라국어논술 · 고등 1학년 · 국어 · 2학기 · 2026']);
    expect(softFootNotes({ teacher: '', course: '', year: '' })).toEqual(['아라국어논술']);
    expect(SOFT_BODY).toEqual({ top: 520, width: 706 });
  });
});

describe('책등 — 오른쪽 정렬 제목·단원 목록과 책장', () => {
  it('과정 상자는 과정을 나누고, 비면 아라 · 국어 · 논술', () => {
    expect(spinesCourseLines('고등 1학년 · 국어 · 2학기')).toEqual(['고등 1학년', '국어', '2학기']);
    expect(spinesCourseLines('')).toEqual(['아라', '국어', '논술']);
    expect(spinesCourseScale(spinesCourseLines('고등 1학년 · 국어 · 2학기'))).toBe(1);
    const many = spinesCourseLines(Array(25).fill('국어').join(' · '));
    expect(spinesCourseScale(many)).toBeLessThan(1);
  });

  it('선생님 줄 — 이름이 길면 줄이 늘고, 학생 칸이 없으면 줄이 넓다', () => {
    expect(spinesTeacherText('송알')).toBe('선생님  송알');
    expect(spinesTeacherText('')).toBe('');
    const base = spinesHeadInfoHeight(NORMAL);
    expect(spinesHeadInfoHeight({ ...NORMAL, teacher: word(40) + ' ' + word(40) })).toBeGreaterThan(base);
    expect(spinesHeadInfoHeight({ teacher: '', showNameBox: false })).toBe(base);
  });

  it('긴 제목·단원은 함께 줄여 본문 자리 안이다 — 책장 560px 은 늘 남는다', () => {
    const p = with_({ title: `${Array(24).fill(word(28)).join(' ')} - 교사용`, topics: Array(6).fill(word(40, '나')) });
    const { title, topic } = spinesBodyScale(p);
    expect(title).toBeLessThan(0.42);
    const blocks = [
      { text: p.title, fontSize: 64 * title, lineHeight: 1, width: SPINES_BODY.width },
      ...p.topics.map((text) => ({ text, fontSize: 18 * topic, lineHeight: 1.35, width: SPINES_BODY.topicWidth })),
    ];
    expect(textBlocksHeight(blocks, 1) + 2 * p.topics.length).toBeLessThanOrEqual(spinesBodyBudget(p));
    expect(spinesBodyBudget(NORMAL)).toBeGreaterThan(300);
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

describe('라인드로잉 — 제목 한 줄 · 상자 모서리 라벨 · 정보 격자', () => {
  it('라벨은 단원 줄, 없으면 과정, 그마저 없으면 문제지', () => {
    expect(zineLabel(NORMAL)).toBe('화자와 정서 · 이미지와 감각');
    expect(zineLabel({ topics: [], course: '고등' })).toBe('고등');
    expect(zineLabel({ topics: [], course: '' })).toBe('문제지');
  });

  it('라벨은 자간까지 세어 두 줄 안에 든다(코덱스 1R — 25자 한 낱말)', () => {
    const label = word(25);
    const size = 38 * zineLabelScale(label);
    expect(wrappedLineCount(label, 480 / (size * 1.02)) * size).toBeLessThanOrEqual(80);
  });

  it('긴 제목·라벨·선생님 이름·과정은 줄인다', () => {
    expect(zineTitleScale(word(20))).toBeLessThan(1);
    expect(zineLabelScale(Array(6).fill(word(20)).join(' · '))).toBeLessThan(1);
    expect(zineInfoScale(with_({ teacher: word(40) }))).toBeLessThan(1);
    expect(zineInfoScale(with_({ course: word(195, '나') }))).toBeLessThan(1);
  });

  it('정보 격자의 줄인 글은 상자2 위에 든다', () => {
    const p = with_({ course: word(195, '나') });
    const size = 16 * zineInfoScale(p);
    const lines = wrappedLineCount(`아라국어논술\n${p.course}`, ZINE_INFO.courseWidth / size);
    expect(lines * size * ZINE_INFO.lineHeight).toBeLessThanOrEqual(ZINE_INFO.height);
  });
});

describe('표지 제목을 비우고 문제지 제목이 아주 길 때(길이 상한 없음, 코덱스 5R)', () => {
  const long = `${word(500)} - 교사용`;
  const p = toCoverLayoutProps({ title: long, subtitle: '과정\n단원', showNameBox: true, year: '2026', teacher: '송알' });

  it('책등 셋 모두 칸 안에', () => {
    const scales = spinesTitleScales(long);
    for (const key of Object.keys(SPINE_TITLE_BOXES) as (keyof typeof SPINE_TITLE_BOXES)[]) {
      const box = SPINE_TITLE_BOXES[key];
      const size = box.fontSize * scales[key];
      expect(wrappedLineCount(long, box.height / (size * (1 + box.letterSpacing))), key)
        .toBeLessThanOrEqual(Math.max(1, Math.floor(box.width / (size * box.lineHeight))));
    }
  });

  it('간단·블러·책등 본문 모두 자리 안에', () => {
    const basic = basicCoverBudget(p);
    expect(textBlocksHeight(basic.blocks, basicCoverScale(p))).toBeLessThanOrEqual(basic.height);
    const soft = softBodyBudget(p);
    expect(textBlocksHeight(soft.blocks, softScales(p).topic) + 22).toBeLessThanOrEqual(soft.height);
    expect(spinesBodyScale(p).title).toBeGreaterThan(0);
    expect(zineTitleScale(long)).toBeGreaterThan(0);
  });
});

describe('자리 수치가 CSS 와 같다', () => {
  const css = (f: string) => readFileSync(join(process.cwd(), 'src/styles', f), 'utf8');
  it('간단 여백 · 에디토리얼 띠 · 링 글 폭 · 블러 본문 · 스케치 머리 · 책등 머리 · 라인드로잉 격자', () => {
    expect(css('paper-cover.css')).toContain('padding: 72px 76px 60px');
    expect(css('paper-covers/editorial.css')).toMatch(/height: 360px;\s+padding: 40px 32px 0;/);
    expect(css('paper-covers/editorial.css')).toMatch(/padding-top: 24px;[^}]*line-height: 24px;/);
    expect(css('paper-covers/editorial.css')).toMatch(/\.pbc-editorial__title \{\s+max-width: 600px;/);
    expect(css('paper-covers/rings.css')).toContain('padding: 50px 100px 80px');
    expect(css('paper-covers/soft.css')).toMatch(/left: 40px;\s+right: 48px;\s+top: 520px;/);
    expect(css('paper-covers/soft.css')).toMatch(/\.pbc-soft__tagline \{\s+padding-top: 80px;/);
    expect(css('paper-covers/soft.css')).toMatch(/\.pbc-soft__note \{\s+width: 260px;/);
    expect(css('paper-covers/sketch.css')).toMatch(/left: 44px;\s+top: 56px;\s+width: 700px;/);
    expect(css('paper-covers/sketch.css')).toMatch(/padding: 65px 0 0 6px;/);
    expect(css('paper-covers/sketch.css')).toMatch(/\.pbc-sketch__grid \{[^}]*top: 470px;/);
    expect(css('paper-covers/spines.css')).toMatch(/\.pbc-spines__head \{[^}]*height: 70px;/);
    expect(css('paper-covers/spines.css')).toMatch(/\.pbc-spines__body \{[^}]*margin: 54px 40px 0;/);
    expect(css('paper-covers/zine.css')).toMatch(/\.pbc-zine__info \{[^}]*top: 374px;/);
    expect(css('paper-covers/zine.css')).toMatch(/\.pbc-zine__box--2 \{[^}]*top: 470px;/);
  });
});
