import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/*
 * 꼬리표 — 잡지 결의 알약(2026-11-13, 원장님 "문제지 조합에서 OMR 이나 이런 뱃지들이 다 옛날 느낌이야").
 * 1px 테두리 · 굵은 11px · 자간 조금 · 숫자와 영문은 Jost(한글은 Pretendard, `font-tag`). 기출 공유 사이트의 `.badge` ·
 * 세트 카드 라벨과 같은 결이다. 주 꼬리표(default)는 잉크, 강조는 갈래(variant)로 고른다.
 * 상태 갈래(ok·warn·danger·info)는 색만으로 뜻을 전하지 않게 늘 글자와 함께 쓴다.
 * ⚠️ 쓰는 곳에서 색·크기를 className 으로 덮을 수 **없다** — 예전에 `bg-amber-500 text-white`·`bg-sky-500`·`text-[10px]` 를
 *    곳곳에서 덮어 꼬리표가 화면마다 갈라졌다. 이 부품이 className 에서 배치(`badgeLayoutClass`)만 남기고 나머지는 버린다
 *    (개발 중에는 경고). `render`·`style` 은 받지 않는다(타입에서 뺐다). 필요한 갈래가 없으면 여기에 더한다.
 *    쓰는 쪽 코드를 정적으로 훑는 검사는 버렸다 — memo·별칭·render 같은 우회로가 끝이 없었다(코덱스 1~5R). 부품이 스스로 지킨다.
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

/**
 * 꼬리표에 둘 수 있는 배치 유틸리티 — 바깥 여백(논리 방향 `ms`·`me` 포함)·정렬·순서·폭 제한·줄어듦. 변형 접두(`hover:`·`md:`)는 안 받는다.
 */
const LAYOUT_CLASS = /^(?:-?m[trblxyse]?-[\w.[\]/-]+|align-[\w-]+|self-[\w-]+|order-[\w-]+|max-w-[\w.[\]/-]+|min-w-0|shrink(?:-0)?|grow(?:-0)?)$/

/**
 * className 에서 배치만 남긴다 — 색·크기·안쪽 여백·글꼴을 덮는 클래스는 버린다.
 * @param className - 쓰는 곳이 넘긴 className
 * @returns 남긴 배치 클래스와 버린 클래스
 */
function badgeLayoutClass(className: string | undefined): { kept: string; dropped: string[] } {
  const tokens = (className ?? "").split(/\s+/).filter(Boolean)
  return {
    kept: tokens.filter((c) => LAYOUT_CLASS.test(c)).join(" "),
    dropped: tokens.filter((c) => !LAYOUT_CLASS.test(c)),
  }
}

/** 꼬리표 props — `render`·`style` 은 받지 않고 className 은 글자만 받는다(모양은 갈래로 고른다) */
type BadgeProps = Omit<useRender.ComponentProps<"span">, "render" | "style" | "className"> &
  VariantProps<typeof badgeVariants> & {
    /** 배치만 — 바깥 여백·정렬·폭 제한. 그 밖의 클래스는 버린다 */
    className?: string
  }

/**
 * 꼬리표.
 * @param props - 갈래(variant)·배치 className·span 속성
 * @returns span
 */
function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const layout = badgeLayoutClass(className)
  if (layout.dropped.length > 0 && process.env.NODE_ENV !== "production") {
    console.warn(`[Badge] 색·크기는 갈래(variant)로 고른다 — 버린 클래스: ${layout.dropped.join(" ")}`)
  }
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), layout.kept),
      },
      props
    ),
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeLayoutClass, badgeVariants }
