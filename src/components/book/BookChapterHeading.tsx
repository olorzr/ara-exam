interface BookChapterHeadingProps {
  /** 장 번호(1부터) */
  number: number;
  title: string;
  /** 출처 요약(문제지의 `source_labels`) — 비면 줄을 그리지 않는다 */
  sources: readonly string[];
}

/**
 * 장 머리 — 내지에서 장마다 첫 블록이다(엔진의 `breakBefore` 가 이 블록 앞에서 쪽을 넘긴다).
 *
 * ⚠️ `.pb-sheet` 안에서 그려진다 — `.pb-sheet p` 의 문단 여백이 새어 들지 않게 `p` 를 쓰지 않는다
 *    (표지 디자인 base.css 의 교훈). 높이는 엔진이 실제로 재므로 글이 길어 줄이 늘어도 잘리지 않는다.
 */
export default function BookChapterHeading({ number, title, sources }: BookChapterHeadingProps) {
  return (
    <div className="bk-chapter">
      <div className="bk-chapter__no">{number}장</div>
      <h2 className="bk-chapter__title">{title || '제목 없는 장'}</h2>
      {sources.length > 0 && <div className="bk-chapter__meta">{sources.join(' · ')}</div>}
    </div>
  );
}
