import { expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { buildPaperBlocks } from '@/lib/problem-paper/blocks';
import type { PaperItemSnapshot, PaperSettings } from '@/types/problem-bank';
import { renderPaperBlocks } from './PaperPrintBlocks';

it('선지가 이미 표에 있으면 학생 문제지에 번호를 중복 인쇄하지 않는다', () => {
  const item: PaperItemSnapshot = {
    number: 1,
    question_type: '객관식',
    stem_html: '<p>설명 방법은?</p><table><tbody><tr><th>예</th><th>방법</th></tr>'
      + '<tr><th>①</th><td>정의</td></tr><tr><th>②</th><td>분석</td></tr>'
      + '<tr><th>③</th><td>예시</td></tr><tr><th>④</th><td>비교</td></tr>'
      + '<tr><th>⑤</th><td>대조</td></tr></tbody></table>',
    choices: ['①', '②', '③', '④', '⑤'],
    answer: '3',
    score: null,
    explanation_html: '',
    area_path: [],
    work_title: '',
    render_mode: 'text',
    image_path: '',
    figure_paths: [],
    passage: null,
    source: {
      source_type: '내신기출', title: '', school_name: '압구정중학교',
      year: '2024', grade: '중2', semester: '2학기', exam_type: '기말', publisher: '',
    },
  };
  const settings: PaperSettings = { columns: 2, showScore: false, showSource: true, omr: false };
  const blocks = buildPaperBlocks([item], false);
  const { container } = render(<div>{renderPaperBlocks({
    blocks, settings, imageUrls: new Map(), showAnswers: false,
  })}</div>);

  expect(container.querySelectorAll('table tr')).toHaveLength(6);
  expect(container.querySelectorAll('.pb-q__choice')).toHaveLength(0);
  expect(container.querySelectorAll('.pb-q__blank')).toHaveLength(0);
});
