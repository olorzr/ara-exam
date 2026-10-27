'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { bodyPlainText } from '@/lib/reference-texts/body-format';
import { DEFAULT_FORMAT_BY_KIND, REFERENCE_KINDS } from '@/lib/reference-texts/constants';
import type { ReferenceTextDraft } from '@/lib/reference-texts/form';
import type { ReferenceTextKind } from '@/types/reference-text';
import ReferenceWorkPickDialog from './ReferenceWorkPickDialog';

interface ReferenceKindFieldProps {
  draft: ReferenceTextDraft;
  patch: (next: Partial<ReferenceTextDraft>) => void;
}

/** 종류마다 칸 이름과 보기 글 */
const COPY: Readonly<Record<ReferenceTextKind, { title: string; titleHint: string; authorHint: string; help: string }>> = {
  작품: {
    title: '작품 제목', titleHint: '봄봄', authorHint: '김유정',
    help: '작품 원문을 올려 두면 문제 만들기가 지문과 함께 읽어요. 문제 은행 작품에서 고르면 기출과 같은 표기가 들어가요.',
  },
  개념: {
    title: '개념 제목', titleHint: '피동 표현과 인용 표현 — 핵심 개념', authorHint: '(제재 개관이면 지은이)',
    help: '단원의 핵심 개념·제재 개관을 표와 목록으로 정리해 둬요. 단원을 붙이면 왼쪽 트리에서 그 단원 아래 모여요.',
  },
};

/**
 * 종류(작품 / 개념) · 제목 · 지은이.
 *
 * 종류를 바꾸면 **본문이 비어 있을 때만** 본문 형식이 그 종류의 기본값을 따른다(작품 평문 · 개념 HTML) —
 * 이미 쓴 본문의 형식을 말없이 바꾸지 않는다(형식 전환은 본문 칸의 단추가 확인을 받고 한다).
 * '문제 은행에서 작품 고르기' 는 작품일 때만 — 개념 제목은 작품 대장과 맞출 까닭이 없다.
 * @param props - 편집 중인 값과 고치기 콜백
 * @returns 종류·제목 섹션
 */
export default function ReferenceKindField({ draft, patch }: ReferenceKindFieldProps) {
  const copy = COPY[draft.kind];

  const changeKind = (kind: ReferenceTextKind) => {
    if (kind === draft.kind) return;
    const empty = bodyPlainText(draft.body, draft.format).trim() === '';
    patch(empty ? { kind, format: DEFAULT_FORMAT_BY_KIND[kind], body: '' } : { kind });
  };

  return (
    <section className="space-y-3 rounded-lg border border-gray-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-md border border-gray-200 p-0.5" role="radiogroup" aria-label="종류">
          {REFERENCE_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={draft.kind === kind}
              onClick={() => changeKind(kind)}
              className={`rounded px-3 py-1 text-sm font-medium ${draft.kind === kind
                ? 'bg-primary text-white'
                : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {kind === '작품' ? '작품 전문' : '개념 정리'}
            </button>
          ))}
        </div>
        {draft.kind === '작품' && (
          <ReferenceWorkPickDialog onPick={({ title, author }) => patch({ title, author })} />
        )}
      </div>
      <p className="text-xs text-gray-500">{copy.help}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="ref-title">{copy.title}</Label>
          <Input
            id="ref-title"
            value={draft.title}
            placeholder={copy.titleHint}
            onChange={(e) => patch({ title: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ref-author">지은이</Label>
          <Input
            id="ref-author"
            value={draft.author}
            placeholder={copy.authorHint}
            onChange={(e) => patch({ author: e.target.value })}
          />
        </div>
      </div>
    </section>
  );
}
