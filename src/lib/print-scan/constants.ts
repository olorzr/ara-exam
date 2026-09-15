/**
 * 학교 프린트 읽기의 정책값.
 *
 * 기출 OCR(`problem-ocr/constants.ts`)과 **일부러 다른 값**이 하나 있다 — 겹침이다.
 * 그 까닭은 아래 주석에 적어 두었다.
 */

/** 한 번에 보낼 쪽 수. 기출과 같다 — 지연을 지배하는 건 출력 토큰이라 3쪽이 한계다 */
export const PRINT_PAGES_PER_BATCH = 3;

/**
 * 본문 읽기 턴이 **선호하는 모델** — 목록(`model/list`)에 있는 첫 id 를 쓴다.
 *
 * 선생님이 설정에서 고른 모델이 있으면 그것이 이긴다. 목록에 하나도 없으면 계정 기본 모델로
 * 물러선다(`resolveOcrPref`). ⚠️ 모델 id 를 코드에 박지 않는다는 규약의 **의도된 예외**다 —
 * 요구가 아니라 선호이고, 매번 실재를 확인한다.
 */
export const PRINT_OCR_MODEL_PREFERENCE: readonly string[] = ['gpt-5.6-terra'];

/**
 * 본문 읽기 턴의 **추론 노력** 선호 순서. 그 모델이 지원하는 첫 값을 쓴다.
 *
 * 낮은 노력으로 읽으면 낱말이 바뀌거나 행이 빠진 채 그럴듯한 결과가 돌아온다 —
 * 시험지는 한 글자만 틀려도 틀린 시험지다. 대가는 turn 이 길어지는 것뿐이다.
 */
export const PRINT_OCR_EFFORT_PREFERENCE: readonly string[] = ['high', 'medium'];

/**
 * 앞 묶음과 겹칠 쪽 수 — **0 이다. 1 로 올리지 말 것.**
 *
 * 기출은 쪽 경계를 넘는 '지문' 을 온전히 보려고 한 쪽을 겹쳐 읽고, 겹쳐 읽은 결과를
 * `merge.ts` 가 지문 단위로 합친다(더 긴 쪽이 이긴다). 프린트 읽기의 결과는 **구조 없는
 * 평문 HTML** 이라 그렇게 합칠 수가 없다 — 겹치면 같은 글이 시험지에 **두 번** 들어간다.
 * 대신 프롬프트가 "이 쪽의 마지막 문단은 이 쪽에서 끝나는 곳까지만" 이라고 못박는다.
 */
export const PRINT_BATCH_OVERLAP = 0;

/**
 * 1단으로 짜인 쪽을 **빈 줄에서 위·아래로** 갈라 보낼 것인가.
 *
 * 2단 쪽은 단 가르기가 이미 글자를 키우지만, 1단 쪽은 통째로 나가면서 사다리에 깎여
 * 글자가 가장 작다 — 가르면 10pt 글자가 대략 13px → 18px 이 된다(rowDetect.ts 머리말).
 * ⚠️ `maxSide` 를 올려 크게 보내는 것으로는 안 된다. 모델이 자기 상한에 맞춰 **도로 줄인다**.
 */
export const PRINT_SPLIT_ROWS = true;

/**
 * 2단 쪽의 **단까지** 위·아래로 가를 것인가 — **기본 false.**
 *
 * 단은 이미 가로가 절반이라 더 가르는 이득이 작은데, 쪽 하나가 **4장**이 되어
 * `PRINT_PAGES_PER_BATCH` 를 2 로 내려야 하고(한 turn 의 이미지 상한) 그만큼 ChatGPT 호출이
 * 는다. 켤 때는 묶음 크기를 **함께** 내릴 것 — constants.test 가 그 짝을 강제한다.
 */
export const PRINT_SPLIT_COLUMN_ROWS = false;

/** 쪽 하나가 될 수 있는 최대 이미지 장수 — 묶음 크기 검사의 재료다 */
export const PRINT_IMAGES_PER_PAGE_MAX = PRINT_SPLIT_COLUMN_ROWS ? 4 : 2;

/** 한 묶음(= 한 번의 읽기)이 낼 수 있는 경고 수 */
export const PRINT_OCR_MAX_WARNINGS = 20;

/** 묶음 전체를 합친 뒤의 경고 상한 — 안 걸면 ocr_meta 가 끝없이 커진다 */
export const PRINT_MAX_MERGED_WARNINGS = 40;

/**
 * '읽는중' 이 이만큼 지나면 **멈춘 것으로 본다**.
 *
 * 탭이 닫히거나 브라우저가 죽으면 `runBundle` 의 정리가 돌지 못해 행이 '읽는중' 인 채로 남는다
 * (그 상태로 남기지 않는다는 규약은 정리가 **돌 수 있을 때만** 지켜진다). 그때 목록의
 * '읽기' 버튼을 계속 잠가 두면 지우고 다시 올리는 것 말고는 되살릴 길이 없다.
 * 한 묶음은 3쪽뿐이라 30분이면 아무리 느린 읽기도 끝나고, 다른 탭이 진짜로 읽는 중이라면
 * 그 탭이 계속 `updated_at` 을 밀어 올리는 게 아니므로 **확인창으로 한 번 더 묻는다**.
 */
export const PRINT_READ_STALE_MS = 30 * 60 * 1000;
