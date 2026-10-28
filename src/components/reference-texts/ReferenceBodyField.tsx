'use client';

import ProblemHtmlEditor from '@/components/problem-editor/ProblemHtmlEditor';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { bodyLength, bodyPlainText, htmlToText, textToHtml } from '@/lib/reference-texts/body-format';
import { stripWorkbookNotes } from '@/lib/reference-texts/workbook-plain';
import { REFERENCE_TEXT_BODY_MAX } from '@/lib/reference-texts/constants';
import type { ReferenceTextDraft } from '@/lib/reference-texts/form';
import ReferenceTextImport from './ReferenceTextImport';

interface ReferenceBodyFieldProps {
  draft: ReferenceTextDraft;
  patch: (next: Partial<ReferenceTextDraft>) => void;
}

/** HTML 편집기의 최소 높이 (px) — 개념 정리는 표가 길다 */
const HTML_EDITOR_MIN_HEIGHT = 480;

/**
 * 본문 — 형식(평문 / 서식)에 따라 입력칸이 다르다.
 *
 * - 평문: 입력칸 그대로(줄바꿈을 지킨다 — 시는 행갈이가 곧 내용이다).
 * - 서식: 문항 편집기(`ProblemHtmlEditor`)를 **참고자료 프로필**로 — 표·〈보기〉 상자·나란히 표에 더해
 *   문제집 서식(말머리 상자·어휘 풀이·여백 해설·도식·형광펜)을 쓴다. 화면은 보기 쪽과 같은 CSS(`reference-sheet.css`)다.
 * 형식 전환: 평문 → 서식은 문단을 그대로 옮기고, 서식 → 평문은 표·상자가 사라지므로 한 번 묻는다.
 * 글자 수는 **보이는 글자** 기준이다(빈 편집기는 `<p></p>` 라 글자열 길이로 재면 거짓이 된다).
 * @param props - 편집 중인 값과 고치기 콜백
 * @returns 본문 섹션
 */
export default function ReferenceBodyField({ draft, patch }: ReferenceBodyFieldProps) {
  const plain = bodyPlainText(draft.body, draft.format);
  // 표시와 상한이 같은 잣대 — 서식 본문은 보이는 글자 수(form.ts 의 차단 조건과 같다)
  const length = bodyLength(draft.body, draft.format);
  const tooLong = length > REFERENCE_TEXT_BODY_MAX;
  const html = draft.format === 'html';

  const toggleFormat = () => {
    if (!html) {
      patch({ format: 'html', body: textToHtml(draft.body) });
      return;
    }
    const message = draft.kind === '작품'
      ? '여백 해설·어휘 풀이·말머리 상자가 사라지고 원문 글자만 남아요. 평문으로 바꿀까요?'
      : '표·상자·굵게 같은 서식이 사라지고 글자만 남아요. 평문으로 바꿀까요?';
    if (plain.trim() !== '' && !window.confirm(message)) return;
    // 작품은 해설을 걷고 원문만 — 해설 글자가 원문 사이에 섞여 들면 참고자료가 그것을 작품의 글로 읽는다
    patch({ format: 'text', body: htmlToText(draft.kind === '작품' ? stripWorkbookNotes(draft.body) : draft.body) });
  };

  return (
    <section className="space-y-3 rounded-lg border border-gray-200 p-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor={html ? undefined : 'ref-body'}>본문</Label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleFormat}
              className="text-xs text-primary underline underline-offset-2"
            >
              {html ? '평문으로 바꾸기' : '표·상자 서식으로 바꾸기'}
            </button>
            <span className={`text-xs ${tooLong ? 'font-medium text-red-600' : 'text-gray-400'}`}>
              {length.toLocaleString()} / {REFERENCE_TEXT_BODY_MAX.toLocaleString()}자
            </span>
          </div>
        </div>
        {html ? (
          <ProblemHtmlEditor
            value={draft.body}
            onChange={(body) => patch({ body })}
            minHeight={HTML_EDITOR_MIN_HEIGHT}
            ariaLabel="본문"
            serif={draft.kind === '작품'}
            profile="reference"
          />
        ) : (
          <Textarea
            id="ref-body"
            value={draft.body}
            rows={20}
            placeholder={draft.kind === '작품'
              ? '작품 전문을 붙여 넣거나 파일에서 불러와 주세요.'
              : '개념 정리를 적어 주세요. 표·목록이 필요하면 위의 서식으로 바꾸기를 누르세요.'}
            className="min-h-96 font-normal"
            onChange={(e) => patch({ body: e.target.value })}
          />
        )}
      </div>

      <ReferenceTextImport
        hasBody={plain.trim() !== ''}
        onText={(text) => patch({ body: html ? textToHtml(text) : text })}
      />
    </section>
  );
}
