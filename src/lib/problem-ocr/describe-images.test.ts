import { describe, it, expect } from 'vitest';
import { describeImages, imageLabel, PROBLEM_SPLIT_RULES } from './describe-images';

describe('imageLabel', () => {
  it('쪽과 단을 사람 말로 적는다', () => {
    expect(imageLabel({ page: 4, part: 'full' })).toBe('4쪽 전체');
    expect(imageLabel({ page: 4, part: 'left' })).toBe('4쪽 왼쪽 단');
    expect(imageLabel({ page: 4, part: 'right' })).toBe('4쪽 오른쪽 단');
  });

  it('위·아래로 나눈 장도 사람 말로 적는다 (프린트 읽기만 만든다)', () => {
    expect(imageLabel({ page: 4, part: 'top' })).toBe('4쪽 위쪽');
    expect(imageLabel({ page: 4, part: 'bottom' })).toBe('4쪽 아래쪽');
    expect(imageLabel({ page: 4, part: 'left-top' })).toBe('4쪽 왼쪽 단 위쪽');
    expect(imageLabel({ page: 4, part: 'left-bottom' })).toBe('4쪽 왼쪽 단 아래쪽');
    expect(imageLabel({ page: 4, part: 'right-top' })).toBe('4쪽 오른쪽 단 위쪽');
    expect(imageLabel({ page: 4, part: 'right-bottom' })).toBe('4쪽 오른쪽 단 아래쪽');
  });
});

describe('describeImages', () => {
  it('한 쪽 = 한 장이면 쪽 번호만 알린다', () => {
    const lines = describeImages([4, 5], [{ page: 4, part: 'full' }, { page: 5, part: 'full' }]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('4·5쪽');
  });

  it('rendered 를 안 주면 한 쪽 = 한 장으로 본다 (옛 호출부)', () => {
    expect(describeImages([4, 5])[0]).toContain('4·5쪽');
  });

  it('단을 갈라 보내면 장마다 무엇인지 밝힌다 — 어긋나면 내용이 엉뚱한 쪽에 기록된다', () => {
    const lines = describeImages([4], [{ page: 4, part: 'left' }, { page: 4, part: 'right' }]);
    expect(lines[0]).toContain('1번=4쪽 왼쪽 단');
    expect(lines[0]).toContain('2번=4쪽 오른쪽 단');
    expect(lines[1]).toContain('한 쪽이 두 장');
  });

  it('문서 종류별 규칙은 호출자가 넘긴다 — 프린트 읽기에 기출 필드를 설명하면 안 된다', () => {
    const withRules = describeImages([4], [{ page: 4, part: 'left' }], PROBLEM_SPLIT_RULES);
    expect(withRules.join('\n')).toContain('continued·continues');

    const bare = describeImages([4], [{ page: 4, part: 'left' }]);
    expect(bare.join('\n')).not.toContain('continued');
    expect(bare.join('\n')).not.toContain('box 의 column');
  });

  it('안 갈랐으면 규칙을 넘겨도 붙이지 않는다 — 없는 상황을 설명하면 혼란만 준다', () => {
    const lines = describeImages([4], [{ page: 4, part: 'full' }], PROBLEM_SPLIT_RULES);
    expect(lines).toHaveLength(1);
  });

  it('위·아래로 나눠 보내면 잇는 법과 **두 번 적지 말 것**을 알린다', () => {
    const lines = describeImages([4], [{ page: 4, part: 'top' }, { page: 4, part: 'bottom' }]);
    const text = lines.join('\n');
    expect(lines[0]).toContain('1번=4쪽 위쪽');
    expect(lines[0]).toContain('2번=4쪽 아래쪽');
    expect(text).toContain('잘린 글줄은 없다');
    expect(text).toContain('두 번 적지 않는다');
    // 단을 안 갈랐으면 단 얘기는 하지 않는다 — 없는 상황을 설명하면 모델이 헷갈린다
    expect(text).not.toContain('왼쪽 단');
  });

  it('단과 위아래를 함께 가르면 "한 쪽이 두 장" 이라고 말하지 않는다 — 넷이다', () => {
    const lines = describeImages([4], [
      { page: 4, part: 'left-top' }, { page: 4, part: 'left-bottom' },
      { page: 4, part: 'right-top' }, { page: 4, part: 'right-bottom' },
    ]);
    const text = lines.join('\n');
    expect(text).not.toContain('한 쪽이 두 장');
    expect(text).toContain('왼쪽 단 조각들을 다 읽은 다음');
    expect(text).toContain('두 번 적지 않는다');
  });
});
