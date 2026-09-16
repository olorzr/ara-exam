import { PRINT_QA_LEAD_MAX } from './constants';
import { stripLabelLine, stripSameLineLabel } from './label';
import { stripTrailingMark } from './marks';

/**
 * **첫 물음 앞의 글**(제목·지시문·지문)을 원문에서 잘라 내는 규칙 (순수 함수).
 *
 * 모델에게 묻지 않고 원문을 자르는 까닭: 물어서 받으면 그 글이 원문에 있는지 또 대조해야 하고,
 * 길이 상한에 걸려 잘려 온다. 자리만 알면 **자르는 것은 언제나 정확하다.**
 *
 * ⚠️ **문항 사이의 글은 여기서 다루지 않는다**(`place.ts` 의 `withLeads` 주석 참고).
 *    그 틈이 지문인지 아직 안 옮긴 답인지는 원리적으로 가릴 수 없어, 다섯 라운드의 리뷰가
 *    글자 규칙을 차례로 뚫었다. 첫 물음 앞은 **아직 어떤 문항도 시작하지 않아 답이 있을 수
 *    없는** 유일한 자리다.
 * ⚠️ 잘라 낸 글 끝에는 그 물음의 **번호가 붙어 있다**('…설명이다.\n1.'). 그대로 두면 문제지에
 *    번호가 두 번 찍힌다(글 끝의 '1.' 과 우리가 찍는 번호). 그래서 떼어 낸다.
 * ⚠️ 잘라 오는 글은 `htmlToPlainText` 가 만든 평문이라 **우리가 넣은 구조 기호**가 섞여 있다
 *    (제목 `#`, 표 `| 칸 | 칸 |`). 대조하려고 넣은 표시지 프린트에 인쇄돼 있던 글자가 아니다 —
 *    떼지 않으면 학생이 받는 문제지에 `# 동백꽃` 같은 것이 그대로 찍힌다.
 */

/** 문장 부호·따옴표뿐인 조각 — 실어 봐야 읽을 것이 없다 */
const PUNCT_ONLY = /^[\s'"‘’“”「」『』《》〈〉()（）[\]［］.,·;:：；、。!?！？…\-–—]*$/;

/** 평문의 제목 표시 — `htmlToPlainText` 가 `<h1~h6>` 자리에 넣는다 */
const HEADING_MARK = /^#{1,6}[ \t]+/gm;

/**
 * 평문의 표 한 행 — `| 칸 | 칸 |`.
 *
 * 줄 앞의 공백을 허용한다 — 행 한가운데서 잘린 ` |` 같은 조각도 걷어내야 한다.
 * ⚠️ **전각 칸 구분자(`｜`)도 본다**(코덱스 37R). 번호 자리 판정은 둘 다 알아보는데 여기만
 *    반각을 고집하면 그 표의 **원본 번호가 앞글에 남아 두 번 인쇄된다**.
 */
const TABLE_ROW = /^[ \t]*[|｜].*$/gm;


/**
 * 잘라 낸 글 끝에 붙은 문항 번호를 뗀다.
 * @param text - 잘라 낸 글
 * @param label - 프린트에 인쇄된 번호 (없으면 '')
 * @returns 번호를 뗀 글
 */
export function stripTrailingLabel(text: string, label: string): string {
  const trimmed = text.replace(/\s+$/, '');
  // ⚠️ **한 번만 뗀다**(코덱스 31R). 같은 줄에서 번호를 뗀 뒤 줄 단위 떼기를 또 돌리면
  //    `다음 숫자를 한글로 쓰시오.\n1\n1.` 에서 **주어진 값 `1` 까지 사라진다**
  const out = stripSameLineLabel(trimmed, label) ?? stripLabelLine(trimmed, label);
  // 표 칸을 잇던 가운뎃점이 끝에 덩그러니 남으면 함께 뗀다
  return out.replace(/[ \t·]+$/, '');
}

/**
 * 평문에 섞인 **우리 표시**를 사람이 읽는 글로 되돌린다.
 *
 * 표는 칸 사이를 가운뎃점으로 잇는다 — 세로줄을 그대로 두면 인쇄물에 기호만 늘어서고,
 * 지우기만 하면 두 칸의 글자가 한 낱말처럼 붙는다('시어뜻').
 * @param text - 잘라 낸 평문
 * @returns 기호를 걷어낸 글
 */
export function stripPlainMarkers(text: string): string {
  return text
    .replace(TABLE_ROW, (line) => line
      .split(/[|｜]/)
      .map((cell) => cell.trim())
      .filter(Boolean)
      .join(' · '))
    .replace(HEADING_MARK, '');
}

/**
 * 너무 긴 앞글은 **물음에 가까운 쪽을 남긴다**.
 *
 * 앞을 남기면 몇 쪽 전의 글이 실리고 정작 이 물음이 가리키는 지문이 잘려 나간다.
 * 줄 경계에서 자른다 — 문장 한가운데서 시작하는 지문은 읽을 수가 없다.
 * ⚠️ **잘랐다는 사실을 함께 돌려준다**(코덱스 5R). 조용히 자르면 선생님은 지문 앞부분이
 *    원래 없었던 줄 안다.
 * @param text - 잘라 낸 글
 * @returns 다듬은 글과 잘렸는지 여부
 */
export function clipLead(text: string): { text: string; truncated: boolean } {
  const trimmed = text.trim();
  if (trimmed.length <= PRINT_QA_LEAD_MAX) return { text: trimmed, truncated: false };
  const tail = trimmed.slice(trimmed.length - PRINT_QA_LEAD_MAX);
  const lineBreak = tail.indexOf('\n');
  return {
    text: (lineBreak >= 0 ? tail.slice(lineBreak + 1) : tail).trim(),
    truncated: true,
  };
}

/** 앞글을 잘라 온 결과 */
export interface PreambleLead {
  lead: string;
  /** 실을 수 없어 막았는가 (지금은 늘 false — 승인 게이트가 대신한다) */
  blocked: boolean;
  /** 너무 길어 앞부분을 **잘랐는가** */
  truncated: boolean;
}

/**
 * 첫 물음 앞의 글을 잘라 온다.
 * @param plain - 본문 평문
 * @param to - 첫 물음이 시작하는 자리
 * @param label - 그 문항의 인쇄된 번호 (끝에 붙어 있으면 뗀다)
 * @returns 앞글과, 실을 수 없었는지(`blocked`)·잘렸는지(`truncated`)
 */
export function preambleLead(plain: string, to: number, label: string): PreambleLead {
  if (to <= 0) return { lead: '', blocked: false, truncated: false };
  const body = stripTrailingLabel(stripPlainMarkers(plain.slice(0, to)), label);
  const clipped = clipLead(body);
  return { lead: clipped.text, blocked: false, truncated: clipped.truncated };
}

/**
 * 앞 문항이 끝난 자리부터 이 물음 앞까지의 글.
 *
 * ⚠️ **걷어내지 않는다**(코덱스 11R). 이 글에 못 옮긴 답이 섞여 있을 수 있지만, 학생 문제지에
 *    실으려면 **사람의 확인**이 필요하므로(`leadApproved`) 여기서 버릴 이유가 없다 —
 *    버리면 멀쩡한 지문이 아무에게도 안 보이고 사라진다. 기호와 번호만 정리해 돌려준다.
 * ⚠️ **줄 한가운데서 시작한 조각도 버리지 않는다**(코덱스 13R — 앞의 '앞 문항의 것이다' 규칙을
 *    뒤집음). 표로 짠 프린트는 `| 1. 갈래는? | 답: 소설 | 다음 글: … |` 처럼 **한 줄이 한 행**
 *    이라, 그 조각을 버리면 같은 행에 실린 **지문이 통째로 사라진다** — 편집 화면에도 교사용
 *    에도 안 남아 선생님은 그런 글이 있었다는 것조차 모른다. 답의 나머지인지 지문인지는
 *    **사람이 승인 게이트에서 가린다**(같은 자리의 R11 판단과 한 규칙이다).
 * @param plain - 본문 평문
 * @param from - 앞 문항이 끝난 자리
 * @param to - 이 물음이 시작하는 자리
 * @param label - 이 문항의 인쇄된 번호
 * @returns 앞글과 잘렸는지 여부
 */
export function betweenLead(
  plain: string,
  from: number,
  to: number,
  label: string,
): PreambleLead {
  if (!(to > from)) return { lead: '', blocked: false, truncated: false };
  const body = stripTrailingLabel(stripPlainMarkers(plain.slice(from, to)), label);
  const clipped = clipLead(body);
  return { lead: clipped.text, blocked: false, truncated: clipped.truncated };
}

/**
 * 물음과 **그 답 사이**에 있던 글.
 *
 * ⚠️ 이 자리가 비어 있지 않은 프린트가 흔하다 — `1. 다음 글의 갈래는?\n봄이 왔다…\n답: 소설`
 *    처럼 **지문을 물음 뒤에 싣는** 꼴이다(코덱스 14R). 문항의 끝이 답의 끝이라 이 글은
 *    앞 문항에도 뒤 문항에도 속하지 않아, 예전에는 **편집 화면에도 교사용에도 안 남고
 *    사라졌다**(경고도 없었다). 같은 승인 게이트에 얹어 그 문항의 앞글에 잇는다.
 * ⚠️ 끝에 덩그러니 남는 답 표시(`답:`)는 뗀다 — 답 자체는 다음 자리에 있다.
 * @param plain - 본문 평문
 * @param from - 물음이 끝난 자리
 * @param to - 답이 시작하는 자리
 * @returns 그 사이의 글과 잘렸는지 여부
 */
export function innerLead(plain: string, from: number, to: number): PreambleLead {
  if (!(to > from)) return { lead: '', blocked: false, truncated: false };
  const clipped = clipLead(stripTrailingMark(stripPlainMarkers(plain.slice(from, to))));
  // ⚠️ **기호로 그린 그림은 싣는다**(코덱스 25R). '글자가 없으면 버린다' 로 하면
  //    `△ → ○ → □` 같은 자료가 통째로 사라진다 — 버리는 것은 따옴표·괄호 한 짝처럼
  //    **문장 부호뿐인** 조각이다
  const lead = PUNCT_ONLY.test(clipped.text) ? '' : clipped.text;
  return { lead, blocked: false, truncated: clipped.truncated && lead !== '' };
}
