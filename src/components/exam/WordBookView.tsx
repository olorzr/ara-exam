'use client';

import { A4Document, CompactPageHeader } from '@/components/print';

/** 단일 열 최대 문항 수 기준 */
const SINGLE_COL_THRESHOLD = 20;

interface WordBookWord {
  id: string;
  word: string;
  meaning: string;
}

interface WordBookViewProps {
  sourceText?: string;
  words: WordBookWord[];
}

/** 헤더 행 (# 단어 뜻 암기) — 매 페이지·매 컬럼 상단에 반복된다 */
function WordHeader() {
  return (
    <div className="wb-thead">
      <span className="w-7 text-center">#</span>
      <span className="wb-thead__word">단어</span>
      <span className="wb-thead__meaning">뜻</span>
      <span className="wb-thead__check">암기</span>
    </div>
  );
}

/**
 * 단어장 뷰 (핑크 테마).
 * 단어 한 줄이 페이지네이션 블록 하나라 페이지 경계에서 줄이 잘리지 않는다.
 */
export default function WordBookView({ sourceText, words }: WordBookViewProps) {
  const useSingleCol = words.length <= SINGLE_COL_THRESHOLD;
  const title = `단어장${sourceText ? ` - ${sourceText}` : ''}`;

  const blocks = words.map((w, idx) => (
    <div key={w.id} className={`wb-row ${idx % 2 === 1 ? 'wb-row--band' : ''}`}>
      <span className="wb-row__num">{String(idx + 1).padStart(2, '0')}</span>
      <span className="wb-row__word">{w.word}</span>
      <span className="wb-row__meaning">{w.meaning}</span>
      <span className="wb-row__check">
        <span className="wb-checkbox" />
        <span className="wb-checkbox" />
        <span className="wb-checkbox" />
      </span>
    </div>
  ));

  return (
    <A4Document
      blocks={blocks}
      columns={useSingleCol ? 1 : 2}
      columnHeader={<WordHeader />}
      firstPageHeader={
        <>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-[18px] font-extrabold text-gray-900 leading-tight">{title}</h2>
              <p className="text-[10px] text-gray-400 mt-0.5 tracking-widest">아라국어논술</p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="아라국어논술" width={52} height={52} className="object-contain" />
          </div>
          <div className="border-t-[1.5px] border-b-[1.5px] border-[#F5C6D8] py-2.5 mb-4 text-[11px]">
            <div className="flex justify-end items-center">
              <span className="text-gray-500">
                총 <strong className="text-gray-800">{words.length}</strong>개
              </span>
            </div>
          </div>
        </>
      }
      laterPageHeader={<CompactPageHeader title={title} accent="pink" />}
    />
  );
}
