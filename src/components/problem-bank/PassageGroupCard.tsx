'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import PassageBodyView from '@/components/problem-bank/PassageBodyView';
import { sourceLabel, type SourceLabelInput } from '@/lib/problem-bank/source-label';
import type { Passage } from '@/types/problem-bank';

/** 본문에서 보여 줄 미리보기 길이 */
const EXCERPT_LENGTH = 120;

/** 태그를 걷어낸 미리보기 글 */
function excerpt(html: string): string {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH)}…` : text;
}

interface PassageGroupCardProps {
  /**
   * 이 묶음의 지문 id. null 이면 **지문이 없는 문항들**이다.
   * 값이 있는데 `passage` 가 null 이면 본문을 아직·끝내 못 읽은 것 — 둘은 다른 말이다.
   */
  passageId: string | null;
  /** 지문 본문. 못 읽었으면 null */
  passage: Passage | null;
  /** 이 묶음 문항들의 출처 (첫 문항 기준) */
  source: SourceLabelInput | null;
  problemCount: number;
  /** 이미지 지문의 서명 URL */
  imageUrl?: string | null;
  /** 본문에 끼운 그림들의 서명 URL */
  figureUrls?: Map<string, string>;
  children: React.ReactNode;
}

/**
 * 작품별 보기의 지문 묶음 — 지문 머리 아래에 그 지문의 문항을 붙인다.
 *
 * 소설 전문이 시험지에 실리는 일은 드물어서 같은 작품이라도 **학교마다 실린 대목이
 * 다르다.** 그래서 작품 하나를 골라도 지문이 여러 개고, 어느 대목인지 보여야 문항을
 * 고를 수 있다. 본문은 기본으로 접어 둔다 — 펼쳐 두면 목록이 아니라 책이 된다.
 */
export default function PassageGroupCard({
  passageId, passage, source, problemCount, imageUrl, figureUrls, children,
}: PassageGroupCardProps) {
  const [open, setOpen] = useState(false);

  if (!passage) {
    return (
      <section className="space-y-2">
        <p className="text-sm font-medium text-gray-500">
          {/* ⚠️ 못 읽은 것을 '지문 없음' 이라고 하면 거짓말이다 — 딸린 지문이 분명히 있다 */}
          {passageId ? '지문을 불러오지 못했어요' : '지문 없는 문항'}
          <span className="text-xs text-gray-400"> ({problemCount})</span>
        </p>
        <div className="space-y-2">{children}</div>
      </section>
    );
  }

  return (
    <section className="space-y-2 rounded-lg border border-gray-200 bg-gray-50/60 p-3">
      <div className="space-y-1">
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
          <span className="font-semibold text-gray-900">
            {passage.title || passage.label || '제목 없는 지문'}
          </span>
          {passage.author && <span className="text-xs text-gray-500">{passage.author}</span>}
          {source && <span className="text-xs text-gray-500">· {sourceLabel(source)}</span>}
          {passage.label && passage.title && (
            <span className="text-xs text-gray-400">{passage.label}</span>
          )}
          <Badge variant="outline">문항 {problemCount}</Badge>
        </p>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 text-left text-xs text-gray-500 hover:text-gray-700"
          aria-expanded={open}
        >
          {open
            ? <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
          <span className="line-clamp-1">
            {open ? '본문 접기' : excerpt(passage.html) || '본문 보기'}
          </span>
        </button>
      </div>

      {open && (
        <div className="rounded border border-gray-200 bg-white p-3">
          <PassageBodyView passage={passage} imageUrl={imageUrl} figureUrls={figureUrls} />
        </div>
      )}

      <div className="space-y-2">{children}</div>
    </section>
  );
}
