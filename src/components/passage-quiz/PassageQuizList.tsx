'use client';

import { Button } from '@/components/ui/button';
import {
  numberQuizItems, type PassageQuizDropped, type QuizItem,
} from '@/lib/passage-quiz';
import QuizItemRow from './QuizItemRow';

/**
 * 만든 문항 목록 — 유형별로 나눠 보여 주되 **번호는 한 벌**이다.
 *
 * 번호를 `numberQuizItems` 한 곳에서 매긴다. 구간마다 따로 세면 문항을 하나 뺐을 때
 * 문제지와 정답표의 번호가 어긋나고, 그것은 채점할 때에야 드러난다.
 */

interface PassageQuizListProps {
  items: QuizItem[];
  dropped: PassageQuizDropped | null;
  onChange: (id: string, patch: Partial<Pick<QuizItem, 'text' | 'answer'>>) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

/**
 * 만든 문항 목록을 그린다.
 * @param props - 문항·버린 내역과 수정·삭제·비우기 콜백
 * @returns 목록 (문항이 없으면 버린 내역 안내만)
 */
export default function PassageQuizList({
  items, dropped, onChange, onRemove, onClear,
}: PassageQuizListProps) {
  const numbered = numberQuizItems(items);
  const ox = numbered.filter((n) => n.item.kind === 'ox');
  const short = numbered.filter((n) => n.item.kind === 'short');

  if (items.length === 0) return <DroppedNote dropped={dropped} />;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-gray-500">
            전체 <b className="text-gray-800">{items.length}문항</b>
            {' '}· O,X {ox.length}개 · 단답형 {short.length}개
          </p>
          {/* 저장되지 않는다는 사실을 문항이 있을 때 계속 보여 준다 — 떠나기 전 확인창이
              닿지 못하는 길(브라우저 뒤로 가기·로그아웃)이 있다 */}
          <p className="mt-0.5 text-xs text-amber-700">
            저장되지 않아요. 인쇄하거나 옮겨 적기 전에 화면을 떠나면 사라집니다.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClear}>전부 지우기</Button>
      </div>

      <Group title="O,X" numbered={ox} onChange={onChange} onRemove={onRemove} />
      <Group title="단답형" numbered={short} onChange={onChange} onRemove={onRemove} />

      <DroppedNote dropped={dropped} />
    </section>
  );
}

/** 유형 한 구간 */
function Group({
  title, numbered, onChange, onRemove,
}: {
  title: string;
  numbered: ReturnType<typeof numberQuizItems>;
  onChange: PassageQuizListProps['onChange'];
  onRemove: PassageQuizListProps['onRemove'];
}) {
  if (numbered.length === 0) return null;
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <h2 className="text-sm font-semibold text-gray-900">{title} {numbered.length}문항</h2>
      <ol className="divide-y divide-gray-100">
        {numbered.map(({ item, number }) => (
          <QuizItemRow
            key={item.id}
            item={item}
            number={number}
            onChange={(patch) => onChange(item.id, patch)}
            onRemove={() => onRemove(item.id)}
          />
        ))}
      </ol>
    </div>
  );
}

/**
 * 왜 적게 나왔는지 — 안 보여 주면 "왜 세 개뿐이지" 만 남는다.
 * 지어낸 근거·답을 걸러 낸 것은 **일부러 한 일**이라 그렇게 말해 준다.
 */
function DroppedNote({ dropped }: { dropped: PassageQuizDropped | null }) {
  if (!dropped) return null;
  const lines = [
    dropped.evidenceNotInText > 0 && `근거 구절이 지문·참고자료에 없어 뺀 문항 ${dropped.evidenceNotInText}개`,
    dropped.answerNotInText > 0 && `답이 지문·참고자료에 없어 뺀 단답형 ${dropped.answerNotInText}개`,
    dropped.duplicate > 0 && `같은 내용이라 뺀 문항 ${dropped.duplicate}개`,
    dropped.malformed > 0 && `모양이 안 맞아 뺀 문항 ${dropped.malformed}개`,
  ].filter((line): line is string => Boolean(line));

  if (lines.length === 0) return null;
  return <p className="text-xs text-gray-500">{lines.join(' · ')}</p>;
}
