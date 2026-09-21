import type { ExamWord } from '@/types';

/** 객관식 선지 수 */
export const CHOICE_COUNT = 5;

/** 선지 라벨 (원문자) */
export const CHOICE_LABELS = ['①', '②', '③', '④', '⑤'] as const;

/**
 * FNV-1a 문자열 해시. 시드와 섞어 32-bit 정수를 돌려준다.
 * char code 단순 합보다 분포가 넓어 mulberry32 초기값의 편향을 줄인다.
 */
function fnv1a(str: string, seed: number): number {
  let h = (2166136261 ^ seed) >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * mulberry32 PRNG. 32-bit 시드로 [0, 1) 난수를 생성한다.
 * glibc LCG 는 하위 비트 편향이 심해 `% N` 에서 쏠림이 생기므로 대신 사용한다.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 시드 기반 Fisher-Yates 셔플. 같은 시드면 항상 같은 순서를 보장한다.
 */
function seededShuffle<T>(arr: readonly T[], seed: number): T[] {
  const result = [...arr];
  const rand = mulberry32(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export interface Choice {
  label: string;
  word: string;
  isCorrect: boolean;
}

/**
 * 선지 생성에 실제로 필요한 최소 필드.
 * 시드가 `id`(= exam_words 행 PK), 표시가 `word` 뿐이라 이 둘이면 충분하다.
 * 화면은 `ExamWord` 를 그대로 넘기고(구조적 부분타입), 서버는 스냅샷 일부만 읽어 넘길 수 있다.
 */
export type ChoiceSeedWord = Pick<ExamWord, 'id' | 'word'>;

/**
 * 문항별 5지선다 선지를 생성한다.
 * 정답 1개 + 같은 시험의 다른 단어 중 (CHOICE_COUNT - 1) 개를 방해지(distractor) 로 뽑아 섞는다.
 * 결정론적이어서 시험지/답안지 양쪽이 동일한 결과를 갖는다.
 */
export function generateChoices(
  currentWord: ChoiceSeedWord,
  allWords: readonly ChoiceSeedWord[],
  questionIndex: number,
): Choice[] {
  // 방해지는 표시 문자열(word)로 노출되므로 word 기준으로 중복을 제거한다.
  // 같은 단어가 여러 행(다중 카테고리)에 있으면 정답과 똑같이 보이는 오답이
  // 섞이거나 동일 오답이 중복되어 문항이 모호해지는 것을 막는다.
  const seed = fnv1a(currentWord.id, questionIndex);
  const seenWords = new Set<string>([currentWord.word]);
  const others: ChoiceSeedWord[] = [];
  for (const w of allWords) {
    if (w.id === currentWord.id) continue;
    if (seenWords.has(w.word)) continue;
    seenWords.add(w.word);
    others.push(w);
  }

  const shuffledOthers = seededShuffle(others, seed);
  const distractors = shuffledOthers.slice(0, CHOICE_COUNT - 1);

  const choices: Choice[] = [
    { label: '', word: currentWord.word, isCorrect: true },
    ...distractors.map((d) => ({ label: '', word: d.word, isCorrect: false })),
  ];

  // 정답 위치를 섞을 땐 방해지 선택과 다른 시드를 써야 상관관계가 사라진다
  const shuffled = seededShuffle(choices, (seed + 1) >>> 0);
  return shuffled.map((c, i) => ({ ...c, label: CHOICE_LABELS[i] }));
}

/**
 * 해당 문항의 정답 라벨(①~⑤) 을 반환한다.
 */
export function getCorrectLabel(
  currentWord: ChoiceSeedWord,
  allWords: readonly ChoiceSeedWord[],
  questionIndex: number,
): string {
  const choices = generateChoices(currentWord, allWords, questionIndex);
  const correct = choices.find((c) => c.isCorrect);
  return correct ? correct.label : '';
}

/**
 * 해당 문항의 정답을 **보기 번호 문자열**('1'~'5') 로 반환한다.
 *
 * OMR 채점(ara-system `gradeAnswers`)은 학생 답을 `'1'`~`'5'` 로 읽으므로 정답표도 같은 표기여야
 * 한다 — 원문자 '①' 를 그대로 보내면 전 문항 오답이 된다.
 * ⚠️ 라벨→번호 변환을 호출부에 복사하지 말 것. 두 곳이 어긋나면 시험지와 정답표가 조용히 달라진다.
 */
export function getCorrectOptionNumber(
  currentWord: ChoiceSeedWord,
  allWords: readonly ChoiceSeedWord[],
  questionIndex: number,
): string {
  const label = getCorrectLabel(currentWord, allWords, questionIndex);
  const idx = (CHOICE_LABELS as readonly string[]).indexOf(label);
  if (idx < 0) {
    // generateChoices 는 정답을 항상 선지에 포함하므로 여기에 오면 그 불변식이 깨진 것이다.
    // 조용히 '0' 같은 값을 흘리면 정답표 전체가 오답이 되므로 즉시 멈춘다.
    throw new Error(`정답 라벨을 보기 번호로 바꾸지 못했습니다: ${JSON.stringify(label)}`);
  }
  return String(idx + 1);
}
