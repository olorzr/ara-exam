'use client';

interface MarkingModeToggleProps {
  /** 켜져 있으면 본문을 드래그해 마크를 붙이고, 마크를 눌러 뗄 수 있다 */
  pressed: boolean;
  onToggle: () => void;
  className?: string;
}

/**
 * '마킹 모드' 토글 단추 — 편집기 툴바와 미리보기 탭 바가 **같은 단추**를 쓴다.
 * 두 벌로 두면 한쪽만 고쳐져 같은 기능이 두 화면에서 다르게 보인다.
 * 켜짐은 색뿐 아니라 `aria-pressed` 로도 알린다.
 */
export default function MarkingModeToggle({ pressed, onToggle, className = '' }: MarkingModeToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border-2 text-[13px] font-bold transition-all
        ${pressed ? 'bg-primary border-primary text-white' : 'bg-white border-primary text-primary'} ${className}`.trim()}
      onClick={onToggle}
    >
      <span
        aria-hidden="true"
        className={`w-2.5 h-2.5 rounded-full transition-colors ${pressed ? 'bg-white' : 'bg-gray-300'}`}
      />
      마킹 모드
    </button>
  );
}
