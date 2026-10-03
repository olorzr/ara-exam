'use client';

import type { ReactNode } from 'react';
import { sanitizeInlineHTML, sanitizeProblemHTML } from '@/lib/sanitize-problem';
import { choiceGlyph } from '@/lib/problem-bank/choices';
import { renderFiguresInHtml, unplacedFigures } from '@/lib/problem-bank/figure-render';
import { hasTabulatedChoices, matrixChoices, pairedChoices } from '@/lib/problem-bank/paired-choices';
import { correctChoiceIndices, splitsExplanation } from '@/lib/problem-paper/answers';
import type { PaperBlock } from '@/lib/problem-paper/blocks';
import { boxPartClassName } from '@/lib/problem-paper/box-parts';
import { stripTrailingEmptyParagraphs } from '@/lib/problem-paper/html-trim';
import { hasYetHangul } from '@/lib/yet-hangul';
import type { PaperItemSnapshot, PaperSettings } from '@/types/problem-bank';
import { PrintImage, SourceLine, TeacherAnswer } from './PaperPrintParts';
import { OmrSlotLabel, withOmrSheetBreak } from './PaperOmrMarks';
import PairedChoiceTable from '@/components/problem-bank/PairedChoiceTable';
import MatrixChoiceTable from '@/components/problem-bank/MatrixChoiceTable';

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
  /**
   * OMR 문제지의 90A 답안지 장 수. **2 이상일 때만** 객관식 번호 옆에 보조 표기(`2-1`)를 달고
   * 새 답안지가 시작되는 문항 앞에 구분 줄을 끼운다. 0·1 이면 아무것도 더하지 않는다.
   */
  omrSheetCount?: number;
}

/** 객관식이면 답안지 칸 표기를 단다 — 주관식은 답안지에 칠하지 않으니 칸이 없다 */
function slotFor(snapshot: PaperItemSnapshot, number: number, multiSheet: boolean): ReactNode {
  return multiSheet && snapshot.question_type === '객관식' ? <OmrSlotLabel number={number} /> : null;
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
        const className = `pb-passage-part${block.first ? ' pb-passage-part--first' : ''}${
          block.last ? ' pb-passage-part--last' : ''
        }${block.serif ? ' yet-hangul-serif' : ''}`;
        // 〈보기〉 상자·표 안에 남은 그림 자리표시자를 여기서 끼운다 — 구조를 자르지 않는다
        const body = { __html: renderFiguresInHtml(block.html, block.figures ?? [], imageUrls) };
        // 상자 밖 조각은 예전 DOM 그대로 — 틀을 더 두르면 잰 높이와 CSS 가 달라진다
        if (!block.box) return <div key={block.key} className={className} dangerouslySetInnerHTML={body} />;
        // 터뜨린 상자의 조각 — 틀은 React 가 두른다. 말머리는 타입으로 온 값이고(box-labels 를
        // 지났다) HTML 문자열을 잇지 않는다: 정화는 쪼개기 전에 끝났고 다시 하지 않는다
        return (
          <div key={block.key} className={className}>
            <blockquote
              data-box={block.box.label}
              className={boxPartClassName(block.box)}
              dangerouslySetInnerHTML={body}
            />
          </div>
        );
      }

      case 'passage-figure': {
        const image = <PrintImage path={block.path} urls={imageUrls} alt={`${block.label || '지문'} 자료`} />;
        return (
          <div key={block.key} className="pb-passage-part pb-figure">
            {/* 상자 안 그림도 같은 틀에 담는다 — 안 그러면 상자 윤곽이 그림 자리에서 끊긴다 */}
            {block.box
              ? <blockquote data-box={block.box.label} className={boxPartClassName(block.box)}>{image}</blockquote>
              : image}
          </div>
        );
      }

      case 'passage-image':
        return (
          <div key={block.key} className="pb-passage-part pb-passage-part--first pb-passage-part--last">
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
              {slotFor(block.snapshot, block.number, multiSheet)}
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

      case 'problem':
        return wrap(
          <ProblemBlock
            key={block.key}
            number={block.number}
            snapshot={block.snapshot}
            settings={settings}
            imageUrls={imageUrls}
            showAnswers={showAnswers}
            slot={slotFor(block.snapshot, block.number, multiSheet)}
          />,
          block.number,
          block.key,
        );

      default:
        return null;
    }
  });
}

/**
 * 문항 블록의 클래스 — 글 문항과 그림 문항이 **같은 함수**를 쓴다.
 *
 * ⚠️ `pb-q--continues` 는 "이 문항의 해설이 따로 흘러간다" 는 뜻이라, 판정을 블록을 만드는
 *    쪽([blocks.ts](../../lib/problem-paper/blocks.ts))과 **같은 `splitsExplanation`** 으로 해야 한다.
 *    갈리면 문항 사이 간격이 두 번 들어가거나(해설이 따로 나갔는데 문항이 제 여백을 그대로 짊)
 *    아예 사라진다(문항이 여백을 줄였는데 해설 조각이 안 나온다).
 * @param snapshot - 문항 스냅샷
 * @param showAnswers - 교사용인가 (학생 문제지에는 해설이 아예 안 나간다)
 * @param yetHangul - 옛한글 문항인가 (발문·선지는 고딕)
 * @returns 공백으로 이은 클래스 문자열
 */
function problemClassName(
  snapshot: PaperItemSnapshot, showAnswers: boolean, yetHangul = false,
): string {
  const classes = ['pb-q'];
  if (yetHangul) classes.push('yet-hangul');
  if (showAnswers && splitsExplanation(snapshot.explanation_html)) classes.push('pb-q--continues');
  return classes.join(' ');
}

interface ProblemBlockProps {
  number: number;
  snapshot: PaperItemSnapshot;
  settings: PaperSettings;
  imageUrls: Map<string, string>;
  showAnswers: boolean;
  /** 답안지 칸 보조 표기(OMR 문제지가 여러 장일 때만) */
  slot?: ReactNode;
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
function ProblemBlock({ number, snapshot, settings, imageUrls, showAnswers, slot = null }: ProblemBlockProps) {
  const objective = snapshot.question_type === '객관식' && snapshot.choices.length > 0;
  const paired = objective ? pairedChoices(snapshot.stem_html, snapshot.choices) : null;
  const matrix = objective && !paired ? matrixChoices(snapshot.stem_html, snapshot.choices) : null;
  const tabulated = objective && !paired && !matrix
    ? hasTabulatedChoices(snapshot.stem_html, snapshot.choices) : false;
  // 발문·선지의 옛한글은 **고딕**이다(지문만 명조 — CLAUDE.md 2026-09-15)
  const yetHangul = hasYetHangul([snapshot.stem_html, ...snapshot.choices].join(''));
  // 교사용에서 표시할 정답 선지. 객관식이 아니면 빈 배열이라 아무 선지도 안 걸린다.
  // **복수 정답이면 둘 다** 걸린다 — 답지에 `③, ⑤` 라고 적고 여기서 한 칸도 안 칠하면
  // 같은 문항이 두 인쇄물에서 다르게 읽힌다
  const answerIndices = showAnswers
    ? correctChoiceIndices(snapshot.question_type, snapshot.answer, snapshot.choices.length)
    : [];

  return (
    <div className={problemClassName(snapshot, showAnswers, yetHangul)}>
      {settings.showSource && <SourceLine source={snapshot.source} />}

      <div className="pb-q__head">
        <span className="q-num q-num--mint">{String(number).padStart(2, '0')}</span>
        {slot}
        <div className="pb-q__stem">
          {/* 끝에 붙은 빈 문단을 걷어낸다 — 그대로 두면 선지 앞에 빈 줄이 생긴다 */}
          <StemWithFigures
            html={stripTrailingEmptyParagraphs(sanitizeProblemHTML(paired?.stemHtml ?? matrix?.stemHtml ?? snapshot.stem_html))}
            paths={snapshot.figure_paths}
            imageUrls={imageUrls}
            number={number}
          />
        </div>
      </div>

      {objective && paired ? (
        <PairedChoiceTable rows={paired.rows} answerIndices={answerIndices} />
      ) : objective && matrix ? (
        <MatrixChoiceTable headers={matrix.headers} rows={matrix.rows} answerIndices={answerIndices} />
      ) : objective && !tabulated ? (
        <div className="pb-q__choices">
          {snapshot.choices.map((choice, i) => {
            const isAnswer = answerIndices.includes(i);
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
      ) : !objective && !showAnswers && (
        // 답 쓰는 자리는 **줄을 긋지 않고 비워 둔다**(2026-09-27 사용자 결정) — 18px 짜리
        // 줄에 글씨를 맞춰 넣기가 답답하다는 제보다. 서술형은 더 넓다.
        // 교사용에는 그리지 않는다 — 쓸 사람이 없다
        <div
          className={`pb-q__blank pb-q__blank--${snapshot.question_type === '서술형' ? 'long' : 'short'}`}
        />
      )}

      {showAnswers && <TeacherAnswer snapshot={snapshot} />}
    </div>
  );
}
