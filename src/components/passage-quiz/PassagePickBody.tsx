'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { htmlToPlainText } from '@/lib/concept-pick/plain-text';
import { fetchPassagesByIds } from '@/lib/problem-bank/detail-queries';
import { passagePickName, searchPassages, type PassagePickRow } from '@/lib/problem-bank/passage-search';
import type { PickGate } from '@/hooks/usePickGate';
import { sourceLabel } from '@/lib/problem-bank/source-label';
import type { PickedPassage } from '@/lib/quiz-references/types';

/**
 * 지문 불러오기 창의 **기출 지문** 탭 — 아카이브에 쌓인 기출 지문을 골라 온다.
 *
 * 기출을 읽어 두면 같은 글을 다시 타이핑할 이유가 없다 — 지문을 고르면 평문으로 펴서 넣는다.
 * 본문(`html`)은 **고른 하나만** 따로 읽는다(목록에 실으면 응답이 무거워진다).
 * 창이 열릴 때 마운트되므로(`QuizSourcePickerDialog`) 상태가 저절로 초기화된다.
 */

interface PassagePickBodyProps {
  /** 창 전체가 함께 쓰는 '하나만 불러오기' 잠금 — 다른 탭에서 읽는 중이면 여기 단추도 잠긴다 */
  gate: PickGate;
  onClose: () => void;
  onPick: (picked: PickedPassage) => void;
}

/**
 * 기출 지문 고르기를 그린다.
 * @param props - 잠금과 닫기·고르기 콜백
 * @returns 검색칸과 지문 목록
 */
export default function PassagePickBody({ gate, onClose, onPick }: PassagePickBodyProps) {
  const [term, setTerm] = useState('');
  const [rows, setRows] = useState<PassagePickRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  /** 창이 아직 떠 있는가 — 닫은 뒤에 도착한 응답이 폼을 덮어쓰면 안 된다 */
  const aliveRef = useRef(true);
  /**
   * 몇 번째 조회인가.
   * ⚠️ 처음 열 때의 '최근 목록'과 검색이 겹치면 **늦게 도착한 옛 응답**이 새 결과를 덮는다.
   */
  const queryIdRef = useRef(0);

  /**
   * 목록을 불러온다. setState 는 `.then` 안에서만 한다
   * (효과 본문의 동기 setState 는 lint 가 막는다).
   */
  const load = (keyword: string, failText: string) => {
    queryIdRef.current += 1;
    const id = queryIdRef.current;
    searchPassages(keyword)
      .then((list) => {
        if (aliveRef.current && id === queryIdRef.current) setRows(list);
      })
      .catch((e) => {
        if (aliveRef.current && id === queryIdRef.current) {
          setError(e instanceof Error ? e.message : failText);
        }
      });
  };

  // 처음 열면 최근 지문을 보여 준다 (창을 다시 열면 이 본문이 새로 마운트된다).
  // ⚠️ `aliveRef` 를 **setup 에서 다시 켠다.** 정리에서 끄기만 하면 Strict Mode 의
  //    setup → cleanup → setup 뒤에 꺼진 채로 남아, 조회가 끝나도 화면이 계속 '불러오는 중' 이다
  useEffect(() => {
    aliveRef.current = true;
    load('', '지문을 불러오지 못했어요.');
    return () => { aliveRef.current = false; };
  }, []);

  const search = () => {
    setRows(null);
    setError(null);
    load(term, '찾지 못했어요.');
  };

  const fail = (message: string) => {
    gate.end();
    setError(message);
    setBusyId(null);
  };

  const pick = (row: PassagePickRow) => {
    if (!gate.begin()) return;
    setBusyId(row.id);
    fetchPassagesByIds([row.id])
      .then(([passage]) => {
        // 불러오는 동안 창을 닫았으면 아무것도 하지 않는다 —
        // 닫아 놓고 직접 쓴 지문이 뒤늦게 덮이면 쓴 사람은 영문을 모른다
        if (!aliveRef.current) return;
        if (!passage) {
          fail('지문을 불러오지 못했어요.');
          return;
        }
        onPick({
          text: htmlToPlainText(passage.html),
          title: passage.title,
          author: passage.author,
          meta: {
            id: passage.id,
            source: 'passage',
            unitPath: passage.unit_path ?? [],
            textbook: row.source.textbook ?? '',
            grade: row.source.grade ?? '',
            schoolName: row.source.school_name ?? '',
            year: row.source.year ?? '',
          },
        });
        onClose();
      })
      .catch((e) => {
        if (!aliveRef.current) return;
        fail(e instanceof Error ? e.message : '지문을 불러오지 못했어요.');
      });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        읽어 둔 기출 지문을 골라 넣습니다. 글로 저장된 지문만 보여요.
      </p>

      <div className="flex items-center gap-2">
        <Input
          value={term}
          placeholder="작품명이나 지은이"
          aria-label="지문 검색어"
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
        <p className="py-12 text-center text-sm text-gray-500">찾는 지문이 없어요.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => pick(row)}
                disabled={gate.busy}
                className="w-full px-1 py-2 text-left hover:bg-gray-50 disabled:opacity-50"
              >
                <span className="text-sm font-medium text-gray-900">{passagePickName(row)}</span>
                {row.author && <span className="ml-2 text-xs text-gray-500">{row.author}</span>}
                {busyId === row.id && <span className="ml-2 text-xs text-primary">불러오는 중…</span>}
                <span className="mt-0.5 block text-xs text-gray-400">
                  {sourceLabel(row.source)} · {row.page_no}쪽
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
