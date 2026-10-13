/**
 * E 스케치의 손그림 — 별 둘, 단원 사이를 잇는 점선 화살표 셋, 아래 물결 하나. 전부 꾸밈이다.
 * 경로는 시안 그대로이고 자리는 sketch.css 가 준다.
 */

const STAR = 'M20 4 L22 17 L36 20 L22 23 L20 36 L18 23 L4 20 L18 17 Z';
const WAVE =
  'M2 20 C 20 14, 30 26, 48 18 S 80 8, 98 20 S 130 28, 150 14 S 190 6, 210 20 S 250 28, 270 16 S 290 10, 298 20';

/** 화살표 — `from` 번째 단원에서 다음 단원으로(1·2 → 2·3 → 3·4) */
const ARROWS = [
  { from: 1, w: 200, h: 60, paths: ['M4 40 C 60 10, 130 10, 190 34', 'M180 26 L191 34 L180 40'] },
  { from: 2, w: 120, h: 110, paths: ['M100 6 C 118 50, 60 80, 14 102', 'M22 92 L13 103 L26 104'] },
  { from: 3, w: 200, h: 60, paths: ['M4 20 C 60 52, 130 52, 190 26', 'M180 20 L191 26 L180 34'] },
] as const;

/**
 * 스케치 표지의 손그림.
 * @param props.topicCount - 격자에 실린 단원 수 — 화살표는 이어 줄 단원이 있을 때만 그린다
 */
export default function SketchDoodles({ topicCount }: { topicCount: number }) {
  return (
    <>
      <svg
        className="pbc-sketch__doodle pbc-sketch__doodle--star-a" width="40" height="40" viewBox="0 0 40 40"
        fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true"
      >
        <path d={STAR} />
      </svg>
      <svg
        className="pbc-sketch__doodle pbc-sketch__doodle--star-b" width="22" height="22" viewBox="0 0 40 40"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"
      >
        <path d={STAR} />
      </svg>
      {ARROWS.filter((a) => a.from < topicCount).map((a) => (
        <svg
          key={a.from}
          className={`pbc-sketch__doodle pbc-sketch__doodle--arrow-${a.from}`}
          width={a.w} height={a.h} viewBox={`0 0 ${a.w} ${a.h}`}
          fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="4 5"
          aria-hidden="true"
        >
          {a.paths.map((d) => <path key={d} d={d} />)}
        </svg>
      ))}
      <svg
        className="pbc-sketch__doodle pbc-sketch__doodle--wave" width="300" height="30" viewBox="0 0 300 30"
        fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" aria-hidden="true"
      >
        <path d={WAVE} />
      </svg>
    </>
  );
}
