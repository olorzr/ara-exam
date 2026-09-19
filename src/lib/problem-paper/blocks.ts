import { splitHtmlBlocks } from '@/lib/print/split-html-blocks';
import { soleFigureIndex, unplacedFigures } from '@/lib/problem-bank/figure-render';
import { sanitizeProblemHTML } from '@/lib/sanitize-problem';
import { hasYetHangul } from '@/lib/yet-hangul';
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
    /**
     * 옛한글 지문인가 — 그리는 쪽이 명조 글꼴 클래스를 붙인다.
     *
     * ⚠️ 판정은 **지문 전체**로 한 번만 하고 모든 조각이 같은 값을 받는다. 조각마다 따로
     *    보면 현대어 풀이 문단만 다른 글꼴이 되어 한 지문이 두 글꼴로 갈려 보인다
     */
    serif: boolean;
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
    /**
     * 이 문항의 스냅샷.
     *
     * ⚠️ 출처만 들고 있으면 안 된다 — **교사용**은 그림 문항에도 정답·해설을 찍는다.
     *    글로 옮기지 못했을 뿐 채점은 똑같이 하므로, 빠지면 그 문항만 답을 따로 찾게 된다.
     */
    snapshot: PaperItemSnapshot;
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
        const serif = hasYetHangul(passage.html);
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
            serif,
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
          snapshot,
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

/*
 * 정답·해설 표기는 [answers.ts](./answers.ts) 로 옮겼다 — 교사용·답지가 함께 쓰면서
 * '인쇄 블록을 나누는 일' 과 섞이지 않게 갈랐다. 이미 이 파일에서 가져다 쓰는 곳이
 * 있으므로 이름은 여기서도 그대로 내보낸다.
 */
export {
  buildAnswerRows, explanationEntries, formatAnswer, MISSING_ANSWER_LABEL,
  type AnswerRow, type ExplanationEntry,
} from './answers';

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

/**
 * 번호가 어긋난 채로 인쇄하기 전에 한 번 묻는 말 — 없으면 null.
 *
 * ⚠️ 화면 경고만으로는 모자랐다(코덱스 리뷰). 경고는 `data-no-print` 라 **인쇄물에는
 *    안 나가고**, 아래로 스크롤해 인쇄 버튼을 누르면 그대로 찍힌다 — 학생은 '01' 이라고
 *    적힌 문항 안에서 '17' 을 보고 답안지의 1번과 맞추지 못한다. 자동으로 지울 방법은
 *    여전히 없으므로(잘라 둔 이미지에 번호가 찍혀 있다) **누를 때 한 번 더 묻는다.**
 * @param renumbered - `renumberedImageItems` 의 결과
 * @returns 확인창 문구 또는 null(물을 것이 없다)
 */
export function renumberedPrintConfirmMessage(
  renumbered: readonly { printed: number; original: number }[],
): string | null {
  if (renumbered.length === 0) return null;
  const some = renumbered.slice(0, 5)
    .map((r) => `${r.printed}번(원본 ${r.original}번)`).join(', ');
  const rest = renumbered.length > 5 ? ` 외 ${renumbered.length - 5}개` : '';
  return [
    `이미지로 출제한 ${renumbered.length}개 문항의 번호가 원본과 달라요: ${some}${rest}.`,
    '잘라 둔 이미지에는 원본 번호가 찍혀 있어 인쇄물에 두 번호가 함께 보이고,',
    '학생이 답안지와 맞추기 어렵습니다.',
    '',
    '그대로 인쇄할까요?',
  ].join('\n');
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
