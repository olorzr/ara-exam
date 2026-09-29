import type { ReactNode } from 'react';
import { OMR_SHEET_QUESTIONS, omrSlotLabel, startsNewOmrSheet } from '@/lib/omr-sheet';

/**
 * OMR 채점 문제지의 답안지 안내 조각 — 90문항을 넘어 답안지가 두 장 이상일 때만 쓴다.
 *
 * 단어 객관식 시험지(`MultipleChoiceView`)와 **같은 규약**이다: 통번호는 그대로 두고 보조 표기
 * (`2-1` = 2장째 1번 칸)만 덧붙이며, 새 답안지가 시작되는 문항 앞에 구분 줄을 끼운다.
 */

/**
 * 문항 번호 옆 작은 보조 표기.
 * @param number - 문제지 안의 번호(1부터)
 */
export function OmrSlotLabel({ number }: { number: number }) {
  return <span className="mc-q-slot">{omrSlotLabel(number - 1)}</span>;
}

/**
 * 새 답안지가 시작되는 문항이면 구분 줄과 **한 노드로** 묶는다.
 *
 * ⚠️ 따로 내보내지 말 것 — 인쇄 엔진은 노드 하나를 쪼갤 수 없는 블록으로 배치하므로, 따로면 자리가
 *    모자랄 때 '답안지 2장째' 안내만 앞 단 바닥에 남고 91번은 다음 쪽에서 시작한다.
 * @param node - 문항 노드
 * @param number - 문제지 안의 번호(1부터)
 * @param key - 묶은 노드의 key
 */
export function withOmrSheetBreak(node: ReactNode, number: number, key: string): ReactNode {
  if (!startsNewOmrSheet(number - 1)) return node;
  const sheetNo = (number - 1) / OMR_SHEET_QUESTIONS + 1;
  return (
    <div key={key}>
      <div className="section-bar section-bar--mint mc-sheet-break">
        <span>여기부터 답안지 {sheetNo}장째 — 새 답안지의 1번 칸부터 표시하세요</span>
      </div>
      {node}
    </div>
  );
}
