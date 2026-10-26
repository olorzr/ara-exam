import { unplacedFigures } from '@/lib/problem-bank/figure-render';
import { markFootnotes } from '@/lib/problem-bank/footnotes';
import { hasLiteralPassageLabels, hasSourceAccuratePassageLayout } from '@/lib/problem-bank/source-accurate-passages';
import { sanitizeProblemHTML } from '@/lib/sanitize-problem';
import { hasYetHangul } from '@/lib/yet-hangul';
import type { PaperItemSnapshot, PaperPassageSnapshot } from '@/types/problem-bank';
import type { PaperBlock } from './blocks';
import { splitPassagePieces } from './box-parts';
import { trimPassageToAskedWorks } from './trim-works';

/**
 * 지문 묶음 하나 → 인쇄 블록 (머리글 + 이미지 또는 문단 조각들).
 *
 * blocks.ts 가 300줄에 닿아 2026-10-11 에 갈라 냈다. 규칙은 그대로이고, 묻지 않는 (가)(나)
 * 구역을 빼는 선택(`trimWorks`)만 더했다.
 */

/** 지문 블록을 만드는 데 필요한 것 */
export interface PassageBlockInput {
  passage: PaperPassageSnapshot;
  /** 그 지문에 딸려 문제지에 담긴 문항들 */
  group: readonly PaperItemSnapshot[];
  /** 블록 키 앞머리에 쓰는 묶음 첫 자리 */
  start: number;
  /** `[1~3] 다음 글을 읽고 …` */
  headerText: string;
  /** 묻지 않는 작품의 구역을 뺀다(trim-works.ts) — 확실하지 않으면 지문 전체를 그린다 */
  trimWorks: boolean;
}

/**
 * 이 지문을 **잘라 둔 이미지 한 장으로** 인쇄하는가.
 *
 * ⚠️ 인쇄 준비 확인(`imagePathsOf`)도 **이 함수**로 판정한다. 둘이 갈리면 이미지로 인쇄하는
 *    지문의 본문 삽화(쓰지도 않는 그림)를 인쇄 준비가 기다리다, 그 그림 하나가 깨졌다고
 *    인쇄 단추가 잠긴다(2026-10-15 리뷰 10번). `image_path` 가 비면 글로 떨어진다.
 * @param passage - 스냅샷의 지문
 * @returns 이미지 블록 하나로 그리면 true
 */
export function passagePrintsAsImage(passage: PaperPassageSnapshot): boolean {
  return passage.render_mode === 'image' && Boolean(passage.image_path);
}

/**
 * 지문 묶음의 인쇄 블록.
 * @param input - 지문·묶음·머리글·선택
 * @returns 순서대로의 블록 (머리글이 맨 앞)
 */
export function passageBlocksOf(input: PassageBlockInput): PaperBlock[] {
  const { passage, group, start, headerText, trimWorks } = input;
  const layout = hasSourceAccuratePassageLayout(passage.id)
    ? { sourceAccurate: true, literalLabels: hasLiteralPassageLabels(passage.html) } : {};
  const blocks: PaperBlock[] = [{ kind: 'passage-header', key: `ph-${start}`, text: headerText }];

  if (passagePrintsAsImage(passage)) {
    blocks.push({
      kind: 'passage-image',
      key: `pi-${start}`,
      path: passage.image_path,
      label: passage.title || passage.label,
      ...layout,
    });
    return blocks;
  }

  const figures = passage.figure_paths ?? [];
  const serif = hasYetHangul(passage.html);
  const label = passage.title || passage.label;
  const html = (trimWorks ? trimPassageToAskedWorks(passage, group)?.html : undefined) ?? passage.html;
  // ⚠️ 최상위 요소 단위로 쪼개되 **구역 상자는 자식 단위로 터뜨린다**(box-parts.ts) — 상자 하나에
  //    지문 전체가 담기면 한 쪽을 넘겨 통째로 축소된다. 자리표시자에서 문자열을 자르지 않으므로
  //    표 안의 그림은 그리는 쪽이 끼운다. 경로 없는 그림·가장자리 빈 문단은 거기서 걷는다.
  //    각주 표시는 정화한 뒤·쪼개기 전에 붙인다 — 떼어 낸 각주 문단이 제 블록이 된다(footnotes.ts)
  const parts = splitPassagePieces(markFootnotes(sanitizeProblemHTML(html)), figures)
    .map((piece, i): PaperBlock => {
      const box = piece.box ? { box: piece.box } : {};
      return piece.figurePath
        ? { kind: 'passage-figure', key: `pf-${start}-${i}`, path: piece.figurePath, label, ...box, ...layout }
        : {
          kind: 'passage-part', key: `pp-${start}-${i}`, html: piece.html,
          serif, figures, first: false, last: false, ...box, ...layout,
        };
    });

  // ⚠️ 자리표시자가 없는 그림은 **본문 끝에** 붙인다. 화면(`BodyWithFigures`)이
  //    그렇게 그리는데 인쇄만 빠뜨리면, 선생님이 화면에서 본 그림이 인쇄물에서만
  //    사라진다 — 가장 알아채기 어려운 결함이다(검수에서 칩만 지운 지문이 그렇다).
  // ⚠️ 판정은 **원래 본문**으로 한다 — 뺀 구역 안에 있던 그림을 '자리 없는 그림' 으로 보면
  //    빼려던 작품의 그림이 지문 끝에 도로 붙는다
  for (const { index, path } of unplacedFigures(passage.html, figures)) {
    parts.push({ kind: 'passage-figure', key: `pf-${start}-x${index}`, path, label, ...layout });
  }

  // 상자 윤곽이 단·쪽을 넘어도 이어져 보이도록 위·아래 테두리를 **글 조각의**
  // 처음·끝에만 표시한다. 그림 블록을 세면 테두리가 그림 위아래에 붙는다
  const textParts = parts.filter((b) => b.kind === 'passage-part');
  const firstText = textParts[0];
  const lastText = textParts[textParts.length - 1];
  if (firstText?.kind === 'passage-part') firstText.first = true;
  if (lastText?.kind === 'passage-part') lastText.last = true;
  blocks.push(...parts);
  return blocks;
}
