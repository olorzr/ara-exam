import { createHost } from '@/lib/print/table-dom';
import { unplacedFigures } from '@/lib/problem-bank/figure-render';
import { markFootnotes } from '@/lib/problem-bank/footnotes';
import { hasTabulatedChoices, matrixChoices, pairedChoices } from '@/lib/problem-bank/paired-choices';
import { sanitizeProblemHTML } from '@/lib/sanitize-problem';
import { markYetHangul } from '@/lib/yet-hangul';
import type { PaperItemSnapshot } from '@/types/problem-bank';
import { isInlineNode, splitPassagePieces, type BoxPart, type PassagePiece } from './box-parts';
import { stripTrailingEmptyParagraphs } from './html-trim';

/**
 * 문항을 '단위' 로 나눈다 — 단 끝에서 자를 수 있는 자리는 단위 사이뿐이다.
 *
 * 원장님(2026-11-06): "문제를 다음 다단으로 넘기는 걸 만들어야 할 것 같음." 문항이 통째로 넘어가 앞 단이 절반 비고,
 * 한 단보다 큰 문항은 70% 로 줄어 찍혔다. 평가원 시험지처럼 〈보기〉가 단 바닥에, 선지가 다음 단 머리에 오면 된다.
 *
 * 한 선지·한 문단 안은 자르지 않는다. 답 빈칸·교사용 답은 바로 앞 단위에 붙어 간다(`questionCuts`).
 */

/** 문항의 한 단위 — 차례는 늘 머리 · 발문 조각 · 그림 · 선지 · 빈칸 · 답이다 */
export type QuestionUnit =
  /** 번호와 나란히 서는 발문 첫 조각 — 늘 0번 */
  | { kind: 'head'; html: string; box?: BoxPart }
  /** 발문의 나머지 조각. 〈보기〉 상자는 지문처럼 자식 단위로 터뜨린다 */
  | { kind: 'stem'; html: string; box?: BoxPart }
  /** 자리표시자 없이 발문 끝에 붙는 그림 */
  | { kind: 'figure'; path: string }
  | { kind: 'choice'; index: number }
  /** 짝(㉮㉯)·행렬 표 선지 — 통째 */
  | { kind: 'choices-table' }
  /** 주관식·서술형 답 쓰는 빈칸 (학생용만) */
  | { kind: 'blank' }
  /** 교사용 답(+짧은 해설) */
  | { kind: 'answer' };

/** 조각이 맡는 단위 범위 — `to` 는 배타 */
export interface QuestionRange {
  from: number;
  to: number;
}

/** 선지를 어떤 모양으로 그리는가 — 단위 만들기와 그리기가 **같은 판정**을 쓴다 */
export interface QuestionChoiceLayout {
  objective: boolean;
  paired: ReturnType<typeof pairedChoices>;
  matrix: ReturnType<typeof matrixChoices>;
  /** 선지가 이미 발문의 표 안에 있다 — 따로 그리지 않는다 */
  tabulated: boolean;
}

/**
 * 선지 모양 판정.
 * @param snapshot - 문항 스냅샷
 * @returns 객관식 여부와 표 선지
 */
export function questionChoiceLayout(snapshot: PaperItemSnapshot): QuestionChoiceLayout {
  const objective = snapshot.question_type === '객관식' && snapshot.choices.length > 0;
  const paired = objective ? pairedChoices(snapshot.stem_html, snapshot.choices) : null;
  const matrix = objective && !paired ? matrixChoices(snapshot.stem_html, snapshot.choices) : null;
  const tabulated = objective && !paired && !matrix ? hasTabulatedChoices(snapshot.stem_html, snapshot.choices) : false;
  return { objective, paired, matrix, tabulated };
}

/**
 * 저장된 발문을 그릴 수 있는 HTML 로 — 정화하고 끝 빈 문단을 걷고 각주·옛한글을 표시한다.
 * 문제지와 문제 은행 화면이 **이 함수 하나**를 쓴다. 갈리면 같은 문항이 두 곳에서 다른 글꼴로 나온다.
 * ⚠️ 차례를 바꾸지 말 것 — 각주 표시가 새로 만든 문단에도 옛한글 표시가 붙어야 한다.
 * @param raw - 저장된 발문 HTML
 * @returns 그릴 수 있는 HTML (다시 정화하지 않는다 — 각주·옛한글 class 가 사라진다)
 */
export function displayStemHtml(raw: string): string {
  return markYetHangul(markFootnotes(stripTrailingEmptyParagraphs(sanitizeProblemHTML(raw))));
}

/**
 * 인쇄할 발문 HTML — 표 선지의 머리를 뗀 뒤 `displayStemHtml` 을 거친다.
 * @param snapshot - 문항 스냅샷
 * @param layout - 선지 모양
 * @returns 그릴 수 있는 HTML
 */
export function questionStemHtml(snapshot: PaperItemSnapshot, layout: QuestionChoiceLayout): string {
  return displayStemHtml(layout.paired?.stemHtml ?? layout.matrix?.stemHtml ?? snapshot.stem_html);
}

/**
 * 발문을 조각으로.
 *
 * ⚠️ 쪼개기는 최상위 **요소**만 본다. 최상위에 날글자나 줄 안 요소가 있으면 통째로 한 조각으로 둔다(옛 손입력
 *    발문) — 날글자는 조용히 사라지고, `<strong>…</strong><u>…</u>` 는 한 줄이 조각마다 여러 줄로 갈린다.
 */
function stemPieces(html: string, figures: readonly string[]): PassagePiece[] {
  const host = createHost(html);
  if (!host) return html ? [{ html }] : [];
  const inline = Array.from(host.childNodes)
    .some((node) => isInlineNode(node) && (node.nodeType !== Node.TEXT_NODE || (node.textContent ?? '').trim() !== ''));
  return inline ? [{ html }] : splitPassagePieces(html, figures, { keepMissingFigures: true });
}

/** 선지 자리의 단위들 */
function answerAreaUnits(snapshot: PaperItemSnapshot, layout: QuestionChoiceLayout, showAnswers: boolean): QuestionUnit[] {
  if (layout.paired || layout.matrix) return [{ kind: 'choices-table' }];
  if (layout.tabulated) return [];
  if (layout.objective) return snapshot.choices.map((_, index) => ({ kind: 'choice', index }));
  return showAnswers ? [] : [{ kind: 'blank' }];
}

/**
 * 문항의 단위들.
 * @param snapshot - 문항 스냅샷
 * @param showAnswers - 교사용인가
 * @returns 차례대로의 단위 (첫 칸은 늘 머리)
 */
export function questionUnits(snapshot: PaperItemSnapshot, showAnswers: boolean): QuestionUnit[] {
  const layout = questionChoiceLayout(snapshot);
  const html = questionStemHtml(snapshot, layout);
  const [head, ...rest] = stemPieces(html, snapshot.figure_paths);
  return [
    { kind: 'head', html: head?.html ?? '', ...(head?.box ? { box: head.box } : {}) },
    ...rest.map((piece): QuestionUnit => ({ kind: 'stem', html: piece.html, ...(piece.box ? { box: piece.box } : {}) })),
    ...unplacedFigures(html, snapshot.figure_paths).map(({ path }): QuestionUnit => ({ kind: 'figure', path })),
    ...answerAreaUnits(snapshot, layout, showAnswers),
    ...(showAnswers ? [{ kind: 'answer' } as const] : []),
  ];
}

/**
 * 범위 안에서 자를 수 있는 경계 — 뒤 조각이 시작하는 단위 번호들.
 *
 * 첫 조각에는 머리 말고 단위 하나가 더 있어야 한다(번호와 발문만 단 바닥에 남기지 않는다). 빈칸·답은 바로 앞
 * 단위에 붙여 둔다 — 빈칸만 다음 단으로 가면 어느 문항의 빈칸인지 알 수 없다.
 * ⚠️ 재는 쪽과 자르는 쪽이 **이 함수 하나**를 써야 후보 번호가 같은 경계를 가리킨다.
 * @param units - 문항의 단위들
 * @param range - 지금 조각의 범위
 * @returns 오름차순 단위 번호들
 */
export function questionCuts(units: readonly QuestionUnit[], range: QuestionRange): number[] {
  const first = range.from + (range.from === 0 ? 2 : 1);
  const cuts: number[] = [];
  for (let k = first; k < range.to; k += 1) {
    if (units[k].kind !== 'blank' && units[k].kind !== 'answer') cuts.push(k);
  }
  return cuts;
}
