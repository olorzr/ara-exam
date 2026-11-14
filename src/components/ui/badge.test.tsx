import { memo } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge, badgeLayoutClass, badgeVariants } from './badge';

/**
 * 꼬리표가 화면마다 갈라지지 않게 **부품이 스스로** 지킨다(2026-11-13 — 원장님 "OMR 이나 이런 뱃지들이 다 옛날 느낌이야").
 * 예전에는 쓰는 곳마다 `bg-amber-500 text-white`·`bg-sky-500`·`text-[10px]` 를 덮어 꼬리표가 제각각이었다.
 * ⚠️ 쓰는 쪽 코드를 정적으로 훑는 검사로 되돌리지 말 것 — 정규식·경로 풀기·타입 검사기 판정 모두 memo·별칭·render 같은
 *    우회로가 계속 나왔다(코덱스 1~5R). Badge 가 className 에서 배치만 남기므로 어떻게 불러와도 덮어쓸 수 없다.
 */

afterEach(() => vi.restoreAllMocks());

describe('badgeLayoutClass', () => {
  it('배치만 남긴다 — 바깥 여백(논리 방향 포함) · 정렬 · 순서 · 폭 제한 · 줄어듦', () => {
    const allowed = 'ml-2 -mt-0.5 ms-2 me-1 mx-auto align-middle self-start order-1 max-w-full min-w-0 shrink grow-0';
    expect(badgeLayoutClass(allowed)).toEqual({ kept: allowed, dropped: [] });
  });

  it('색·크기·안쪽 여백·글꼴·테두리와 변형 표기는 버린다', () => {
    const bad = ['bg-amber-500', 'text-white', 'text-lg', 'text-ink', 'text-[10px]', 'pl-8', 'px-1.5', 'font-normal',
      'border-0', 'rounded', 'h-5', 'hover:bg-red-500', 'md:ml-2'];
    expect(badgeLayoutClass(`ml-2 ${bad.join(' ')}`)).toEqual({ kept: 'ml-2', dropped: bad });
  });

  it('비었으면 아무것도 없다', () => {
    expect(badgeLayoutClass(undefined)).toEqual({ kept: '', dropped: [] });
  });
});

describe('Badge', () => {
  it('넘긴 색·크기는 그리지 않고 갈래 모양을 지킨다 — 배치는 남는다', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    render(<Badge variant="warn" className="ml-2 bg-red-500 text-lg pl-8">정답 없음</Badge>);
    const el = screen.getByText('정답 없음');
    expect(el.className).toContain('ml-2');
    expect(el.className).toContain('border-amber-500');
    expect(el.className).toContain('font-tag');
    for (const c of ['bg-red-500', 'text-lg', 'pl-8']) expect(el.className.split(/\s+/)).not.toContain(c);
    // 개발 중에는 버린 것을 알린다
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('bg-red-500 text-lg pl-8'));
  });

  it('어떻게 감싸 불러와도 덮어쓸 수 없다 — memo · 다른 이름 · 객체 필드', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const Memo = memo(Badge);
    const parts = { Tag: Badge };
    render(<><Memo className="bg-red-500">가</Memo><parts.Tag className="text-[10px]">나</parts.Tag></>);
    expect(screen.getByText('가').className).not.toContain('bg-red-500');
    expect(screen.getByText('나').className).not.toContain('text-[10px]');
  });

  it('배치만 넘기면 경고하지 않는다', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    render(<Badge className="ml-2 align-middle">OMR</Badge>);
    expect(warn).not.toHaveBeenCalled();
  });

  it('render · style 은 받지 않는다(타입에서 뺐다 — 뿌리를 바꾸면 갈래 모양이 통째로 사라진다)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    // @ts-expect-error render 는 받지 않는다
    const withRender = <Badge render={<b />}>a</Badge>;
    // @ts-expect-error style 은 받지 않는다
    const withStyle = <Badge style={{ background: 'red' }}>b</Badge>;
    // @ts-expect-error className 은 글자만 — 함수 className 은 받지 않는다
    const withFn = <Badge className={() => 'bg-red-500'}>c</Badge>;
    expect([withRender, withStyle, withFn]).toHaveLength(3);
  });

  it('길이가 정해지지 않은 글은 wrap 으로 줄을 바꾼다 — 기본은 한 줄 알약', () => {
    render(<><Badge>OMR</Badge><Badge variant="muted" wrap>중2 비상(박영민) 2학기 2. 문학의 갈래 &gt; (1) 동백꽃</Badge></>);
    const pill = screen.getByText('OMR').className.split(/\s+/);
    expect(pill).toContain('whitespace-nowrap');
    expect(pill).toContain('rounded-full');
    const wrapped = screen.getByText(/문학의 갈래/).className.split(/\s+/);
    expect(wrapped).toContain('whitespace-normal');
    expect(wrapped).not.toContain('whitespace-nowrap');
    expect(wrapped).toContain('max-w-full');
  });

  it('갈래 — 상태와 덜 중요한 수, 주 꼬리표는 잉크', () => {
    for (const variant of ['default', 'outline', 'secondary', 'muted', 'ok', 'warn', 'danger', 'info'] as const) {
      expect(badgeVariants({ variant })).toContain('border');
    }
    expect(badgeVariants()).toContain('bg-ink');
    expect(badgeVariants()).toContain('font-tag');
  });
});
