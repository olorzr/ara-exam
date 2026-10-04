import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import PaperCoverPage, { COVER_IMAGE_FAILED_NOTICE, renderCoverSlot } from './PaperCoverPage';
import { DEFAULT_SIMPLE_COVER } from '@/lib/problem-paper/cover';

describe('PaperCoverPage', () => {
  it('간단 표지 — 제목·부제·이름 칸', () => {
    const { container } = render(
      <PaperCoverPage cover={{ ...DEFAULT_SIMPLE_COVER, subtitle: '3회' }} title="상현중 기출 - 교사용" />,
    );
    expect(container.querySelector('.pb-cover__title')!.textContent).toBe('상현중 기출 - 교사용');
    expect(container.querySelector('.pb-cover__subtitle')!.textContent).toBe('3회');
    expect(Array.from(container.querySelectorAll('.pb-cover__names dt')).map((d) => d.textContent))
      .toEqual(['학교', '학년 · 반', '이름']);
  });

  it('이름 칸을 끄면 그리지 않고, 부제가 비면 줄도 없다', () => {
    const { container } = render(
      <PaperCoverPage cover={{ ...DEFAULT_SIMPLE_COVER, showNameBox: false }} title="제목" />,
    );
    expect(container.querySelector('.pb-cover__names')).toBeNull();
    expect(container.querySelector('.pb-cover__subtitle')).toBeNull();
  });

  it('그림 표지 — 그림 하나뿐, 글은 그리지 않는다', () => {
    const { container } = render(
      <PaperCoverPage
        cover={{ ...DEFAULT_SIMPLE_COVER, kind: 'image', imagePath: 'papers/p/cover-a.jpg' }}
        title="제목" imageUrl="https://example.test/cover.jpg"
      />,
    );
    const imgs = container.querySelectorAll('img');
    expect(imgs).toHaveLength(1);
    expect(imgs[0].getAttribute('src')).toBe('https://example.test/cover.jpg');
    expect(container.querySelector('.pb-cover__title')).toBeNull();
  });

  it('그림 주소가 아직 없으면 자리 안내만 그린다', () => {
    const { container } = render(
      <PaperCoverPage cover={{ ...DEFAULT_SIMPLE_COVER, kind: 'image', imagePath: 'x' }} title="제목" />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('불러오는 중');
  });
});

describe('표지 자리 — 못 읽거나 깨졌을 때', () => {
  it('그림을 끝내 못 받았으면 깨진 그림 대신 인쇄되는 안내를 그린다', () => {
    const { container } = render(
      <PaperCoverPage
        cover={{ ...DEFAULT_SIMPLE_COVER, kind: 'image', imagePath: 'x' }}
        title="제목" imageUrl="https://example.test/cover.jpg" imageFailed
      />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe(COVER_IMAGE_FAILED_NOTICE);
    expect(container.querySelector('[data-no-print]')).toBeNull();
  });

  it('표지를 못 읽었으면 표지가 없어도 안내 한 장을 표지 자리에 둔다', () => {
    const { container } = render(<>{renderCoverSlot({ cover: null, paperTitle: 'p', suffix: '', notice: '못 읽었어요' })}</>);
    expect(container.textContent).toBe('못 읽었어요');
  });

  it('표지가 없고 안내도 없으면 표지 낱장을 그리지 않는다', () => {
    expect(renderCoverSlot({ cover: null, paperTitle: 'p', suffix: '' })).toBeUndefined();
  });

  it('교사용·답지 꼬리를 붙여 그린다', () => {
    const { container } = render(<>{renderCoverSlot({ cover: DEFAULT_SIMPLE_COVER, paperTitle: '기출', suffix: ' - 답지' })}</>);
    expect(container.querySelector('.pb-cover__title')!.textContent).toBe('기출 - 답지');
  });
});
