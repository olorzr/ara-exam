import { CHOICE_COUNT, generateChoices, getCorrectOptionNumber } from './exam-choices';

/**
 * ara-system 성적 연동으로 보내는 문항 한 개.
 *
 * 주관식(뜻 보고 단어 쓰기)과 객관식(5지선다) **두 벌**을 함께 싣는다.
 * 어느 쪽으로 채점할지는 시험을 만들 때가 아니라 **채점할 때** 고르므로,
 * 양쪽 정답을 다 보내 두고 ara-system 이 `answer_key[].dual` 로 보관한다.
 */
export interface VocabWordPayload {
  no: number;
  /** 주관식 정답 = 단어 */
  answer: string;
  type: '주관식';
  /** 객관식 정답 = 보기 번호 '1'~'5'. 선지를 못 만든 문항에서는 생략된다. */
  mcAnswer?: string;
  /** 선지 5개(라벨 ①~⑤ 순). `mcAnswer` 와 항상 함께 있거나 함께 없다. */
  choices?: string[];
}

/** `exam_words` 스냅샷 중 선지 재현에 필요한 최소 컬럼. */
export interface VocabPayloadRow {
  id: string;
  word: string;
  meaning: string;
  order_index: number;
}

/**
 * 시험지와 **완전히 같은** 선지·정답을 서버에서 재현해 연동 payload 를 만든다.
 *
 * 객관식 정답(①~⑤)은 DB 에 저장되지 않고 `exam-choices` 가 매번 결정론적으로 재계산한다.
 * 그래서 이 함수는 화면(`MultipleChoiceView`)과 **같은 입력**을 줘야 한다:
 *   - `rows` 는 `exam_words` 를 `order_index` 오름차순으로 읽은 **전체** 배열
 *   - 시드는 `rows[i].id`(= `exam_words` 행 PK, `word_id` 아님), 문항 인덱스는 **배열 위치**
 *
 * ⚠️ 셔플을 여기서 다시 구현하지 말 것 — `exam-choices` 를 그대로 호출해야 시험지와 답이 맞는다.
 */
export function buildVocabWords(rows: readonly VocabPayloadRow[]): VocabWordPayload[] {
  assertCanonicalOrder(rows);

  return rows.map((row, idx) => {
    const base: VocabWordPayload = {
      no: idx + 1,
      answer: row.word,
      type: '주관식',
    };

    // 선지가 5개를 못 채우면(같은 표기 단어가 많아 dedupe 후 모자란 경우 등) 그 문항만
    // 객관식 정보를 뺀다 — 4지선다로 잘린 정답표를 내보내는 것보다 주관식으로만 남기는 게 낫다.
    const choices = generateChoices(row, rows, idx);
    if (choices.length !== CHOICE_COUNT) return base;

    return {
      ...base,
      mcAnswer: getCorrectOptionNumber(row, rows, idx),
      choices: choices.map((c) => c.word),
    };
  });
}

/**
 * `rows[i].order_index === i` 를 확인한다.
 *
 * `create_exam_with_words` 가 `order_index = ordinality - 1` 로 넣고 `exam_words` 는 RLS 로 쓰기가
 * 잠겨 있어 정상이라면 항상 참이다. 어긋난 채 넘어가면 **인쇄된 시험지와 정답표가 조용히
 * 달라지므로**(선지 시드가 배열 위치를 쓴다) 여기서 멈추는 것이 유일한 탐지 장치다.
 */
function assertCanonicalOrder(rows: readonly VocabPayloadRow[]): void {
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].order_index !== i) {
      throw new Error(
        `exam_words 순서가 어긋났습니다: rows[${i}].order_index=${rows[i].order_index} (기대값 ${i}). ` +
          '정답표가 시험지와 달라질 수 있어 중단합니다.',
      );
    }
  }
}
