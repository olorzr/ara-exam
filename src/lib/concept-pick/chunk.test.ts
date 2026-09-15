import { describe, it, expect } from 'vitest';
import { chunkPlainText } from './chunk';

describe('chunkPlainText', () => {
  it('상한 안에 들어가면 통째로 한 묶음이다', () => {
    expect(chunkPlainText('가나다\n라마바', 100)).toEqual(['가나다\n라마바']);
  });

  it('빈 본문은 빈 배열 — 부를 쪽이 묶음 수를 0으로 본다', () => {
    expect(chunkPlainText('', 100)).toEqual([]);
    expect(chunkPlainText('\n\n  \n', 100)).toEqual([]);
  });

  it('줄 경계로만 자른다 — 표 한 행이 쪼개지면 시어와 뜻의 짝이 깨진다', () => {
    const rows = ['| 갈래 | 서정시 |', '| 성격 | 서정적 |', '| 주제 | 그리움 |'];
    const chunks = chunkPlainText(rows.join('\n'), 20);
    expect(chunks).toEqual(rows);
    for (const chunk of chunks) expect(chunk.startsWith('| ')).toBe(true);
  });

  it('상한보다 긴 줄은 쪼개지 않고 그 줄만으로 한 묶음이 된다', () => {
    const long = `| 특징 | ${'가'.repeat(200)} |`;
    expect(chunkPlainText(`짧은 줄\n${long}\n또 짧은 줄`, 30))
      .toEqual(['짧은 줄', long, '또 짧은 줄']);
  });

  it('딱 맞는 본문은 한 묶음이다 — 마지막 줄에까지 줄바꿈을 물리면 공연히 갈린다', () => {
    // '가나' + 줄바꿈 + '다라' = 5자
    expect(chunkPlainText('가나\n다라', 5)).toEqual(['가나\n다라']);
    // 한 글자만 넘으면 갈린다
    expect(chunkPlainText('가나\n다라마', 5)).toEqual(['가나', '다라마']);
  });

  it('상한을 넘기 직전까지 줄을 모은다 — 묶음 수가 곧 AI 호출 수다', () => {
    const lines = Array.from({ length: 6 }, () => '가'.repeat(9)); // 줄바꿈 포함 10자
    expect(chunkPlainText(lines.join('\n'), 20)).toHaveLength(3);
  });

  it('묶음 끝에 남은 빈 줄은 떨어져 나간다 — 모델에게 빈 줄만 보낼 이유가 없다', () => {
    expect(chunkPlainText('첫 줄\n\n둘째 줄', 5)).toEqual(['첫 줄', '둘째 줄']);
  });
});
