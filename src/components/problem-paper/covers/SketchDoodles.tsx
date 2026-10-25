/**
 * E 스케치의 손그림 — 별 둘, 선생님·학생 칸 사이 점선 화살표 하나, 아래 물결 하나. 전부 꾸밈이다.
 * 경로는 시안 그대로이고 자리는 sketch.css 가 준다. 뒷표지(BackCover)도 별·물결을 쓴다.
 */

const STAR = 'M20 4 L22 17 L36 20 L22 23 L20 36 L18 23 L4 20 L18 17 Z';
const WAVE =
  'M2 20 C 20 14, 30 26, 48 18 S 80 8, 98 20 S 130 28, 150 14 S 190 6, 210 20 S 250 28, 270 16 S 290 10, 298 20';
const ARROW = ['M4 40 C 60 10, 130 10, 190 34', 'M180 26 L191 34 L180 40'] as const;

/** 별 둘 — 제목 끝자리 */
export function SketchStars() {
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
    </>
  );
}

/** 아래 물결 */
export function SketchWave() {
  return (
    <svg
      className="pbc-sketch__doodle pbc-sketch__doodle--wave" width="300" height="30" viewBox="0 0 300 30"
      fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" aria-hidden="true"
    >
      <path d={WAVE} />
    </svg>
  );
}

/**
 * 스케치 표지의 손그림.
 * @param props.arrow - 선생님·학생 칸이 둘 다 있을 때만 사이를 잇는 화살표를 그린다
 */
export default function SketchDoodles({ arrow }: { arrow: boolean }) {
  return (
    <>
      <SketchStars />
      {arrow && (
        <svg
          className="pbc-sketch__doodle pbc-sketch__doodle--arrow" width="200" height="60" viewBox="0 0 200 60"
          fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="4 5"
          aria-hidden="true"
        >
          {ARROW.map((d) => <path key={d} d={d} />)}
        </svg>
      )}
      <SketchWave />
    </>
  );
}
