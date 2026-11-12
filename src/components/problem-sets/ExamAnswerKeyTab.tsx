'use client';

import { useSignedImageUrls } from '@/hooks/useSignedImageUrls';
import { PDF_VIEW_MAX_PAGES, usePdfUrlPages } from '@/hooks/usePdfUrlPages';
import { isPdfPath } from '@/lib/problem-bank/exam-view-files';
import SignedFileButton from './SignedFileButton';

interface ExamAnswerKeyTabProps {
  /** `problem_sources.answer_key_paths` */
  paths: string[];
}

/**
 * 읽기 전용 시험 보기의 '답지' 탭 — 따로 올린 답지 파일을 크게 보여 준다.
 *
 * 2026-11-13 운영 답지 1,100개가 전부 PDF 다. CSP 가 iframe 을 막아(`frame-src` 없음, `object-src 'none'`)
 * pdf.js 로 쪽마다 그림을 그리고(`usePdfUrlPages`) 새 탭으로 여는 링크를 함께 둔다. 사진 답지는 그대로 그린다.
 * 검수 화면의 `AnswerKeyFiles` 는 썸네일 크기라 쓰지 않았다.
 */
export default function ExamAnswerKeyTab({ paths }: ExamAnswerKeyTabProps) {
  const signed = useSignedImageUrls(paths);

  if (paths.length === 0) {
    return <p className="py-12 text-center text-sm text-gray-500">따로 올린 답지가 없어요.</p>;
  }
  return (
    <div className="space-y-4">
      {paths.map((path, i) => (
        <AnswerKeyFile
          key={path}
          path={path}
          index={i}
          count={paths.length}
          url={signed.urls.get(path) ?? null}
          failed={!signed.loading && signed.missing.includes(path)}
          onRetry={signed.reload}
        />
      ))}
    </div>
  );
}

/** 답지 파일 한 개 */
function AnswerKeyFile({ path, index, count, url, failed, onRetry }: {
  path: string;
  index: number;
  count: number;
  url: string | null;
  failed: boolean;
  onRetry: () => void;
}) {
  const pdf = isPdfPath(path);
  const rendered = usePdfUrlPages(pdf ? url : null);
  const title = count > 1 ? `답지 ${index + 1}` : '답지';

  return (
    <section className="space-y-2 rounded-lg border border-gray-200 bg-card p-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-label font-bold">{title}</span>
        {/* 누를 때 새로 서명한다 — 화면을 열 때 받은 주소는 한 시간이면 만료된다(코덱스 2R) */}
        <SignedFileButton path={path}>{pdf ? '답지 PDF 새 탭에서 열기' : '새 탭에서 열기'}</SignedFileButton>
      </div>

      {failed ? (
        <p className="text-xs text-amber-700">
          답지를 불러오지 못했어요.{' '}
          <button type="button" onClick={onRetry} className="underline underline-offset-2">다시 불러오기</button>
        </p>
      ) : !url || rendered.loading ? (
        <p className="py-8 text-center text-xs text-gray-400">불러오는 중…</p>
      ) : !pdf ? (
        // 서명 URL 이라 next/image 최적화 대상이 아니다
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={title} className="w-full" />
      ) : rendered.error ? (
        <p className="text-xs text-amber-700">{rendered.error} 위의 링크로 새 탭에서 열어 보세요.</p>
      ) : (
        <>
          {rendered.pages.map((src, page) => (
            // pdf.js 가 그린 data URL 이다
            // eslint-disable-next-line @next/next/no-img-element
            <img key={page} src={src} alt={`${title} ${page + 1}쪽`} className="w-full border border-gray-100" />
          ))}
          {rendered.total > PDF_VIEW_MAX_PAGES && (
            <p className="text-xs text-gray-500">
              앞 {PDF_VIEW_MAX_PAGES}쪽만 보여요(전체 {rendered.total}쪽). 나머지는 새 탭에서 열어 보세요.
            </p>
          )}
        </>
      )}
    </section>
  );
}
