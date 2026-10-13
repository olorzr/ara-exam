import { describe, expect, it } from 'vitest';
import {
  COVER_TOPICS_MAX, coverFillText, coverYearOf, splitSubtitle, toCoverLayoutProps,
} from './cover-text';

describe('splitSubtitle', () => {
  it('첫 줄은 과정, 둘째 줄부터는 단원', () => {
    expect(splitSubtitle('고등 1학년 · 국어\n화자와 정서\n이미지와 감각')).toEqual({
      course: '고등 1학년 · 국어', topics: ['화자와 정서', '이미지와 감각'],
    });
  });

  it('옛 한 줄 부제는 통째로 과정이다', () => {
    expect(splitSubtitle('2학기 중간고사 대비 3회')).toEqual({ course: '2학기 중간고사 대비 3회', topics: [] });
  });

  it('빈 줄·앞뒤 공백·CRLF 를 걷는다', () => {
    expect(splitSubtitle('  \r\n 과정 \r\n\r\n 단원 하나 \n  ')).toEqual({ course: '과정', topics: ['단원 하나'] });
  });

  it('단원이 상한을 넘으면 넘친 것을 마지막 단원에 잇는다 — 글자는 버리지 않는다', () => {
    const lines = Array.from({ length: 40 }, (_, i) => `단${i + 1}`);
    const { topics } = splitSubtitle(['과정', ...lines].join('\n'));
    expect(topics).toHaveLength(COVER_TOPICS_MAX);
    expect(topics.slice(0, COVER_TOPICS_MAX - 1)).toEqual(lines.slice(0, COVER_TOPICS_MAX - 1));
    expect(topics[COVER_TOPICS_MAX - 1]).toBe(lines.slice(COVER_TOPICS_MAX - 1).join(' · '));
  });

  it('비었으면 둘 다 비었다', () => {
    expect(splitSubtitle('')).toEqual({ course: '', topics: [] });
  });
});

describe('coverYearOf', () => {
  it('문제지를 만든 해', () => {
    expect(coverYearOf('2026-06-15T03:00:00+00:00')).toBe('2026');
  });

  it('읽을 수 없으면 비운다', () => {
    expect(coverYearOf('')).toBe('');
    expect(coverYearOf(undefined)).toBe('');
    expect(coverYearOf('아무거나')).toBe('');
  });
});

describe('coverFillText', () => {
  it('조각을 이어 붙여 정한 길이를 넘을 때까지 되풀이한다', () => {
    const text = coverFillText(['현대시', '', ' 화자 '], 30, '대신');
    expect(text.startsWith('현대시, 화자. 현대시, 화자. ')).toBe(true);
    expect(text.length).toBeGreaterThanOrEqual(30);
  });

  it('조각이 모두 비면 대신할 글을 쓴다', () => {
    expect(coverFillText(['', ' '], 6, 'ARA')).toBe('ARA. ARA. ');
  });
});

describe('toCoverLayoutProps', () => {
  it('부제를 나눠 함께 싣고 원문도 남긴다', () => {
    expect(toCoverLayoutProps({ title: '제목', subtitle: '과정\n단원', showNameBox: true, year: '2026' })).toEqual({
      title: '제목', subtitle: '과정\n단원', course: '과정', topics: ['단원'], showNameBox: true, year: '2026',
    });
  });
});
