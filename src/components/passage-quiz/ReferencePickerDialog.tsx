'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { searchReferenceCandidates } from '@/lib/quiz-references/search';
import {
  QUIZ_REFERENCE_KINDS, QUIZ_REFERENCE_KIND_LABELS,
  type QuizReferenceKind, type ReferenceCandidate,
} from '@/lib/quiz-references/types';

/**
 * 참고자료를 **직접 고르는** 창.
 *
 * 자동 매칭은 신호(작품명·단원)가 있어야 도는데, 선생님이 알고 있는 자료를 그냥 붙이고 싶을
 * 때가 있다 — 제목 표기가 달라 자동으로 안 걸리는 자료가 특히 그렇다.
 *
 * 껍데기는 `PassagePickerDialog` 와 같다: 열릴 때 속을 마운트해 상태를 비우고,
 * `aliveRef` 를 효과 **본문에서 되돌리며**(StrictMode), 늦게 온 응답은 세대 번호로 버린다.
 */

interface ReferencePickerDialogProps {
  open: boolean;
  /** 이미 붙어 있는 자료 — 두 번 붙일 수 없다 */
  attachedKeys: ReadonlySet<string>;
  onClose: () => void;
  onPick: (candidate: ReferenceCandidate) => void;
}

/**
 * 참고자료 고르기 창을 그린다.
 * @param props - 열림 여부·이미 붙은 자료와 닫기·고르기 콜백
 * @returns 창 (닫혀 있으면 속을 그리지 않는다)
 */
export default function ReferencePickerDialog({
  open, attachedKeys, onClose, onPick,
}: ReferencePickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        {open && <PickerBody attachedKeys={attachedKeys} onClose={onClose} onPick={onPick} />}
      </DialogContent>
    </Dialog>
  );
}

/** 실제 내용 — 열릴 때 마운트되므로 상태가 저절로 초기화된다 */
function PickerBody({
  attachedKeys, onClose, onPick,
}: Omit<ReferencePickerDialogProps, 'open'>) {
  const [kind, setKind] = useState<QuizReferenceKind>('sheet');
  const [term, setTerm] = useState('');
  const [rows, setRows] = useState<ReferenceCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const aliveRef = useRef(true);
  const queryIdRef = useRef(0);

  /** 목록을 불러온다. setState 는 `.then` 안에서만 한다 */
  const load = (nextKind: QuizReferenceKind, keyword: string) => {
    queryIdRef.current += 1;
    const id = queryIdRef.current;
    searchReferenceCandidates(nextKind, keyword)
      .then((list) => {
        if (aliveRef.current && id === queryIdRef.current) setRows(list);
      })
      .catch((e) => {
        if (aliveRef.current && id === queryIdRef.current) {
          setError(e instanceof Error ? e.message : '자료를 불러오지 못했어요.');
        }
      });
  };

  // ⚠️ `aliveRef` 를 setup 에서 다시 켠다 — 정리에서 끄기만 하면 StrictMode 의
  //    setup → cleanup → setup 뒤에 꺼진 채로 남아 화면이 계속 '불러오는 중' 이다
  useEffect(() => {
    aliveRef.current = true;
    load('sheet', '');
    return () => { aliveRef.current = false; };
  }, []);

  const changeKind = (next: QuizReferenceKind) => {
    setKind(next);
    setRows(null);
    setError(null);
    load(next, term);
  };

  const search = () => {
    setRows(null);
    setError(null);
    load(kind, term);
  };

  return (
    <div className="space-y-3">
      <div>
        <DialogTitle className="text-base">참고자료 직접 고르기</DialogTitle>
        <p className="mt-1 text-sm text-gray-500">
          고른 자료의 본문을 지문과 함께 읽습니다. 자동으로 찾은 자료는 그대로 둡니다.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {QUIZ_REFERENCE_KINDS.map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={kind === value ? 'default' : 'outline'}
            // 색만으로 알리지 않는다 — 화면 낭독기도 무엇이 골라졌는지 말할 수 있어야 한다
            aria-pressed={kind === value}
            onClick={() => changeKind(value)}
          >
            {QUIZ_REFERENCE_KIND_LABELS[value]}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={term}
          placeholder="제목이나 지은이"
          aria-label="참고자료 검색어"
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') search(); }}
        />
        <Button type="button" variant="outline" onClick={search}>
          <Search className="h-3.5 w-3.5" />
          <span className="ml-1">찾기</span>
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {rows === null ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">찾는 자료가 없어요.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {rows.map((row) => {
            const already = attachedKeys.has(row.key);
            return (
              <li key={row.key}>
                <button
                  type="button"
                  disabled={already}
                  onClick={() => { onPick(row); onClose(); }}
                  className="w-full px-1 py-2 text-left hover:bg-gray-50 disabled:opacity-50"
                >
                  <span className="text-sm font-medium text-gray-900">{row.label}</span>
                  {already && <span className="ml-2 text-xs text-gray-400">이미 붙임</span>}
                  {row.subtitle && (
                    <span className="mt-0.5 block text-xs text-gray-400">{row.subtitle}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
