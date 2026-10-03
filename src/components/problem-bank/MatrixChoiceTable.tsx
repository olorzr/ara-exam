import { choiceGlyph } from '@/lib/problem-bank/choices';
import { sanitizeInlineHTML } from '@/lib/sanitize-problem';

export default function MatrixChoiceTable({
  headers, rows, answerIndices,
}: {
  headers: readonly string[];
  rows: readonly (readonly string[])[];
  answerIndices: readonly number[];
}) {
  return (
    <table className="pb-q__paired-choices">
      <thead><tr><th aria-label="선지 번호" />{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
      <tbody>
        {rows.map((row, index) => {
          const isAnswer = answerIndices.includes(index);
          return (
            <tr key={index} className={isAnswer ? 'pb-q__choice--answer' : ''}>
              <td className="pb-q__choice-glyph">{choiceGlyph(index)}</td>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>
                  <span dangerouslySetInnerHTML={{ __html: sanitizeInlineHTML(cell) }} />
                  {isAnswer && cellIndex === row.length - 1 && (
                    <span className="pb-q__choice-answer-mark">정답</span>
                  )}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
