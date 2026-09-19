import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  bulkAddBlockMessage, bulkAddToast, folderTooBigMessage, PAPER_MAX_ITEMS,
} from './bulk-add';

/**
 * `create_problem_paper` 의 **정식 정의** — 그 함수를 담은 sql 파일 중 번호가 가장 큰 것.
 *
 * 파일 이름을 박아 두지 않는 까닭: 이 함수는 마이그레이션을 더할 때마다 새 파일로 복사되는데
 * (17 → 23 → 34 → 35 …), 이름을 박으면 다음 복사본이 상한을 바꿔도 이 검사가 **옛 파일만**
 * 보고 통과한다 — 그러면 검사가 있으나 마나다.
 */
function latestRpcSource(): string {
  const dir = join(__dirname, '../../../sql');
  // ⚠️ **숫자로** 세운다. 사전순으로 세우면 언젠가 `100_…` 이 `99_…` 보다 앞에 서서
  //    옛 정의를 보고 통과한다(코덱스 리뷰 3R)
  const files = readdirSync(dir)
    .filter((name) => /^\d+_.*\.sql$/.test(name))
    .sort((a, b) => Number.parseInt(b, 10) - Number.parseInt(a, 10));
  for (const name of files) {
    const text = readFileSync(join(dir, name), 'utf8');
    if (text.includes('FUNCTION exam.create_problem_paper')) return text;
  }
  throw new Error('create_problem_paper 를 담은 sql 파일을 찾지 못했다');
}

describe('PAPER_MAX_ITEMS', () => {
  /**
   * ⚠️ 이 값이 서버와 갈리면 화면은 담게 해 놓고 **저장에서 튕긴다**(그때는 순서까지 손본
   *    뒤다). 숫자를 한 번 더 적어 두는 것으로는 못 잡는다 — RPC 가 바뀌어도 그 리터럴은
   *    그대로이기 때문이다. **정식 정의 파일을 실제로 읽어** 대조한다.
   */
  it('DB(RPC) 상한과 같다 — 정식 정의를 직접 읽어 대조한다', () => {
    expect(latestRpcSource()).toContain(`v_count < 1 OR v_count > ${PAPER_MAX_ITEMS}`);
  });
});

describe('bulkAddBlockMessage', () => {
  it('상한 안이면 막지 않는다', () => {
    expect(bulkAddBlockMessage(0, 200)).toBeNull();
    expect(bulkAddBlockMessage(190, 10)).toBeNull();
  });

  it('넘치면 지금 개수·담으려는 개수·남은 자리를 모두 말한다', () => {
    const message = bulkAddBlockMessage(12, 300);
    expect(message).toContain('200문항');
    expect(message).toContain('12개');
    expect(message).toContain('300개');
    expect(message).toContain('188개');
  });

  it('이미 가득 찼으면 남은 자리를 말하지 않는다', () => {
    const message = bulkAddBlockMessage(200, 1);
    expect(message).toContain('가득');
    expect(message).not.toContain('0개까지만');
  });
});

describe('folderTooBigMessage', () => {
  it('상한 안의 폴더는 막지 않는다', () => {
    expect(folderTooBigMessage(200)).toBeNull();
    expect(folderTooBigMessage(0)).toBeNull();
  });

  /**
   * ⚠️ 담긴 문항 수와 **무관하게** 폴더 크기만 본다. 폴더가 상한을 넘으면 앞에서 잘라
   *    담을 수밖에 없는데, 자르면 지문에 딸린 문항이 중간에서 끊겨 저장이 다시 막힌다.
   */
  it('넘치면 폴더 크기와 좁히는 법을 말한다', () => {
    const message = folderTooBigMessage(312);
    expect(message).toContain('312문항');
    expect(message).toContain('200문항');
    expect(message).toContain('좁혀');
  });
});

describe('bulkAddToast', () => {
  it('담은 개수를 말한다', () => {
    expect(bulkAddToast(12, 0)).toBe('12문항을 담았어요.');
  });

  /** 건너뛴 것을 안 밝히면 "12개를 골랐는데 9개만 들어갔다" 가 설명되지 않는다 */
  it('건너뛴 것이 있으면 함께 밝힌다', () => {
    expect(bulkAddToast(9, 3)).toContain('이미 담긴 3개');
  });

  it('하나도 못 담았으면 까닭을 말한다', () => {
    expect(bulkAddToast(0, 5)).toContain('이미 담겨');
    expect(bulkAddToast(0, 0)).toContain('담을 문항이 없어요');
  });
});
