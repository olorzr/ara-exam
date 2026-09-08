import { splitHtmlBlocks } from '@/lib/print/split-html-blocks';
import { sanitizeProblemHTML } from '@/lib/sanitize-problem';
import type { PaperItemSnapshot, PaperSettings } from '@/types/problem-bank';
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
  | { kind: 'passage-part'; key: string; html: string; first: boolean; last: boolean }
  | { kind: 'passage-image'; key: string; path: string; label: string }
  | { kind: 'problem'; key: string; number: number; snapshot: PaperItemSnapshot }
  | {
    kind: 'problem-image';
    key: string;
    number: number;
    path: string;
    score: number | null;
    /** 출처 표시가 켜졌을 때 찍을 스냅샷 — 글 문항과 같은 줄이 나가야 한다 */
    source: PaperItemSnapshot['source'];
  };

/** 지문 머리글 문구 — 국어 시험지의 관용 표현 */
function passageHeaderText(range: string): string {
  return `[${range}] 다음 글을 읽고 물음에 답하시오.`;
}

/**
 * 스냅샷 목록을 인쇄 블록으로 바꾼다.
 * @param items - 문제지 항목 (order_index 순서)
 * @param settings - 인쇄 설정
 * @returns 순서대로의 블록 목록
 */
export function buildPaperBlocks(
  items: readonly PaperItemSnapshot[],
  settings: PaperSettings,
): PaperBlock[] {
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
        const parts = splitHtmlBlocks(sanitizeProblemHTML(passage.html));
        parts.forEach((html, i) => {
          blocks.push({
            kind: 'passage-part',
            key: `pp-${group.start}-${i}`,
            html,
            // 상자 윤곽이 단·쪽을 넘어도 이어져 보이도록 위·아래 테두리를 조각에 표시한다
            first: i === 0,
            last: i === parts.length - 1,
          });
        });
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
          score: settings.showScore ? snapshot.score : null,
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
  }
  return [...paths];
}

/** 정답표 한 줄 */
export interface AnswerRow {
  number: number;
  /** 미입력이면 '미입력' — 빈칸으로 두면 인쇄물에서 누락과 구분되지 않는다 */
  answer: string;
  score: number | null;
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
    score: item.score,
    question_type: item.question_type,
  }));
}

/**
 * 배점 합계. 하나라도 배점이 없으면 합계를 내지 않는다 —
 * 일부만 더한 값을 만점처럼 인쇄하면 채점이 틀어진다.
 * @param items - 문제지 항목
 * @returns 합계. 못 내면 null
 */
export function totalScore(items: readonly PaperItemSnapshot[]): number | null {
  if (items.length === 0) return null;
  let sum = 0;
  for (const item of items) {
    if (item.score === null) return null;
    sum += item.score;
  }
  return Math.round(sum * 100) / 100;
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
