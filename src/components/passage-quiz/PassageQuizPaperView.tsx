'use client';

import { useMemo, type ReactNode } from 'react';
import { A4Document, CompactPageHeader } from '@/components/print';
import ExamPrintHeader from '@/components/exam/ExamPrintHeader';
import { numberQuizItems, quizPaperTitle, splitPassageBlocks, type QuizItem } from '@/lib/passage-quiz';

/**
 * 지문으로 만든 문항의 **문제지** 인쇄 뷰.
 *
 * 지문은 문단마다 한 블록으로 나눠 넘긴다 — 한 덩어리로 주면 한 쪽에 못 담을 때
 * `A4Document` 가 통째로 축소해 글씨가 작아진다.
 * 번호는 `numberQuizItems` 가 매긴다(정답표와 **같은 함수**를 써야 번호가 어긋나지 않는다).
 */

interface PassageQuizPaperViewProps {
  text: string;
  title: string;
  author: string;
  items: QuizItem[];
}

/**
 * 문제지를 A4 쪽으로 그린다.
 * @param props - 만들 때 쓴 지문·제목·지은이와 문항 목록
 * @returns 인쇄용 문서
 */
export default function PassageQuizPaperView({
  text, title, author, items,
}: PassageQuizPaperViewProps) {
  const paperTitle = quizPaperTitle(title);

  const blocks = useMemo(() => {
    const out: ReactNode[] = [];
    const heading = [title.trim(), author.trim()].filter(Boolean).join(' · ');
    if (heading) out.push(<p key="heading" className="pb-passage-header">{heading}</p>);

    const parts = splitPassageBlocks(text);
    parts.forEach((part, i) => {
      // 연과 연 사이는 띄운다. 자리가 모자라 쪼갠 조각은 원래 이어지던 글이라 붙여 둔다
      const edge = `${i === 0 ? ' pb-passage-part--first' : ''}`
        + `${i === parts.length - 1 ? ' pb-passage-part--last' : ''}`
        + `${part.newParagraph && i > 0 ? ' pb-passage-part--gap' : ''}`;
      out.push(
        <div key={`passage-${i}`} className={`pb-passage-part${edge}`}>
          <p className="pb-quiz-passage">{part.text}</p>
        </div>,
      );
    });

    const numbered = numberQuizItems(items);
    const ox = numbered.filter((n) => n.item.kind === 'ox');
    const short = numbered.filter((n) => n.item.kind === 'short');

    if (ox.length > 0) {
      out.push(
        <div key="ox-bar" className="section-bar section-bar--mint">
          <span>O,X — 맞으면 O, 틀리면 X 를 쓰시오.</span>
        </div>,
      );
      // 답 쓰는 칸은 문항 오른쪽 끝에 — 지문을 보며 O·X 만 채우게 한다
      ox.forEach(({ item, number }) => out.push(
        <QuestionBlock key={item.id} number={number} text={item.text} tail={<span className="pb-quiz-box">(　　)</span>} />,
      ));
    }

    if (short.length > 0) {
      out.push(
        <div key="short-bar" className="section-bar section-bar--mint">
          <span>단답형 — 지문에서 찾아 쓰시오.</span>
        </div>,
      );
      short.forEach(({ item, number }) => out.push(
        <QuestionBlock
          key={item.id}
          number={number}
          text={item.text}
          // 주관식과 같은 두 줄 — 낱말 하나를 쓰는 자리다(서술형만 네 줄이다)
          below={<div className="pb-q__lines"><div className="pb-q__line" /><div className="pb-q__line" /></div>}
        />,
      ));
    }

    return out;
  }, [text, title, author, items]);

  return (
    <A4Document
      blocks={blocks}
      columns={1}
      className="pb-sheet"
      firstPageHeader={
        <ExamPrintHeader
          title={paperTitle}
          sourceLabels={[title.trim(), author.trim()].filter(Boolean)}
          showScoreRow
          totalCount={items.length}
        />
      }
      laterPageHeader={<CompactPageHeader title={paperTitle} />}
    />
  );
}

/** 문항 한 개 — 발문과 답 자리가 한 블록이다(갈리면 읽을 수 없다) */
function QuestionBlock({
  number, text, tail, below,
}: { number: number; text: string; tail?: ReactNode; below?: ReactNode }) {
  return (
    <div className="pb-q">
      <div className="pb-q__head">
        <span className="q-num q-num--mint">{String(number).padStart(2, '0')}</span>
        <div className="pb-q__stem"><p>{text}</p></div>
        {tail}
      </div>
      {below}
    </div>
  );
}
