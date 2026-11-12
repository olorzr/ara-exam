'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageTitle } from '@/components/magazine';
import { ExamAnswerKeyTab, ExamItemsTab, ExamOriginalTab } from '@/components/problem-sets';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useExamView } from '@/hooks/useExamView';
import { MOCK_EXAM_SOURCE_TYPE } from '@/lib/problem-bank/school-exam-tree';
import { setViewHref, SETS_PATH } from '@/lib/problem-bank/source-set-link';
import { sourceMetaLabel } from '@/lib/problem-bank/source-label';
import { mockSubject, sourceSetOf } from '@/lib/problem-bank/source-sets';

/** 탭 */
type ExamTab = 'items' | 'original' | 'key';

const TABS: readonly ExamTab[] = ['items', 'original', 'key'];

/**
 * 읽기 전용 시험 보기 (`/problems/sets/exam/[id]`) — 세트 한 장에서 학교를 누르면 열린다.
 *
 * 탭 셋: 문항·지문(정답 강조 · 해설 접기) / 원본(쪽 이미지 + PDF 새 탭) / 답지(pdf.js 로 그린다).
 * 고치는 길은 없다 — 고치기는 '올라간 기출' 의 시험지 화면(원본 대조 편집)이 맡는다(사용자 결정, 2026-11-13).
 * ⚠️ 내신기출·모의고사만 그린다 — 평가문제집은 문제 은행에서 숨긴다(0.9.65). 주소로 열어도 여기에 새 구멍을 내지 않는다.
 */
export default function ProblemSetExamPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const { data, loading, missing, error, reload } = useExamView(id);
  const [tab, setTab] = useState<ExamTab>('items');
  /**
   * 한 번이라도 연 탭 — 연 탭만 마운트하고 그 뒤로는 감춘 채 둔다(ArchiveSidePanel 과 같은 수법).
   * 원본 탭은 쪽 이미지가 수십 장이라 열 때까지 서명하지 않고, 돌아왔을 때 문항 화면을 처음부터 다시 그리지 않는다.
   */
  const [seen, setSeen] = useState<ReadonlySet<ExamTab>>(() => new Set<ExamTab>(['items']));

  const changeTab = (v: unknown) => {
    // base-ui 는 값으로 null 을 줄 수 있다(CLAUDE.md Known Issues)
    if (!TABS.includes(v as ExamTab)) return;
    const next = v as ExamTab;
    setTab(next);
    setSeen((prev) => (prev.has(next) ? prev : new Set(prev).add(next)));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-3 py-16 text-center text-sm text-gray-500">
        <p>{error}</p>
        <Button type="button" variant="outline" size="sm" onClick={reload}>다시 불러오기</Button>
      </div>
    );
  }
  const set = data ? sourceSetOf(data.source) : null;
  if (missing || !data || !set) {
    return (
      <div className="space-y-3 py-16 text-center text-sm text-gray-500">
        <p>{missing || !data ? '시험지를 찾지 못했어요. 지워졌을 수 있어요.' : '세트로 보는 시험지가 아니에요.'}</p>
        <Link href={SETS_PATH} className="font-semibold text-ink underline underline-offset-2">기출 세트 목록으로</Link>
      </div>
    );
  }

  const { source, passages, problems } = data;
  const mock = source.source_type === MOCK_EXAM_SOURCE_TYPE;
  const keyCount = source.answer_key_paths?.length ?? 0;

  return (
    <div className="mx-auto max-w-[880px] space-y-4">
      <Link
        href={setViewHref(set)}
        prefetch={false}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        이 세트의 {mock ? '과목' : '학교'} 목록
      </Link>

      <div className="border-b-2 border-ink pb-3">
        <PageTitle eyebrow={`( EXAM ) · ${sourceMetaLabel(source)}`}>
          {mock ? mockSubject(source.title) : source.school_name || '학교 미지정'}
        </PageTitle>
        <p className="mt-1 text-sm text-gray-500">
          {source.title} · 문항 {problems.length} · 지문 {passages.length}
        </p>
      </div>

      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList>
          <TabsTrigger value="items">문항·지문</TabsTrigger>
          <TabsTrigger value="original">원본 {source.page_count > 0 ? `${source.page_count}쪽` : ''}</TabsTrigger>
          <TabsTrigger value="key" disabled={keyCount === 0}>답지{keyCount > 1 ? ` ${keyCount}` : ''}</TabsTrigger>
        </TabsList>
        <TabsContent value="items" keepMounted className="pt-3">
          <ExamItemsTab passages={passages} problems={problems} />
        </TabsContent>
        <TabsContent value="original" keepMounted={seen.has('original')} className="pt-3">
          <ExamOriginalTab source={source} />
        </TabsContent>
        <TabsContent value="key" keepMounted={seen.has('key')} className="pt-3">
          <ExamAnswerKeyTab paths={source.answer_key_paths ?? []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
