/**
 * `@media print { … }` 블록 하나를 괄호 짝으로 떼어 낸다.
 * @param text - CSS 글
 * @returns 인쇄 블록(없으면 빈 글)
 */
export function printBlock(text: string): string {
  const start = text.indexOf('@media print');
  if (start < 0) return '';
  let depth = 0;
  for (let i = text.indexOf('{', start); i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    if (text[i] === '}') depth -= 1;
    if (depth === 0) return text.slice(start, i + 1);
  }
  return text.slice(start);
}

/**
 * 글 안의 16진 색 가운데 무채색이 아닌 것.
 * @param text - CSS 글
 * @returns 무채색이 아닌 색들
 */
export function chromaticHexColors(text: string): string[] {
  return (text.match(/#[0-9a-f]{3,6}\b/gi) ?? []).filter((hex) => {
    const h = hex.slice(1);
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const [r, g, b] = [0, 2, 4].map((i) => full.slice(i, i + 2).toLowerCase());
    return !(r === g && g === b);
  });
}
