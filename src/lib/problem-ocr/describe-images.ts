import type { RenderedImage } from '@/lib/pdf/pdfPages';

/**
 * 보낸 이미지가 무엇인지 모델에게 알리는 줄들 (순수 함수).
 *
 * `prompt.ts` 에서 떼어 왔다 — 학교 프린트 읽기([print-scan/prompt.ts])도 같은 방식으로
 * 쪽을 갈라 보내므로 설명 문구가 두 벌이 되면 한쪽만 고쳐진다.
 *
 * 문서 종류마다 달라지는 부분(기출의 continued·box.column 같은 스키마 얘기)은
 * 호출부가 `splitRules` 로 넘긴다 — 여기에 섞어 두면 프린트 읽기에서 **있지도 않은 필드**를
 * 설명하게 되고, 구조화 출력이 통째로 어긋날 수 있다.
 */

/** 이미지 한 장을 사람 말로 — '4쪽 왼쪽 단' */
export function imageLabel(image: RenderedImage): string {
  if (image.part === 'left') return `${image.page}쪽 왼쪽 단`;
  if (image.part === 'right') return `${image.page}쪽 오른쪽 단`;
  return `${image.page}쪽 전체`;
}

/**
 * 기출 OCR 이 단을 갈라 보낼 때만 붙이는 줄들.
 *
 * 좌표(`box.column`)와 이어짐(`continued`/`continues`)은 기출 스키마에만 있는 필드라
 * 여기 둔다. 프린트 읽기는 자기 것을 따로 넘긴다.
 */
export const PROBLEM_SPLIT_RULES: readonly string[] = [
  '- 같은 쪽의 두 장에 걸친 지문은 **한 지문**이다. continued·continues 는 **쪽과 쪽 사이**'
  + '에만 쓴다(단과 단 사이에는 쓰지 않는다).',
  '- box 의 column 은 **쪽 기준**으로 적는다: 왼쪽 단 이미지에서 본 것은 1, 오른쪽 단'
  + ' 이미지에서 본 것은 2. top·bottom 은 이미지 세로가 곧 쪽 세로라 그대로 적으면 된다.',
];

/**
 * 보낸 이미지가 무엇인지 알리는 줄들.
 *
 * ⚠️ 이 설명이 이미지와 어긋나면 **읽은 내용이 통째로 엉뚱한 쪽에 기록된다** —
 *    그리고 그 잘못된 쪽 번호가 중복 판정·지문 병합·크롭까지 줄줄이 어긋나게 만든다.
 *    그래서 호출부는 요청한 쪽이 아니라 **실제로 그린 이미지**를 넘겨야 한다.
 * @param pages - 이번 묶음이 덮는 쪽
 * @param rendered - 보낸 이미지들 (없으면 한 쪽 = 한 장)
 * @param splitRules - 단을 갈라 보냈을 때만 덧붙일 문서 종류별 규칙
 * @returns 프롬프트에 실을 줄들
 */
export function describeImages(
  pages: number[],
  rendered?: RenderedImage[],
  splitRules: readonly string[] = [],
): string[] {
  const split = rendered?.some((r) => r.part !== 'full') ?? false;
  if (!rendered || !split) {
    return [`- 이번에 보낸 이미지는 ${pages.join('·')}쪽이고, 이미지 순서가 곧 이 쪽 순서다.`];
  }

  const list = rendered.map((r, i) => `${i + 1}번=${imageLabel(r)}`).join(', ');
  return [
    `- 이번에 보낸 이미지는 ${rendered.length}장이고 차례로 이렇다: ${list}.`,
    '- **단을 따로 찍은 것이라 한 쪽이 두 장**이다. 왼쪽 단 맨 아래에서 같은 쪽 오른쪽 단'
    + ' 맨 위로 글이 이어진다 — 두 장을 한 쪽으로 이어서 읽는다.',
    ...splitRules,
  ];
}
