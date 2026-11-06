'use client';

import type { ReactNode } from 'react';
import { choiceGlyph } from '@/lib/problem-bank/choices';
import { renderFiguresInHtml } from '@/lib/problem-bank/figure-render';
import { correctChoiceIndices, splitsExplanation } from '@/lib/problem-paper/answers';
import type { PaperProblemBlock } from '@/lib/problem-paper/blocks';
import { boxPartClassName } from '@/lib/problem-paper/box-parts';
import { questionChoiceLayout, type QuestionUnit } from '@/lib/problem-paper/question-units';
import { sanitizeInlineHTML } from '@/lib/sanitize-problem';
import { yetHangulClass } from '@/lib/yet-hangul';
import type { PaperItemSnapshot, PaperSettings } from '@/types/problem-bank';
import MatrixChoiceTable from '@/components/problem-bank/MatrixChoiceTable';
import PairedChoiceTable from '@/components/problem-bank/PairedChoiceTable';
import { PrintImage, SourceLine, TeacherAnswer } from './PaperPrintParts';

/**
 * 문항의 클래스 — 글 문항과 그림 문항이 **같은 함수**를 쓴다.
 *
 * ⚠️ `pb-q--continues` 는 "이 문항의 해설이 따로 흘러간다" 는 뜻이라, 판정을 블록을 만드는
 *    쪽([blocks.ts](../../lib/problem-paper/blocks.ts))과 **같은 `splitsExplanation`** 으로 해야 한다.
 *    갈리면 문항 사이 간격이 두 번 들어가거나(해설이 따로 나갔는데 문항이 제 여백을 그대로 짊)
 *    아예 사라진다(문항이 여백을 줄였는데 해설 조각이 안 나온다).
 * @param snapshot - 문항 스냅샷
 * @param showAnswers - 교사용인가 (학생 문제지에는 해설이 아예 안 나간다)
 * @returns 공백으로 이은 클래스 문자열
 */
export function problemClassName(snapshot: PaperItemSnapshot, showAnswers: boolean): string {
  const classes = ['pb-q'];
  if (showAnswers && splitsExplanation(snapshot.explanation_html)) classes.push('pb-q--continues');
  return classes.join(' ');
}

interface PaperQuestionProps {
  block: PaperProblemBlock;
  settings: PaperSettings;
  imageUrls: Map<string, string>;
  showAnswers: boolean;
  /** 답안지 칸 보조 표기(OMR 문제지가 여러 장일 때만) */
  slot?: ReactNode;
}

/** 발문 칸에 드는 단위 */
type StemUnit = Extract<QuestionUnit, { kind: 'head' | 'stem' | 'figure' }>;

const isStemUnit = (unit: QuestionUnit): unit is StemUnit =>
  unit.kind === 'head' || unit.kind === 'stem' || unit.kind === 'figure';

/**
 * 발문 조각 하나.
 *
 * 조각마다 제 요소라 재는 쪽이 단위 끝을 안다. 상자 조각의 틀은 지문과 같이 React 가 두른다. 정화는 단위를 만들 때
 * 끝났고(각주 class 가 사라지므로 다시 하지 않는다), 그림 자리표시자는 조각 안에서 끼운다 — 상자 안의 그림에서
 * HTML 을 자르지 않는다.
 */
function StemPiece({
  unit, paths, imageUrls, number,
}: { unit: StemUnit; paths: readonly string[]; imageUrls: Map<string, string>; number: number }) {
  if (unit.kind === 'figure') {
    return (
      <div className="pb-q__unit pb-figure" data-q-unit="">
        <PrintImage path={unit.path} urls={imageUrls} alt={`${number}번 자료`} />
      </div>
    );
  }
  const body = { __html: renderFiguresInHtml(unit.html, paths, imageUrls) };
  if (!unit.box) return <div className="pb-q__unit" data-q-unit="" dangerouslySetInnerHTML={body} />;
  return (
    <div className="pb-q__unit" data-q-unit="">
      <blockquote
        data-box={unit.box.label ?? undefined}
        className={boxPartClassName(unit.box)}
        dangerouslySetInnerHTML={body}
      />
    </div>
  );
}

/**
 * 문항 하나, 또는 그 조각 하나 — 자리가 모자라면 단위 사이에서 갈려 다음 단으로 이어진다(2026-11-06 원장 결정).
 *
 * 번호·출처·OMR 칸은 첫 조각에만 찍는다. 이어지는 조각은 번호 칸을 비워 같은 들여쓰기로 시작하고, 문항 사이 간격은
 * 마지막 조각만 진다. 교사용 답은 마지막 선지에 붙어 간다.
 */
export default function PaperQuestion({ block, settings, imageUrls, showAnswers, slot = null }: PaperQuestionProps) {
  const { number, snapshot, units } = block;
  const { from, to } = block.range ?? { from: 0, to: units.length };
  const shown = units.slice(from, to);
  const stem = shown.filter(isStemUnit);
  const choices = shown.flatMap((unit) => (unit.kind === 'choice' ? [unit.index] : []));
  const has = (kind: QuestionUnit['kind']) => shown.some((unit) => unit.kind === kind);

  const { paired, matrix } = questionChoiceLayout(snapshot);
  // 교사용에서 표시할 정답 선지. 객관식이 아니면 빈 배열이라 아무 선지도 안 걸린다.
  // **복수 정답이면 둘 다** 걸린다 — 답지에 `③, ⑤` 라고 적고 여기서 한 칸도 안 칠하면
  // 같은 문항이 두 인쇄물에서 다르게 읽힌다
  const answerIndices = showAnswers
    ? correctChoiceIndices(snapshot.question_type, snapshot.answer, snapshot.choices.length)
    : [];

  const first = from === 0;
  const last = to === units.length;
  const className = [
    // 해설이 따로 흘러가는 표시는 해설 조각이 바로 뒤에 오는 마지막 조각에만
    problemClassName(snapshot, last && showAnswers),
    first ? '' : 'pb-q--cont',
    last && !block.tight ? '' : 'pb-q--split',
  ].filter(Boolean).join(' ');

  return (
    <div className={className}>
      {first && settings.showSource && <SourceLine source={snapshot.source} />}

      {stem.length > 0 && (
        <div className="pb-q__head">
          {first
            ? <span className="q-num q-num--mint">{String(number).padStart(2, '0')}</span>
            : <span className="q-num q-num--blank">{' '}</span>}
          {first && slot}
          <div className="pb-q__stem">
            {stem.map((unit, i) => (
              <StemPiece key={i} unit={unit} paths={snapshot.figure_paths} imageUrls={imageUrls} number={number} />
            ))}
          </div>
        </div>
      )}

      {has('choices-table') && (
        <div data-q-unit="">
          {paired
            ? <PairedChoiceTable rows={paired.rows} answerIndices={answerIndices} />
            : matrix && <MatrixChoiceTable headers={matrix.headers} rows={matrix.rows} answerIndices={answerIndices} />}
        </div>
      )}

      {choices.length > 0 && (
        <div className="pb-q__choices">
          {choices.map((i) => {
            const isAnswer = answerIndices.includes(i);
            const text = sanitizeInlineHTML(snapshot.choices[i]);
            return (
              <span key={i} className={`pb-q__choice${isAnswer ? ' pb-q__choice--answer' : ''}`} data-q-unit="">
                <span className="pb-q__choice-glyph">{choiceGlyph(i)}</span>
                {/* 옛한글 글꼴은 이 글자에만 — 선지 기호·다른 선지까지 바뀌면 문항 전체가 굵어 보인다 */}
                <span className={yetHangulClass(text)} dangerouslySetInnerHTML={{ __html: text }} />
                {/* 색만으로 알리지 않는다 — 흑백으로 뽑으면 바탕색이 거의 사라진다 */}
                {isAnswer && <span className="pb-q__choice-answer-mark">정답</span>}
              </span>
            );
          })}
        </div>
      )}

      {/* 답 쓰는 자리는 **줄을 긋지 않고 비워 둔다**(2026-09-27 사용자 결정) — 18px 짜리
          줄에 글씨를 맞춰 넣기가 답답하다는 제보다. 서술형은 더 넓다. 교사용에는 단위가 없다 */}
      {has('blank') && (
        <div
          className={`pb-q__blank pb-q__blank--${snapshot.question_type === '서술형' ? 'long' : 'short'}`}
          data-q-unit=""
        />
      )}

      {has('answer') && <div data-q-unit=""><TeacherAnswer snapshot={snapshot} /></div>}
    </div>
  );
}
