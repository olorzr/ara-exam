import type { ReactNode } from 'react';

interface TileHeadProps {
  /** 영문 작은 라벨 — `SHEET` → `( SHEET )` */
  label: string;
  /** 꼭지 번호(1부터) — 없으면 오른쪽에 `aside` 를 둔다 */
  no?: number;
  /** 번호 대신 오른쪽에 둘 것(지우기 단추 등) */
  aside?: ReactNode;
}

/**
 * 잡지 꼭지 머리 — `( SHEET )   #01`. 대시보드 빠른 실행·기출 세트 카드와 같은 결이다(2026-11-14).
 * 라벨·번호는 꾸밈이라 화면 읽기 프로그램에는 숨긴다. `aside` 는 숨기지 않는다(단추가 들어간다).
 */
export default function TileHead({ label, no, aside }: TileHeadProps) {
  return (
    <span className="flex items-center justify-between gap-2">
      <span aria-hidden="true" className="font-label text-[10px] font-medium tracking-[0.18em] text-ink">( {label} )</span>
      {no !== undefined && (
        <b aria-hidden="true" className="font-label text-xl font-extrabold tracking-[0.02em] text-ink">
          #{String(no).padStart(2, '0')}
        </b>
      )}
      {aside}
    </span>
  );
}
