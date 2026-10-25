/**
 * F 라인드로잉의 선 그림 — 시안(Zine.dc.html, 2026-10-25) 의 SVG 경로를 **그대로** 옮겼다(색만 currentColor).
 * 자리는 zine.css 가 준다. 그림은 꾸밈이라 모두 `aria-hidden` 이다.
 *
 * 경로 묶음은 원본 문서에서 기계로 뽑았다 — 손으로 고치지 말고 시안이 바뀌면 다시 뽑을 것.
 */

/** 그림 한 획 — 기본은 선만, `fill` 은 선 + 채움, `solid` 는 채움만, `hole` 은 흰 구멍 */
interface Mark {
  d: string;
  fill?: true;
  solid?: true;
  hole?: true;
  width?: number;
}

const CUP: readonly Mark[] = [
  { d: 'M8 12 L12 38 L30 38 L34 12 Z' },
  { d: 'M6 12 L36 12' },
  { d: 'M12 20 L30 20' },
  { d: 'M14 26 L28 26 L26 34 L16 34 Z', fill: true },
];

const BOX1: readonly Mark[] = [
  { d: 'M40 72 L48 160 Q50 172 62 172 L158 172 Q170 172 172 160 L180 72' },
  { d: 'M40 72 A70 14 0 1 0 180 72 A70 14 0 1 0 40 72 Z' },
  { d: 'M180 92 Q226 86 226 116 Q226 146 180 142' },
  { d: 'M150 12 L172 34 L112 94 L92 100 L98 80 Z' },
  { d: 'M141 21 L163 43' },
  { d: 'M98 80 L112 94 L92 100 Z', fill: true },
  { d: 'M58 82 Q54 104 62 126 Q66 134 60 138 Q52 128 50 104 Q48 90 58 82 Z', solid: true },
  { d: 'M30 184 L190 184' },
  { d: 'M250 70 L300 48 L352 70 L352 130 L300 152 L250 130 Z' },
  { d: 'M250 70 L300 92 L352 70' },
  { d: 'M300 92 L300 152' },
  { d: 'M300 92 L300 152 L352 130 L352 70 Z', solid: true },
  { d: 'M262 92 L262 122' },
  { d: 'M236 150 Q260 142 272 160' },
  { d: 'M380 150 Q440 118 500 150 Q560 118 620 150 L620 62 Q560 30 500 62 Q440 30 380 62 Z' },
  { d: 'M500 62 L500 150' },
  { d: 'M400 80 L480 56' },
  { d: 'M400 98 L480 74' },
  { d: 'M400 116 L470 94' },
  { d: 'M520 56 L600 80' },
  { d: 'M520 74 L600 98' },
  { d: 'M520 94 L590 116' },
  { d: 'M560 44 L560 112 L572 100 L584 112 L584 50 Z', solid: true },
  { d: 'M370 150 Q500 184 630 150' },
];

const BOX2: readonly Mark[] = [
  { d: 'M40 130 L40 200 L230 200 L230 130 Z' },
  { d: 'M40 130 L58 112 L248 112 L230 130' },
  { d: 'M230 130 L248 112 L248 182 L230 200' },
  { d: 'M40 130 L40 200 L58 200 L58 130 Z', solid: true },
  { d: 'M30 90 L30 130 L220 130 L220 90 Z' },
  { d: 'M30 90 L48 72 L238 72 L220 90' },
  { d: 'M220 90 L238 72 L238 112' },
  { d: 'M60 110 L200 110' },
  { d: 'M50 46 L50 72 L232 72 L232 46 Z' },
  { d: 'M50 46 L68 30 L250 30 L232 46' },
  { d: 'M232 46 L250 30 L250 60' },
  { d: 'M160 30 L160 72 L172 62 L184 72 L184 30 Z', solid: true },
  { d: 'M330 60 L590 40 L612 300 L352 318 Z' },
  { d: 'M360 100 Q390 86 420 100 T480 100 T540 96' },
  { d: 'M364 130 Q394 116 424 130 T484 130 T552 126' },
  { d: 'M368 160 Q398 146 428 160 T488 160' },
  { d: 'M372 190 Q402 176 432 190 T470 190' },
  { d: 'M520 290 Q540 250 572 236 Q596 226 604 246 Q610 264 586 274 L552 296' },
  { d: 'M552 296 Q530 316 506 304 Q488 294 500 274 L520 250' },
  { d: 'M560 240 L596 160 L612 166 L578 246' },
  { d: 'M596 160 L604 142 L612 166' },
  { d: 'M604 142 L608 150', fill: true },
  { d: 'M470 206 L480 220' },
  { d: 'M470 206 Q466 196 474 192 Q482 190 484 198 Q488 206 480 212 Z', solid: true },
  { d: 'M498 170 Q494 160 502 158 Q510 158 510 166 Q512 176 504 178 Z', solid: true },
  { d: 'M444 224 Q440 214 448 212 Q456 212 456 220 Q458 230 450 232 Z', solid: true },
  { d: 'M430 40 L470 36 L478 90 Q480 100 470 102 L442 104 Q432 104 432 94 Z' },
  { d: 'M436 48 L472 46' },
  { d: 'M444 62 L464 60' },
  { d: 'M300 230 Q312 250 300 270 Q292 284 304 300 Q314 312 302 324', width: 4 },
];

const BOX3: readonly Mark[] = [
  { d: 'M26 40 L26 92 Q26 104 38 104 L52 104 Q64 104 64 92 L64 30 Q64 18 52 18 L40 18 Q28 18 28 30 L28 84 Q28 92 36 92 L44 92 Q52 92 52 84 L52 40' },
  { d: 'M90 30 L150 24 L156 80 L96 86 Z' },
  { d: 'M150 24 L156 80 L120 84 Q140 70 150 24 Z', solid: true },
  { d: 'M100 46 L140 42' },
  { d: 'M104 60 L136 56' },
  { d: 'M176 48 Q198 40 212 60 Q226 80 206 94 Q186 106 170 90 Q156 72 176 48 Z' },
  { d: 'M190 72 L190 56' },
  { d: 'M190 72 L204 76' },
  { d: 'M30 136 L110 126 L120 150 L36 156 Z' },
  { d: 'M110 126 L120 150 L138 134 Z', solid: true },
  { d: 'M160 128 Q166 122 172 128' },
  { d: 'M186 140 Q192 134 198 140' },
  { d: 'M206 120 Q212 114 218 120' },
  { d: 'M148 150 Q154 144 160 150' },
];

const BLOB: readonly Mark[] = [
  // 시안은 svg 뿌리가 채움(#111)이라 이 획은 채움만이다
  { d: 'M60 34 Q96 20 116 46 Q134 70 118 96 Q104 120 76 118 Q46 116 36 90 Q28 64 48 46 Z', solid: true },
  { d: 'M70 60 Q84 54 90 66 Q94 76 82 80 Q68 82 66 70 Z', hole: true },
  { d: 'M54 98 Q62 92 68 100 Q66 108 58 106 Z', hole: true },
];

function MarkPath({ mark }: { mark: Mark }) {
  if (mark.hole) return <path d={mark.d} fill="#ffffff" stroke="none" />;
  if (mark.solid) return <path d={mark.d} fill="currentColor" stroke="none" />;
  return <path d={mark.d} fill={mark.fill ? 'currentColor' : undefined} strokeWidth={mark.width} />;
}

interface DrawingProps {
  className: string;
  /** 시안의 그림 크기(viewBox) */
  width: number;
  height: number;
  marks: readonly Mark[];
  /** 선 굵기 */
  stroke: number;
  /** 상자 안을 채우는 그림 — 상자 크기가 바뀌면(중철 면) 비율을 지키며 줄어든다 */
  fit?: boolean;
}

function Drawing({ className, width, height, marks, stroke, fit = false }: DrawingProps) {
  return (
    <svg
      className={className}
      width={fit ? '100%' : width} height={fit ? '100%' : height} viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      {marks.map((mark, i) => <MarkPath key={i} mark={mark} />)}
    </svg>
  );
}

/** 제목 옆 연필통 */
export function ZineCup() {
  return <Drawing className="pbc-zine__cup" width={44} height={44} marks={CUP} stroke={2.4} />;
}

/** 상자 1 — 컵·연필·육면체·펼친 책 */
export function ZineBox1() {
  return <Drawing className="pbc-zine__drawing" width={680} height={192} marks={BOX1} stroke={3} fit />;
}

/** 상자 2 — 책 더미·종이·손·잉크 방울 */
export function ZineBox2() {
  return <Drawing className="pbc-zine__drawing" width={680} height={334} marks={BOX2} stroke={3} fit />;
}

/** 상자 3 — 클립·쪽지·시계·지우개 */
export function ZineBox3() {
  return <Drawing className="pbc-zine__drawing" width={238} height={166} marks={BOX3} stroke={3} fit />;
}

/** 동그라미 안의 먹 덩어리 */
export function ZineBlob() {
  return <Drawing className="pbc-zine__blob" width={150} height={150} marks={BLOB} stroke={0} fit />;
}
