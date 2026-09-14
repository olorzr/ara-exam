/**
 * 삭제 확인 문구 (순수 함수).
 *
 * 화면에 흩어 두면 "시험지가 0장인데 시험지 얘기가 나오는" 거짓말이 조용히 생긴다 —
 * `problem-bank/source-delete.ts` 의 `sourceDeleteConfirmMessage` 와 같은 규약이다.
 */

/** 성적 안내 — 두 문구가 **글자 그대로** 같아야 한다(한쪽만 고치면 설명이 갈라진다) */
const GRADE_NOTE = '이미 학원 성적에 등록된 회차는 그대로 남습니다.';

/**
 * 스캔 하나를 지울 때의 확인 문구.
 *
 * 시험지 수를 **반드시** 밝힌다 — 묶음을 지우면 그 묶음으로 만든 개념지도 함께 사라진다
 * (DB 의 ON DELETE CASCADE). 모르고 누르면 손으로 마킹한 빈칸까지 날아간다.
 * @param input.title - 스캔 제목
 * @param input.bundleCount - 딸린 묶음 수
 * @param input.sheetCount - 함께 사라질 시험지 수
 * @param input.running - 아직 읽는 중인 묶음이 있는가
 * @returns 확인창에 띄울 글
 */
export function scanDeleteConfirmMessage(input: {
  title: string;
  bundleCount: number;
  sheetCount: number;
  running: boolean;
}): string {
  const lines = [`"${input.title || '제목 없는 스캔'}" 을 지울까요?`, ''];
  lines.push(`· 프린트 ${input.bundleCount}장이 목록에서 사라집니다.`);
  if (input.sheetCount > 0) {
    lines.push(`· 이 프린트로 만든 **시험지 ${input.sheetCount}장도 함께 지워집니다** (마킹 포함).`);
    lines.push(`  ${GRADE_NOTE}`);
  }
  if (input.running) {
    lines.push('· 아직 읽는 중인 프린트가 있어요. 다른 탭에서 읽고 있다면 그 결과는 저장되지 않습니다.');
  }
  lines.push('', '되돌릴 수 없습니다.');
  return lines.join('\n');
}

/**
 * 묶음 하나를 지울 때의 확인 문구.
 * @param input.name - 프린트명
 * @param input.hasSheet - 그 묶음으로 만든 시험지가 있는가
 * @param input.running - 지금 읽는 중인가
 * @returns 확인창에 띄울 글
 */
export function bundleDeleteConfirmMessage(input: {
  name: string;
  hasSheet: boolean;
  running: boolean;
}): string {
  const lines = [`"${input.name}" 프린트를 지울까요?`, ''];
  if (input.hasSheet) {
    lines.push(`· 이 프린트로 만든 **시험지도 함께 지워집니다** (마킹 포함). ${GRADE_NOTE}`);
  }
  if (input.running) {
    lines.push('· 지금 읽는 중이에요. 다른 탭에서 읽고 있다면 그 결과는 저장되지 않습니다.');
  }
  lines.push('', '되돌릴 수 없습니다.');
  return lines.join('\n');
}
