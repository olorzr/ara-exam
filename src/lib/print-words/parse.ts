import type { WordEntry } from '@/components/words';
// 순수 함수만 가져온다 — 배럴(`@/lib/concept-pick`)을 타면 이 파서가 브라우저 전용 모듈을 끌고 온다
import { foldStrict } from '@/lib/concept-pick/fold';
import {
  PRINT_MEANING_MAX, PRINT_WORD_MAX, PRINT_WORDS_MAX_COUNT,
} from './constants';

/**
 * 단어 응답을 검증한다 (순수 함수).
 *
 * 스키마는 모양만 강제하므로 **말이 되는지**는 여기서 본다. 반드시 막아야 하는 것 셋:
 *  ① 뜻이 빈 항목 — 등록하지 않고 **목록으로 돌려준다**(사람에게 알릴 재료다).
 *     `words.meaning` 은 NOT NULL 인데 CHECK 가 없어, 공백만 든 값도 그대로 들어간다.
 *  ② 본문에 없는 말 — 모델이 사전에서 가져온 것이라 프린트와 어긋난다.
 *  ③ 같은 단어 중복 — `UNIQUE(category_id, word)` 라 어차피 뒤엣것이 조용히 버려진다.
 */

/** 왜 뺐는지 — "몇 개는 왜 안 들어갔는지" 를 설명할 재료다 */
export interface PrintWordsDropped {
  /** 뜻이 프린트에 안 적혀 있던 단어들 (이름을 그대로 보여 준다) */
  noMeaning: string[];
  /** 뜻이 **본문에 없는** 말이던 단어들 — 모델이 사전에서 가져왔다는 뜻이다 */
  unverified: string[];
  /** 본문에 그 글자가 없었다 */
  notInText: number;
  /** 같은 단어가 두 번 왔다 */
  duplicate: number;
  /** 모양이 안 맞는다(빈 값·너무 김·줄바꿈) */
  malformed: number;
}

export interface PrintWordsResult {
  entries: WordEntry[];
  dropped: PrintWordsDropped;
}

export interface PrintWordsParseContext {
  /** 프린트 본문의 평문 — '본문에 있는가' 판정의 기준 */
  plain: string;
}

/** 줄바꿈·연속 공백을 한 칸으로 — 단어장 한 줄에 들어가야 하고, 본문 대조의 기준도 이것이다 */
function tidyMeaning(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** 끝에 붙는 마침표만 떼고 본다 — 프린트의 '…함.' 과 모델의 '…함' 은 같은 뜻이다 */
function withoutTrailingStop(value: string): string {
  return value.replace(/[.。·]+$/, '').trim();
}

/**
 * 이 뜻이 **프린트에 실제로 인쇄돼 있는가**.
 *
 * ⚠️ 단어만 대조하면 모자란다. `경외` 가 본문에 있기만 하면 모델이 사전에서 가져온 풀이
 *    (`존경하고 두려워함`)가 그대로 등록돼, "뜻은 지어내지 않는다" 는 계약이 깨진다
 *    (코덱스 리뷰 P2). 본문도 공백을 접어 비교해야 프린트에서 줄이 바뀐 뜻을 놓치지 않는다.
 */
function meaningIsPrinted(meaning: string, foldedPlain: string): boolean {
  if (foldedPlain.includes(meaning)) return true;
  const trimmed = withoutTrailingStop(meaning);
  if (trimmed !== '' && foldedPlain.includes(trimmed)) return true;
  // 표에 실린 뜻은 평문에서 `| 단어 | 뜻 |` 로 오고, 뜻이 두 칸·두 줄에 걸쳐 있으면 그 사이에
  // 우리가 넣은 기호가 낀다. 그 기호 때문에 멀쩡한 뜻이 '지어낸 것' 으로 몰리면 안 된다.
  // ⚠️ **`foldStrict` 여야 한다**(코덱스 리뷰 2R). 공백까지 지우는 세기로 견주면
  //    '아버지 가방에' 가 '아버지가 방에' 와 같아지고 '-3' 이 '3' 과 같아져,
  //    프린트에 없는 뜻이 그대로 등록된다 — 이 함수가 막으려던 바로 그 일이다
  const folded = foldStrict(trimmed === '' ? meaning : trimmed);
  return folded !== '' && foldStrict(foldedPlain).includes(folded);
}

/**
 * 응답 JSON 을 검증해 등록할 단어 목록으로.
 * @param raw - 검증 전 JSON 문자열
 * @param ctx - 본문 평문
 * @returns 등록할 단어와 뺀 이유. 모양이 깨졌으면 null
 */
export function parsePrintWords(
  raw: string,
  ctx: PrintWordsParseContext,
): PrintWordsResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const value = parsed as Record<string, unknown>;
  if (!Array.isArray(value.words)) return null;

  const seen = new Set<string>();
  const entries: WordEntry[] = [];
  const dropped: PrintWordsDropped = {
    noMeaning: [], unverified: [], notInText: 0, duplicate: 0, malformed: 0,
  };
  // 본문도 같은 규칙으로 접어 둔다 — 뜻이 프린트에서 줄바꿈으로 갈려 있어도 찾아야 한다
  const foldedPlain = tidyMeaning(ctx.plain);

  for (const item of value.words) {
    if (entries.length >= PRINT_WORDS_MAX_COUNT) break;
    if (!item || typeof item !== 'object') {
      dropped.malformed += 1;
      continue;
    }
    const row = item as Record<string, unknown>;
    const word = typeof row.word === 'string' ? row.word.trim() : '';

    if (word === '' || word.length > PRINT_WORD_MAX || /[\r\n\t]/.test(word)) {
      dropped.malformed += 1;
      continue;
    }
    if (seen.has(word)) {
      dropped.duplicate += 1;
      continue;
    }
    // 본문에 없는 말은 모델이 밖에서 가져온 것이다 — 프린트에 없는 단어를 외우게 된다
    if (!ctx.plain.includes(word)) {
      seen.add(word);
      dropped.notInText += 1;
      continue;
    }

    const meaning = tidyMeaning(typeof row.meaning === 'string' ? row.meaning : '');
    if (meaning === '') {
      // 뜻은 지어내지 않는다 — 등록하지 않고 사람에게 이름을 보여 준다
      seen.add(word);
      dropped.noMeaning.push(word);
      continue;
    }
    // 프린트에 없는 뜻이면 모델이 지어낸 것이다 — 단어가 본문에 있다는 것만으로는 모자라다
    if (!meaningIsPrinted(meaning, foldedPlain)) {
      seen.add(word);
      dropped.unverified.push(word);
      continue;
    }

    seen.add(word);
    entries.push({ word, meaning: meaning.slice(0, PRINT_MEANING_MAX) });
  }

  return { entries, dropped };
}
