'use client';

import type { ReactNode } from 'react';
import { sanitizeInlineHTML, sanitizeProblemHTML } from '@/lib/sanitize-problem';
import { choiceGlyph } from '@/lib/problem-bank/choices';
import { renderFiguresInHtml, unplacedFigures } from '@/lib/problem-bank/figure-render';
import { correctChoiceIndex } from '@/lib/problem-paper/answers';
import type { PaperBlock } from '@/lib/problem-paper/blocks';
import { stripTrailingEmptyParagraphs } from '@/lib/problem-paper/html-trim';
import { hasYetHangul } from '@/lib/yet-hangul';
import type { PaperItemSnapshot, PaperSettings } from '@/types/problem-bank';
import { PrintImage, SourceLine, TeacherAnswer } from './PaperPrintParts';

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
  blocks: PaperBlock[];
  settings: PaperSettings;
  /** Storage 경로 → 서명 URL */
  imageUrls: Map<string, string>;
  /**
   * 교사용인가 — 정답 선지에 표시를 하고 문항 밑에 답·해설을 붙인다.
   * 학생이 쓸 답 줄은 그리지 않는다(선생님 종이에는 쓸 일이 없다).
   */
  showAnswers?: boolean;
}

/**
 * 블록을 A4Document 가 받는 ReactNode 배열로 바꾼다.
 * @param args - 블록·설정·이미지 URL·교사용 여부
 * @returns 블록 순서 그대로의 노드 배열
 */
export function renderPaperBlocks({
  blocks, settings, imageUrls, showAnswers = false,
}: RenderArgs): ReactNode[] {
  return blocks.map((block) => {
    switch (block.kind) {
      case 'passage-header':
        return <p key={block.key} className="pb-passage-header">{block.text}</p>;

      case 'passage-part':
        return (
          <div
            key={block.key}
            // 옛한글 지문은 명조로 — 판정은 blocks.ts 가 지문 전체로 한 번 해서 모든 조각에 싣는다
            className={`pb-passage-part${block.first ? ' pb-passage-part--first' : ''}${
              block.last ? ' pb-passage-part--last' : ''
            }${block.serif ? ' yet-hangul-serif' : ''}`}
            // 〈보기〉 상자·표 안에 남은 그림 자리표시자를 여기서 끼운다 — 구조를 자르지 않는다
            dangerouslySetInnerHTML={{
              __html: renderFiguresInHtml(block.html, block.figures ?? [], imageUrls),
            }}
          />
        );

      case 'passage-figure':
        return (
          <div key={block.key} className="pb-passage-part pb-figure">
            <PrintImage path={block.path} urls={imageUrls} alt={`${block.label || '지문'} 자료`} />
          </div>
        );

      case 'passage-image':
        return (
          <div key={block.key} className="pb-passage-part pb-passage-part--first pb-passage-part--last">
            <PrintImage path={block.path} urls={imageUrls} alt={block.label || '지문'} />
          </div>
        );

      case 'problem-image':
        return (
          <div key={block.key} className="pb-q">
            {/* 출처 표시는 글 문항과 같아야 한다 — 그림 문항만 빠지면 표기가 들쭉날쭉해진다 */}
            {settings.showSource && <SourceLine source={block.snapshot.source} />}
            <div className="pb-q__head">
              <span className="q-num q-num--mint">{String(block.number).padStart(2, '0')}</span>
            </div>
            <PrintImage path={block.path} urls={imageUrls} alt={`${block.number}번 문항`} />
            {/* 이미지 문항의 정답·해설도 교사용에는 있어야 한다 — 글로 옮기지 못했을 뿐
                채점은 똑같이 한다. 빠지면 그 문항만 답을 따로 찾게 된다 */}
            {showAnswers && <TeacherAnswer snapshot={block.snapshot} />}
          </div>
        );

      case 'problem':
        return (
          <ProblemBlock
            key={block.key}
            number={block.number}
            snapshot={block.snapshot}
            settings={settings}
            imageUrls={imageUrls}
            showAnswers={showAnswers}
          />
        );

      default:
        return null;
    }
  });
}

interface ProblemBlockProps {
  number: number;
  snapshot: PaperItemSnapshot;
  settings: PaperSettings;
  imageUrls: Map<string, string>;
  showAnswers: boolean;
}

/**
 * 발문을 그리되 **그림 자리표시자 자리에 그림을 끼운다.**
 *
 * ⚠️ HTML 을 자리표시자에서 **잘라 나누지 않는다** — 〈보기〉 상자 안의 그림에서
 *    상자가 먼저 닫혀 그림과 뒷글이 밖으로 튀어나온다(화면 쪽과 같은 규약).
 * ⚠️ 자리표시자가 없는데 그림이 있으면 **발문 끝에** 붙인다. 안 그리면 인쇄물에서
 *    자료가 통째로 빠진 문항이 나가는데, 그건 화면을 봐서는 알 수 없는 결함이다.
 */
function StemWithFigures({
  html, paths, imageUrls, number,
}: { html: string; paths: readonly string[]; imageUrls: Map<string, string>; number: number }) {
  const trailing = unplacedFigures(html, paths);

  return (
    <>
      {/* 정화는 호출부가 이미 했다 — 여기서 다시 하면 넣은 <img> 가 통째로 사라진다 */}
      <div dangerouslySetInnerHTML={{ __html: renderFiguresInHtml(html, paths, imageUrls) }} />
      {trailing.length > 0 && (
        <div className="pb-figure">
          {trailing.map(({ path }) => (
            <PrintImage key={path} path={path} urls={imageUrls} alt={`${number}번 자료`} />
          ))}
        </div>
      )}
    </>
  );
}

/** 문항 하나 — 출처·발문·선지·삽화(교사용이면 답까지)가 한 블록이다(갈리면 읽을 수 없다) */
function ProblemBlock({ number, snapshot, settings, imageUrls, showAnswers }: ProblemBlockProps) {
  const objective = snapshot.question_type === '객관식' && snapshot.choices.length > 0;
  // 발문·선지의 옛한글은 **고딕**이다(지문만 명조 — CLAUDE.md 2026-09-15)
  const yetHangul = hasYetHangul([snapshot.stem_html, ...snapshot.choices].join(''));
  // 교사용에서 표시할 정답 선지. 객관식이 아니면 null 이라 아무 선지도 안 걸린다
  const answerIndex = showAnswers ? correctChoiceIndex(snapshot.question_type, snapshot.answer) : null;

  return (
    <div className={`pb-q${yetHangul ? ' yet-hangul' : ''}`}>
      {settings.showSource && <SourceLine source={snapshot.source} />}

      <div className="pb-q__head">
        <span className="q-num q-num--mint">{String(number).padStart(2, '0')}</span>
        <div className="pb-q__stem">
          {/* 끝에 붙은 빈 문단을 걷어낸다 — 그대로 두면 선지 앞에 빈 줄이 생긴다 */}
          <StemWithFigures
            html={stripTrailingEmptyParagraphs(sanitizeProblemHTML(snapshot.stem_html))}
            paths={snapshot.figure_paths}
            imageUrls={imageUrls}
            number={number}
          />
        </div>
      </div>

      {objective ? (
        <div className="pb-q__choices">
          {snapshot.choices.map((choice, i) => {
            const isAnswer = answerIndex === i;
            return (
              <span key={i} className={`pb-q__choice${isAnswer ? ' pb-q__choice--answer' : ''}`}>
                <span className="pb-q__choice-glyph">{choiceGlyph(i)}</span>
                <span dangerouslySetInnerHTML={{ __html: sanitizeInlineHTML(choice) }} />
                {/* 색만으로 알리지 않는다 — 흑백으로 뽑으면 바탕색이 거의 사라진다 */}
                {isAnswer && <span className="pb-q__choice-answer-mark">정답</span>}
              </span>
            );
          })}
        </div>
      ) : !showAnswers && (
        <div className="pb-q__lines">
          {/* 서술형은 쓸 자리가 더 필요하다. 교사용에는 그리지 않는다 — 쓸 사람이 없다 */}
          {Array.from({ length: snapshot.question_type === '서술형' ? 4 : 2 }, (_, i) => (
            <div key={i} className="pb-q__line" />
          ))}
        </div>
      )}

      {showAnswers && <TeacherAnswer snapshot={snapshot} />}
    </div>
  );
}
