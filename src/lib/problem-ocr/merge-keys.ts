import type { OcrItem } from './schema';

/**
 * 겹쳐 읽은 묶음에서 **같은 항목인지** 판정하는 키 (순수 함수).
 *
 * 병합(merge.ts)에서 떼어 둔 이유는 규칙이 미묘해서다 — 아래 주석의 함정들이
 * 실제로 코덱스 리뷰에서 잡힌 것들이고, 테스트로 따로 고정해 둔다.
 */

/**
 * 지문 머리글 표기를 하나로 맞춘다 (`[1~3]` · `[1 ∼ 3]` · `[ 1 - 3 ]` → `1~3`).
 *
 * ⚠️ 이게 없으면 **같은 지문이 둘로 남는다.** 겹쳐 읽은 두 묶음이 같은 머리글을 서로 다른
 *    물결표로 옮기면 중복 판정 키가 갈리고, 그러면 잘린 지문 두 개가 저장된다.
 *    저장값도 같은 함수로 다듬어 화면·검사에서 같은 글자를 보게 한다.
 * @param label - 모델이 읽은 머리글
 * @returns 다듬은 표기. 빈 값이면 빈 문자열
 */
export function normalizeLabel(label: string | null | undefined): string {
  if (!label) return '';
  return label
    .normalize('NFKC')
    // 감싼 괄호를 벗긴다 — '[1~3]' 과 '1~3' 은 같은 머리글이다
    .replace(/^[[(（［【〔<〈]+|[\])）］】〕>〉]+$/g, '')
    // 물결·붙임표 변종을 하나로 (NFKC 가 전각 숫자·괄호는 이미 폈다)
    .replace(/[~∼〜～\u2012-\u2015\u2212-]/g, '~')
    .replace(/\s+/g, '')
    .trim();
}

/** 태그를 걷어낸 본문 — 길이 비교와 중복 판정에 쓴다 */
export function textOf(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
/**
 * 중복 판정 키. 라벨이 없으면 본문 앞부분으로 대신한다.
 *
 * ⚠️ **이어지는 조각은 내용으로 키를 만들면 안 된다.** 겹쳐 읽은 묶음이 같은 조각을
 *    더 온전히 봤을 때 글이 달라져 '다른 조각'으로 보이고, 그러면 같은 뒷부분이 두 번
 *    붙는다. 쪽 경계에서 잘릴 수 있는 지문은 그 쪽의 **마지막 하나뿐**이므로
 *    (쪽 하나에 이어지는 조각이 둘일 수 없다) 쪽 번호만으로 충분하다.
 */
export function passageKeyBase(item: OcrItem): string {
  if (item.continued) return `${item.page}|C`;
  const label = normalizeLabel(item.label);
  return label
    ? `${item.page}|L|${label}`
    : `${item.page}|H|${textOf(item.html).slice(0, 40)}`;
}

/**
 * 묶음 안 등장 순번까지 더한 지문 키 (문항의 `problemKeyIn` 과 같은 이유).
 *
 * 한 쪽에 `[1~2]` 같은 라벨이 두 번 나오는 자료(문제집·프린트의 절 구분)에서
 * 두 지문이 같은 키를 받으면 하나로 합쳐지고, **문항이 엉뚱한 글에 붙는다**
 * (코덱스 리뷰 16R). 이어지는 조각은 쪽마다 하나뿐이라 순번이 늘 0 이고
 * 묶음을 넘나드는 병합도 그대로 동작한다.
 * @param item - 검증된 항목
 * @param seenInBatch - 이 묶음에서 기본 키가 몇 번 나왔는지 (호출하며 증가시킨다)
 * @returns 순번이 붙은 키
 */
export function passageKeyIn(item: OcrItem, seenInBatch: Map<string, number>): string {
  const base = passageKeyBase(item);
  const nth = seenInBatch.get(base) ?? 0;
  seenInBatch.set(base, nth + 1);
  return `${base}#${nth}`;
}

/**
 * 문항 중복 판정 키의 **기본형**.
 *
 * ⚠️ 여기에 등장 순번이 더 붙는다(problemKeyIn 참조). 쪽·번호만으로 유일하다고 보면
 *    문제집·프린트처럼 **한 쪽 안에서 번호가 다시 시작하는** 자료에서 서로 다른 문항이
 *    같은 키를 받아 하나가 통째로 사라진다(코덱스 리뷰 14R).
 */
export function problemKeyBase(item: OcrItem): string {
  return item.number !== null
    ? `${item.page}|N|${item.number}`
    : `${item.page}|S|${textOf(item.stem_html).slice(0, 40)}`;
}

/**
 * 이 묶음 안에서의 등장 순번까지 더한 키.
 *
 * 한 묶음 안에 같은 기본 키가 두 번 나오면 **서로 다른 문항**이다 — 모델은 둘을 각각
 * 다른 ref 로 냈다. 반면 다른 묶음에서 같은 키가 나오면 겹쳐 읽은 **같은 문항**이다.
 * 순번을 붙이면 그 둘이 갈린다: 같은 자리끼리만 합쳐진다.
 * @param item - 검증된 항목
 * @param seenInBatch - 이 묶음에서 기본 키가 몇 번 나왔는지 (호출하며 증가시킨다)
 * @returns 순번이 붙은 키
 */
export function problemKeyIn(item: OcrItem, seenInBatch: Map<string, number>): string {
  const base = problemKeyBase(item);
  const nth = seenInBatch.get(base) ?? 0;
  seenInBatch.set(base, nth + 1);
  return `${base}#${nth}`;
}
