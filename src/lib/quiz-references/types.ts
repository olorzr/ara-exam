/**
 * 참고자료 찾기·붙이기의 타입.
 *
 * 참고자료는 문제 만들기가 지문과 **함께 읽는** 글이다. 네 곳에서 온다:
 *   개념지 · 학교 프린트 시험지 원문 · 기출 지문 · 작품 전문.
 * 넷 다 이미 학원에 쌓여 있는 자료라, 새로 만들지 않고 **찾아 붙이는** 것이 이 모듈의 일이다.
 */

/** 참고자료가 어디서 왔는가 */
export type QuizReferenceKind = 'sheet' | 'print' | 'passage' | 'text';

/** 종류의 사람 말 — 화면 배지와 자료 이름 앞머리에 같이 쓴다 */
export const QUIZ_REFERENCE_KIND_LABELS: Record<QuizReferenceKind, string> = {
  sheet: '개념지',
  print: '학교 프린트',
  passage: '기출 지문',
  text: '전문',
};

/** 종류를 고를 때 보여 줄 순서 — 가르치는 자료가 먼저다 */
export const QUIZ_REFERENCE_KINDS: QuizReferenceKind[] = ['sheet', 'print', 'passage', 'text'];

/**
 * 붙일 수 있는 자료 하나 (본문은 아직 없다).
 *
 * `key` 가 자료의 정체다 — 종류가 다르면 id 가 같아도 다른 자료이고, 여러 신호가 같은
 * 자료를 찾아 왔을 때 이 값으로 합친다.
 */
export interface ReferenceCandidate {
  /** `${kind}:${id}` */
  key: string;
  kind: QuizReferenceKind;
  id: string;
  /** 화면·정답표에 찍히는 이름 (`개념지 · 봄봄`) */
  label: string;
  /** 어느 것인지 가리는 한 줄 (`2026 · 중2 · 천재(정호웅) · 1. 문학의 갈래`) */
  subtitle: string;
  /** 최근에 고친 순으로 줄 세울 때 쓴다 */
  updatedAt: string;
}

/** 무엇을 보고 이 자료를 골랐는가 */
export type MatchSignal = 'title' | 'unit' | 'school' | 'author' | 'body';

/** 신호 하나가 맞았다는 기록 */
export interface MatchHit {
  signal: MatchSignal;
  /** 사람에게 보일 까닭 한 조각 (`제목에 '봄봄'`) */
  detail: string;
}

/** 자료 하나가 신호 하나에 걸린 것 — 조회가 돌려주는 알갱이 */
export interface CandidateHit {
  candidate: ReferenceCandidate;
  hit: MatchHit;
}

/** 점수를 매겨 줄 세운 자료 */
export interface RankedReference extends ReferenceCandidate {
  score: number;
  /** 왜 골랐는지 — 자동으로 붙이려면 반드시 밝힌다 */
  reason: string;
}

/** 지금 붙어 있는 자료 */
export interface AttachedReference extends ReferenceCandidate {
  /** 왜 붙었는지. 직접 고른 것은 '직접 고름' */
  reason: string;
  /** 자동으로 붙은 것인가 (다시 찾기가 갈아 끼우는 대상) */
  auto: boolean;
  /** 본문 평문. **아직 못 읽었으면 null** — 그동안은 만들기를 막는다 */
  plain: string | null;
  /** 상한에 걸려 잘렸는가 */
  truncated: boolean;
}

/** 아카이브에서 고른 지문이 함께 들고 오는 정보 — 매칭 신호가 된다 */
export interface PickedPassageMeta {
  /** 그 지문 자신. 후보에서 뺀다 */
  id: string;
  /** 교과서 단원 이름 경로 [대단원, 소단원] */
  unitPath: string[];
  /** 교과서 이름 (개념지의 publisher 와 같은 값이다) */
  textbook: string;
  grade: string;
  schoolName: string;
  year: string;
}

/** 자료를 찾을 때 쓰는 신호 묶음 */
export interface QuizMatchSignals {
  /** 작품명 (정규화된 값). 너무 짧으면 '' */
  title: string;
  author: string;
  excludePassageId: string | null;
  /**
   * 후보에서 뺄 개념지·프린트 시험지 id.
   *
   * 학교 프린트의 문답에 모범답안을 만들 때 쓴다 — 안 빼면 **그 프린트 자신**이
   * '같은 학교 · 제목에 …' 으로 걸려 자동으로 붙는다. 자기 본문은 이미 프롬프트에
   * 통째로 실려 있어 두 번 싣는 셈이고, 답이 비어 있는 그 글이 근거 자료로 둔갑한다.
   */
  excludeSheetId: string | null;
  unitPath: string[];
  textbook: string;
  grade: string;
  schoolName: string;
  year: string;
}
