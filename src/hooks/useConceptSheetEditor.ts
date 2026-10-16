'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { Editor } from '@tiptap/react';
import type { BuilderCategory, MarkItem } from '@/components/exam-builder';
import { extractMarks } from '@/lib/concept-marks';
import { sanitizeConceptHTML } from '@/lib/sanitize-html';
import { fireConceptGradeSync } from '@/lib/concept-grade-sync';
import {
  DEFAULT_CONCEPT_CATEGORY,
  buildConceptSheetPayload,
  generateConceptTitle,
  isCategoryIncomplete,
  type ConceptDraftSnapshot,
} from '@/lib/concept-sheet-form';
import { useConceptMarkActions } from './useConceptMarkActions';
import { useConceptSheetDraft } from './useConceptSheetDraft';
import { DEFAULT_PASS_PERCENTAGE } from '@/lib/constants';
import type { ConceptSheet } from '@/types';

export interface ConceptSheetEditorOptions {
  /** 편집할 개념지 id. 'new' 면 새로 만든다 */
  sheetId: string;
  /**
   * 목록 화면 경로. 뒤로 가기와 '찾을 수 없음' 이 여기로 돌아가고,
   * 새로 만든 뒤 주소도 `${listHref}/{id}` 가 된다.
   *
   * ⚠️ 그래서 **편집기의 부모 경로**여야 한다(개념지는 `/exam/builder`).
   *    'new' 로 들어오지 않는 화면(프린트 시험지)은 그 규칙과 무관하다.
   */
  listHref: string;
  /** 처음 보일 화면. 없으면 새 개념지는 편집기, 기존 개념지는 미리보기 */
  initialScreen?: 'editor' | 'preview';
}

/**
 * 개념지 에디터의 상태·로딩·저장을 캡슐화한 훅.
 * `sheetId` 가 'new' 이면 새 개념지, UUID 이면 기존 개념지를 불러와 편집한다.
 *
 * 화면을 두 곳에서 쓴다 — 개념지(`/exam/builder/[id]`)와 학교 프린트 시험지
 * (`/print-sheets/[bundleId]`). 그래서 경로를 훅 안에서 읽지 않고 **호출부가 넘긴다**.
 *
 * 마킹 조작은 `useConceptMarkActions`, 제목·검증·payload 조립은
 * `@/lib/concept-sheet-form` 이 담당한다.
 *
 * 보안: editor_html 은 저장 시에도 불러올 때도 `sanitizeConceptHTML` 로 정화한다
 * (Stored XSS 방어 — concept_sheets 는 authenticated 전원이 쓰는 공유 테이블이다).
 */
export function useConceptSheetEditor(opts: ConceptSheetEditorOptions) {
  const { sheetId, listHref } = opts;
  const router = useRouter();
  const { user } = useAuth();
  const isNew = sheetId === 'new';

  const [screen, setScreen] = useState<'editor' | 'preview'>(
    opts.initialScreen ?? (isNew ? 'editor' : 'preview'),
  );
  const [title, setTitle] = useState('');
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(!isNew);
  const [category, setCategory] = useState<BuilderCategory>(DEFAULT_CONCEPT_CATEGORY);
  const [editorHTML, setEditorHTML] = useState('');
  const [marks, setMarks] = useState<MarkItem[]>([]);
  // 합격 기준(%) — 단어 시험지와 같은 규약. 커트라인 미만이면 재시험이고,
  // 이 값이 학원 관리 시스템의 합격/불합격 판정 기준이 된다(sql/25).
  const [passPercentage, setPassPercentage] = useState(DEFAULT_PASS_PERCENTAGE);
  const [previewTab, setPreviewTab] = useState('concept');
  // 마킹 모드 — 편집기와 미리보기가 **한 값**을 나눠 쓴다. 꺼져 있으면 어느 화면에서도 포인터
  // (드래그·클릭)로 마크가 붙거나 떨어지지 않는다. 화면을 오가도 되돌리지 않는다(편집기는 미리보기
  // 중에도 마운트된 채라 두 벌을 두면 언젠가 갈린다).
  const [markingMode, setMarkingMode] = useState(false);
  const toggleMarkingMode = useCallback(() => setMarkingMode((v) => !v), []);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [initialHTML, setInitialHTML] = useState<string | null>(isNew ? '' : null);
  /**
   * 저장된 개념지 id·버전·저장 중 — **ref** 다. 첫 저장이 끝나기 전에 다시 누르면 state 는 아직
   * 안 바뀌어 있어 두 번째 INSERT 가 나간다(같은 개념지가 둘). 버전은 낙관적 동시성 제어용으로
   * 불러올 때의 updated_at 을 기억해 저장 시 충돌을 감지하고, 저장마다 돌려받은 값으로 바뀐다.
   */
  const savedIdRef = useRef<string | null>(isNew ? null : sheetId);
  const versionRef = useRef<string | null>(null);
  const savingRef = useRef(false);
  const editorRef = useRef<Editor | null>(null);

  const markActions = useConceptMarkActions(editorRef, setEditorHTML);

  /** 지금 화면의 편집 값 — 저장된 값과 견줘 '저장 안 됨'·주소 옮기기를 정한다(useConceptSheetDraft) */
  const current = useMemo<ConceptDraftSnapshot>(
    () => ({ title, category, html: editorHTML, passPercentage }),
    [title, category, editorHTML, passPercentage],
  );
  const [initialSaved] = useState<ConceptDraftSnapshot | null>(() => (isNew
    ? { title: '', category: DEFAULT_CONCEPT_CATEGORY, html: '', passPercentage: DEFAULT_PASS_PERCENTAGE }
    : null));
  const replace = useCallback((id: string) => router.replace(`${listHref}/${id}`), [router, listHref]);
  const draft = useConceptSheetDraft({ current, initialSaved, editorRef, replace });
  const { loadedIdRef, markLoaded, markSaved } = draft;

  /** 카테고리 변경 시 자동 제목도 갱신한다 */
  const handleCategoryChange = useCallback((next: BuilderCategory) => {
    setCategory(next);
    if (!titleManuallyEdited) {
      setTitle(generateConceptTitle(next));
    }
  }, [titleManuallyEdited]);

  /** 제목 직접 입력 */
  const handleTitleChange = useCallback((value: string) => {
    setTitle(value);
    setTitleManuallyEdited(true);
  }, []);

  /* ── 기존 개념지 불러오기 ── */
  useEffect(() => {
    (async () => {
      if (isNew || !user) {
        setLoading(false);
        return;
      }
      // ⚠️ 방금 만들어 주소만 바뀐 경우다 — 다시 읽으면 저장하는 사이 이어 친 값을 DB 값으로 덮는다
      if (loadedIdRef.current === sheetId) return;
      // 네트워크 예외(throw)가 나도 스피너가 멈추도록 finally 에서 loading 을 내린다.
      try {
        const { data, error } = await supabase
          .from('concept_sheets')
          .select('*')
          .eq('id', sheetId)
          .single();

        if (error || !data) {
          toast.error('개념지를 찾을 수 없습니다.');
          router.push(listHref);
          return;
        }

        const sheet = data as ConceptSheet;
        const loadedCategory: BuilderCategory = {
          level: sheet.level,
          year: sheet.year ?? '',
          grade: sheet.grade,
          publisher: sheet.publisher,
          semester: sheet.semester,
          unit: sheet.unit,
          subunit: sheet.subunit,
          schoolName: sheet.school_name ?? '',
        };
        const loadedPass = sheet.pass_percentage ?? DEFAULT_PASS_PERCENTAGE;
        setTitle(sheet.title);
        setCategory(loadedCategory);
        versionRef.current = sheet.updated_at;
        setPassPercentage(loadedPass);
        // 저장 시 sanitize 했더라도 과거 오염 데이터나 직접 DB/RPC 쓰기가 남아 있을 수
        // 있다. 편집기 content 로 주입하기 전에 읽기 경로에서도 정화한다.
        const safeHTML = sanitizeConceptHTML(sheet.editor_html);
        setInitialHTML(safeHTML);
        setEditorHTML(safeHTML);
        markLoaded(sheet.id, { title: sheet.title, category: loadedCategory, html: safeHTML, passPercentage: loadedPass });
      } catch {
        toast.error('개념지를 불러오지 못했어요.');
        router.push(listHref);
      } finally {
        setLoading(false);
      }
    })();
  }, [isNew, sheetId, user, router, listHref, loadedIdRef, markLoaded]);

  /* ── 저장 (editor_html 은 sanitizeConceptHTML 로 정화) ── */
  const handleSave = useCallback(async () => {
    // ⚠️ 저장 중에 다시 누르면 무시한다 — 첫 INSERT 가 끝나기 전이면 같은 개념지가 둘 생긴다
    if (!user || savingRef.current) return;

    if (isCategoryIncomplete(category)) {
      toast.error('카테고리를 먼저 설정해주세요.');
      return;
    }

    const editor = editorRef.current;
    const currentMarks = editor ? extractMarks(editor) : marks;
    /** 보내는 편집 값 — 저장하는 사이 이어 친 것과 가르려고 붙잡아 둔다(useConceptSheetDraft) */
    const sent: ConceptDraftSnapshot = {
      title, category, html: editor ? editor.getHTML() : editorHTML, passPercentage,
    };
    const payload = buildConceptSheetPayload({
      title,
      category,
      html: sanitizeConceptHTML(sent.html),
      marks: currentMarks,
      passPercentage,
    });

    savingRef.current = true;
    setSaving(true);

    // 저장 중 throw(네트워크 등)가 나도 스피너가 멈추도록 finally 에서 saving 을 내린다.
    try {
      const savedId = savedIdRef.current;
      if (savedId) {
        // 낙관적 동시성 제어: concept_sheets 는 공유 테이블이라 두 사람이 동시에
        // 편집하면 마지막 저장이 상대 변경을 통째로 덮어쓴다(last-write-wins).
        // 불러올 때의 updated_at 과 일치할 때만 갱신하고, 어긋나면(0행 갱신) 저장을
        // 거부해 사용자에게 새로고침을 안내한다. updated_at 은 트리거가 자동 갱신한다.
        let query = supabase
          .from('concept_sheets')
          .update(payload)
          .eq('id', savedId);
        if (versionRef.current) {
          query = query.eq('updated_at', versionRef.current);
        }
        const { data, error } = await query.select('updated_at').maybeSingle();

        if (error) {
          toast.error('저장에 실패했습니다.');
          return;
        }
        if (!data) {
          toast.error('다른 사용자가 이 개념지를 먼저 수정했어요. 새로고침 후 다시 저장해주세요.');
          return;
        }
        versionRef.current = data.updated_at;
        fireConceptGradeSync(savedId, currentMarks.length);
        toast.success('저장되었습니다.');
        // 지난번에 미뤄 둔 주소 옮기기가 있으면 깨끗해진 지금 시도한다
        markSaved(sent, savedId, false);
      } else {
        const { data, error } = await supabase
          .from('concept_sheets')
          .insert(payload)
          .select('id, updated_at')
          .single();

        if (error || !data) {
          toast.error('저장에 실패했습니다.');
          return;
        }
        savedIdRef.current = data.id;
        versionRef.current = data.updated_at;
        fireConceptGradeSync(data.id, currentMarks.length);
        toast.success('저장되었습니다.');
        // ⚠️ 주소는 **저장하는 사이 손댄 것이 없을 때만** 옮긴다(2026-10-15 리뷰 4번) — 옮기면 화면이
        //    새로 마운트돼 DB 값으로 다시 그려지고, 이어 친 글이 사라진다
        markSaved(sent, data.id, true);
      }
    } catch {
      toast.error('저장에 실패했습니다.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
    // ⚠️ passPercentage 를 deps 에 넣지 않으면 방금 바꾼 합격 기준이 아니라 마운트 시점 값으로
    //    저장된다(화면엔 70% 인데 저장은 80% 가 되는 조용한 어긋남).
  }, [user, title, category, editorHTML, marks, passPercentage, markSaved]);

  return {
    router,
    listHref,
    screen,
    setScreen,
    title,
    handleTitleChange,
    category,
    handleCategoryChange,
    editorHTML,
    setEditorHTML,
    marks,
    setMarks,
    passPercentage,
    setPassPercentage,
    previewTab,
    setPreviewTab,
    markingMode,
    toggleMarkingMode,
    saving,
    loading,
    initialHTML,
    editorRef,
    handleSave,
    /** 저장된 값과 다른 편집이 있는가 — 떠날 때 묻는 기준이기도 하다 */
    dirty: draft.dirty,
    handleEditorReady: draft.handleEditorReady,
    ...markActions,
  };
}

/** 편집기 훅이 돌려주는 것 전부 — 작업 화면 컴포넌트가 그대로 받는다 */
export type ConceptSheetEditorState = ReturnType<typeof useConceptSheetEditor>;
