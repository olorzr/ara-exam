/**
 * 디자인 표지의 제목 크기 (순수 함수).
 *
 * 시안은 '현대시 읽기'(6자)를 146px 로 찍지만 실제 제목은 '2학기 중간고사 대비 현대시 3회 - 교사용'
 * 처럼 길다. 글자 수에 따라 크기를 단계로 줄여 정해진 띠 안에 담는다 — 넘치면 아래 글과 겹치거나
 * 중철에서 면 밖으로 잘린다. 크기는 CSS 변수(`--pbc-title-scale`)로 넘겨 각 디자인의 기준 px 에 곱한다.
 */

/** 글자 수가 `maxLength` 이하면 `scale` 을 쓴다 */
export interface TitleScaleStep {
  maxLength: number;
  scale: number;
}

/**
 * 큰 제목(에디토리얼 146px 기준 · 띠 730×290px)의 단계. 배율마다 들어가는 글자 수(줄 수 × 줄당 글자)의
 * 3분의 2쯤에서 끊는다 — 낱말 단위로 줄이 갈려 칸이 남기 때문이다.
 * 8자 두 줄(시안의 '현대시 / 읽기' 와 같은 크기) · 14자 세 줄(102px) · 26자 네 줄(73px) ·
 * 42자 다섯 줄(55px) · 64자 여섯 줄(44px) · 그보다 길면 여덟 줄(38px).
 */
export const TITLE_SCALE_STEPS: readonly TitleScaleStep[] = [
  { maxLength: 8, scale: 1 },
  { maxLength: 14, scale: 0.7 },
  { maxLength: 26, scale: 0.5 },
  { maxLength: 42, scale: 0.38 },
  { maxLength: 64, scale: 0.3 },
  { maxLength: Infinity, scale: 0.26 },
];

/**
 * 제목 글자 수 — 코드포인트로 센다(옛한글·한자 하나를 둘로 세지 않게).
 * @param title - 제목
 * @returns 앞뒤 공백을 뺀 글자 수
 */
export function titleLengthOf(title: string): number {
  return [...title.trim()].length;
}

/**
 * 글자 수에 맞는 제목 배율.
 * @param length - 제목 글자 수(`titleLengthOf`)
 * @param steps - 디자인의 단계표(짧은 것부터)
 * @returns 기준 크기에 곱할 배율
 */
export function titleScale(length: number, steps: readonly TitleScaleStep[] = TITLE_SCALE_STEPS): number {
  const step = steps.find((s) => length <= s.maxLength);
  return step ? step.scale : steps[steps.length - 1].scale;
}

/** 세로쓰기 책등 한 칸의 크기(px)와 글자 모양 */
export interface VerticalBox {
  /** 글이 흐를 수 있는 높이(위아래 여백을 뺀 값) */
  height: number;
  /** 글줄을 쌓을 수 있는 폭(좌우 여백을 뺀 값) */
  width: number;
  /** 배율 1 의 글자 크기 */
  fontSize: number;
  /** 자간(em) */
  letterSpacing: number;
  /** 줄 높이(배수) */
  lineHeight: number;
}

/**
 * 책등 글자를 이보다 작게 줄이지 않는다. 굵은 책등(폭 84px · 60px · 자간 0.35em)에 100자 제목 + 꼬리가 들어가려면
 * 0.2 배 언저리까지 내려가야 한다 — 0.3 에서 멈추면 칸을 넘친 글이 `overflow: hidden` 에 잘린다(코덱스 4R).
 */
export const MIN_VERTICAL_SCALE = 0.15;
/** 배율을 이만큼씩 줄여 보며 맞춘다 */
export const VERTICAL_SCALE_STEP = 0.05;

/**
 * 고르게 줄여 본 아래 끝(`MIN_*_SCALE`)에서도 안 들어가면 이 배율까지 0.9 배씩 더 줄인다. 표지 제목을 비우면
 * 문제지 제목을 쓰는데 그 제목에는 길이 상한이 없다(DB·화면 모두) — 넘친 글이 `overflow: hidden` 에 잘리는 것보다
 * 작게라도 다 찍히는 편이 낫다(코덱스 5R). 보통 입력은 여기까지 오지 않는다.
 */
export const MIN_EXTREME_SCALE = 0.02;
/** 아래 끝 너머에서 한 번에 줄이는 비율 */
const EXTREME_SHRINK = 0.9;

function shrinkBeyondFloor(floor: number, fits: (scale: number) => boolean): number {
  for (let scale = floor * EXTREME_SHRINK; scale > MIN_EXTREME_SCALE; scale *= EXTREME_SHRINK) {
    // 내림한다 — 반올림하면 검사를 통과한 값보다 커져 줄이 하나 더 갈릴 수 있다(코덱스 7R). 작아지면 늘 들어간다
    if (fits(scale)) return Math.floor(scale * 1000) / 1000;
  }
  return MIN_EXTREME_SCALE;
}

/**
 * 조건을 만족하는 가장 큰 배율(1 이하). 1 에서 `step` 씩 `floor` 까지 고르게 줄여 보고, 그래도 안 되면
 * 0.9 배씩 `MIN_EXTREME_SCALE` 까지 더 줄인다. 맞춤 함수들이 모두 이 순서를 쓴다.
 * @param fits - 그 배율이면 들어가는가
 * @param floor - 고르게 줄여 보는 아래 끝
 * @param step - 고르게 줄이는 간격
 * @returns 배율
 */
export function fitScale(fits: (scale: number) => boolean, floor: number, step: number): number {
  const steps = Math.round((1 - floor) / step);
  for (let i = 0; i <= steps; i += 1) {
    const scale = Math.round((1 - i * step) * 100) / 100;
    if (fits(scale)) return scale;
  }
  return shrinkBeyondFloor(floor, fits);
}

/**
 * 세로쓰기 칸에 글 전체가 들어가는 가장 큰 배율. 칸이 좁으면 세로줄을 늘리고 그래도 모자라면 글자를 줄인다.
 * 세로줄도 가로줄처럼 띄어쓰기에서 갈리고 긴 낱말은 쪼개진다(`wrappedLineCount`) — 글자 수로만 세면 낱말이
 * 남긴 빈자리를 못 봐 칸을 넘친다. 글을 잘라 내지 않으려는 계산이다(`overflow: hidden` 이 말없이 자른다).
 * @param text - 세로로 찍을 글
 * @param box - 칸의 크기와 글자 모양
 * @returns 1 이하의 배율(보통 0.15 ~ 1, 아주 긴 글은 그 아래로도 — `MIN_EXTREME_SCALE`)
 */
export function fitVerticalScale(text: string, box: VerticalBox): number {
  const fits = (scale: number) => {
    const size = box.fontSize * scale;
    const perColumn = box.height / (size * (1 + box.letterSpacing));
    const columns = Math.max(1, Math.floor(box.width / (size * box.lineHeight)));
    return wrappedLineCount(text, perColumn) <= columns;
  };
  return fitScale(fits, MIN_VERTICAL_SCALE, VERTICAL_SCALE_STEP);
}

/**
 * 줄 수 — 브라우저처럼 띄어쓰기에서 줄을 바꾸고(`word-break: keep-all`) 한 줄보다 긴 낱말은 쪼갠다
 * (`overflow-wrap: anywhere`). 글자 수만으로 세면 긴 낱말이 남기는 빈자리를 못 봐 줄 수를 적게 센다(코덱스 2R).
 * @param text - 글(줄바꿈 `\n` 은 새 줄)
 * @param perLine - 한 줄에 드는 글자 수
 * @returns 줄 수(빈 글은 0)
 */
export function wrappedLineCount(text: string, perLine: number): number {
  const per = Math.max(1, Math.floor(perLine));
  let total = 0;
  for (const row of text.split('\n')) {
    const words = row.trim().split(/\s+/).filter(Boolean).map((w) => [...w].length);
    if (words.length === 0) continue;
    let lines = 1;
    let used = 0;
    for (const len of words) {
      const need = used === 0 ? len : used + 1 + len;
      if (need <= per) {
        used = need;
        continue;
      }
      if (used > 0) lines += 1;
      // 줄보다 긴 낱말은 여러 줄로 쪼개진다
      lines += Math.floor((len - 1) / per);
      used = len % per || per;
    }
    total += lines;
  }
  return total;
}

/** 크기를 정할 글 덩어리 하나(px) — 한글 한 자를 글자 크기만큼 넓다고 본다(라틴 글자는 더 좁아 넉넉하다) */
export interface TextBlock {
  text: string;
  /** 배율 1 의 글자 크기 */
  fontSize: number;
  /** 줄 높이(배수) */
  lineHeight: number;
  /** 줄 폭 */
  width: number;
}

/**
 * 글 덩어리들을 배율 `scale` 로 찍었을 때의 높이 합.
 * @param blocks - 글 덩어리
 * @param scale - 배율
 * @returns 높이(px)
 */
export function textBlocksHeight(blocks: readonly TextBlock[], scale: number): number {
  return blocks.reduce((sum, b) => {
    const size = b.fontSize * scale;
    return sum + wrappedLineCount(b.text, b.width / size) * size * b.lineHeight;
  }, 0);
}

/** 맞춤 배율을 고르게(0.02 씩) 줄여 보는 아래 끝 — 그 너머는 `shrinkBeyondFloor` */
export const MIN_FIT_SCALE = 0.3;
/** 맞춤 배율을 이만큼씩 줄여 본다 */
export const FIT_SCALE_STEP = 0.02;

/**
 * 글 덩어리들이 **함께** 정한 높이 안에 드는 가장 큰 배율(1 이하). 덩어리마다 따로 줄이면 합이 넘친다(코덱스 2R).
 * 고정 자리에 놓인 글이 아래 꾸밈·바닥 글과 겹치거나 중철 면 밖으로 밀리지 않게 한다 — 잘라 내지 않고 줄인다.
 * @param blocks - 글 덩어리(배율 1 의 크기로)
 * @param height - 넘지 말아야 할 높이
 * @param gap - 덩어리 사이 간격(배율과 무관)
 * @returns 1 이하의 배율(보통 `MIN_FIT_SCALE` ~ 1, 아주 긴 글은 그 아래로도 — `MIN_EXTREME_SCALE`)
 */
export function fitTextScale(blocks: readonly TextBlock[], height: number, gap = 0): number {
  const room = height - gap * Math.max(0, blocks.length - 1);
  const fits = (scale: number) => textBlocksHeight(blocks, scale) <= room;
  return fitScale(fits, MIN_FIT_SCALE, FIT_SCALE_STEP);
}
