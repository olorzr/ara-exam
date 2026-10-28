'use client';

import { markFootnotes } from '@/lib/problem-bank/footnotes';
import { sanitizeReferenceHTML } from '@/lib/sanitize-reference';
import { hasYetHangul } from '@/lib/yet-hangul';
import type { ReferenceTextFormat, ReferenceTextKind } from '@/types/reference-text';

interface ReferenceBodyViewProps {
  body: string;
  format: ReferenceTextFormat;
  kind: ReferenceTextKind;
}

/**
 * 작품 전문 · 개념 본문을 **읽기 전용**으로 — 평가문제집 쪽처럼(말머리 상자 · 어휘 풀이 · 여백 해설 · 도식 · 형광펜).
 *
 * 문항과 같은 스코프(`.pb-sheet.pb-sheet--screen`) 위에 `.ref-sheet` 를 얹는다 — 〈보기〉 상자 · (가) 구역 · 나란히 표 ·
 * 네모 표시 · 각주는 기출 지문과 한 벌의 CSS 가 그리고, 문제집 서식만 reference-sheet.css 가 더한다.
 *
 * ⚠️ 저장할 때 정화했더라도 여기서 **한 번 더** 정화한다(진입이 `dangerouslySetInnerHTML` — `PassageBodyView` 와 같은
 *    다층 방어). 각주 표시(`markFootnotes`)는 정화한 **뒤에** 붙이고 다시 정화하지 않는다(class 를 받지 않는다).
 * 옛 평문 작품은 빈 줄로 문단을 갈라 텍스트 노드로만 그린다(줄바꿈은 CSS 가 지킨다).
 * @param props - 본문 · 형식 · 종류
 * @returns 본문
 */
export default function ReferenceBodyView({ body, format, kind }: ReferenceBodyViewProps) {
  const work = kind === '작품';
  // 옛한글은 블록째 옛한글 글꼴로 — 작품 원문은 명조, 개념은 고딕(지문·발문과 같은 규약)
  const yet = hasYetHangul(body) ? (work ? ' yet-hangul-serif' : ' yet-hangul') : '';
  const base = `pb-sheet pb-sheet--screen ref-sheet ${work ? 'ref-sheet--work' : 'ref-sheet--concept'}${yet}`;

  if (format !== 'html') {
    const paragraphs = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    return (
      <div className={`${base} ref-sheet--plain`}>
        {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
      </div>
    );
  }
  return <div className={base} dangerouslySetInnerHTML={{ __html: markFootnotes(sanitizeReferenceHTML(body)) }} />;
}
