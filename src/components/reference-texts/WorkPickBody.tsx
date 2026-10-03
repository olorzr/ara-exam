'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import FacetTree from '@/components/problem-bank/FacetTree';
import WorkTreeOrderSelect from '@/components/problem-bank/WorkTreeOrderSelect';
import { Input } from '@/components/ui/input';
import type { WorkFacet } from '@/lib/problem-bank/facets';
import { buildWorkTree, type WorkTreeOrder } from '@/lib/problem-bank/work-tree';
import { readWorkTreeOrder } from '@/lib/problem-bank/work-tree-pref';

/** 고른 작품 — 폼의 제목·지은이 칸에 들어간다 */
export interface PickedWork {
  title: string;
  author: string;
}

interface WorkPickBodyProps {
  /** 문제 은행의 작품들. null 이면 아직 읽는 중 */
  facets: WorkFacet[] | null;
  failed: boolean;
  onRetry: () => void;
  onPick: (work: PickedWork) => void;
}

/** 검색 비교용 — 자모가 갈린 글자·대소문자를 맞춘다 */
const fold = (text: string): string => text.normalize('NFC').toLowerCase();

/**
 * 작품 고르기의 **속** — 검색칸, 정렬, 문제 은행 작품 트리.
 *
 * 트리는 문제 은행 아카이브의 작품 트리와 **같은 빌더**다(문학·비문학 › 지은이 › 작품).
 * 여기서 고르면 기출 지문에 쓰인 **표준 표기**가 그대로 들어가 전문과 지문의 작품명이 맞는다 —
 * 문제 만들기의 참고자료 자동 매칭이 제목으로 찾기 때문이다.
 *
 * 껍데기(대화창)와 가른 까닭: 포털로 뜨는 창은 테스트 환경에서 열어 볼 수 없어서다.
 * @param props - 작품 목록과 고른 작품 콜백
 * @returns 검색칸과 트리
 */
export default function WorkPickBody({ facets, failed, onRetry, onPick }: WorkPickBodyProps) {
  const [query, setQuery] = useState('');
  // lazy 초기화 — 효과에서 setState 하지 않는다(WorkTreePanel 과 같은 판단)
  const [order, setOrder] = useState<WorkTreeOrder>(() => readWorkTreeOrder());

  const keyword = fold(query.trim());
  const nodes = useMemo(() => {
    const list = (facets ?? []).filter(
      (f) => !keyword || fold(f.title).includes(keyword) || fold(f.author).includes(keyword),
    );
    return buildWorkTree(list, order);
  }, [facets, keyword, order]);

  if (failed) {
    return (
      <div className="space-y-2 py-6 text-center">
        <p className="text-sm text-red-600">문제 은행 작품을 불러오지 못했어요.</p>
        <button type="button" onClick={onRetry} className="text-sm text-primary underline underline-offset-2">
          다시 불러오기
        </button>
      </div>
    );
  }
  if (!facets) {
    return <p className="py-6 text-center text-sm text-gray-400">문제 은행 작품을 불러오는 중…</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="작품명이나 지은이"
            aria-label="작품 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 pl-9 text-sm"
          />
        </div>
        <WorkTreeOrderSelect value={order} onChange={setOrder} />
      </div>
      <p className="text-xs text-gray-500">괄호 안 숫자는 문제 은행에 쌓인 문항 수예요.</p>
      <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-gray-200 p-1">
        {/* ⚠️ 검색어가 바뀌면 다시 마운트한다 — 트리는 접힘을 처음 한 번만 정해서, 펼친 채로
            보여 주려면 새로 그려야 한다(검색 중에는 맞은 작품이 폴더 안에 숨지 않게) */}
        <FacetTree
          key={keyword}
          nodes={nodes}
          onSelect={(facet) => onPick({ title: facet.title, author: facet.author })}
          defaultExpandedDepth={keyword ? Number.MAX_SAFE_INTEGER : 1}
          emptyText={keyword ? '맞는 작품이 없어요. 제목을 직접 적어도 됩니다.' : '문제 은행에 작품이 아직 없어요.'}
        />
      </div>
    </div>
  );
}
