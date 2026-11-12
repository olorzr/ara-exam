'use client';

import type { Editor } from '@tiptap/react';

/** 테두리 방향별 속성 키 */
const BORDER_SIDES = [
  { attr: 'borderTop', label: '上', title: '위 테두리', svg: 'M2 2h12' },
  { attr: 'borderBottom', label: '下', title: '아래 테두리', svg: 'M2 14h12' },
  { attr: 'borderLeft', label: '左', title: '왼쪽 테두리', svg: 'M2 2v12' },
  { attr: 'borderRight', label: '右', title: '오른쪽 테두리', svg: 'M14 2v12' },
] as const;

/**
 * 배경색 프리셋.
 * ⚠️ 회색 견본은 Tailwind 클래스(bg-gray-100)가 아니라 저장값 그대로 그린다 — 화면 테마가 회색 계조를
 *    민트 기운으로 바꿔서(2026-11-12), 클래스로 그리면 견본과 실제로 저장·인쇄되는 #F3F4F6 이 달라진다.
 */
const BG_COLORS = [
  { value: null, label: '없음', css: 'bg-white' },
  { value: '#F3F4F6', label: '회색', css: 'bg-[#F3F4F6]' },
  { value: '#FEF3C7', label: '노랑', css: 'bg-amber-100' },
  { value: '#DBEAFE', label: '파랑', css: 'bg-blue-100' },
  { value: '#D1FAE5', label: '초록', css: 'bg-emerald-100' },
  { value: '#FCE7F3', label: '분홍', css: 'bg-pink-100' },
] as const;

interface CellStyleToolbarProps {
  editor: Editor;
}

/**
 * 셀 스타일 툴바: 테두리 방향별 토글 + 전체 테두리 + 배경색 팔레트.
 * 커서가 테이블 셀 안에 있을 때만 표시된다.
 */
export default function CellStyleToolbar({ editor }: CellStyleToolbarProps) {
  const inCell = editor.isActive('tableCell') || editor.isActive('tableHeader');
  if (!inCell) return null;

  /** 개별 테두리 토글 (검정 ↔ 투명) */
  function toggleBorder(attr: string) {
    const current = editor.getAttributes('tableCell')[attr]
      ?? editor.getAttributes('tableHeader')[attr];
    const next = current === 'transparent' ? null : 'transparent';
    editor.chain().focus().setCellAttribute(attr, next).run();
  }

  /** 전체 테두리 일괄 설정 */
  function setAllBorders(value: string | null) {
    const chain = editor.chain().focus();
    for (const side of BORDER_SIDES) {
      chain.setCellAttribute(side.attr, value);
    }
    chain.run();
  }

  /** 배경색 설정 */
  function setBgColor(value: string | null) {
    editor.chain().focus().setCellAttribute('backgroundColor', value).run();
  }

  return (
    <div className="flex items-center gap-2 ml-1">
      {/* 테두리 방향별 토글 */}
      <div className="flex items-center gap-0.5" title="테두리 방향별 토글">
        <span className="text-[11px] text-gray-500 mr-0.5">테두리</span>
        {BORDER_SIDES.map((side) => {
          const current = editor.getAttributes('tableCell')[side.attr]
            ?? editor.getAttributes('tableHeader')[side.attr];
          const isTransparent = current === 'transparent';
          return (
            <button
              key={side.attr}
              className={`w-7 h-7 flex items-center justify-center rounded transition-colors
                ${isTransparent ? 'bg-gray-100 text-gray-400' : 'bg-primary/15 text-primary'}`}
              title={`${side.title} ${isTransparent ? '(투명)' : '(검정)'}`}
              onClick={() => toggleBorder(side.attr)}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d={side.svg} />
                {/* 나머지 테두리는 연하게 표시 */}
                <rect x="2" y="2" width="12" height="12" stroke="currentColor" strokeWidth="0.5" opacity="0.2" fill="none" />
              </svg>
            </button>
          );
        })}
        {/* 전체 검정 / 전체 투명 */}
        <button
          className="w-7 h-7 flex items-center justify-center rounded text-[11px] font-bold bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
          title="전체 테두리 검정"
          onClick={() => setAllBorders(null)}
        >
          ▣
        </button>
        <button
          className="w-7 h-7 flex items-center justify-center rounded text-[11px] font-bold bg-gray-100 text-gray-400 hover:bg-gray-200 transition-colors"
          title="전체 테두리 투명"
          onClick={() => setAllBorders('transparent')}
        >
          ▢
        </button>
      </div>

      <div className="w-px h-5 bg-gray-200" />

      {/* 배경색 팔레트 */}
      <div className="flex items-center gap-0.5" title="셀 배경색">
        <span className="text-[11px] text-gray-500 mr-0.5">배경</span>
        {BG_COLORS.map((c) => (
          <button
            key={c.label}
            className={`w-5 h-5 rounded border border-gray-300 hover:scale-125 transition-transform ${c.css}`}
            title={c.label}
            onClick={() => setBgColor(c.value)}
          />
        ))}
      </div>
    </div>
  );
}
