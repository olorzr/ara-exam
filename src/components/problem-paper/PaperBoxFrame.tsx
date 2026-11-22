import type { ReactNode } from 'react';
import { boxPartClassName, type BoxPart } from '@/lib/problem-paper/box-parts';

interface PaperBoxFrameProps {
  /** 바깥 틀 — 터뜨린 구역 상자의 표시 */
  box: BoxPart;
  /** 안쪽 틀 — 겹친 상자(구역 안의 [A] 등)를 문단마다 풀었을 때만 */
  inner?: BoxPart;
  /** 틀 안에 넣을 HTML(정화가 끝난 것). `children` 과 함께 주지 않는다 */
  html?: string;
  /** 틀 안에 넣을 노드(그림 조각) */
  children?: ReactNode;
}

/**
 * 터뜨린 상자 조각의 틀 — 지문 글 조각·그림 조각·발문 조각이 **같은 부품**을 쓴다.
 *
 * 안쪽 틀이 없으면 예전과 같은 `<blockquote>` 한 겹이다(쪼개지 않은 모양이 글자 하나까지 같아야 한다).
 * 겹친 상자를 풀었으면 바깥 틀 안에 안쪽 틀을 한 겹 더 두른다(box-parts.ts). 말머리는 타입으로 온 값이라
 * (box-labels 를 지났다) HTML 문자열을 잇지 않는다 — 정화는 쪼개기 전에 끝났고 다시 하지 않는다.
 * @param props - 틀 표시와 내용
 * @returns 틀을 두른 요소
 */
export default function PaperBoxFrame({ box, inner, html, children }: PaperBoxFrameProps) {
  const body = html === undefined ? undefined : { __html: html };
  if (!inner) {
    return body
      ? <blockquote data-box={box.label ?? undefined} className={boxPartClassName(box)} dangerouslySetInnerHTML={body} />
      : <blockquote data-box={box.label ?? undefined} className={boxPartClassName(box)}>{children}</blockquote>;
  }
  return (
    <blockquote data-box={box.label ?? undefined} className={boxPartClassName(box, inner)}>
      {body
        ? <blockquote data-box={inner.label ?? undefined} className={boxPartClassName(inner)} dangerouslySetInnerHTML={body} />
        : <blockquote data-box={inner.label ?? undefined} className={boxPartClassName(inner)}>{children}</blockquote>}
    </blockquote>
  );
}
