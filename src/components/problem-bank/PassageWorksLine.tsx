'use client';

import type { PassageWork } from '@/types/problem-bank';

interface PassageWorksLineProps {
  works?: PassageWork[] | null;
  /** 작품을 모를 때 대신 보여 줄 말 (머리글 범위·'제목 없는 지문') */
  fallback: string;
  /** 지금 훑고 있는 작품 — 그 편을 굵게 짚어 준다 */
  highlight?: string;
}

/**
 * 지문 머리의 **작품 줄** — `(가) 진달래꽃 · 김소월  (나) 엄마 걱정 · 기형도`.
 *
 * 한 지문에 여러 편이 실리므로(sql/33) 파생 문자열 하나를 찍으면 어느 편이 (가)이고
 * 누가 썼는지 알 수 없다. 작품을 골라 훑는 중이면 그 편을 굵게 해, 이 묶음이 왜 나왔는지
 * 한눈에 보이게 한다.
 */
export default function PassageWorksLine({
  works, fallback, highlight,
}: PassageWorksLineProps) {
  if (!works || works.length === 0) {
    return <span className="font-semibold text-gray-900">{fallback}</span>;
  }

  return (
    <>
      {works.map((work) => (
        <span key={work.title} className="inline-flex items-baseline gap-1">
          {work.label && <span className="text-xs text-gray-400">({work.label})</span>}
          <span
            className={work.title === highlight
              ? 'font-semibold text-gray-900'
              : 'font-medium text-gray-600'}
          >
            {work.title}
          </span>
          {work.author && <span className="text-xs text-gray-500">{work.author}</span>}
        </span>
      ))}
    </>
  );
}
