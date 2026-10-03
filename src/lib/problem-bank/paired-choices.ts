/**
 * ㉮·㉯ 두 열로 인쇄된 객관식 선택지를 화면과 인쇄에서도 표로 그린다.
 * 저장값에는 각 열의 이름을 남겨 검색·좁은 화면의 의미를 보존한다.
 */
const HEADER = /<p>\s*㉮[\s　]+㉯\s*<\/p>\s*$/u;
const ROW = /^<u>㉮<\/u>\s*(.*?)<br\s*\/?\s*>\s*<u>㉯<\/u>\s*(.*?)$/iu;

export function pairedChoices(stemHtml: string, choices: readonly string[]) {
  if (!HEADER.test(stemHtml) || choices.length !== 5) return null;
  const rows = choices.map((choice) => ROW.exec(choice));
  if (rows.some((row) => row === null)) return null;
  return {
    stemHtml: stemHtml.replace(HEADER, ''),
    rows: rows.map((row) => [row![1], row![2]] as const),
  };
}

/** 원문 선지가 2~4열 표로 인쇄되고 발문 끝에 열 머리글이 있는 경우. */
const MATRIX_HEADER = /<p>\s*(㉠[\s　]+㉡(?:[\s　]+㉢)?|㉮[\s　]+㉯[\s　]+㉰|ⓐ[\s　]+ⓑ[\s　]+ⓒ(?:[\s　]+ⓓ)?|A[\s　]+B(?:[\s　]+C[\s　]+D)?)\s*<\/p>(?=(?:<\/blockquote>)?\s*$)/u;
const INTERVIEW_HEADER = /<p>\s*질문 분석[\s　]+답변 전략\s*<\/p>(?=(?:<\/blockquote>)?\s*$)/u;
const CELL_BREAK = /<br\s*\/?\s*>/iu;

export function matrixChoices(stemHtml: string, choices: readonly string[]) {
  const match = MATRIX_HEADER.exec(stemHtml);
  const interview = !match && INTERVIEW_HEADER.test(stemHtml);
  if ((!match && !interview) || choices.length !== 5) return null;
  const headers = interview ? ['구간', '질문 분석', '답변 전략'] : match![1].trim().split(/[\s　]+/u);
  const rows = choices.map((choice) => choice.split(CELL_BREAK).map((cell) => cell.trim()));
  if (rows.some((row) => row.length !== headers.length || row.some((cell) => !cell))) return null;
  return { stemHtml: stemHtml.replace(interview ? INTERVIEW_HEADER : MATRIX_HEADER, ''), headers, rows };
}

/** 선지 다섯 개가 이미 본문 표의 행이나 칸에 적힌 경우를 찾는다. */
export function hasTabulatedChoices(stemHtml: string, choices: readonly string[]) {
  const glyphs = ['①', '②', '③', '④', '⑤'];
  if (choices.length !== 5 || choices.some((choice, i) => choice !== glyphs[i])) return false;

  return [...stemHtml.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/giu)]
    .some(([table]) => glyphs.every((glyph) => table.includes(glyph)));
}
