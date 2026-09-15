import type { MatchSignal, QuizReferenceKind } from './types';

/** 참고자료 찾기·붙이기의 정책값 */

/**
 * 자동으로 붙이는 최대 건수.
 *
 * 세 건인 까닭: 지문 상한(40,000)에 자료 상한(15,000)을 셋 더해도 합 상한
 * (`PASSAGE_QUIZ_BUNDLE_LIMIT`, 100,000) 안이라, **자동만으로는 절대 못 보내는 일이 없다.**
 */
export const QUIZ_REFERENCE_MAX_AUTO = 3;

/** 직접 더한 것까지 합친 최대 건수 */
export const QUIZ_REFERENCE_MAX_TOTAL = 5;

/** 신호 하나가 긁어 오는 후보의 최대 줄 수 */
export const QUIZ_REFERENCE_CANDIDATE_LIMIT = 20;

/**
 * 작품명으로 찾으려면 최소 이 글자 수는 돼야 한다.
 *
 * 한 글자 제목('봄')으로 `ilike` 를 돌리면 그 글자가 든 자료가 전부 걸려 온다 —
 * 점수가 높게 나와 **엉뚱한 자료가 자동으로 붙는다.**
 */
export const QUIZ_MATCH_TITLE_MIN = 2;

/**
 * 신호마다의 무게.
 *
 * 작품명이 압도적인 까닭: 같은 작품을 다룬 자료가 곧 쓸모 있는 자료다. 단원·학교는
 * "같은 시험 범위" 라는 약한 신호이고, 본문에 이름이 스쳐 지나가는 것은 가장 약하다.
 */
export const MATCH_WEIGHTS: Record<MatchSignal, number> = {
  title: 5,
  unit: 4,
  school: 3,
  author: 2,
  body: 2,
};

/**
 * 종류에 주는 덤.
 *
 * 개념지·전문이 앞서는 까닭: 그 둘은 **가르치려고 만든 글**이라 화자·정서·표현법처럼
 * 지문만으로는 물을 수 없는 내용이 들어 있다. 기출 지문은 대개 같은 글의 다른 판본이라
 * 새로 얻는 것이 적다.
 */
export const KIND_BONUS: Record<QuizReferenceKind, number> = {
  sheet: 1,
  text: 1,
  print: 0,
  passage: 0,
};

/**
 * 이 점수 아래는 자동으로 붙이지 않는다.
 *
 * 약한 신호 하나(본문에 이름이 스침·지은이만 같음)로 붙이면, 아무 상관 없는 자료가
 * 프롬프트를 차지하고 그 자료에서 근거를 끌어온 문항이 나온다.
 *
 * ⚠️ **종류 덤(`KIND_BONUS`)을 더하기 *전*의 신호 점수와 견준다**(코덱스 리뷰). 덤까지 더해
 *    비교하면 `지은이만 같은 전문`(2+1)과 `본문에 이름만 스친 개념지`(2+1)가 문턱을 넘어,
 *    막으려던 바로 그 '약한 신호 하나' 가 통과한다 — 같은 지은이의 **다른 작품**이 자동으로
 *    붙고 프롬프트는 그 자료를 근거로 써도 된다고 말한다. 덤은 **줄 세울 때만** 쓴다.
 */
export const MATCH_MIN_SCORE = 3;
