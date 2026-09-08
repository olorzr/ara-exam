'use client';

import type { ReactNode } from 'react';
import { sanitizeInlineHTML, sanitizeProblemHTML } from '@/lib/sanitize-problem';
import type { PaperBlock } from '@/lib/problem-paper/blocks';
import { stripTrailingEmptyParagraphs } from '@/lib/problem-paper/html-trim';
import type { PaperItemSnapshot, PaperSettings } from '@/types/problem-bank';

/** 선지 기호 — 인쇄에서 React 가 붙인다(본문에는 기호를 저장하지 않는다) */
const CHOICE_GLYPHS = ['①', '②', '③', '④', '⑤'];

/**
 * 인쇄 블록을 실제 React 노드로 그린다.
 *
 * 블록 목록을 만드는 일(무엇을 어떤 단위로 쪼갤지)은 순수 함수(`blocks.ts`)가 하고,
 * 여기서는 그리기만 한다 — 그래야 쪼개기 규칙을 테스트로 고정할 수 있다.
 */

interface RenderArgs {
  blocks: PaperBlock[];
  settings: PaperSettings;
  /** Storage 경로 → 서명 URL */
  imageUrls: Map<string, string>;
}

/**
 * 블록을 A4Document 가 받는 ReactNode 배열로 바꾼다.
 * @param args - 블록·설정·이미지 URL
 * @returns 블록 순서 그대로의 노드 배열
 */
export function renderPaperBlocks({ blocks, settings, imageUrls }: RenderArgs): ReactNode[] {
  return blocks.map((block) => {
    switch (block.kind) {
      case 'passage-header':
        return <p key={block.key} className="pb-passage-header">{block.text}</p>;

      case 'passage-part':
        return (
          <div
            key={block.key}
            className={`pb-passage-part${block.first ? ' pb-passage-part--first' : ''}${
              block.last ? ' pb-passage-part--last' : ''
            }`}
            dangerouslySetInnerHTML={{ __html: block.html }}
          />
        );

      case 'passage-image':
        return (
          <div key={block.key} className="pb-passage-part pb-passage-part--first pb-passage-part--last">
            <PrintImage path={block.path} urls={imageUrls} alt={block.label || '지문'} />
          </div>
        );

      case 'problem-image':
        return (
          <div key={block.key} className="pb-q">
            <div className="pb-q__head">
              <span className="q-num q-num--mint">{String(block.number).padStart(2, '0')}</span>
            </div>
            <PrintImage path={block.path} urls={imageUrls} alt={`${block.number}번 문항`} />
            {/* 출처 표시는 글 문항과 같아야 한다 — 그림 문항만 빠지면 표기가 들쭉날쭉해진다 */}
            {settings.showSource && <SourceLine source={block.source} />}
          </div>
        );

      case 'problem':
        return (
          <ProblemBlock
            key={block.key}
            number={block.number}
            snapshot={block.snapshot}
            settings={settings}
            imageUrls={imageUrls}
          />
        );

      default:
        return null;
    }
  });
}

/**
 * 이미지 한 장.
 *
 * ⚠️ URL 이 없을 때 **빈 자리**를 두면 안 된다. 이미지로 출제한 문항은 그 이미지가
 *    본문 전체라, 조용히 비워 두면 문항이 통째로 빠진 시험지가 인쇄된다.
 *    눈에 보이는 자리표시자를 두고, 인쇄 자체는 호출부(문제지 화면)가 막는다.
 */
function PrintImage({ path, urls, alt }: { path: string; urls: Map<string, string>; alt: string }) {
  const src = urls.get(path);
  if (!src) {
    return (
      <div
        style={{
          border: '1px dashed #b45309', color: '#b45309', fontSize: '9pt',
          padding: '16px 8px', textAlign: 'center',
        }}
      >
        이미지를 불러오지 못했어요 ({alt})
      </div>
    );
  }
  // 서명 URL 이라 next/image 로 다룰 수 없고, 인쇄에서는 지연 로딩이 치명적이다
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} />;
}

interface ProblemBlockProps {
  number: number;
  snapshot: PaperItemSnapshot;
  settings: PaperSettings;
  imageUrls: Map<string, string>;
}

/** 문항 하나 — 발문·선지·삽화가 한 블록이다(갈리면 읽을 수 없다) */
function ProblemBlock({ number, snapshot, settings, imageUrls }: ProblemBlockProps) {
  const objective = snapshot.question_type === '객관식' && snapshot.choices.length > 0;

  return (
    <div className="pb-q">
      <div className="pb-q__head">
        <span className="q-num q-num--mint">{String(number).padStart(2, '0')}</span>
        <div
          className="pb-q__stem"
          // 끝에 붙은 빈 문단을 걷어낸다 — 그대로 두면 선지 앞에 빈 줄이 생긴다
          dangerouslySetInnerHTML={{
            __html: stripTrailingEmptyParagraphs(sanitizeProblemHTML(snapshot.stem_html)),
          }}
        />
      </div>

      {snapshot.figure_paths.length > 0 && (
        <div className="pb-figure">
          {snapshot.figure_paths.map((path) => (
            <PrintImage key={path} path={path} urls={imageUrls} alt={`${number}번 자료`} />
          ))}
        </div>
      )}

      {objective ? (
        <div className="pb-q__choices">
          {snapshot.choices.map((choice, i) => (
            <span key={i} className="pb-q__choice">
              <span className="pb-q__choice-glyph">{CHOICE_GLYPHS[i] ?? `(${i + 1})`}</span>
              <span dangerouslySetInnerHTML={{ __html: sanitizeInlineHTML(choice) }} />
            </span>
          ))}
        </div>
      ) : (
        <div className="pb-q__lines">
          {/* 서술형은 쓸 자리가 더 필요하다 */}
          {Array.from({ length: snapshot.question_type === '서술형' ? 4 : 2 }, (_, i) => (
            <div key={i} className="pb-q__line" />
          ))}
        </div>
      )}

      {settings.showSource && <SourceLine source={snapshot.source} />}
    </div>
  );
}

/** 문항 아래에 붙는 출처 한 줄 — 글 문항·그림 문항이 같은 모양을 쓴다 */
function SourceLine({ source }: { source: PaperItemSnapshot['source'] }) {
  const text = [source.year, source.school_name || source.publisher, source.exam_type]
    .filter(Boolean)
    .join(' ');
  if (!text) return null;
  return (
    <p className="pb-q__meta" style={{ paddingLeft: 20, marginTop: 2 }}>
      {text}
    </p>
  );
}
