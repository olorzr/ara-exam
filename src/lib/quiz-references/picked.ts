import type { ReferenceBodyRow } from '@/lib/reference-texts/queries';
import { htmlToText } from '@/lib/reference-texts/body-format';
import { referenceBodyPlainText } from '@/lib/reference-texts/workbook-plain';
import type { ReferenceTextListItem } from '@/types/reference-text';
import type { PickedPassage } from './types';

/**
 * 작품 전문·개념 한 편을 **지문으로** 불러올 때의 값 (순수 함수).
 *
 * ⚠️ 이 모듈은 `@/lib/reference-texts` 배럴을 쓰지 않는다 — 그 배럴이 `import.ts` 를 거쳐 pdf.js 를
 *    문제 만들기 번들로 끌어온다(`bodies.ts` 와 같은 규약). 파일 경로로만 가져온다.
 */

/** 말머리 상자의 여는 태그 — 말머리 글자는 정화기가 글자·숫자·`·!?~()-` 만 받는다(`isCalloutLabel`) */
const CALLOUT_OPEN = /<blockquote\b[^>]*\bdata-callout="([^"]+)"[^>]*>/gi;

/**
 * 말머리 상자의 이름을 글로 꺼내 상자 머리에 한 줄로 둔다.
 *
 * 화면은 그 이름을 CSS(`content: attr(data-callout)`)로만 찍어, 태그를 벗기면 '학습 목표'·'핵심 정리' 같은
 * 머리가 사라지고 상자 속 글만 앞뒤 문단과 뭉친다. 지문으로 읽을 AI 에게는 그 머리가 문단의 갈래를 알려 준다.
 * @param html - 개념 본문(정화한 값)
 * @returns 말머리가 글로 들어간 HTML
 */
function withCalloutLabels(html: string): string {
  return html.replace(CALLOUT_OPEN, (tag: string, label: string) => `${tag}<p>[${label}]</p>`);
}

/**
 * 본문을 지문 평문으로.
 *
 * - **작품**은 원문만 남긴다(`referenceBodyPlainText` — 말머리 상자·어휘 풀이·도식 통째, 여백 해설은 원문 칸만).
 *   출판사 해설이 섞이면 학생 문제지에 해설이 지문처럼 찍히고 AI 는 그 풀이를 작품의 글로 알고 문항을 낸다
 *   (참고자료 `bodies.ts` 와 같은 판단).
 * - ⚠️ **개념은 그 함수를 쓰면 안 된다** — 개념 정리는 말머리 상자·어휘 표·도식이 **곧 내용**이라 걷으면
 *   거의 빈 글이 된다. 서식만 벗기고 글은 다 남긴다(`htmlToText` — 표 칸은 ` · `, 목록은 `- `, 문단은 빈 줄).
 * @param kind - 작품 / 개념
 * @param body - 본문과 형식
 * @returns 평문 지문
 */
export function referencePassageText(kind: ReferenceTextListItem['kind'], body: ReferenceBodyRow): string {
  if (kind === '작품') return referenceBodyPlainText(body.body, body.format);
  return body.format === 'html' ? htmlToText(withCalloutLabels(body.body)) : body.body;
}

/**
 * 고른 전문·개념을 폼으로 넘길 값으로.
 *
 * 단원이 여럿(최대 8)이면 **첫 단원만** 신호로 쓴다 — 신호는 참고자료를 찾는 단서일 뿐이고, 무엇을 보고
 * 붙였는지(`reason`)가 화면에 함께 찍혀 엉뚱하면 선생님이 뺄 수 있다. 학교·학년도는 전문에 없다(학교 축 없음).
 * @param row - 목록 줄
 * @param body - 그 줄의 본문
 * @returns 지문·제목·지은이와 매칭 신호
 */
export function pickedFromReferenceText(row: ReferenceTextListItem, body: ReferenceBodyRow): PickedPassage {
  const unit = row.units[0];
  return {
    text: referencePassageText(row.kind, body),
    title: row.title,
    author: row.author,
    meta: {
      id: row.id,
      source: 'text',
      unitPath: unit ? [...unit.unit_path] : [],
      textbook: unit?.textbook ?? '',
      grade: unit?.grade ?? '',
      schoolName: '',
      year: '',
    },
  };
}
