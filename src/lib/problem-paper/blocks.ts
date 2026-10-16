import { splitHtmlBlocks } from '@/lib/print/split-html-blocks';
import { explanationHtml, splitsExplanation } from './answers';
import type { BoxPart } from './box-parts';
import { trimEdgeEmptyParagraphs } from './html-trim';
import type { PaperItemSnapshot } from '@/types/problem-bank';
import { groupRangeLabel, groupsOf, type PaperItem } from './compose';
import { passageBlocksOf, passagePrintsAsImage } from './passage-blocks';
import { trimmedFigurePaths } from './trim-works';

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
    /** 원본 대조가 끝난 지문 — 앱의 기본 바깥 틀을 더하지 않는다 */
    sourceAccurate?: boolean;
    /** (가)가 본문 글자에 있으므로 CSS 말머리는 숨긴다 */
    literalLabels?: boolean;
    /**
     * 터뜨린 구역 상자의 조각일 때 그 상자 — 그리는 쪽이 `<blockquote data-box>` 틀을 두른다.
     * 상자를 통째로 한 블록에 두면 3,000자 (가) 지문이 한 쪽을 넘겨 깨알같이 줄어든다(box-parts.ts)
     */
    box?: BoxPart;
  }
  | { kind: 'passage-image'; key: string; path: string; label: string; sourceAccurate?: boolean }
  /** 지문 본문 제자리에 끼울 그림 한 장 — 문단 조각들 사이에 낀다. 상자 안이면 같은 틀을 두른다 */
  | { kind: 'passage-figure'; key: string; path: string; label: string; box?: BoxPart; sourceAccurate?: boolean; literalLabels?: boolean }
  | { kind: 'problem'; key: string; number: number; snapshot: PaperItemSnapshot }
  /**
   * 교사용에서 **따로 흘려 보내는** 해설 조각.
   *
   * 짧은 해설은 문항 블록 안에 둔다(쪽 경계에서 떨어지지 않게). 길면 그럴 수 없다 —
   * 블록은 쪼갤 수 없어서 한 쪽을 넘기는 순간 문항까지 통째로 축소돼 찍힌다.
   */
  | {
    kind: 'explanation-part';
    key: string;
    number: number;
    html: string;
    first: boolean;
    last: boolean;
  }
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

/**
 * 이 문항을 **잘라 둔 이미지 한 장으로** 인쇄하는가.
 *
 * ⚠️ 블록 만들기·번호 어긋남 판정·인쇄 준비 확인(`imagePathsOf`)이 **모두 이 함수**를 쓴다.
 *    갈리면 이미지로 인쇄하는 문항의 본문 삽화(인쇄에 안 나가는 그림)가 깨졌다고 인쇄 단추가
 *    잠긴다(2026-10-15 리뷰 10번). `image_path` 가 비면 글 문항으로 떨어지고 그때는 삽화가 필요하다.
 * @param item - 문제지 항목
 * @returns 이미지 블록 하나로 그리면 true
 */
export function problemPrintsAsImage(item: PaperItemSnapshot): boolean {
  return item.render_mode === 'image' && Boolean(item.image_path);
}

/** 지문 머리글 문구 — 국어 시험지의 관용 표현 */
function passageHeaderText(range: string): string {
  return `[${range}] 다음 글을 읽고 물음에 답하시오.`;
}

/** 블록을 나누는 선택 */
export interface PaperBlockOptions {
  /**
   * (가)(나) 복합 지문에서 담은 문항이 묻지 않는 작품의 구역을 뺀다(trim-works.ts).
   * 인쇄 화면의 선택이다 — 문제지 저장 설정이 아니다(print-trim-pref.ts).
   */
  trimWorks?: boolean;
}

/**
 * 스냅샷 목록을 인쇄 블록으로 바꾼다.
 *
 * 인쇄 설정(단 수·출처 표시)은 블록을 **나누는 규칙에 영향을 주지 않아** 여기서 받지 않는다.
 * 출처 표시는 그리는 쪽(`PaperPrintBlocks`)이 판단한다.
 * @param items - 문제지 항목 (order_index 순서)
 * @param showAnswers - 교사용인가
 * @param options - 블록을 나누는 선택(구역 빼기)
 * @returns 순서대로의 블록 목록
 */
export function buildPaperBlocks(
  items: readonly PaperItemSnapshot[], showAnswers = false, options: PaperBlockOptions = {},
): PaperBlock[] {
  const paperItems: PaperItem[] = items.map((item, index) => ({
    problemId: String(index),
    passageId: item.passage?.id ?? null,
  }));

  const blocks: PaperBlock[] = [];

  for (const group of groupsOf(paperItems)) {
    const passage = items[group.start].passage;

    if (passage) {
      blocks.push(...passageBlocksOf({
        passage,
        group: items.slice(group.start, group.end + 1),
        start: group.start,
        headerText: passageHeaderText(groupRangeLabel(group)),
        trimWorks: options.trimWorks ?? false,
      }));
    }

    for (let i = group.start; i <= group.end; i += 1) {
      const snapshot = items[i];
      const number = i + 1;

      if (problemPrintsAsImage(snapshot)) {
        blocks.push({
          kind: 'problem-image',
          key: `qi-${i}`,
          number,
          path: snapshot.image_path,
          snapshot,
        });
      } else {
        blocks.push({ kind: 'problem', key: `q-${i}`, number, snapshot });
      }

      // 긴 해설은 문단 단위로 갈라 흘려 보낸다 — 문항 블록에 두면 한 쪽을 넘기는 순간
      // 문항·선지·답까지 통째로 축소돼 찍힌다(코덱스 정지 리뷰).
      // ⚠️ 그리는 쪽도 **같은 `splitsExplanation`** 으로 판정한다 — 갈리면 해설이
      //    두 번 찍히거나 아예 사라진다
      if (showAnswers && splitsExplanation(snapshot.explanation_html)) {
        const clean = explanationHtml(snapshot.explanation_html);
        // ⚠️ `splitHtmlBlocks` 는 **최상위 요소**만 돌려준다 — 태그로 감싸이지 않은 날글자는
        //    자식 요소가 없어 빈 배열이 된다. 그대로 두면 문항 블록도 건너뛴 참이라
        //    **해설이 통째로 사라진다**(코덱스 정지 리뷰 2R). 못 쪼개면 통째로 한 조각이다
        const split = trimEdgeEmptyParagraphs(splitHtmlBlocks(clean));
        const parts = split.length > 0 ? split : [clean];
        parts.forEach((html, part) => blocks.push({
          kind: 'explanation-part',
          key: `qe-${i}-${part}`,
          number,
          html,
          first: part === 0,
          last: part === parts.length - 1,
        }));
      }
    }
  }

  return blocks;
}

/**
 * 인쇄에 필요한 Storage 경로를 모은다. 서명 URL 을 **한 번에** 받으려고 쓴다.
 *
 * ⚠️ 구역을 빼고 인쇄하면(`trimWorks`) 뺀 구역에만 있던 그림은 **필요 없다** — 넣어 두면 인쇄하지도
 *    않을 그림이 깨졌다고 인쇄 단추가 잠긴다(코덱스 1R). 판정은 인쇄 블록과 **같은 함수**다.
 * ⚠️ 같은 까닭으로 **이미지로 인쇄하는** 문항·지문은 잘라 둔 이미지 하나만 필요하다 — 본문 삽화
 *    (`figure_paths`)는 그 모드에서 그려지지 않는다. 글로 떨어지는 경우(이미지 경로가 빈 이미지
 *    출제)에는 삽화를 그대로 받는다. 판정은 블록과 같은 `problemPrintsAsImage`·`passagePrintsAsImage` 다
 * @param items - 문제지 항목
 * @param options - 블록을 나누는 선택 (`buildPaperBlocks` 에 넘기는 것과 같은 값)
 * @returns 중복 없는 경로 목록 (없으면 빈 배열)
 */
export function imagePathsOf(
  items: readonly PaperItemSnapshot[], options: PaperBlockOptions = {},
): string[] {
  const skip = options.trimWorks ? trimmedFigurePaths(items) : new Map<string, Set<string>>();
  const paths = new Set<string>();
  for (const item of items) {
    if (problemPrintsAsImage(item)) paths.add(item.image_path);
    else for (const figure of item.figure_paths) if (figure) paths.add(figure);

    const passage = item.passage;
    if (!passage) continue;
    if (passagePrintsAsImage(passage)) {
      paths.add(passage.image_path);
      continue;
    }
    const dropped = skip.get(passage.id);
    for (const figure of passage.figure_paths ?? []) if (figure && !dropped?.has(figure)) paths.add(figure);
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
    if (!problemPrintsAsImage(item)) return;
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
