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

/**
 * 한 단계(모델 응답 하나·묶음 실행 하나)가 낼 수 있는 경고 수.
 * JSON 스키마의 `maxItems` 이기도 하다 — 모델이 폭주해도 화면·DB 를 지킨다.
 */
export const OCR_MAX_WARNINGS = 20;

/**
 * 합쳐 둔 최종 경고 수의 상한.
 *
 * 단계별 상한(20)보다 큰 이유: 경고가 이제 **항목마다 따로** 붙는다(어느 문항 얘기인지
 * 알려야 하므로 하나로 뭉칠 수 없다). 30문항 시험지에서 선지 빠짐이 여러 개면
 * 20 에서 잘려 뒤쪽 문항의 문제가 통째로 안 보인다.
 */
export const OCR_MAX_MERGED_WARNINGS = 60;

/**
 * 묶음이 이 개수를 넘으면 시작 전에 사람에게 확인받는다.
 * 묶음 하나 = 선생님 ChatGPT 1회라, 30쪽짜리를 무심코 누르면 15회가 나간다.
 */
export const OCR_CONFIRM_BATCH_THRESHOLD = 3;

/**
 * 본문 HTML 한 덩어리의 상한(글자).
 *
 * ⚠️ 예전 값은 6,000 이었고 **말없이 잘렸다.** 쪽을 넘어가는 고전소설·장문 독서 지문이
 *    여기서 뒷부분을 잃었는데, 파서가 `slice` 만 하고 아무 말도 하지 않아
 *    "AI 가 안 읽었다" 와 "우리가 잘랐다" 를 구분할 방법이 없었다.
 *    지금은 넉넉히 두고, 그래도 넘으면 **반드시 경고**한다(parse.ts).
 *
 * DB 쪽 제약은 없다(`html`·`stem_html` 은 그냥 TEXT).
 */
export const OCR_HTML_MAX = 20000;

/**
 * 2단 조판 쪽을 **단별 이미지 두 장**으로 갈라 보낼 것인가.
 *
 * 켜는 이유가 둘이다:
 *  ① **읽는 순서.** 쪽 전체를 한 장으로 보내면 시각 모델이 왼쪽 단 첫 줄 다음에
 *     오른쪽 단 첫 줄을 읽어 두 글을 한 문단으로 섞는 일이 있다. 단을 갈라 보내면
 *     읽을 순서가 하나뿐이라 그 실수가 구조적으로 사라진다.
 *  ② **글자 크기.** 단 이미지는 세로가 쪽과 같고 가로만 절반이라, 배율을 올려도
 *     인코딩 사다리의 `maxSide`(긴 변 = 세로)에 걸리지 않는다 — A4 기준 단 하나가
 *     595px 에서 892px 로 넓어진다(pdfPages.ts `COLUMN_SCALE`).
 *
 * 대가는 이미지 장수가 두 배라는 것이다(묶음 3쪽이면 6장, `MAX_TURN_IMAGES` 8 안).
 * 쪽당 바이트 예산은 그대로 나눠 쓰므로 묶음 총량은 변하지 않는다.
 *
 * 홈(단 사이 여백)을 못 찾은 쪽은 **가르지 않는다** — 1단 조판을 반으로 자르면
 * 모든 줄이 두 동강 난다.
 */
export const OCR_SPLIT_COLUMNS = true;

/**
 * 한 항목에서 받아들일 그림 수.
 *
 * 국어 시험지의 한 문항·지문에 그림이 셋을 넘는 일은 드물다. 상한을 두는 이유는
 * 모델이 글자 덩어리를 그림으로 잘못 보고 좌표를 잔뜩 낼 때 크롭이 폭주하는 것을
 * 막기 위해서다(그림 하나가 Storage 업로드 한 번이다).
 *
 * 사람이 검수에서 더 붙일 수는 있다 — 그쪽 상한은 `MAX_FIGURES`(figure-placeholders.ts).
 */
export const OCR_MAX_FIGURES_PER_ITEM = 3;
