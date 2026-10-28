'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { ReferenceTextEditorState } from '@/hooks/useReferenceTextEditor';
import ReferenceBodyField from './ReferenceBodyField';
import ReferenceClassifySection from './ReferenceClassifySection';
import ReferenceKindField from './ReferenceKindField';

/**
 * 작품 전문 · 개념 편집 폼 — 조립만 한다.
 *
 * 종류·제목(`ReferenceKindField`) → 분류(`ReferenceClassifySection`: 단원·문법·차례·태그·판본 메모)
 * → 본문(`ReferenceBodyField`: 평문 입력칸 / 표·상자 서식 편집기).
 */

interface ReferenceTextFormProps {
  editor: ReferenceTextEditorState;
  backHref: string;
  /**
   * 보기 화면으로 돌아가기(이미 있는 전문을 고칠 때) — 저장하지 않은 것이 있으면 한 번 묻는다.
   * ⚠️ `useUnsavedGuard` 는 다른 주소로 떠날 때만 묻는다 — 같은 주소 안의 보기 ↔ 편집 전환은 여기서 묻는다.
   */
  onBack?: () => void;
}

/**
 * 편집 화면을 그린다.
 * @param props - 편집기 상태와 목록 경로
 * @returns 편집 화면
 */
export default function ReferenceTextForm({ editor, backHref, onBack }: ReferenceTextFormProps) {
  const { draft, patch, blocker, dirty, loading, saving, save, isNew } = editor;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  const noun = draft.kind === '개념' ? '개념 정리' : '작품 전문';
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">
          {draft.kind === '개념' ? '💡' : '📖'} {isNew ? `새 ${noun}` : `${noun} 고치기`}
        </h1>
        <div className="flex items-center gap-2">
          <Link href={backHref}>
            <Button type="button" variant="outline">목록</Button>
          </Link>
          {onBack && (
            <Button
              type="button" variant="outline" disabled={saving}
              onClick={() => {
                if (dirty && !window.confirm('저장하지 않은 내용이 있어요. 보기로 돌아갈까요?')) return;
                onBack();
              }}
            >
              보기로
            </Button>
          )}
          <Button type="button" disabled={saving || blocker !== null} onClick={() => void save()}>
            {saving ? '저장 중…' : '저장'}
          </Button>
        </div>
      </div>

      <ReferenceKindField draft={draft} patch={patch} />
      <ReferenceClassifySection draft={draft} patch={patch} />
      <ReferenceBodyField draft={draft} patch={patch} />

      <div className="flex flex-wrap items-center gap-2">
        {blocker
          ? <span className="text-sm text-gray-500">{blocker}</span>
          : dirty && <span className="text-sm text-amber-700">저장하지 않은 내용이 있어요.</span>}
      </div>
    </div>
  );
}
