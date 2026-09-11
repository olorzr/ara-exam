'use client';

import { useEffect, useState } from 'react';
import { ArrowUpToLine, Image as ImageIcon, Trash2, Type } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ProblemHtmlEditor from '@/components/problem-editor/ProblemHtmlEditor';
import PassageContinueButton from './PassageContinueButton';
import FigureStrip from './FigureStrip';
import { useFigureEditor } from '@/hooks/useFigureEditor';
import { useTrackedState } from '@/hooks/useTrackedState';
import type { Bbox } from '@/types/problem-bank';
import AreaPathPicker from './AreaPathPicker';
import type { AreaTreeNode } from '@/lib/problem-bank/area-tree';
import { UNIT_DEPTH_LABELS } from '@/lib/problem-bank/unit-tree';
import type { PassagePatch } from '@/lib/problem-bank/mutations';
import type { Passage } from '@/types/problem-bank';

interface PassageEditorCardProps {
  passage: Passage;
  /** 이 지문에 딸린 문항 수 — 지우기 전에 알려 준다 */
  problemCount: number;
  areaTree: AreaTreeNode[];
  /** 교과서 단원 트리. 출처에 교과서가 없으면 빈 배열이라 칸이 안 뜬다 */
  unitTree: AreaTreeNode[];
  selected: boolean;
  onSelect: () => void;
  onSave: (patch: PassagePatch) => Promise<boolean>;
  onDelete: () => void;
  /** 저장하지 않은 수정이 생기거나 사라질 때 알린다 — '검수 마치기' 를 막는 데 쓴다 */
  onDirtyChange?: (dirty: boolean) => void;
  /** OCR 이 이 지문에 남긴 확인거리 — 위 배너의 경고를 카드에도 붙인다 */
  issues?: string[];
  /**
   * 다음 쪽에서 이어지는 본문을 읽어 온다. AI 가 꺼져 있거나 원본이 없으면 없다.
   * 읽어 온 글은 **본문 끝에 붙여 보여 주기만** 하고 저장은 사람이 누른다.
   */
  onContinue?: (page: number, soFarHtml: string) => Promise<{ html: string } | null>;
  /** 이 지문의 이어 읽기가 도는 중인가 */
  continuing?: boolean;
  /** 원본 문서의 쪽 수 — 없는 쪽을 읽으러 가지 않게 가둔다 */
  sourcePageCount?: number;
  /**
   * 이 지문을 **앞 지문에 이어 붙인다.** 읽는 순서상 앞 지문이 있을 때만 온다.
   * 쪽을 넘어가는 지문이 둘로 갈라져 저장됐을 때 손으로 합치는 길이다.
   */
  onMergeIntoPrevious?: () => void;
  /** 본문에 끼운 그림들의 서명 URL */
  figureUrls?: Map<string, string>;
  /** 원본에서 끌어 잡기를 시작한다 — 페이지가 끝난 영역을 넘겨준다 */
  onStartCapture?: (handler: (bbox: Bbox, pageUrl: string) => void) => void;
  /** 지금 이 카드가 영역을 기다리는 중인가 */
  capturing?: boolean;
}

/**
 * 지문 한 개의 검수 카드.
 *
 * ⚠️ 호출부는 `key={passage.id}` 를 준다(ProblemEditorCard 와 같은 이유).
 */
export default function PassageEditorCard({
  passage, problemCount, areaTree, unitTree, selected, onSelect, onSave, onDelete, onDirtyChange,
  issues, onContinue, continuing, sourcePageCount, onMergeIntoPrevious,
  figureUrls, onStartCapture, capturing,
}: PassageEditorCardProps) {
  // 값과 함께 최신 ref 를 든다 — 그림을 붙이는 동안 친 글을 잃지 않으려면
  // 다 올린 **뒤에** 본문을 읽어야 한다
  const [html, setHtml, bodyRef] = useTrackedState(passage.html);
  const [title, setTitle] = useState(passage.title);
  const [author, setAuthor] = useState(passage.author);
  const [area, setArea] = useState<string[]>(passage.area_path);
  const [unit, setUnit] = useState<string[]>(passage.unit_path);
  const [figurePaths, setFigurePaths, pathsRef] = useTrackedState<string[]>(
    passage.figure_paths ?? [],
  );
  /**
   * 저장할 때 '글로 출제' 로 되돌려야 하는가.
   *
   * ⚠️ 이미지 출제 지문에 뒷부분을 이어 붙여도, 인쇄는 **잘라 둔 시작 쪽 이미지**를 쓰므로
   *    되찾은 글이 여전히 안 나간다. 저장할 때 함께 바꿔야 한다(코덱스 리뷰).
   */
  const [backToText, setBackToText, backToTextRef] = useTrackedState(false);
  const [saving, setSaving] = useState(false);

  /**
   * 그림을 붙이거나 뺄 때는 **본문과 경로를 한 번에** 저장한다 —
   * 따로 저장될 틈을 주면 자리표시자와 그림 수가 어긋난다.
   */
  const figures = useFigureEditor({
    kind: 'passage',
    read: () => ({ html: bodyRef.current, paths: pathsRef.current }),
    // ⚠️ 저장을 **기다리기 전에** 화면에 반영한다 — 그 왕복 동안 친 글을 잃지 않는다
    apply: (next) => { setHtml(next.html); setFigurePaths(next.paths); },
    id: passage.id,
    save: async (next) => {
      // ⚠️ 밀린 '글로 출제' 도 함께 싣는다. 이 저장만으로 카드가 깨끗해지므로,
      //    빠뜨리면 검수를 마쳐도 인쇄는 시작 쪽 이미지만 쓴다
      const ok = await onSave({
        html: next.html,
        figure_paths: next.paths,
        ...(backToTextRef.current ? { render_mode: 'text' as const } : {}),
      });
      if (ok) {
        setFigurePaths(next.paths);
        setBackToText(false);
      }
      return ok;
    },
  });

  /** 저장하지 않은 수정이 있는가 — 문항 카드와 같은 이유로 화면에 알린다 */
  const dirty = html !== passage.html
    || title !== passage.title
    || author !== passage.author
    // ⚠️ 그림 경로와 밀린 출제 방식도 센다. 그림을 뺐는데 저장이 실패하면 화면에서만
    //    사라진 채 '저장 안 됨' 표시가 안 떠, 검수를 마친 뒤 되살아난다
    || backToText
    || figurePaths.join('\u0000') !== (passage.figure_paths ?? []).join('\u0000')
    || area.join('>') !== passage.area_path.join('>')
    || unit.join('>') !== passage.unit_path.join('>');

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const handleSave = async () => {
    setSaving(true);
    // ⚠️ `figure_paths` 도 함께 보낸다 — 그림을 붙이는 저장이 실패했을 때 사람이 다시
    //    눌러 고칠 길이 이것뿐이다(자리표시자만 남고 경로가 안 들어간 상태를 푼다)
    const ok = await onSave({
      html, title, author, area_path: area, unit_path: unit, figure_paths: figurePaths,
      // 이어 읽어 붙였으면 글로 되돌린다 — 잘라 둔 이미지는 시작 쪽만 담고 있다
      ...(backToText ? { render_mode: 'text' as const } : {}),
    });
    // ⚠️ **성공했을 때만** 내린다. 실패했는데 내리면 다시 눌러도 이미지 출제인 채로 남아
    //    되찾은 글이 영영 인쇄물에 안 나간다
    if (ok) setBackToText(false);
    setSaving(false);
  };



  /**
   * 다음 쪽에서 이어지는 글을 읽어 **본문 끝에 붙인다.**
   *
   * ⚠️ 저장하지 않는다 — 카드가 '저장 안 됨' 이 되고 사람이 확인한 뒤 누른다.
   *    잘못 읽었을 때 되돌릴 길이 있어야 한다.
   */
  const handleContinue = async (page: number) => {
    const result = await onContinue?.(page, bodyRef.current);
    if (!result?.html) return;
    // ⚠️ 읽는 동안(수십 초) 친 글을 잃지 않게 **끝난 뒤의** 본문 뒤에 붙인다
    const now = bodyRef.current;
    setHtml(now ? `${now}\n${result.html}` : result.html);
    // 이미지 출제인 채로 두면 되찾은 글이 인쇄물에 안 나간다
    if (passage.render_mode === 'image') setBackToText(true);
  };

  const toggleRenderMode = () => {
    const next = passage.render_mode === 'image' ? 'text' : 'image';
    if (next === 'image' && !passage.image_path) return;
    onSave({ render_mode: next });
  };

  return (
    <div
      data-passage-id={passage.id}
      onFocusCapture={onSelect}
      className={`rounded-lg border-2 p-4 transition ${
        selected ? 'border-primary shadow-sm'
          : issues && issues.length > 0 ? 'border-amber-400 bg-amber-50/40' : 'border-amber-200 bg-amber-50/40'
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={onSelect} className="text-sm font-semibold text-gray-900">
          지문 {passage.label || ''}
        </button>
        <Badge variant="outline">{passage.page_no}쪽</Badge>
        <Badge variant="outline">문항 {problemCount}개</Badge>
        {passage.render_mode === 'image' && <Badge variant="outline">이미지 출제</Badge>}
        {backToText && (
          <Badge className="bg-sky-500 text-white">저장하면 글로 출제</Badge>
        )}
        {dirty && <Badge className="bg-sky-500 text-white">저장 안 됨</Badge>}
        {issues && issues.length > 0 && (
          <Badge className="bg-amber-500 text-white">확인 필요 {issues.length}</Badge>
        )}

        <div className="ml-auto flex items-center gap-1">
          {passage.image_path && (
            <Button type="button" variant="outline" size="sm" onClick={toggleRenderMode}>
              {passage.render_mode === 'image'
                ? <><Type className="h-3.5 w-3.5" /><span className="ml-1">글로 출제</span></>
                : <><ImageIcon className="h-3.5 w-3.5" /><span className="ml-1">이미지로 출제</span></>}
            </Button>
          )}
          {onMergeIntoPrevious && (
            <Button
              type="button" variant="outline" size="sm"
              onClick={onMergeIntoPrevious}
              title="이 지문을 바로 앞 지문의 뒤에 붙입니다"
            >
              <ArrowUpToLine className="h-3.5 w-3.5" />
              <span className="ml-1">앞 지문에 붙이기</span>
            </Button>
          )}
          <Button
            type="button" variant="outline" size="sm"
            onClick={() => {
              const message = problemCount > 0
                ? `이 지문을 지울까요? 딸린 문항 ${problemCount}개는 남고 지문만 떨어집니다.\n`
                  + '문항을 서버에서 다시 읽으므로, 저장하지 않은 입력은 사라집니다.'
                : '이 지문을 지울까요?';
              if (window.confirm(message)) onDelete();
            }}
            aria-label="지문 삭제"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {issues && issues.length > 0 && (
        <ul className="mb-3 list-disc space-y-0.5 rounded border border-amber-300 bg-amber-50 py-2 pl-7 pr-3 text-xs text-amber-900">
          {issues.map((issue) => <li key={issue}>{issue}</li>)}
        </ul>
      )}

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">작품명</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 text-sm" />
            {/* 트리거가 딸린 문항의 작품명까지 함께 바꾼다 — 모르고 고치면 놀란다 */}
            <p className="text-[11px] text-gray-400">딸린 문항의 작품명도 함께 바뀝니다</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">지은이</Label>
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} className="h-8 text-sm" />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-gray-500">본문</Label>
          <ProblemHtmlEditor value={html} onChange={setHtml} minHeight={200} ariaLabel="지문 본문" />
        </div>

        <FigureStrip
          paths={figurePaths}
          urls={figureUrls ?? new Map()}
          onRemove={figures.remove}
          onStartCapture={onStartCapture ? () => onStartCapture(figures.capture) : undefined}
          capturing={capturing}
          busy={figures.busy}
        />

        {onContinue && (
          <PassageContinueButton
            defaultPage={passage.page_no + 1}
            maxPage={sourcePageCount ?? 0}
            busy={continuing ?? false}
            onRead={handleContinue}
          />
        )}

        <AreaPathPicker tree={areaTree} value={area} onChange={setArea} />
        <AreaPathPicker
          tree={unitTree} value={unit} labels={UNIT_DEPTH_LABELS} onChange={setUnit}
        />

        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? '저장 중…' : '저장'}
          </Button>
        </div>
      </div>
    </div>
  );
}
