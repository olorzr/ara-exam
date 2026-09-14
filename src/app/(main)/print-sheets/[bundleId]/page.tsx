'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PrintPageStrip } from '@/components/print-scan';
import { ConceptSheetWorkspace } from '@/components/exam-builder';
import { useBundlePageImages } from '@/hooks/useBundlePageImages';
import { useConceptSheetEditor } from '@/hooks/useConceptSheetEditor';
import type { SignedImages } from '@/hooks/useSignedImageUrls';
import type { PrintBundle } from '@/types/print-scan';

/** 목록 경로 — 뒤로 가기의 기준 */
const LIST_HREF = '/print-sheets';

/**
 * 학교 프린트 시험지 편집 (`/print-sheets/[bundleId]`).
 *
 * 시험지는 개념지와 **같은 것**이라 편집·마킹·미리보기·인쇄·성적 연동이 전부 그대로다.
 * 다른 점은 왼쪽에 원본 쪽 이미지를 세워 둔다는 것 하나뿐이다.
 *
 * ⚠️ 훅은 조건부로 못 부르므로 시험지 id 를 아는 바깥과 편집기를 부르는 안쪽을 나눈다.
 */
export default function PrintSheetPage() {
  const params = useParams<{ bundleId: string }>();
  const data = useBundlePageImages(params.bundleId);

  if (data.loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!data.bundle) {
    return <Notice title="프린트를 찾을 수 없어요." detail={data.error ?? undefined} />;
  }

  if (!data.sheetId) {
    return <Notice title={`"${data.bundle.name}" 시험지가 아직 없어요.`} detail={pendingDetail(data.bundle)} />;
  }

  return <PrintSheetWorkspace sheetId={data.sheetId} bundle={data.bundle} images={data.images} />;
}

/** 아직 시험지가 없을 때 무엇을 하면 되는지 */
function pendingDetail(bundle: PrintBundle): string {
  if (bundle.status === '읽는중') return '지금 읽는 중이에요. 잠시 뒤에 목록에서 다시 확인해 주세요.';
  if (bundle.status === '실패') return '읽기가 끝나지 못했어요. 목록에서 "다시 읽기" 를 눌러 주세요.';
  if (bundle.status === '읽기완료') return '목록에서 "시험지 만들기" 를 누르면 바로 만들어집니다.';
  return '목록에서 "읽기" 를 누르면 시험지를 만듭니다.';
}

function Notice({ title, detail }: { title: string; detail?: string }) {
  return (
    <Card>
      <CardContent className="space-y-3 py-10 text-center">
        <p className="text-sm font-medium text-gray-900">{title}</p>
        {detail && <p className="text-sm text-gray-500">{detail}</p>}
        <Link href={LIST_HREF}>
          <Button variant="outline" size="sm">목록으로</Button>
        </Link>
      </CardContent>
    </Card>
  );
}

/** 편집기 — 시험지 id 가 확정된 뒤에만 마운트된다 */
function PrintSheetWorkspace({
  sheetId, bundle, images,
}: {
  sheetId: string;
  bundle: PrintBundle;
  images: SignedImages;
}) {
  const editor = useConceptSheetEditor({
    sheetId,
    listHref: LIST_HREF,
    // 읽어 온 글은 손볼 곳이 있기 마련이라 편집기부터 연다(개념지는 미리보기부터)
    initialScreen: 'editor',
  });

  return (
    <ConceptSheetWorkspace
      editor={editor}
      backHref={LIST_HREF}
      titlePlaceholder="시험지 제목을 입력하세요"
      sidePanel={
        <PrintPageStrip pages={bundle.pages} paths={bundle.page_paths} images={images} />
      }
    />
  );
}
