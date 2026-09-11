import { splitHtmlBlocks } from '@/lib/print/split-html-blocks';
import { soleFigureIndex, unplacedFigures } from '@/lib/problem-bank/figure-render';
import { sanitizeProblemHTML } from '@/lib/sanitize-problem';
import { trimEdgeEmptyParagraphs } from './html-trim';
import type { PaperItemSnapshot } from '@/types/problem-bank';
import { groupRangeLabel, groupsOf, type PaperItem } from './compose';

/**
 * 문제지 스냅샷 → 인쇄 블록 (순수 함수, DOM 파싱 사용).
 *
 * 인쇄 엔진(`A4Document`)의 블록 하나는 **쪽을 넘겨 쪼갤 수 없는 최소 단위**다.
 * 그래서 지문을 통째로 한 블록에 넣으면 안 된다 — 한 쪽에 안 들어가는 순간
 * `transform: scale()` 로 깨알같이 줄어든다. 지문은 **문단 단위로 쪼개** 흘려 보내고,
 * 문항은 하나가 한 블록이다(발문과 선지가 갈리면 읽을 수 없다).
 *
 * ⚠️ 정화(sanitize)를 여기서 한 번 더 한다. 저장 시점에 이미 걸렀지만 스냅샷은
 *    jsonb 라 나중에 DB 를 직접 건드린 값이 섞일 수 있고, 렌더 진입은
 *    `dangerouslySetInnerHTML` 이다(개념지와 같은 다층 방어).
 */

/** 인쇄 블록 한 개 */
export type PaperBlock =
  | { kind: 'passage-header'; key: string; text: string }
  | {
    kind: 'passage-part';
    key: string;
    html: string;
    /** 이 지문의 그림 경로들 — 상자 안에 남은 자리표시자를 그리는 쪽이 끼운다 */
    figures?: string[];
    first: boolean;
    last: boolean;
  }
  | { kind: 'passage-image'; key: string; path: string; label: string }
  /** 지문 본문 제자리에 끼울 그림 한 장 — 문단 조각들 사이에 낀다 */
  | { kind: 'passage-figure'; key: string; path: string; label: string }
  | { kind: 'problem'; key: string; number: number; snapshot: PaperItemSnapshot }
  | {
    kind: 'problem-image';
    key: string;
    number: number;
    path: string;
    /** 출처 표시가 켜졌을 때 찍을 스냅샷 — 글 문항과 같은 줄이 나가야 한다 */
    source: PaperItemSnapshot['source'];
  };

/** 지문 머리글 문구 — 국어 시험지의 관용 표현 */
function passageHeaderText(range: string): string {
  return `[${range}] 다음 글을 읽고 물음에 답하시오.`;
}

/**
 * 스냅샷 목록을 인쇄 블록으로 바꾼다.
 *
 * 인쇄 설정(단 수·출처 표시)은 블록을 **나누는 규칙에 영향을 주지 않아** 여기서 받지 않는다.
 * 출처 표시는 그리는 쪽(`PaperPrintBlocks`)이 판단한다.
 * @param items - 문제지 항목 (order_index 순서)
 * @returns 순서대로의 블록 목록
 */
export function buildPaperBlocks(items: readonly PaperItemSnapshot[]): PaperBlock[] {
  const paperItems: PaperItem[] = items.map((item, index) => ({
    problemId: String(index),
    passageId: item.passage?.id ?? null,
  }));

  const blocks: PaperBlock[] = [];

  for (const group of groupsOf(paperItems)) {
    const passage = items[group.start].passage;

    if (passage) {
      blocks.push({
        kind: 'passage-header',
        key: `ph-${group.start}`,
        text: passageHeaderText(groupRangeLabel(group)),
      });

      if (passage.render_mode === 'image' && passage.image_path) {
        blocks.push({
          kind: 'passage-image',
          key: `pi-${group.start}`,
          path: passage.image_path,
          label: passage.title || passage.label,
        });
      } else {
        // 가장자리 빈 문단을 먼저 걷어낸다 — 상자 테두리 안이 위아래로 뜨는 것을 막고,
        // first/last 표시도 진짜 첫·마지막 조각에 붙는다
        const figures = passage.figure_paths ?? [];
        // ⚠️ **최상위 블록으로 먼저 쪼갠다.** 자리표시자에서 문자열을 자르면 〈보기〉 상자나
        //    표 안에 있는 그림에서 여는 태그와 닫는 태그가 갈려 상자가 깨진다.
        //    쪼갠 **뒤에** 그림만인 조각을 가려내고, 상자 안에 남은 것은 그리는 쪽이 끼운다
        const raw = trimEdgeEmptyParagraphs(splitHtmlBlocks(sanitizeProblemHTML(passage.html)));
        const parts: PaperBlock[] = raw.map((html, i): PaperBlock => {
          const only = soleFigureIndex(html);
          const path = only === null ? '' : figures[only - 1];
          if (only !== null && path) {
            return {
              kind: 'passage-figure',
              key: `pf-${group.start}-${i}`,
              path,
              label: passage.title || passage.label,
            };
          }
          return {
            kind: 'passage-part',
            key: `pp-${group.start}-${i}`,
            html,
            // 상자 안에 남은 자리표시자는 그리는 쪽이 서명 URL 로 끼운다
            figures,
            first: false,
            last: false,
          };
        // 그림만이었는데 경로가 없는 조각은 버린다 — 빈 줄만 남는다
        }).filter((b) => b.kind !== 'passage-part' || soleFigureIndex(b.html) === null);

        // ⚠️ 자리표시자가 없는 그림은 **본문 끝에** 붙인다. 화면(`BodyWithFigures`)이
        //    그렇게 그리는데 인쇄만 빠뜨리면, 선생님이 화면에서 본 그림이 인쇄물에서만
        //    사라진다 — 가장 알아채기 어려운 결함이다(검수에서 칩만 지운 지문이 그렇다)
        for (const { index, path } of unplacedFigures(passage.html, figures)) {
          parts.push({
            kind: 'passage-figure',
            key: `pf-${group.start}-x${index}`,
            path,
            label: passage.title || passage.label,
          });
        }

        // 상자 윤곽이 단·쪽을 넘어도 이어져 보이도록 위·아래 테두리를 **글 조각의**
        // 처음·끝에만 표시한다. 그림 블록을 세면 테두리가 그림 위아래에 붙는다
        const textParts = parts.filter((b) => b.kind === 'passage-part');
        const firstText = textParts[0];
        const lastText = textParts[textParts.length - 1];
        if (firstText?.kind === 'passage-part') firstText.first = true;
        if (lastText?.kind === 'passage-part') lastText.last = true;
        blocks.push(...parts);
      }
    }

    for (let i = group.start; i <= group.end; i += 1) {
      const snapshot = items[i];
      const number = i + 1;

      if (snapshot.render_mode === 'image' && snapshot.image_path) {
        blocks.push({
          kind: 'problem-image',
          key: `qi-${i}`,
          number,
          path: snapshot.image_path,
          source: snapshot.source,
        });
        continue;
      }

      blocks.push({ kind: 'problem', key: `q-${i}`, number, snapshot });
    }
  }

  return blocks;
}

/**
 * 인쇄에 필요한 Storage 경로를 모은다. 서명 URL 을 **한 번에** 받으려고 쓴다.
 * @param items - 문제지 항목
 * @returns 중복 없는 경로 목록 (없으면 빈 배열)
 */
export function imagePathsOf(items: readonly PaperItemSnapshot[]): string[] {
  const paths = new Set<string>();
  for (const item of items) {
    if (item.render_mode === 'image' && item.image_path) paths.add(item.image_path);
    for (const figure of item.figure_paths) if (figure) paths.add(figure);
    const passage = item.passage;
    if (passage?.render_mode === 'image' && passage.image_path) paths.add(passage.image_path);
    for (const figure of passage?.figure_paths ?? []) if (figure) paths.add(figure);
  }
  return [...paths];
}

/** 정답표 한 줄 */
export interface AnswerRow {
  number: number;
  /** 미입력이면 '미입력' — 빈칸으로 두면 인쇄물에서 누락과 구분되지 않는다 */
  answer: string;
  question_type: PaperItemSnapshot['question_type'];
}

/** 정답이 비었을 때 정답표에 찍는 문구 */
export const MISSING_ANSWER_LABEL = '미입력';

/**
 * 정답표 줄을 만든다.
 * @param items - 문제지 항목
 * @returns 번호 순서대로의 줄
 */
export function buildAnswerRows(items: readonly PaperItemSnapshot[]): AnswerRow[] {
  return items.map((item, i) => ({
    number: i + 1,
    answer: item.answer.trim() || MISSING_ANSWER_LABEL,
    question_type: item.question_type,
  }));
}

/**
 * 이미지로 출제한 문항 중 **인쇄 번호와 원본 번호가 다른** 것들.
 *
 * ⚠️ 잘라 둔 이미지에는 원본 시험지의 문항 번호가 그대로 찍혀 있다(그래야 선지까지
 *    안 잘린다). 문제지에서 자리가 바뀌면 이미지의 '17' 과 우리가 찍는 '01' 이 함께
 *    보여 학생이 답안지와 맞추기 어렵다. 자동으로 지울 방법이 없으므로
 *    화면에서 알려 선생님이 판단하게 한다(코덱스 리뷰 20R).
 * @param items - 문제지 항목
 * @returns `{ printed, original }` 목록
 */
export function renumberedImageItems(
  items: readonly PaperItemSnapshot[],
): { printed: number; original: number }[] {
  const out: { printed: number; original: number }[] = [];
  items.forEach((item, i) => {
    if (item.render_mode !== 'image' || !item.image_path) return;
    if (item.number === null || item.number === i + 1) return;
    out.push({ printed: i + 1, original: item.number });
  });
  return out;
}

/** 가장 긴 지문의 글자 수 — 1단 권유 판단에 쓴다 */
export function longestPassageChars(items: readonly PaperItemSnapshot[]): number {
  let longest = 0;
  const seen = new Set<string>();
  for (const item of items) {
    const passage = item.passage;
    if (!passage || seen.has(passage.id)) continue;
    seen.add(passage.id);
    const chars = passage.html.replace(/<[^>]*>/g, '').replace(/\s+/g, '').length;
    if (chars > longest) longest = chars;
  }
  return longest;
}
