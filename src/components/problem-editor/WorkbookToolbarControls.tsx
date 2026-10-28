'use client';

import { useState } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';
import { Highlighter } from 'lucide-react';
import { VERSE_LAYOUT } from '@/lib/sanitize-problem';
import {
  CALLOUT_LABEL_MAX, CALLOUT_PRESETS, CALLOUT_TONES, CALLOUT_TONE_LABELS, GLOSS_LAYOUT, VOCAB_LAYOUT,
  isCalloutLabel, isCalloutTone, type CalloutTone,
} from '@/lib/workbook-markup';

/** '없음' 센티널 — 빈 문자열 option 은 브라우저마다 다루기가 다르다 */
const NONE = '__none__';

/** 표 모양 고르기 — 값은 `data-layout` */
const TABLE_LAYOUT_OPTIONS = [
  { value: NONE, label: '보통 표' },
  { value: VERSE_LAYOUT, label: '칸선 없는 나란히 표' },
  { value: GLOSS_LAYOUT, label: '원문 · 여백 해설' },
  { value: VOCAB_LAYOUT, label: '어휘 풀이 (낱말 위 · 풀이 아래)' },
] as const;

/** 도식 고르기 — 값은 `data-flow` */
const FLOW_OPTIONS = [
  { value: NONE, label: '보통 목록' },
  { value: 'right', label: '→ 오른쪽 도식' },
  { value: 'down', label: '↓ 아래 도식' },
] as const;

/** 말머리 고르기의 값 — `말머리|갈래` */
const presetValue = (label: string, tone: string) => `${label}|${tone}`;

interface WorkbookToolbarControlsProps {
  editor: Editor;
}

/**
 * 작품 전문 · 개념 편집기에만 붙는 단추들 — 형광펜 · 작은 글씨 · 말머리 상자 · 표 모양 · 도식 · 표 틀 넣기.
 *
 * ⚠️ 활성 상태는 `useEditorState` 로만 읽는다(문항 툴바와 같은 까닭 — `editor.isActive` 를 직접 읽으면 커서를 옮겨도
 *    다시 그려지지 않는다). 말머리 상자와 〈보기〉 상자(`data-box`)는 한 blockquote 에 함께 두지 않는다 — 하나를 고르면
 *    다른 쪽을 비운다(문항 툴바의 상자 칸도 같다).
 * @param props - 편집기
 * @returns 단추 묶음
 */
export default function WorkbookToolbarControls({ editor }: WorkbookToolbarControlsProps) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const quote = e.getAttributes('blockquote');
      return {
        highlight: e.isActive('highlight'),
        small: e.isActive('small'),
        blockquote: e.isActive('blockquote'),
        calloutLabel: typeof quote['data-callout'] === 'string' ? (quote['data-callout'] as string) : null,
        calloutTone: typeof quote['data-tone'] === 'string' ? (quote['data-tone'] as string) : null,
        table: e.isActive('table'),
        layout: (e.getAttributes('table').layout as string | null) ?? null,
        bulletList: e.isActive('bulletList'),
        flow: (e.getAttributes('bulletList')['data-flow'] as string | null) ?? null,
      };
    },
  });

  const buttonClass = (active: boolean) =>
    `rounded px-2 py-1 text-xs ${active ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'}`;
  const selectClass = 'rounded border border-gray-200 bg-white px-1.5 py-1 text-xs text-gray-700';

  /** 말머리 상자로 감싸거나(없으면 만들고) 말머리를 바꾼다. '없음' 이면 상자를 푼다 */
  const setCallout = (value: string) => {
    const chain = editor.chain().focus();
    if (value === NONE) {
      if (state.blockquote) chain.toggleBlockquote().run();
      return;
    }
    const [label, tone] = value.split('|');
    if (!state.blockquote) chain.setBlockquote();
    chain.updateAttributes('blockquote', { 'data-callout': label, 'data-tone': tone || null, 'data-box': null }).run();
  };

  const currentPreset = state.calloutLabel ? presetValue(state.calloutLabel, state.calloutTone ?? '') : NONE;
  const knownPreset = CALLOUT_PRESETS.some((p) => presetValue(p.label, p.tone) === currentPreset);

  return (
    <>
      <span className="mx-1 h-4 w-px bg-gray-200" aria-hidden />
      <button
        type="button" className={buttonClass(state.highlight)}
        onClick={() => editor.chain().focus().toggleMark('highlight').run()}
        aria-pressed={state.highlight} aria-label="형광펜" title="핵심어 형광펜 (Ctrl/⌘+Shift+H) — 정리 쪽 빈칸의 정답도 이것으로"
      >
        <Highlighter className="h-3.5 w-3.5" />
      </button>
      <button
        type="button" className={buttonClass(state.small)}
        onClick={() => editor.chain().focus().toggleMark('small').run()}
        aria-pressed={state.small} title="작은 글씨 — 어휘의 한자 풀이(話 말할 화)"
      >
        작게
      </button>

      <select
        className={selectClass} aria-label="말머리 상자"
        value={currentPreset}
        onChange={(e) => setCallout(e.target.value)}
      >
        <option value={NONE}>말머리 상자 없음</option>
        {!knownPreset && state.calloutLabel && <option value={currentPreset}>{state.calloutLabel}</option>}
        {CALLOUT_PRESETS.map((p) => (
          <option key={p.label} value={presetValue(p.label, p.tone)}>{p.label}</option>
        ))}
      </select>
      {state.calloutLabel !== null && (
        <CalloutEditFields
          key={`${state.calloutLabel}|${state.calloutTone ?? ''}`}
          editor={editor}
          label={state.calloutLabel}
          tone={state.calloutTone}
          selectClass={selectClass}
        />
      )}

      {/* 표 안에서는 표 틀을 넣지 않는다 — 여백 해설 표가 겹치면 원문 칸 안에 해설이 들어가 참고자료로 샌다(코덱스 1R) */}
      {!state.table && (
        <>
          <button
            type="button" className={buttonClass(false)}
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: false })
              .updateAttributes('table', { layout: VOCAB_LAYOUT }).run()}
            title="낱말 칸 · 풀이 칸 두 칸 표 — 화면에서는 밑줄 친 낱말 바로 밑에 풀이가 놓여요"
          >
            어휘 풀이 표
          </button>
          <button
            type="button" className={buttonClass(false)}
            onClick={() => editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: false })
              .updateAttributes('table', { layout: GLOSS_LAYOUT }).run()}
            title="왼쪽 원문(연·문단) · 오른쪽 여백 해설 — 해설 앞 화살표는 저절로 붙어요"
          >
            여백 해설 표
          </button>
        </>
      )}
      {state.table && (
        <select
          className={selectClass} aria-label="표 모양"
          value={state.layout ?? NONE}
          onChange={(e) => editor.chain().focus()
            .updateAttributes('table', { layout: e.target.value === NONE ? null : e.target.value }).run()}
        >
          {TABLE_LAYOUT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
      {state.bulletList && (
        <select
          className={selectClass} aria-label="도식"
          value={state.flow ?? NONE}
          onChange={(e) => editor.chain().focus()
            .updateAttributes('bulletList', { 'data-flow': e.target.value === NONE ? null : e.target.value }).run()}
        >
          {FLOW_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
    </>
  );
}

interface CalloutEditFieldsProps {
  editor: Editor;
  label: string;
  tone: string | null;
  selectClass: string;
}

/**
 * 고른 말머리 상자의 글자 · 색 갈래 고치기 — 글자는 칸을 떠날 때(또는 Enter) 한 번에 바꾼다.
 * 치는 도중의 빈 글자·긴 글자를 상자에 바로 넣으면 정화기가 속성째 지운다.
 * 위에서 `key` 로 다시 마운트하므로 상자를 옮겨 다니면 그 상자의 글자로 다시 시작한다.
 * @param props - 편집기 · 지금 말머리 · 갈래
 * @returns 입력칸과 갈래 고르기
 */
function CalloutEditFields({ editor, label, tone, selectClass }: CalloutEditFieldsProps) {
  const [draft, setDraft] = useState(label);
  const valid = isCalloutLabel(draft);

  const commit = () => {
    if (!valid || draft === label) {
      setDraft(label);
      return;
    }
    editor.chain().focus().updateAttributes('blockquote', { 'data-callout': draft }).run();
  };

  return (
    <>
      <input
        className={`w-32 rounded border px-1.5 py-1 text-xs ${valid ? 'border-gray-200' : 'border-red-400'}`}
        aria-label="말머리 글자" maxLength={CALLOUT_LABEL_MAX}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
      />
      <select
        className={selectClass} aria-label="말머리 색"
        value={tone && isCalloutTone(tone) ? tone : NONE}
        onChange={(e) => editor.chain().focus()
          .updateAttributes('blockquote', { 'data-tone': e.target.value === NONE ? null : (e.target.value as CalloutTone) }).run()}
      >
        <option value={NONE}>회색</option>
        {CALLOUT_TONES.map((t) => <option key={t} value={t}>{CALLOUT_TONE_LABELS[t]}</option>)}
      </select>
    </>
  );
}
