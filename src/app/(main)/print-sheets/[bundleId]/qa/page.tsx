'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PrintPageStrip } from '@/components/print-scan';
import {
  PrintQaKeyView, PrintQaList, PrintQaPaperView, PrintQaStatusCard,
} from '@/components/print-qa';
import { QuizReferencesSection, ReferencePickerDialog } from '@/components/passage-quiz';
import { useAiEnabled } from '@/hooks/useAiEnabled';
import { useBundlePageImages } from '@/hooks/useBundlePageImages';
import { usePrintQa } from '@/hooks/usePrintQa';
import { useQuizReferences } from '@/hooks/useQuizReferences';
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import type { SignedImages } from '@/hooks/useSignedImageUrls';
import { looksLikeQaPrint, qaAnswerCounts, qaReferenceBlocker } from '@/lib/print-qa';
import { signalsFromBundle } from '@/lib/quiz-references/signals';
import type { PrintBundle, PrintScan } from '@/types/print-scan';

/**
 * 학교 프린트 **문답 시험지** (`/print-sheets/[bundleId]/qa`).
 *
 * 선생님이 직접 `N. 물음 … 답: 정답` 꼴로 만든 프린트를 진짜 시험지처럼 뽑는 화면이다 —
 * **문제지**(답 없음) · **교사용**(문제 밑에 답) · **답지**(번호와 답) 셋을 골라 인쇄한다.
 * 답이 비어 있거나 학생이 연필로 적어 둔 것은 개념지 등을 근거로 모범답안을 만들 수 있다.
 *
 * 같은 묶음의 **빈칸 시험지**(`/print-sheets/[bundleId]`)와는 다른 화면이다 — 그쪽은 본문에
 * 구멍을 뚫는 개념지이고, 이쪽은 문항으로 나눈 문답이다. 둘은 같은 원문에서 나온다.
 *
 * ⚠️ 훅은 조건부로 못 부르므로 묶음을 아는 바깥과 문답을 다루는 안쪽을 나눈다
 *    (`/print-sheets/[bundleId]/page.tsx` 와 같은 모양).
 */

/** 목록 경로 — 뒤로 가기의 기준 */
const LIST_HREF = '/print-sheets';

type ViewMode = 'edit' | 'paper' | 'teacher' | 'key';

const VIEW_LABELS: { mode: ViewMode; label: string }[] = [
  { mode: 'edit', label: '편집' },
  { mode: 'paper', label: '문제지' },
  { mode: 'teacher', label: '교사용' },
  { mode: 'key', label: '답지' },
];

/**
 * 문답 시험지 화면.
 * @returns 묶음을 읽어 문답 편집·인쇄 화면을 그린다 (아직 못 읽은 프린트면 안내)
 */
export default function PrintQaPage() {
  const params = useParams<{ bundleId: string }>();
  const data = useBundlePageImages(params.bundleId);

  if (data.loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!data.bundle) {
    return <Notice title="프린트를 찾을 수 없어요." detail={data.error ?? undefined} />;
  }

  // 읽어 둔 원문이 없으면 나눌 것이 없다 — 무엇을 하면 되는지 함께 말한다
  if (!data.bundle.ocr_html) {
    return (
      <Notice
        title={`"${data.bundle.name}" 은(는) 아직 읽지 않았어요.`}
        detail="목록에서 읽기를 먼저 해 주세요. 읽어 둔 원문으로 문답을 나눕니다."
      />
    );
  }

  return (
    <PrintQaWorkspace
      bundle={data.bundle}
      scan={data.scan}
      sheetId={data.sheetId}
      images={data.images}
    />
  );
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

/**
 * 문답을 다루는 안쪽 — 묶음과 원문이 확정된 뒤에만 마운트된다.
 * @param props - 묶음·스캔·그 묶음의 빈칸 시험지 id·원본 쪽 이미지
 * @returns 편집·인쇄 화면
 */
function PrintQaWorkspace({
  bundle, scan, sheetId, images,
}: {
  bundle: PrintBundle;
  scan: PrintScan | null;
  sheetId: string | null;
  images: SignedImages;
}) {
  const ai = useAiEnabled();
  const qa = usePrintQa(bundle);
  const refs = useQuizReferences();
  const [mode, setMode] = useState<ViewMode>('edit');
  const [pickerOpen, setPickerOpen] = useState(false);

  const counts = qaAnswerCounts(qa.items);
  // 문항이 없으면 인쇄할 것도 없다. 모드를 효과로 되돌리지 않고 **그릴 때 정한다**
  const view: ViewMode = qa.items.length > 0 ? mode : 'edit';
  // ⚠️ **방금 나누며 알아낸 작품**(`qa.meta.work`)을 쓴다(코덱스 리뷰). 화면이 뜰 때 읽어 둔
  //    `bundle.qa_meta` 를 보면, 나누기가 프린트에서 작품명을 찾아내도 **새로고침 전까지**
  //    그 신호로 자료를 찾지 못한다
  const signals = signalsFromBundle({
    bundle: { ...bundle, qa_meta: qa.meta },
    scanTitle: scan?.title ?? '',
    sheetId,
  });
  const blocker = qaReferenceBlocker(qa.plain.length, {
    referenceChars: refs.referenceChars,
    loading: refs.loading,
    searching: refs.suggesting,
  });

  // 저장하지 않은 수정이 있으면 떠나기 전에 묻는다
  useUnsavedGuard(qa.dirty, '고친 내용이 저장되지 않았어요. 이 화면을 떠날까요?');

  // 이 프린트에 맞는 자료를 **알아서 찾아 붙인다**(까닭을 함께 보여 준다 — 마음에 안 들면 뺀다).
  // 신호는 묶음에서 나오므로 화면을 여는 순간 이미 정해져 있다 — 사람이 한 번 더 누를 이유가 없다
  useEffect(() => {
    void refs.suggest(signals);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 신호 값이 같으면 다시 찾지 않는다(훅이 `signalsKey` 로 막는다)
  }, [signals.title, signals.author, signals.schoolName, signals.grade, signals.year]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3" data-no-print>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-gray-900">📝 {bundle.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            프린트에 적힌 물음과 답으로 문제지·교사용·답지를 만들어요.{' '}
            <Link href={`/print-sheets/${bundle.id}`} className="text-primary underline underline-offset-2">
              빈칸 시험지
            </Link>
            로 만들려면 이쪽으로 가세요.
          </p>
        </div>

        {qa.items.length > 0 && (
          <div className="flex items-center gap-1">
            {VIEW_LABELS.map((v) => (
              <Button
                key={v.mode}
                type="button"
                size="sm"
                variant={view === v.mode ? 'default' : 'outline'}
                // 색만으로 알리지 않는다 — 화면 낭독기도 무엇이 골라졌는지 말할 수 있어야 한다
                aria-pressed={view === v.mode}
                onClick={() => setMode(v.mode)}
              >
                {v.label}
              </Button>
            ))}
            {view !== 'edit' && (
              <Button type="button" size="sm" onClick={() => window.print()}>
                <Printer className="h-3.5 w-3.5" />
                <span className="ml-1">인쇄</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ⚠️ **고친 것이 있으면 안내로 가리지 않는다**(코덱스 2R). AI 가 꺼져 있어도 이미 나눠 둔
          문답은 손볼 수 있는데, 마지막 문항을 지운 순간 화면이 안내로 바뀌면 저장할 길이 없다 */}
      {!ai.features.print_qa && qa.items.length === 0 && !qa.dirty ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-gray-500">
            아직 열리지 않은 기능이에요.{' '}
            <a href="/settings/ai" className="text-primary underline underline-offset-2">
              AI 연결 설정
            </a>
            에서 상태를 확인해 주세요.
          </CardContent>
        </Card>
      ) : view === 'edit' ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0 space-y-4">
            <PrintQaStatusCard
              counts={counts}
              stale={qa.stale}
              looksLikeQa={looksLikeQaPrint(qa.plain)}
              running={qa.running}
              saving={qa.saving}
              aiEnabled={ai.features.print_qa}
              warnings={qa.meta.warnings ?? []}
              onSplit={() => { void qa.split(); }}
              onCancel={qa.cancel}
            />

            {qa.items.length > 0 && (
              <QuizReferencesSection
                attached={refs.attached}
                suggesting={refs.suggesting}
                canSuggest
                hasRoom={refs.hasRoom}
                textChars={qa.plain.length}
                referenceChars={refs.referenceChars}
                onSuggest={() => { void refs.suggest(signals, { force: true }); }}
                onOpenPicker={() => setPickerOpen(true)}
                onRemove={refs.remove}
              />
            )}

            <PrintQaList
              items={qa.items}
              picked={qa.picked}
              dirty={qa.dirty}
              saving={qa.saving}
              disabled={qa.running || qa.saving}
              generateBlocker={ai.features.print_qa ? blocker : 'ChatGPT 연결이 필요해요.'}
              onPick={qa.pick}
              onApproveLead={qa.approveLead}
              onPickDefault={qa.pickDefault}
              onPickNone={qa.pickNone}
              onQuestion={qa.updateQuestion}
              onAnswer={qa.updateAnswer}
              onRemove={qa.removeItem}
              onGenerate={() => { void qa.generateAnswers(refs.promptReferences); }}
              onSave={() => { void qa.save(); }}
            />

            <ReferencePickerDialog
              open={pickerOpen}
              attachedKeys={refs.attachedKeys}
              onClose={() => setPickerOpen(false)}
              onPick={refs.add}
            />
          </div>

          {/* 원본을 옆에 세워 둔다 — '원문과 달라요' 가 붙은 물음을 대조할 자리다 */}
          <div className="hidden xl:block">
            <PrintPageStrip pages={bundle.pages} paths={bundle.page_paths} images={images} />
          </div>
        </div>
      ) : view === 'key' ? (
        <PrintQaKeyView
          name={bundle.name}
          bundle={bundle}
          items={qa.items}
          references={qa.meta.references ?? []}
        />
      ) : (
        // 인쇄 뷰는 그 모드에서만 그린다 — A4Document 의 숨은 측정 컨테이너가 편집 화면에 있으면
        // 쓰지도 않을 쪽 나누기를 계속 다시 잰다
        <PrintQaPaperView
          name={bundle.name}
          bundle={bundle}
          items={qa.items}
          showAnswers={view === 'teacher'}
        />
      )}
    </div>
  );
}
