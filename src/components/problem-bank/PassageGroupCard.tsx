'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import PassageBodyView from '@/components/problem-bank/PassageBodyView';
import PassageWorksLine from '@/components/problem-bank/PassageWorksLine';
import type { PassageHead } from '@/lib/problem-bank/detail-queries';
import { sourceLabel, type SourceLabelInput } from '@/lib/problem-bank/source-label';
import type { Passage } from '@/types/problem-bank';

/** 본문에서 보여 줄 미리보기 길이 */
const EXCERPT_LENGTH = 120;

/** 태그를 걷어낸 미리보기 글 */
function excerpt(html: string): string {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH)}…` : text;
}

/**
 * 본문까지 받아 온 지문인가.
 *
 * 목록은 대개 **머리만** 읽어 온다(`fetchPassageHeadsByIds`) — 그때는 펼칠 본문이 없으므로
 * 접기·펼치기 자체를 내지 않는다. 있지도 않은 단추를 눌러 빈 상자를 보는 것이 더 나쁘다.
 * @param passage - 지문 또는 머리
 * @returns 본문이 있으면 true
 */
function isFullPassage(passage: Passage | PassageHead): passage is Passage {
  return 'html' in passage;
}

interface PassageGroupCardProps {
  /**
   * 이 묶음의 지문 id. null 이면 **지문이 없는 문항들**이다.
   * 값이 있는데 `passage` 가 null 이면 본문을 아직·끝내 못 읽은 것 — 둘은 다른 말이다.
   */
  passageId: string | null;
  /** 지문. 못 읽었으면 null. 목록에서는 본문 없는 **머리**일 수 있다 */
  passage: Passage | PassageHead | null;
  /** 지문을 아직 읽어 오는 중인가 — '못 읽었어요' 와 가려 말해야 한다 */
  loading?: boolean;
  /** 이 묶음 문항들의 출처 (첫 문항 기준) */
  source: SourceLabelInput | null;
  problemCount: number;
  /** 지금 훑고 있는 작품 — 여러 편 실린 지문에서 그 편을 짚어 준다 */
  highlightWork?: string;
  /** 머리 오른쪽에 붙일 조작 (문제지 조합의 '이 지문 담기') */
  action?: React.ReactNode;
  /** 이미지 지문의 서명 URL */
  imageUrl?: string | null;
  /** 본문에 끼운 그림들의 서명 URL */
  figureUrls?: Map<string, string>;
  children: React.ReactNode;
}

/**
 * 목록의 지문 묶음 — 지문 머리 아래에 그 지문의 문항을 붙인다.
 *
 * 같은 지문에 딸린 문항이 어느 것인지 목록에서 알 수 있어야 문제지에 담을 때 헤매지 않는다.
 * 작품으로 훑을 때는 특히 그렇다 — 소설 전문이 시험지에 실리는 일은 드물어서 같은 작품이라도
 * **학교마다 실린 대목이 다르다.** 본문은 기본으로 접어 둔다 — 펼쳐 두면 목록이 아니라 책이 된다.
 *
 * 머리에는 **실린 작품을 전부** 적는다 — `(가) 진달래꽃 / (나) 엄마 걱정` 지문을 파생
 * 문자열 하나로 찍으면 어느 편이 (가)인지, 지금 훑는 작품이 어느 쪽인지 알 수 없다.
 */
export default function PassageGroupCard({
  passageId, passage, loading, source, problemCount, highlightWork, action, imageUrl, figureUrls,
  children,
}: PassageGroupCardProps) {
  const [open, setOpen] = useState(false);

  if (!passage) {
    return (
      <section className="space-y-2">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-gray-500">
          {/* ⚠️ 못 읽은 것을 '지문 없음' 이라고 하면 거짓말이다 — 딸린 지문이 분명히 있다.
              아직 읽는 중인 것을 '못 읽었어요' 라고 해도 마찬가지다 */}
          <span>
            {!passageId ? '지문 없는 문항' : loading ? '지문 불러오는 중…' : '지문을 불러오지 못했어요'}
            <span className="text-xs text-gray-400"> ({problemCount})</span>
          </span>
          {/* 지문을 못 읽어도 담기는 돼야 한다 — 문항은 멀쩡하다 */}
          {action && <span className="ml-auto">{action}</span>}
        </p>
        <div className="space-y-2">{children}</div>
      </section>
    );
  }

  return (
    <section className="space-y-2 rounded-lg border border-gray-200 bg-gray-50/60 p-3">
      <div className="space-y-1">
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
          <PassageWorksLine
            works={passage.works}
            fallback={passage.label || '제목 없는 지문'}
            highlight={highlightWork}
          />
          {source && <span className="text-xs text-gray-500">· {sourceLabel(source)}</span>}
          {passage.label && passage.works?.length > 0 && (
            <span className="text-xs text-gray-400">{passage.label}</span>
          )}
          <Badge variant="outline">문항 {problemCount}</Badge>
          {action && <span className="ml-auto">{action}</span>}
        </p>

        {/* 본문을 안 받아 온 목록에서는 펼칠 것이 없다 — 단추도 내지 않는다 */}
        {isFullPassage(passage) && (
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
        )}
      </div>

      {open && isFullPassage(passage) && (
        <div className="rounded border border-gray-200 bg-white p-3">
          <PassageBodyView passage={passage} imageUrl={imageUrl} figureUrls={figureUrls} />
        </div>
      )}

      <div className="space-y-2">{children}</div>
    </section>
  );
}
