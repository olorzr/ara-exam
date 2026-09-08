'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useSignedImageUrls } from '@/hooks/useSignedImageUrls';
import { areaPathLabel } from '@/lib/problem-bank/area-tree';
import { fetchProblemDetail, type ProblemDetail } from '@/lib/problem-bank/detail-queries';
import { sourceLabel } from '@/lib/problem-bank/source-label';
import { unitPathLabel } from '@/lib/problem-bank/unit-tree';
import PassageBodyView from './PassageBodyView';
import ProblemBodyView from './ProblemBodyView';

interface ProblemDetailDialogProps {
  /** 열 문항 id. null 이면 창이 닫혀 있다 */
  problemId: string | null;
  onClose: () => void;
}

/**
 * 문항 상세 창 — **지문과 함께** 본다.
 *
 * 목록 카드는 발문 90자와 썸네일뿐이라, 이 문항이 어떤 글에 딸린 것인지·선지가 무엇인지
 * 알 수 없었다. 문제지에 담고 인쇄한 뒤에야 알게 되는 일이 생긴다.
 *
 * 페이지가 아니라 창인 이유: 아카이브의 필터·스크롤·선택을 잃지 않아야 하고,
 * 문제지 조합 화면에서도 담기 전에 같은 방법으로 확인할 수 있어야 한다.
 */
export default function ProblemDetailDialog({ problemId, onClose }: ProblemDetailDialogProps) {
  return (
    <Dialog open={problemId !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        {/* 창을 다시 열면 처음부터 읽는다 — key 로 마운트를 갈아 끼우면 옛 문항이 안 남는다 */}
        {problemId && <DetailBody key={problemId} problemId={problemId} />}
      </DialogContent>
    </Dialog>
  );
}

/** 실제 내용 — `key={problemId}` 로 마운트되므로 문항이 바뀌면 상태가 저절로 초기화된다 */
function DetailBody({ problemId }: { problemId: string }) {
  const [detail, setDetail] = useState<ProblemDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** 형제 중 지금 보고 있는 문항 */
  const [shownId, setShownId] = useState(problemId);
  const [showOriginal, setShowOriginal] = useState(false);

  // 마운트할 때 한 번만 읽는다. setState 는 `.then` 안에서만 한다
  // (효과 본문의 동기 setState 는 lint 가 막는다 — CLAUDE.md 규약 ④)
  useEffect(() => {
    let alive = true;
    fetchProblemDetail(problemId)
      .then((res) => {
        if (!alive) return;
        if (res) setDetail(res);
        else setError('문항을 찾지 못했어요.');
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : '불러오지 못했어요.');
      });
    return () => { alive = false; };
  }, [problemId]);

  const shown = detail?.siblings.find((p) => p.id === shownId) ?? detail?.problem ?? null;
  const paths = [
    detail?.passage?.image_path,
    shown?.image_path,
    ...(shown?.figure_paths ?? []),
  ].filter((p): p is string => Boolean(p));
  const images = useSignedImageUrls(paths);

  if (error) {
    return (
      <>
        <DialogTitle>문항</DialogTitle>
        <p className="py-8 text-center text-sm text-gray-500">{error}</p>
      </>
    );
  }
  if (!detail || !shown) {
    return (
      <>
        <DialogTitle>문항</DialogTitle>
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      </>
    );
  }

  const { source, passage, siblings } = detail;
  const originalUrl = shown.image_path ? images.urls.get(shown.image_path) : null;

  return (
    <div className="space-y-3">
      <div>
        <DialogTitle className="text-base">
          {shown.number !== null ? `${shown.number}번 문항` : '문항'}
        </DialogTitle>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
          <Badge variant="outline">{shown.question_type}</Badge>
          {shown.status === '검수완료' && <Badge className="bg-emerald-500 text-white">검수</Badge>}
          <span>{sourceLabel(source)}</span>
          {shown.work_title && <span>· {shown.work_title}</span>}
          {shown.unit_path.length > 0 && <span>· {unitPathLabel(shown.unit_path)}</span>}
          {shown.area_path.length > 0 && <span>· {areaPathLabel(shown.area_path)}</span>}
        </p>
      </div>

      {passage && (
        <section className="space-y-1.5 rounded-lg border border-gray-200 p-3">
          <p className="flex flex-wrap items-baseline gap-2 text-sm">
            <span className="font-semibold text-gray-900">
              {passage.title || passage.label || '지문'}
            </span>
            {passage.author && <span className="text-xs text-gray-500">{passage.author}</span>}
            {passage.title && passage.label && (
              <span className="text-xs text-gray-400">{passage.label}</span>
            )}
          </p>
          <PassageBodyView
            passage={passage}
            imageUrl={passage.image_path ? images.urls.get(passage.image_path) : null}
          />
        </section>
      )}

      {siblings.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
          <span>이 지문의 문항</span>
          {siblings.map((sibling) => (
            <button
              key={sibling.id}
              type="button"
              onClick={() => { setShownId(sibling.id); setShowOriginal(false); }}
              className={`rounded border px-2 py-0.5 ${
                sibling.id === shownId
                  ? 'border-primary bg-primary/10 font-medium text-primary'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
              aria-current={sibling.id === shownId}
            >
              {sibling.number ?? '?'}
            </button>
          ))}
        </div>
      )}

      <ProblemBodyView problem={shown} imageUrls={images.urls} />

      {/* 이미지 출제 문항은 위 본문이 곧 그 이미지다 — 같은 그림을 두 번 두지 않는다 */}
      {shown.image_path && shown.render_mode !== 'image' && (
        <div>
          <button
            type="button"
            onClick={() => setShowOriginal((v) => !v)}
            className="text-xs text-primary underline underline-offset-2"
          >
            {showOriginal ? '원본 접기' : '원본 보기'}
          </button>
          {showOriginal && (
            originalUrl
              // 서명 URL 이라 next/image 로 다룰 수 없다
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={originalUrl} alt="원본 문항" className="mt-1 max-w-full rounded border border-gray-200" />
              : <p className="mt-1 text-xs text-amber-700">원본 이미지를 불러오지 못했어요.</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3 border-t border-gray-100 pt-3 text-sm">
        <Link href={`/problems/edit/${shown.id}`} className="text-primary underline underline-offset-2">
          문항 편집
        </Link>
        <Link
          href={`/problems/sources/${source.id}?item=${shown.id}`}
          className="text-primary underline underline-offset-2"
        >
          검수 화면에서 보기
        </Link>
      </div>
    </div>
  );
}
