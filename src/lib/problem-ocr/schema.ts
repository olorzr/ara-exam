import type { QuestionType } from '@/types/problem-bank';
import {
  OCR_HTML_MAX, OCR_MAX_FIGURES_PER_ITEM, OCR_MAX_ITEMS_PER_BATCH, OCR_MAX_WARNINGS,
} from './constants';
import type { DraftWarning } from './warnings';

/**
 * 기출 OCR 의 구조화 출력 계약.
 *
 * `turn/start` 의 `outputSchema` 로 보내면 모델이 이 모양의 JSON **문자열**을 돌려준다.
 * 스키마가 강제하는 것은 모양뿐이고, 값이 말이 되는지는 `parse.ts` 가 다시 본다.
 *
 * 규약(구조화 출력 엄격 모드):
 *  - `additionalProperties: false`
 *  - **모든 속성을 `required` 에** 넣는다. 선택값은 빼는 게 아니라 nullable 타입으로 둔다
 *    (엄격 모드는 속성 누락을 거부한다).
 */

/**
 * 항목이 쪽 어디에 있는지.
 *
 * x/y/w/h 네 숫자를 요구하지 않는 이유: 시각 모델의 좌표는 부정확하고, 국어 시험지는
 * 거의 항상 2단 조판이라 **어느 단인지 + 세로 구간**만 알면 충분히 잘라 낼 수 있다.
 * 가로는 단 폭 전체를 쓴다(여백 포함).
 */
export interface OcrBox {
  /** 0 = 쪽 전체 폭, 1 = 왼쪽 단, 2 = 오른쪽 단 */
  column: 0 | 1 | 2;
  /** 쪽 높이 대비 시작 위치 (0~1) */
  top: number;
  /** 쪽 높이 대비 끝 위치 (0~1) */
  bottom: number;
}

/** 모델이 읽어 낸 항목 하나 (지문 또는 문항) */
export interface OcrItem {
  kind: 'passage' | 'problem';
  /** 이 묶음 안에서만 유효한 참조 이름 ('P1', 'Q3') */
  ref: string;
  /** 실제 쪽 번호 (프롬프트가 알려준 값 중 하나) */
  page: number;
  box: OcrBox | null;
  /** 문항이 딸린 지문의 ref. 지문이 없으면 null */
  passage_ref: string | null;
  /** 원본 시험지의 문항 번호 */
  number: number | null;
  /** 지문 머리글 범위 ('[1~3]') */
  label: string | null;
  /** 작품명·글 제목 */
  title: string | null;
  author: string | null;
  /** 지문 본문 HTML */
  html: string;
  /** 앞 쪽에서 이어진 지문(머리글이 없다) */
  continued: boolean;
  /** 이 쪽 끝에서 다음 쪽으로 이어진다 */
  continues: boolean;
  question_type: QuestionType;
  /** 발문 HTML (문항 번호 제외) */
  stem_html: string;
  /** 선지 본문 (①~⑤ 기호 제외) */
  choices: string[];
  /** 같은 쪽에 인쇄된 정답표에서 읽은 값. 없으면 null */
  answer: string | null;
  /** 표·그림이 있어 글로 다 옮기지 못했다 → 이미지 출제 후보 */
  has_figure: boolean;
  /**
   * 글로 못 옮기는 **그림·표 부분만**의 위치들.
   *
   * 항목 전체(`box`)와 다르다 — 그림만 잘라 본문의 **제자리**에 끼우려는 것이다.
   * 본문 HTML 의 `<figure data-figure="n">` 자리표시자와 순서로 짝을 이룬다
   * (figures[0] 이 1번).
   */
  figures: OcrBox[];
  work_title: string | null;
  /** 영역 세트 트리의 이름 경로. 해당 없으면 빈 배열 */
  area_path: string[];
  /** 교과서 단원 트리의 이름 경로 [대단원, 소단원]. 해당 없으면 빈 배열 */
  unit_path: string[];
  /**
   * 문법 분류 — **여기만 경로가 여러 개**다(한 문항이 개념 두셋을 걸친다).
   *
   * ⚠️ **JSON 스키마와 모양이 다르다.** 모델에게는 배열의 배열(`[['단어','품사','명사']]`)로
   *    받는다 — 마디를 하나씩 내야 트리와 대조하기 쉽다. 그것을 `parse.ts` 가 저장 모양인
   *    경로 문자열(`['단어 > 품사 > 명사']`)로 접는다. 이 타입은 **접은 뒤**의 모양이다.
   */
  grammar_paths: string[];
}

/**
 * 한 묶음의 읽기 결과.
 *
 * 경고가 `DraftWarning` 인 이유: 이 단계에서는 아직 **행 id 가 없다**(id 는 병합이 만든다).
 * 어느 항목 얘기인지는 묶음 지역 이름(`ref`)으로만 말할 수 있고, 병합이 그것을 id 로 바꾼다.
 */
export interface OcrDraft {
  items: OcrItem[];
  warnings: DraftWarning[];
}

/**
 * 정답표 페이지에서 읽은 정답 한 줄.
 * 배점은 읽지 않는다(2026-09-08) — 인쇄에 쓰지 않으므로 물어볼 이유가 없다.
 */
export interface AnswerKeyRow {
  no: number;
  answer: string;
}

/** 정답표 읽기 결과 */
export interface AnswerKeyDraft {
  answers: AnswerKeyRow[];
  warnings: DraftWarning[];
}

const nullableString = { type: ['string', 'null'] };
const nullableInteger = { type: ['integer', 'null'] };

/** 기출 문항·지문 추출 스키마 */
export const PROBLEM_OCR_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items', 'warnings'],
  properties: {
    items: {
      type: 'array',
      maxItems: OCR_MAX_ITEMS_PER_BATCH,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'kind', 'ref', 'page', 'box', 'passage_ref', 'number', 'label', 'title', 'author',
          'html', 'continued', 'continues', 'question_type', 'stem_html', 'choices',
          'answer', 'has_figure', 'figures', 'work_title', 'area_path', 'unit_path',
          'grammar_paths',
        ],
        properties: {
          kind: { type: 'string', enum: ['passage', 'problem'] },
          ref: { type: 'string', maxLength: 16 },
          page: { type: 'integer', minimum: 1 },
          box: {
            type: ['object', 'null'],
            additionalProperties: false,
            required: ['column', 'top', 'bottom'],
            properties: {
              column: { type: 'integer', enum: [0, 1, 2] },
              top: { type: 'number', minimum: 0, maximum: 1 },
              bottom: { type: 'number', minimum: 0, maximum: 1 },
            },
          },
          passage_ref: { ...nullableString, maxLength: 16 },
          number: { ...nullableInteger, minimum: 1 },
          label: { ...nullableString, maxLength: 40 },
          title: { ...nullableString, maxLength: 120 },
          author: { ...nullableString, maxLength: 60 },
          html: { type: 'string', maxLength: OCR_HTML_MAX },
          continued: { type: 'boolean' },
          continues: { type: 'boolean' },
          question_type: { type: 'string', enum: ['객관식', '주관식', '서술형'] },
          stem_html: { type: 'string', maxLength: OCR_HTML_MAX },
          choices: {
            type: 'array',
            maxItems: 5,
            items: { type: 'string', maxLength: 600 },
          },
          answer: { ...nullableString, maxLength: 200 },
          has_figure: { type: 'boolean' },
          // 항목 전체가 아니라 **그림 부분만**의 자리. box 와 같은 모양이다
          figures: {
            type: 'array',
            maxItems: OCR_MAX_FIGURES_PER_ITEM,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['column', 'top', 'bottom'],
              properties: {
                column: { type: 'integer', enum: [0, 1, 2] },
                top: { type: 'number', minimum: 0, maximum: 1 },
                bottom: { type: 'number', minimum: 0, maximum: 1 },
              },
            },
          },
          work_title: { ...nullableString, maxLength: 120 },
          // 빈 배열이 "해당 없음"이다 — nullable 배열은 엄격 모드에서 다루기 번거롭다
          area_path: {
            type: 'array',
            maxItems: 4,
            items: { type: 'string', maxLength: 60 },
          },
          unit_path: {
            type: 'array',
            maxItems: 2,
            items: { type: 'string', maxLength: 80 },
          },
          // 배열의 배열 — 경로 하나가 [대분류, 중분류, 개념] 이고 그것을 여러 개 낸다
          grammar_paths: {
            type: 'array',
            maxItems: 3,
            items: {
              type: 'array',
              maxItems: 3,
              items: { type: 'string', maxLength: 60 },
            },
          },
        },
      },
    },
    warnings: {
      type: 'array',
      maxItems: OCR_MAX_WARNINGS,
      items: { type: 'string', maxLength: 300 },
    },
  },
} as const;

/** 정답표 페이지 전용 스키마 (본문 없이 번호·정답·배점만) */
export const ANSWER_KEY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['answers', 'warnings'],
  properties: {
    answers: {
      type: 'array',
      maxItems: 300,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['no', 'answer'],
        properties: {
          no: { type: 'integer', minimum: 1 },
          answer: { type: 'string', maxLength: 200 },
        },
      },
    },
    warnings: {
      type: 'array',
      maxItems: OCR_MAX_WARNINGS,
      items: { type: 'string', maxLength: 300 },
    },
  },
} as const;
