'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ReferenceTextEditorState } from '@/hooks/useReferenceTextEditor';
import { REFERENCE_TEXT_BODY_MAX } from '@/lib/reference-texts/constants';
import ReferenceTextImport from './ReferenceTextImport';

/**
 * 작품 전문 편집 폼.
 *
 * 본문은 **평문**이라 서식 도구가 없다 — 줄바꿈만 그대로 지킨다(시는 행갈이가 곧 내용이다).
 */

interface ReferenceTextFormProps {
  editor: ReferenceTextEditorState;
  backHref: string;
}

/**
 * 전문 편집 화면을 그린다.
 * @param props - 편집기 상태와 목록 경로
 * @returns 편집 화면
 */
export default function ReferenceTextForm({ editor, backHref }: ReferenceTextFormProps) {
  const { draft, patch, blocker, dirty, loading, saving, save, isNew } = editor;
  const tooLong = draft.body.length > REFERENCE_TEXT_BODY_MAX;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            📖 {isNew ? '새 작품 전문' : '작품 전문 고치기'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            작품 원문을 올려 두면 문제 만들기가 지문과 함께 읽어요. 잘린 지문으로도 제대로 된
            문항이 나옵니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={backHref}>
            <Button type="button" variant="outline">목록</Button>
          </Link>
          <Button type="button" disabled={saving || blocker !== null} onClick={() => void save()}>
            {saving ? '저장 중…' : '저장'}
          </Button>
        </div>
      </div>

      <section className="space-y-3 rounded-lg border border-gray-200 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="ref-title">작품 제목</Label>
            <Input
              id="ref-title"
              value={draft.title}
              placeholder="봄봄"
              onChange={(e) => patch({ title: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ref-author">지은이</Label>
            <Input
              id="ref-author"
              value={draft.author}
              placeholder="김유정"
              onChange={(e) => patch({ author: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="ref-body">본문</Label>
            <span className={`text-xs ${tooLong ? 'font-medium text-red-600' : 'text-gray-400'}`}>
              {draft.body.length.toLocaleString()} / {REFERENCE_TEXT_BODY_MAX.toLocaleString()}자
            </span>
          </div>
          <Textarea
            id="ref-body"
            value={draft.body}
            rows={20}
            placeholder="작품 전문을 붙여 넣거나 파일에서 불러와 주세요."
            className="min-h-96 font-normal"
            onChange={(e) => patch({ body: e.target.value })}
          />
        </div>

        <ReferenceTextImport
          hasBody={draft.body.trim() !== ''}
          onText={(text) => patch({ body: text })}
        />

        <div className="flex flex-wrap items-center gap-2">
          {blocker
            ? <span className="text-sm text-gray-500">{blocker}</span>
            : dirty && <span className="text-sm text-amber-700">저장하지 않은 내용이 있어요.</span>}
        </div>
      </section>
    </div>
  );
}
