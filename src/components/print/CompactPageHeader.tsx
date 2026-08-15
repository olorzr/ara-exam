interface CompactPageHeaderProps {
  title: string;
  /** 하단 구분선 색 계열 — 문서 테마에 맞춘다 */
  accent?: 'mint' | 'pink';
}

/**
 * 2페이지 이후 매 페이지 상단에 반복되는 한 줄 헤더.
 * 1페이지의 전체 헤더(이름/날짜/점수란)를 반복하면 본문이 밀리므로 제목만 남긴다.
 */
export default function CompactPageHeader({ title, accent = 'mint' }: CompactPageHeaderProps) {
  return (
    <div className={`a4-compact-header a4-compact-header--${accent}`}>
      <span className="a4-compact-header__title">{title}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="아라국어논술" width={18} height={18} className="object-contain" />
    </div>
  );
}
