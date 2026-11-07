import type { ReactNode } from 'react';
import { OMR_SHEET_QUESTIONS, startsNewOmrSheet } from '@/lib/omr-sheet';

/**
 * OMR 채점 문제지의 답안지 안내 조각 — 90문항을 넘어 답안지가 두 장 이상일 때만 쓴다.
 *
 * 통번호는 그대로 두고 새 답안지가 시작되는 문항 앞에 구분 줄을 끼운다.
 * ⚠️ 번호 옆 보조 표기(`1-4` = 1장째 4번 칸)는 **문제지에서 뺐다**(2026-11-07 원장 결정) — 1~90번은 통번호와 같은 숫자라
 *    문항마다 뜻 없는 글자가 붙어 보였다. 단어 객관식 시험지(`MultipleChoiceView`)에는 그대로 있어 두 화면이 여기서 갈린다.
 */

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
