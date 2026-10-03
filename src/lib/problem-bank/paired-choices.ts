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

/** 2020.06 13번(3열), 29번(4열)처럼 발문 끝에 열 머리글이 있는 선지. */
const MATRIX_HEADER = /<p>\s*(㉠[\s　]+㉡[\s　]+㉢|A[\s　]+B[\s　]+C[\s　]+D)\s*<\/p>(?=(?:<\/blockquote>)?\s*$)/u;
const CELL_BREAK = /<br\s*\/?\s*>/iu;

export function matrixChoices(stemHtml: string, choices: readonly string[]) {
  const match = MATRIX_HEADER.exec(stemHtml);
  if (!match || choices.length !== 5) return null;
  const headers = match[1].trim().split(/[\s　]+/u);
  const rows = choices.map((choice) => choice.split(CELL_BREAK).map((cell) => cell.trim()));
  if (rows.some((row) => row.length !== headers.length || row.some((cell) => !cell))) return null;
  return { stemHtml: stemHtml.replace(MATRIX_HEADER, ''), headers, rows };
}
