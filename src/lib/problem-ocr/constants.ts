/**
 * 기출 OCR 정책값.
 *
 * 여기 있는 숫자는 전부 **정책**이지 프로토콜 한계가 아니다.
 * 와이어 클램프는 `src/lib/ai/codex/protocol.ts` 의 `MAX_TURN_IMAGES`(8) 하나뿐이다.
 */

/**
 * 한 묶음(= ChatGPT 1회)에 실을 쪽 수.
 *
 * 정답표 읽기(ara-system)는 5쪽을 쓰지만 여기서는 **3쪽**이다 —
 * 국어 기출은 지문을 통째로 옮겨 적어야 해서 **출력 토큰이 지연을 지배한다**.
 * 3쪽이면 지문 2~3개 + 문항 10여 개, 대략 1만 토큰 안팎의 출력이 된다.
 * 쪽을 늘리면 turn 하나가 길어져 워치독에 걸리기 쉽고, 중간에 실패하면 잃는 것도 커진다.
 */
export const OCR_PAGES_PER_BATCH = 3;

/**
 * 묶음끼리 겹쳐 읽는 쪽 수.
 *
 * 지문은 쪽 경계를 자주 넘는데(2단 조판에서 흔하다), 겹치지 않으면 어느 묶음도
 * 그 지문을 통째로 보지 못해 **양쪽에서 반씩 잘린 지문 두 개**가 만들어진다.
 * 1쪽만 겹쳐도 경계를 넘는 지문 하나는 반드시 한 묶음 안에 온전히 들어온다.
 * 대가는 ChatGPT 호출 수가 늘어나는 것이라(3쪽·겹침1 = 2쪽마다 1회) 2 이상으로 올리지 않는다.
 */
export const OCR_BATCH_OVERLAP = 1;

/**
 * 이 turn 의 워치독(ms). 정답표 읽기(`60초 + 30초×장`)보다 훨씬 넉넉하다 —
 * 지문 전사는 출력이 10배 가까이 길다.
 * 전역 `TURN_TIMEOUT_MS` 를 올리지 않는 이유는 죽은 연결을 포기하는 시간까지
 * 같이 늘어나기 때문이다(localClient 주석 참조).
 * @param pageCount - 이 묶음의 쪽 수
 * @returns 밀리초 예산 (최대 8분)
 */
export function ocrTurnBudgetMs(pageCount: number): number {
  return Math.min(480_000, 90_000 + 120_000 * Math.max(1, pageCount));
}

/** 정답표 페이지는 출력이 짧다 — 실측된 조합(5장·짧은 출력)을 그대로 쓴다 */
export const ANSWER_KEY_PAGES_PER_BATCH = 5;

/**
 * 정답표 turn 예산. ara-system 정답표 경로에서 검증된 식이다.
 * @param pageCount - 이 묶음의 쪽 수
 * @returns 밀리초 예산 (최대 5분)
 */
export function answerKeyTurnBudgetMs(pageCount: number): number {
  return Math.min(300_000, 60_000 + 30_000 * Math.max(1, pageCount));
}

/** 한 묶음에서 받아들일 최대 항목 수 — 모델이 폭주해도 화면·DB 를 지킨다 */
export const OCR_MAX_ITEMS_PER_BATCH = 60;

/** 경고 표시 상한. 병합도 같은 상한을 써야 목록이 무한정 늘지 않는다 */
export const OCR_MAX_WARNINGS = 20;

/**
 * 묶음이 이 개수를 넘으면 시작 전에 사람에게 확인받는다.
 * 묶음 하나 = 선생님 ChatGPT 1회라, 30쪽짜리를 무심코 누르면 15회가 나간다.
 */
export const OCR_CONFIRM_BATCH_THRESHOLD = 3;
