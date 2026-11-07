'use client';

import type { ReactNode } from 'react';
import { renderFiguresInHtml } from '@/lib/problem-bank/figure-render';
import type { PaperBlock } from '@/lib/problem-paper/blocks';
import { boxPartClassName } from '@/lib/problem-paper/box-parts';
import type { PaperSettings } from '@/types/problem-bank';
import { PrintImage, SourceLine, TeacherAnswer } from './PaperPrintParts';
import { withOmrSheetBreak } from './PaperOmrMarks';
import PaperQuestion, { problemClassName } from './PaperQuestion';

/**
 * 인쇄 블록을 실제 React 노드로 그린다.
 *
 * 블록 목록을 만드는 일(무엇을 어떤 단위로 쪼갤지)은 순수 함수(`blocks.ts`)가 하고,
 * 여기서는 그리기만 한다 — 그래야 쪼개기 규칙을 테스트로 고정할 수 있다.
 *
 * 문제지와 **교사용은 같은 렌더러**다(`showAnswers` 하나로 갈린다) — 두 벌로 두면
 * 문항 모양이 언젠가 한쪽만 고쳐져, 선생님이 든 종이와 학생이 든 종이가 달라진다.
 */

interface RenderArgs {
  blocks: readonly PaperBlock[];
  settings: PaperSettings;
  /** Storage 경로 → 서명 URL */
  imageUrls: Map<string, string>;
  /**
   * 교사용인가 — 정답 선지에 표시를 하고 문항 밑에 답·해설을 붙인다.
   * 학생이 쓸 답 줄은 그리지 않는다(선생님 종이에는 쓸 일이 없다).
   */
  showAnswers?: boolean;
  /**
   * OMR 문제지의 90A 답안지 장 수. **2 이상일 때만** 새 답안지가 시작되는 문항 앞에 구분 줄을 끼운다.
   * 0·1 이면 아무것도 더하지 않는다.
   */
  omrSheetCount?: number;
}

/**
 * 블록을 A4Document 가 받는 ReactNode 배열로 바꾼다.
 * @param args - 블록·설정·이미지 URL·교사용 여부
 * @returns 블록 순서 그대로의 노드 배열
 */
export function renderPaperBlocks({
  blocks, settings, imageUrls, showAnswers = false, omrSheetCount = 0,
}: RenderArgs): ReactNode[] {
  const multiSheet = omrSheetCount > 1;
  // 구분 줄은 문항 **앞**에 붙어 그 문항과 한 블록이 된다 — 지문 조각 앞에 붙이면 안 된다
  const wrap = (node: ReactNode, number: number, key: string): ReactNode =>
    multiSheet ? withOmrSheetBreak(node, number, `${key}-omr`) : node;
  return blocks.map((block) => {
    switch (block.kind) {
      case 'passage-header':
        return <p key={block.key} className="pb-passage-header">{block.text}</p>;

      case 'passage-part': {
        // 옛한글 지문은 명조로 — 판정은 blocks.ts 가 지문 전체로 한 번 해서 모든 조각에 싣는다
        const className = `pb-passage-part${block.sourceAccurate ? ' pb-passage-part--unframed' : ''}${block.literalLabels ? ' pb-passage-part--literal-labels' : ''}${block.first ? ' pb-passage-part--first' : ''}${
          block.last ? ' pb-passage-part--last' : ''
        }${block.continues ? ' pb-passage-part--continues' : ''}${block.serif ? ' yet-hangul-serif' : ''}`;
        // 〈보기〉 상자·표 안에 남은 그림 자리표시자를 여기서 끼운다 — 구조를 자르지 않는다
        const body = { __html: renderFiguresInHtml(block.html, block.figures ?? [], imageUrls) };
        // 상자 밖 조각은 예전 DOM 그대로 — 틀을 더 두르면 잰 높이와 CSS 가 달라진다
        if (!block.box) return <div key={block.key} className={className} dangerouslySetInnerHTML={body} />;
        // 터뜨린 상자의 조각 — 틀은 React 가 두른다. 말머리는 타입으로 온 값이고(box-labels 를
        // 지났다) HTML 문자열을 잇지 않는다: 정화는 쪼개기 전에 끝났고 다시 하지 않는다
        return (
          <div key={block.key} className={className}>
            <blockquote
              data-box={block.box.label ?? undefined}
              className={boxPartClassName(block.box)}
              dangerouslySetInnerHTML={body}
            />
          </div>
        );
      }

      case 'passage-figure': {
        const image = <PrintImage path={block.path} urls={imageUrls} alt={`${block.label || '지문'} 자료`} />;
        return (
          <div key={block.key} className={`pb-passage-part pb-figure${block.sourceAccurate ? ' pb-passage-part--unframed' : ''}${block.literalLabels ? ' pb-passage-part--literal-labels' : ''}`}>
            {/* 상자 안 그림도 같은 틀에 담는다 — 안 그러면 상자 윤곽이 그림 자리에서 끊긴다 */}
            {block.box
              ? <blockquote data-box={block.box.label ?? undefined} className={boxPartClassName(block.box)}>{image}</blockquote>
              : image}
          </div>
        );
      }

      case 'passage-image':
        return (
          <div key={block.key} className={`pb-passage-part pb-passage-part--first pb-passage-part--last${block.sourceAccurate ? ' pb-passage-part--unframed' : ''}`}>
            <PrintImage path={block.path} urls={imageUrls} alt={block.label || '지문'} />
          </div>
        );

      case 'problem-image':
        return wrap(
          <div key={block.key} className={problemClassName(block.snapshot, showAnswers)}>
            {/* 출처 표시는 글 문항과 같아야 한다 — 그림 문항만 빠지면 표기가 들쭉날쭉해진다 */}
            {settings.showSource && <SourceLine source={block.snapshot.source} />}
            <div className="pb-q__head">
              <span className="q-num q-num--mint">{String(block.number).padStart(2, '0')}</span>
            </div>
            <PrintImage path={block.path} urls={imageUrls} alt={`${block.number}번 문항`} />
            {/* 이미지 문항의 정답·해설도 교사용에는 있어야 한다 — 글로 옮기지 못했을 뿐
                채점은 똑같이 한다. 빠지면 그 문항만 답을 따로 찾게 된다 */}
            {showAnswers && <TeacherAnswer snapshot={block.snapshot} />}
          </div>,
          block.number,
          block.key,
        );

      case 'explanation-part':
        return (
          <div
            key={block.key}
            className={`pb-q__explanation pb-q__explanation--part${
              block.first ? ' pb-q__explanation--first' : ''
            }${block.last ? ' pb-q__explanation--last' : ''}`}
          >
            {/* 갈라 낸 해설은 문항과 다른 장에 찍힐 수 있다 — 첫 조각에 번호를 달아
                떨어져 나가도 어느 문항의 해설인지 알 수 있게 한다 */}
            {block.first && (
              <span className="pb-q__explanation-label">{block.number}번 해설</span>
            )}
            {/* 정화는 blocks.ts 가 이미 했다(쪼개기 전에 한 번) */}
            <div dangerouslySetInnerHTML={{ __html: block.html }} />
          </div>
        );

      case 'problem': {
        const question = (
          <PaperQuestion
            key={block.key}
            block={block}
            settings={settings}
            imageUrls={imageUrls}
            showAnswers={showAnswers}
          />
        );
        // 구분 줄은 그 문항의 첫 조각에만 붙는다 — 이어지는 조각마다 찍히면 안내가 되풀이된다
        return (block.range?.from ?? 0) === 0 ? wrap(question, block.number, block.key) : question;
      }

      default:
        return null;
    }
  });
}
