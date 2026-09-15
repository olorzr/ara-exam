'use client';

import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { composeSyllable, convertYetHangulNotation, hasUnconvertedNotation } from '@/lib/yet-hangul';

/**
 * 옛한글 음절을 **낱자로 골라 넣는** 창.
 *
 * 왜 필요한가: 윈도우 MS 옛한글 IME·맥 전용 입력기가 없으면 아래아(ㆍ)나 반치음(ㅿ)을
 * 칠 방법이 아예 없다. OCR 이 잘못 읽은 글자를 검수에서 고치려면 입력 수단이 있어야 한다.
 *
 * ⚠️ 창이 열려 있는 동안 `editor.chain().focus()` 를 부르지 않는다 — 편집기로 포커스를
 *    되돌리면 넣을 자리(선택 영역)가 창을 열기 전과 달라진다. 넣기는 `commands.insertContent`
 *    만 쓰고 포커스는 창을 닫을 때 돌려준다.
 */

/** 팔레트에 올릴 옛 낱자 — 중세국어 자료에 실제로 나오는 것만 */
const OLD_LETTERS = [
  'ㆍ', 'ㆎ', 'ㅿ', 'ㆁ', 'ㆆ', 'ㅸ', 'ㅱ', 'ㆄ', 'ㆀ', 'ㆅ',
  'ㅳ', 'ㅄ', 'ㅶ', 'ㅺ', 'ㅼ', 'ㅽ', 'ㆇ', 'ㆌ',
] as const;

/** 방점 — 값은 `composeSyllable` 이 받는 표시 글자다 */
const TONE_OPTIONS = [
  { value: '', label: '없음 (평성)' },
  { value: '.', label: '한 점 (거성)' },
  { value: ':', label: '두 점 (상성)' },
] as const;

interface YetHangulDialogProps {
  editor: Editor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * 낱자를 조합해 편집기에 넣는 창.
 * @param props.editor - 넣을 대상 편집기
 * @param props.open - 열림 여부
 * @param props.onOpenChange - 열림 상태 변경
 */
export default function YetHangulDialog({ editor, open, onOpenChange }: YetHangulDialogProps) {
  const [letters, setLetters] = useState('');
  const [tone, setTone] = useState<string>('');

  /**
   * 대체 표기(`⟦ㅎㆍㄴ⟧`)를 통째로 붙여 넣은 경우 — 여러 음절을 한 번에 받는다.
   *
   * ⚠️ 이때 방점 선택은 **쓰지 않는다**(코덱스 리뷰 4R). 표기 안에 음절이 여럿이면 어느 음절에
   *    붙일지 알 수 없다 — 방점은 표기 자체에 `⟦ㄴㆍ:⟧` 로 적는다. 칸을 잠가 그 사실을 보인다.
   */
  const pasted = letters.includes('⟦') ? convertYetHangulNotation(letters) : null;
  const composed = pasted ?? composeSyllable(letters + tone);
  const ready = composed !== null && (pasted === null || !hasUnconvertedNotation(pasted));

  const close = () => {
    setLetters('');
    setTone('');
    onOpenChange(false);
    // 창이 닫힌 뒤에 포커스를 돌려준다 — 곧바로 이어 칠 수 있어야 한다
    editor.commands.focus();
  };

  const insert = () => {
    if (!ready || composed === null) return;
    editor.commands.insertContent(composed);
    // 창은 열어 둔다 — 옛한글은 한 음절만 고치는 일이 드물다
    setLetters('');
    setTone('');
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle className="text-base">옛한글 넣기</DialogTitle>

        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            낱자를 <b className="text-gray-800">초성·중성·종성</b> 순서로 적으면 한 음절로
            합칩니다 (예: ㅎ ㆍ ㄴ → <span className="yet-hangul-serif">&#x1112;&#x119E;&#x11AB;</span>).
            컴퓨터에 옛한글 입력기가 있으면 본문에 바로 쳐도 됩니다.
          </p>

          <div className="space-y-1">
            <Label className="text-xs text-gray-500" htmlFor="yet-letters">낱자</Label>
            <Input
              id="yet-letters"
              value={letters}
              onChange={(e) => setLetters(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); insert(); } }}
              placeholder="ㅎㆍㄴ"
              className="yet-hangul-serif text-lg"
              autoFocus
            />
          </div>

          <div className="flex flex-wrap gap-1">
            {OLD_LETTERS.map((letter) => (
              <button
                key={letter}
                type="button"
                className="yet-hangul-serif rounded border border-gray-200 bg-white px-2 py-1
                  text-base text-gray-800 hover:bg-gray-50"
                aria-label={`${letter} 넣기`}
                onClick={() => setLetters((prev) => prev + letter)}
              >
                {letter}
              </button>
            ))}
            <button
              type="button"
              className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600
                hover:bg-gray-50"
              onClick={() => setLetters((prev) => prev.slice(0, -1))}
              disabled={letters === ''}
            >
              ← 지우기
            </button>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-gray-500">방점</Label>
            <div className="flex gap-1">
              {TONE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`rounded px-2 py-1 text-xs ${tone === option.value
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700'} disabled:opacity-40`}
                  aria-pressed={tone === option.value}
                  disabled={pasted !== null}
                  onClick={() => setTone(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {pasted !== null && (
              <p className="text-xs text-gray-500">
                ⟦ ⟧ 표기를 넣을 때는 방점을 괄호 안에 적어 주세요 — 예: ⟦ㄴㆍ:⟧
              </p>
            )}
          </div>

          <div className="rounded bg-gray-50 px-2 py-2">
            <span className="text-xs text-gray-500">미리보기 </span>
            <span className="yet-hangul-serif text-2xl text-gray-900">
              {composed ?? '—'}
            </span>
            {letters !== '' && composed === null && (
              <span className="ml-2 text-xs text-gray-500">
                초성·중성(·종성) 순서로 두세 자를 적어 주세요.
              </span>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={close}>닫기</Button>
          <Button type="button" size="sm" onClick={insert} disabled={!ready}>넣기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
