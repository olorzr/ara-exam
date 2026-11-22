'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import SignedFileButton from '@/components/problem-sets/SignedFileButton';
import { useImageResign } from '@/hooks/useImageResign';
import { useSignedImageUrls } from '@/hooks/useSignedImageUrls';
import { examViewHref } from '@/lib/problem-bank/source-set-link';
import { sourcePagePath } from '@/lib/problem-bank/storage-paths';
import { fetchProblemOrigin, type ProblemOrigin } from '@/lib/problem-report/queries';

/** 읽기 전용 시험 보기가 그리는 출처 유형 — 평가문제집은 거기 안 열린다(0.9.87) */
const EXAM_VIEW_TYPES: ReadonlySet<string> = new Set(['내신기출', '모의고사']);

type OriginState =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'failed' }
  | { status: 'ok'; origin: ProblemOrigin };

/**
 * 쪽 이미지 경로 — 출처 id 가 이상하면 경로를 만들지 않는다(`sourcePagePath` 가 던진다).
 * @param origin - 원본 쪽
 * @param page - 보여 줄 쪽
 * @returns 경로 또는 null
 */
function pagePathOf(origin: ProblemOrigin, page: number): string | null {
  try {
    return sourcePagePath(origin.sourceId, page);
  } catch {
    return null;
  }
}

/**
 * 신고 창의 원본 시험지 쪽 — 고른 문항이 실린 원본 쪽 이미지를 창 안에 보여 준다(2026-11-22 원장 요청:
 * "오류 신고할 때 그 시험지(원본 사진)를 보여 주면 좋겠다"). 틀렸다고 생각한 곳을 원본과 바로 견주게 한다.
 *
 * 문항이 쪽을 넘어가면 앞뒤 쪽으로 넘겨 본다. 크게 보기는 누를 때 서명해 새 탭으로 연다(`SignedFileButton`).
 * 쪽 이미지는 서명 주소가 한 시간이면 만료돼 오래 열어 두면 깨진다 — 시험 보기 원본 탭과 같이 그 쪽만 다시 서명한다(`useImageResign`).
 * 부르는 쪽이 문항마다 `key` 로 새로 마운트한다(넘겨 보던 쪽이 다음 문항에 남지 않게).
 * 원본을 못 읽어도 신고는 막지 않는다 — 곁가지다.
 * @param problemId - 문항 id. null 이면 원본 문항이 지워진 문제지 항목이다
 */
export default function ReportOriginalPage({ problemId }: { problemId: string | null }) {
  const [state, setState] = useState<OriginState>(problemId ? { status: 'loading' } : { status: 'none' });
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState<number | null>(null);

  useEffect(() => {
    if (!problemId) return;
    let alive = true;
    fetchProblemOrigin(problemId)
      .then((origin) => { if (alive) setState(origin ? { status: 'ok', origin } : { status: 'none' }); })
      .catch(() => { if (alive) setState({ status: 'failed' }); });
    return () => { alive = false; };
  }, [problemId, attempt]);

  const origin = state.status === 'ok' ? state.origin : null;
  const shown = origin ? (page ?? origin.pageNo) : 0;
  const path = origin ? pagePathOf(origin, shown) : null;
  const signed = useSignedImageUrls(path ? [path] : []);
  const pages = useImageResign(signed.urls);

  if (state.status === 'loading') return <Frame><Note>원본 시험지를 불러오는 중…</Note></Frame>;
  if (state.status === 'failed') {
    return (
      <Frame>
        <Note>원본 시험지를 불러오지 못했어요.</Note>
        <button
          type="button" className="text-sm font-semibold text-ink underline underline-offset-2"
          onClick={() => { setState({ status: 'loading' }); setAttempt((n) => n + 1); }}
        >
          다시 불러오기
        </button>
      </Frame>
    );
  }
  if (!origin || !path) {
    return <Frame><Note>이 문항은 원본 시험지를 보여 줄 수 없어요(문항이 지워졌거나 다시 올라왔어요).</Note></Frame>;
  }

  const url = pages.urlOf(path);
  const broken = pages.broken.has(path) || (!signed.loading && !url && !pages.signing.has(path));
  return (
    <Frame>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-semibold text-gray-700">
          원본 {shown} / {origin.pageCount}쪽
        </span>
        <span className="flex items-center gap-1">
          <PageButton label="앞 쪽" disabled={shown <= 1} onClick={() => setPage(shown - 1)}><ChevronLeft className="h-4 w-4" /></PageButton>
          <PageButton label="다음 쪽" disabled={shown >= origin.pageCount} onClick={() => setPage(shown + 1)}><ChevronRight className="h-4 w-4" /></PageButton>
        </span>
        {shown === origin.pageNo ? (
          <span className="text-xs text-gray-500">이 문항이 있는 쪽</span>
        ) : (
          <button type="button" className="text-xs font-semibold text-ink underline underline-offset-2" onClick={() => setPage(null)}>
            문항 쪽으로
          </button>
        )}
      </div>
      <div className="max-h-[40vh] overflow-auto rounded-md border border-gray-200 bg-white sm:max-h-[55vh]">
        {url && pages.showable(path) ? (
          // 서명 URL 이라 next/image 대상이 아니다. 주소마다 새 요소 — 옛 주소의 오류가 새 시도에 섞이지 않게
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={url} src={url} alt={`원본 ${shown}쪽`} className="w-full"
            onError={() => pages.onError(path, url)} onLoad={() => pages.onLoad(path)}
          />
        ) : (
          <div className="flex aspect-[1/1.414] flex-col items-center justify-center gap-2 text-xs text-gray-400">
            {broken ? (
              <>
                <span>이 쪽을 불러오지 못했어요.</span>
                <button type="button" onClick={() => pages.retry(path)} className="font-semibold text-ink underline underline-offset-2">
                  다시 불러오기
                </button>
              </>
            ) : '불러오는 중…'}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <SignedFileButton path={path}>크게 보기</SignedFileButton>
        {EXAM_VIEW_TYPES.has(origin.sourceType) && (
          <Link
            href={examViewHref(origin.sourceId)} target="_blank" rel="noopener noreferrer" prefetch={false}
            className="font-semibold text-ink underline underline-offset-2"
          >
            시험지 전체 보기
          </Link>
        )}
      </div>
    </Frame>
  );
}

/** 원본 칸의 틀 — 제목 한 줄 + 내용 */
function Frame({ children }: { children: ReactNode }) {
  return (
    <section aria-label="원본 시험지" className="space-y-2">
      <h3 className="text-sm text-gray-600">원본 시험지</h3>
      {children}
    </section>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="rounded-md bg-gray-50 px-3 py-6 text-center text-xs text-gray-500">{children}</p>;
}

function PageButton({
  label, disabled, onClick, children,
}: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button" aria-label={label} disabled={disabled} onClick={onClick}
      className="rounded-md border border-gray-200 p-1 text-gray-700 hover:border-ink hover:text-ink disabled:opacity-40"
    >
      {children}
    </button>
  );
}
