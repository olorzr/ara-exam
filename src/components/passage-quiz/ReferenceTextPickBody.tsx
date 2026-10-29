'use client';

import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
// ⚠️ 컴포넌트 배럴(`@/components/reference-texts`)로 가져오지 않는다 — 배럴에 든 가져오기 화면이
//    pdf.js 를 끌고 와 문제 만들기 번들이 무거워진다. 파일 경로로만 가져온다
import ReferenceKindChips from '@/components/reference-texts/ReferenceKindChips';
import ReferenceSidePanel from '@/components/reference-texts/ReferenceSidePanel';
import { useReferenceTextFacets } from '@/hooks/useReferenceTextFacets';
import type { PickGate } from '@/hooks/usePickGate';
import { useReferenceTexts } from '@/hooks/useReferenceTexts';
import { pickedFromReferenceText } from '@/lib/quiz-references/picked';
import type { PickedPassage } from '@/lib/quiz-references/types';
import { ALL_REFERENCE_TEXTS, describeAxis } from '@/lib/reference-texts/filters';
import { fetchReferenceBodies } from '@/lib/reference-texts/queries';
import { unitKey, unitLabel } from '@/lib/reference-texts/units';
import type { ReferenceTextListItem } from '@/types/reference-text';

/** 줄마다 보여 줄 단원 수 — 나머지는 '외 n' 으로 접는다 */
const UNITS_SHOWN = 2;

interface ReferenceTextPickBodyProps {
  /** 창 전체가 함께 쓰는 '하나만 불러오기' 잠금 — 다른 탭에서 읽는 중이면 여기 단추도 잠긴다 */
  gate: PickGate;
  onClose: () => void;
  onPick: (picked: PickedPassage) => void;
}

/**
 * 지문 불러오기 창의 **작품 전문·개념** 탭.
 *
 * 작품 전문·개념 목록 화면(`/reference-texts`)과 **같은 부품**으로 고른다 — 왼쪽 패널(교과서 · 단원 /
 * 작품 / 문법), 종류 칩(전체 · 작품 · 개념), 검색칸. 그래서 어느 교과서 어느 단원의 글인지, 작품인지
 * 개념인지를 보고 고른다. 줄을 누르면 그 한 편의 본문만 읽어 지문 평문으로 바꿔 넣는다
 * (작품은 해설을 뺀 원문, 개념은 상자·표 내용까지 — `pickedFromReferenceText`).
 *
 * 목록 줄은 링크가 아니라 **단추**다 — 목록 화면의 `ReferenceTextList` 는 읽기 화면으로 가는 링크와
 * 지우기 단추라 여기 맞지 않아 모양만 본떴다.
 * @param props - 닫기·고르기 콜백
 * @returns 분류 패널과 고르기 목록
 */
export default function ReferenceTextPickBody({ gate, onClose, onPick }: ReferenceTextPickBodyProps) {
  const list = useReferenceTexts();
  const facets = useReferenceTextFacets();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** 창이 아직 떠 있는가 — 닫은 뒤에 도착한 본문이 폼을 덮어쓰면 안 된다 */
  const aliveRef = useRef(true);
  const axisLabel = describeAxis(list.axis);

  // ⚠️ 효과 본문에서 true 로 되돌린다 — StrictMode 의 setup → cleanup → setup 뒤에 꺼진 채로 남으면
  //    고른 본문이 와도 폼에 안 들어간다
  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  const fail = (message: string) => {
    gate.end();
    setError(message);
    setBusyId(null);
  };

  const pick = (row: ReferenceTextListItem) => {
    if (!gate.begin()) return;
    setBusyId(row.id);
    setError(null);
    fetchReferenceBodies([row.id])
      .then((bodies) => {
        // 불러오는 동안 창을 닫았으면 아무것도 하지 않는다 — 닫아 놓고 직접 쓴 지문이 뒤늦게 덮이면 안 된다
        if (!aliveRef.current) return;
        const body = bodies.get(row.id);
        if (!body) {
          fail('본문을 불러오지 못했어요. 그새 지워졌을 수 있어요.');
          return;
        }
        onPick(pickedFromReferenceText(row, body));
        onClose();
      })
      .catch((e) => {
        if (!aliveRef.current) return;
        fail(e instanceof Error ? e.message : '본문을 불러오지 못했어요.');
      });
  };

  return (
    <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
      <div className="md:max-h-[60vh] md:overflow-y-auto">
        <ReferenceSidePanel
          axis={list.axis}
          rows={facets.rows}
          unitTree={facets.unitTree}
          grammarTree={facets.grammarTree}
          onChange={list.setAxis}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={list.search}
            placeholder="작품명·개념 제목이나 지은이"
            aria-label="작품 전문·개념 검색어"
            className="max-w-xs"
            onChange={(e) => list.setSearch(e.target.value)}
          />
          <ReferenceKindChips value={list.kind} onChange={list.setKind} />
        </div>

        {axisLabel && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <span className="rounded bg-primary/10 px-2 py-0.5 font-medium text-primary">{axisLabel}</span>
            <button
              type="button"
              className="text-xs text-primary underline underline-offset-2"
              onClick={() => list.setAxis(ALL_REFERENCE_TEXTS)}
            >
              해제
            </button>
          </p>
        )}

        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

        {list.loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        ) : list.rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500">
            {list.empty ? '아직 올린 작품 전문·개념이 없어요.' : '이 분류에 맞는 것이 없어요.'}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 md:max-h-[52vh] md:overflow-y-auto">
            {list.rows.map((row) => (
              <li key={row.id}>
                <PickRow row={row} busy={busyId === row.id} disabled={gate.busy} onPick={pick} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** 고르기 목록 한 줄 — 종류는 글자 배지로 알린다(색만으로 가르지 않는다) */
function PickRow({
  row, busy, disabled, onPick,
}: { row: ReferenceTextListItem; busy: boolean; disabled: boolean; onPick: (row: ReferenceTextListItem) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(row)}
      disabled={disabled}
      className="w-full px-3 py-2 text-left hover:bg-gray-50 disabled:opacity-50"
    >
      <span className="block truncate text-sm font-medium text-gray-900">
        <span
          className={`mr-1.5 inline-block rounded px-1.5 py-px align-[1px] text-[11px] font-medium ${
            row.kind === '개념' ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}
        >
          {row.kind}
        </span>
        {row.title}
        {row.note && <span className="ml-2 text-xs font-normal text-amber-700">{row.note}</span>}
        {busy && <span className="ml-2 text-xs font-normal text-primary">불러오는 중…</span>}
      </span>
      <span className="mt-0.5 block truncate text-xs text-gray-400">
        {[row.author, `${row.char_count.toLocaleString()}자`].filter(Boolean).join(' · ')}
      </span>
      {row.units.length > 0 && (
        <span className="mt-1 flex flex-wrap gap-1">
          {row.units.slice(0, UNITS_SHOWN).map((unit) => (
            <span key={unitKey(unit)} className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">
              {unitLabel(unit)}
            </span>
          ))}
          {row.units.length > UNITS_SHOWN && (
            <span className="px-1 py-0.5 text-[11px] text-gray-400">외 {row.units.length - UNITS_SHOWN}</span>
          )}
        </span>
      )}
    </button>
  );
}
