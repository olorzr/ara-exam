import { choiceGlyph } from '@/lib/problem-bank/choices';
import { sanitizeInlineHTML } from '@/lib/sanitize-problem';

export default function PairedChoiceTable({
  rows, answerIndices,
}: {
  rows: readonly (readonly [string, string])[];
  answerIndices: readonly number[];
}) {
  return (
    <table className="pb-q__paired-choices">
      <thead><tr><th aria-label="선지 번호" /><th>㉮</th><th>㉯</th></tr></thead>
      <tbody>
        {rows.map(([left, right], index) => {
          const isAnswer = answerIndices.includes(index);
          return (
            <tr key={index} className={isAnswer ? 'pb-q__choice--answer' : ''}>
              <td className="pb-q__choice-glyph">{choiceGlyph(index)}</td>
              <td dangerouslySetInnerHTML={{ __html: sanitizeInlineHTML(left) }} />
              <td>
                <span dangerouslySetInnerHTML={{ __html: sanitizeInlineHTML(right) }} />
                {isAnswer && <span className="pb-q__choice-answer-mark">정답</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
