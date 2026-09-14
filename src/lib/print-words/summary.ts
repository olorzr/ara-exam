import type { PrintWordsMeta } from '@/types/print-scan';
import { PRINT_WORDS_SAMPLE } from './constants';

/**
 * 이 프린트가 카테고리에 올려 둔 단어 수 — **칩·단어 관리 링크·삭제 확인창의 단일 출처**다.
 *
 * ⚠️ 마지막 시도의 `registered` 를 세면 안 된다. 다시 등록하면 전부 중복이라 그 값이 0 이고
 *    (`insert_words_batch` 의 `ON CONFLICT DO NOTHING`), 다시 등록하다 **실패하면** 그 시도의
 *    숫자가 전부 0 이다. 둘 다 단어는 DB 에 그대로 있는 상태라, 그 숫자로 판단하면 칩이
 *    '단어 없음' 이 되고 삭제 확인창의 "단어는 남습니다" 안내가 사라진다 — 선생님은 단어도
 *    함께 지워진 줄 안다(코덱스 리뷰 P2). 그래서 `wordCount` 는 **줄지 않는 누적값**이다.
 * @param meta - 등록 영수증
 * @returns 올려 둔 단어 수. 등록한 적이 없으면 0
 */
export function registeredWordCount(meta: PrintWordsMeta | null | undefined): number {
  return meta?.wordCount ?? 0;
}

/**
 * 다시 등록한 뒤의 누적 단어 수 (순수 함수).
 *
 * 두 값의 **큰 쪽**을 쓴다:
 *  ① `previous + registered` — 이번에 **새로 들어간** 단어는 이전 총계에 더해진다.
 *  ② `registered + skipped` — 이번 시도가 프린트에서 찾아낸 전부. 첫 등록인데 그 단어들이
 *     이미 카테고리에 있던 경우(`registered` 가 0)를 잡는다.
 *
 * ⚠️ `Math.max(previous, registered + skipped)` 로는 **부분 겹침을 놓친다**(코덱스 리뷰 5R):
 *    10개를 등록해 둔 프린트를 다시 읽어 5개가 새로 들어가고 5개가 중복이면 DB 에는 15개가
 *    있는데 그 식은 10을 남긴다 — 칩과 삭제 안내가 함께 틀린다.
 * @param previous - 지금까지의 누적값
 * @param registered - 이번에 새로 들어간 수
 * @param skipped - 이번에 이미 있어서 건너뛴 수
 * @returns 새 누적값 (줄지 않는다)
 */
export function nextWordCount(previous: number, registered: number, skipped: number): number {
  return Math.max(previous + registered, registered + skipped);
}

/** 목록 줄에 붙일 단어 칩 */
export interface WordsChip {
  label: string;
  tone: 'ok' | 'muted' | 'error';
  /** 마우스를 올렸을 때 보일 자세한 설명 (경고 포함) */
  title: string;
}

/**
 * 단어 등록 결과를 목록 칩 한 줄로 (순수 함수).
 *
 * ⚠️ '확인 필요' 칩과 **따로 둔다.** 그쪽은 "시험지 본문을 확인하라" 는 뜻이라
 *    단어 경고를 섞으면 개수가 부풀고 무엇을 보라는 것인지 흐려진다.
 * @param meta - 영수증 (한 번도 안 돌렸으면 빈 객체)
 * @returns 칩. 아직 안 돌렸으면 null
 */
export function wordsChip(meta: PrintWordsMeta | null | undefined): WordsChip | null {
  if (!meta || !meta.status) return null;

  const kept = registeredWordCount(meta);

  if (meta.status === 'failed') {
    // 실패해도 **이미 들어간 단어는 그대로 있다** — 그 사실을 함께 밝힌다
    return {
      label: '단어 등록 실패',
      tone: 'error',
      title: [
        meta.warnings?.join('\n') || '단어를 등록하지 못했어요.',
        kept > 0 ? `이미 등록해 둔 단어 ${kept}개는 그대로 있어요.` : '',
      ].filter(Boolean).join('\n'),
    };
  }

  const noMeaning = meta.noMeaning ?? 0;
  const unverified = meta.unverified ?? 0;
  const skipped = meta.skipped ?? 0;
  const total = kept;
  const detail = [
    skipped ? `이미 있던 단어 ${skipped}개는 건너뛰었어요.` : '',
    noMeaning ? `뜻이 안 적혀 있어 뺀 단어 ${noMeaning}개가 있어요.` : '',
    unverified ? `프린트에 없는 뜻이 붙어 있어 뺀 단어 ${unverified}개가 있어요.` : '',
    ...(meta.warnings ?? []),
  ].filter(Boolean).join('\n');

  // 이번엔 못 찾았어도 **이미 올려 둔 단어가 있으면** 그 개수를 말한다
  if (total === 0) {
    return {
      label: '단어 없음',
      tone: 'muted',
      title: detail || '프린트에서 뜻이 적힌 단어를 찾지 못했어요.',
    };
  }

  return {
    label: `단어 ${total}개`,
    tone: 'ok',
    title: detail || `단어 ${total}개를 등록했어요.`,
  };
}

/**
 * 이름을 몇 개만 보여 주고 나머지는 세어 준다 — 경고 한 줄이 끝없이 길어지지 않게.
 * @param names - 보여 줄 이름들
 * @returns `'상기, 통념 외 3개'` 꼴. 비었으면 빈 문자열
 */
export function sampleNames(names: readonly string[]): string {
  if (names.length === 0) return '';
  const head = names.slice(0, PRINT_WORDS_SAMPLE).join(', ');
  const rest = names.length - PRINT_WORDS_SAMPLE;
  return rest > 0 ? `${head} 외 ${rest}개` : head;
}
