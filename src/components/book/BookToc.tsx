/** 쪽 번호를 아직 모를 때 칸에 넣는 글 — 글자 없이 줄 상자만 세운다(채워도 줄 높이가 같게) */
const PENDING_PAGE = ' ';

/**
 * 목차 머리 — 내지 맨 앞 블록이다(1장은 `breakBefore` 로 그다음 쪽에서 시작한다).
 *
 * ⚠️ `.pb-sheet` 안에서 그려진다 — `.pb-sheet p` 의 문단 여백이 새어 들지 않게 `p` 를 쓰지 않는다(장 머리와 같은 규약).
 */
export function BookTocHeading() {
  return (
    <div className="bk-toc">
      <h2 className="bk-toc__head">목차</h2>
    </div>
  );
}

interface BookTocRowProps {
  /** 장 번호(1부터) */
  number: number;
  title: string;
  /** 인쇄 쪽 번호 — 엔진이 배치를 알리기 전에는 null */
  page: number | null;
}

/**
 * 목차 한 줄 — 장 번호 · 제목 · 점선 · 시작 쪽.
 *
 * ⚠️ 쪽 번호 칸은 **폭이 고정**이다(book.css `.bk-toc__page`). 번호가 채워지면 블록이 바뀌어 엔진이 다시 재는데,
 *    줄 높이가 숫자와 무관해야 배치가 그대로라 쪽 번호가 다시 바뀌지 않는다(수렴 조건). 칸을 글자 폭으로 바꾸면
 *    제목 줄바꿈이 숫자 자릿수를 따라 흔들려 목차가 쪽을 넘나들 수 있다.
 */
export function BookTocRow({ number, title, page }: BookTocRowProps) {
  return (
    <div className="bk-toc__row">
      <span className="bk-toc__no">{number}장</span>
      <span className="bk-toc__title">{title || '제목 없는 장'}</span>
      <span className="bk-toc__leader" aria-hidden="true" />
      <span className="bk-toc__page" data-pending={page === null ? '' : undefined}>
        {page === null ? PENDING_PAGE : page}
      </span>
    </div>
  );
}
