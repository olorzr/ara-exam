/**
 * 줄 번호 — `01` · `02` … 잡지 라벨 글꼴의 옅은 숫자. 꾸밈이라 화면 읽기 프로그램에는 숨긴다(차례는 `ol` 이 말한다).
 * @param props.n - 1부터
 */
export default function ItemNo({ n }: { n: number }) {
  return (
    <span aria-hidden="true" className="w-7 shrink-0 pt-0.5 font-label text-xs font-bold text-gray-400 tabular-nums">
      {String(n).padStart(2, '0')}
    </span>
  );
}
