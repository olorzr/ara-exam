'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ReferenceTextForm, ReferenceTextView } from '@/components/reference-texts';
import { Button } from '@/components/ui/button';
import { useOwnerAccess } from '@/hooks/useOwnerAccess';
import { useReferenceTextEditor } from '@/hooks/useReferenceTextEditor';
import { useReferenceTextView } from '@/hooks/useReferenceTextView';
import type { ReferenceTextKind } from '@/types/reference-text';

/** 전문 목록 경로 — 뒤로 가기와 새로 만든 뒤 주소의 기준 */
const LIST_HREF = '/reference-texts';

/** 가운데 도는 표시 */
function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
    </div>
  );
}

interface EditorProps {
  id: string;
  initialKind: ReferenceTextKind;
  onBack?: () => void;
}

/**
 * 원장의 편집 화면 — 상태·로딩·저장은 훅이, 화면은 폼이 맡는다(개념지 편집기와 같은 모양).
 * @param props - id · 새로 만들 때의 종류 · 보기로 돌아가기
 * @returns 편집 폼
 */
function ReferenceTextEditor({ id, initialKind, onBack }: EditorProps) {
  const editor = useReferenceTextEditor({ id, listHref: LIST_HREF, initialKind });
  return <ReferenceTextForm editor={editor} backHref={LIST_HREF} onBack={onBack} />;
}

/**
 * 보기 화면 — 선생님은 늘 여기, 원장은 '편집' 으로 넘어간다.
 * @param props - id · 원장이면 편집 콜백
 * @returns 보기 쪽
 */
function ReferenceTextViewer({ id, onEdit }: { id: string; onEdit?: () => void }) {
  const view = useReferenceTextView(id);
  if (view.loading) return <Spinner />;
  if (!view.row) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-sm text-gray-500">
        <p>{view.failed ? '불러오지 못했어요.' : '찾는 작품 전문·개념이 없어요. 지워졌을 수 있어요.'}</p>
        <div className="flex gap-2">
          {view.failed && <Button variant="outline" size="sm" onClick={view.reload}>다시 불러오기</Button>}
          <Link href={LIST_HREF}><Button variant="outline" size="sm">목록으로</Button></Link>
        </div>
      </div>
    );
  }
  return <ReferenceTextView row={view.row} backHref={LIST_HREF} onEdit={onEdit} />;
}

/**
 * 주소에서 id 와 종류를 읽고 **보기 / 편집** 을 가른다.
 *
 * - 선생님: 늘 보기(읽기 전용, 문제집처럼 꾸민 본문). `new` 는 목록으로 돌려보낸다 — 올리기·고치기는 원장만(sql/84).
 * - 원장: 보기가 먼저, '편집' 으로 폼. `new` 는 곧바로 폼이다. 새로 만든 뒤 주소가 `/{id}` 로 바뀌면 화면이 새로 마운트돼
 *   보기로 들어온다(저장한 모양을 바로 본다).
 * 주소의 종류(`?kind=개념`)는 **처음 한 번만** 읽는다(훅의 useState 초기값) — 바꾸는 것은 폼의 종류 칸이다.
 * @returns 보기 또는 편집 화면
 */
function ReferenceTextScreen() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { checking, isOwner } = useOwnerAccess();
  const isNew = params.id === 'new';
  const [editing, setEditing] = useState(isNew);
  const initialKind: ReferenceTextKind = search.get('kind') === '개념' ? '개념' : '작품';
  const blocked = !checking && !isOwner && isNew;

  useEffect(() => {
    if (blocked) router.replace(LIST_HREF);
  }, [blocked, router]);

  if (checking || blocked) return <Spinner />;
  if (isOwner && (isNew || editing)) {
    return (
      <ReferenceTextEditor
        id={params.id}
        initialKind={initialKind}
        onBack={isNew ? undefined : () => setEditing(false)}
      />
    );
  }
  return <ReferenceTextViewer id={params.id} onEdit={isOwner ? () => setEditing(true) : undefined} />;
}

/**
 * 작품 전문 · 개념 한 편 (`/reference-texts/[id]`, 'new' 면 새로 올리기 — 원장만).
 * `useSearchParams` 는 Suspense 경계 안에서 부른다(`words/print/page.tsx` 와 같은 규약).
 * @returns 보기 또는 편집 화면
 */
export default function ReferenceTextPage() {
  return (
    <Suspense fallback={null}>
      <ReferenceTextScreen />
    </Suspense>
  );
}
