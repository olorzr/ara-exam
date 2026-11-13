import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/*
 * 꼬리표 — 잡지 결의 알약(2026-11-13, 원장님 "문제지 조합에서 OMR 이나 이런 뱃지들이 다 옛날 느낌이야").
 * 1px 테두리 · 굵은 11px · 자간 조금 · 숫자와 영문은 Jost(한글은 Pretendard, `font-tag`). 기출 공유 사이트의 `.badge` ·
 * 세트 카드 라벨과 같은 결이다. 주 꼬리표(default)는 잉크, 강조는 갈래(variant)로 고른다.
 * 상태 갈래(ok·warn·danger·info)는 색만으로 뜻을 전하지 않게 늘 글자와 함께 쓴다.
 * ⚠️ 쓰는 곳에서 색·크기를 className 으로 덮지 말 것 — 예전에 `bg-amber-500 text-white`·`bg-sky-500`·`text-[10px]` 를 곳곳에서
 *    덮어 꼬리표가 화면마다 갈라졌다. 필요한 갈래가 없으면 여기에 더한다.
 */
const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2 py-px font-tag text-[11px] leading-[1.6] font-bold tracking-[0.04em] whitespace-nowrap transition-all focus-visible:ring-[3px] focus-visible:ring-ring/30 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "border-ink bg-ink text-white [a]:hover:bg-ink/85",
        secondary:
          "border-transparent bg-accent-soft text-ink [a]:hover:bg-accent-soft/70",
        destructive:
          "border-destructive/40 bg-destructive/10 text-destructive focus-visible:ring-destructive/20 [a]:hover:bg-destructive/20",
        outline:
          "border-ink text-ink [a]:hover:bg-muted",
        /** 덜 중요한 수 — 단어 시험지의 문항 수 등 */
        muted: "border-gray-300 text-gray-500",
        ghost:
          "border-transparent hover:bg-muted hover:text-muted-foreground",
        link: "border-transparent text-primary underline-offset-4 hover:underline",
        ok: "border-primary text-primary",
        warn: "border-amber-500 bg-amber-50 text-amber-800",
        danger: "border-red-400 bg-red-50 text-red-700",
        info: "border-sky-500 bg-sky-50 text-sky-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
