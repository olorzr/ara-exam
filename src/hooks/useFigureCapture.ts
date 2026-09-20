'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Bbox } from '@/types/problem-bank';

/**
 * 검수 화면에서 **원본을 끌어 잡는 중**인 상태.
 *
 * 한 번에 한 카드만 잡으므로 돌려줄 함수를 그냥 들고 있으면 된다 — 저장은 본문을 아는
 * 카드가 한다. 여기서 관리하는 것은 '누가 무엇을 기다리는가' 뿐이다.
 */

/** 잡은 영역을 돌려줄 함수 */
export type CaptureHandler = (bbox: Bbox, pageUrl: string) => void;

export interface CaptureTarget {
  /** 영역을 기다리는 카드(문항·지문) id */
  id: string;
  /**
   * 다시 자를 그림의 1-based 순번. `null` 이면 **끝에 새로 붙이는** 모드다.
   */
  figureIndex: number | null;
  /**
   * 시작할 때의 **카드 판**(마운트 세대 + 저장 버전). 그 사이 카드가 다시 마운트되거나
   * 그 항목이 저장·삭제되면 이 잡기는 무효다
   */
  version: string;
  onBbox: CaptureHandler;
}

interface UseFigureCaptureInput {
  /** 그 항목이 실린 쪽 — 켤 때 원본을 그 쪽으로 넘긴다 */
  pageOf: (id: string) => number | undefined;
  /**
   * 그 카드의 판 — 마운트 세대와 저장 버전(`updated_at`)을 합친 값. 항목이 사라졌으면 null.
   */
  versionOf: (id: string) => string | null;
  /** 왼쪽 원본이 볼 쪽을 바꾼다 (`useReviewFocus.setPage`) */
  setPage: (page: number) => void;
}

/**
 * 원본 끌어 잡기의 대상과 안내 문구를 관리한다.
 *
 * ⚠️ 카드의 **판이 달라지면 잡기를 무효로 본다**(마운트 세대 + `updated_at`). 잡기를
 *    기다리는 사이에 일어나는 일이 셋이다:
 *    ① 서버 본문을 다시 읽어 카드가 다시 마운트된다(작품명 저장·지문 삭제) — 옛 카드의
 *       `read`·`apply` 클로저가 살아 있어 그때 잡은 그림이 **옛 본문과 함께 저장돼 새 본문을
 *       덮는다**.
 *    ② 그 카드에서 그냥 '저장' 이나 '검수 완료' 를 누른다 — 들고 있던 저장 함수가 **옛
 *       `updated_at`** 을 닫아 두고 있어(`useProblemReview.saveProblem` 의 `problems` 클로저),
 *       나중에 부르면 아무도 안 고쳤는데 **충돌로 튕긴다**(코덱스 리뷰 1R).
 *    ③ 그 항목이 지워진다 — 없는 행에 저장하러 간다.
 *    state 를 효과로 지우지 않고 렌더에서 파생한다(`set-state-in-effect` 규칙).
 * @param input - 쪽·마운트 세대 조회와 쪽 이동
 * @returns 지금 대상과 시작·취소·전달 함수, 그리고 안내 문구
 */
export function useFigureCapture({ pageOf, versionOf, setPage }: UseFigureCaptureInput) {
  const [state, setState] = useState<CaptureTarget | null>(null);

  // 카드의 판이 달라졌으면(다시 마운트·저장·삭제) 없던 일로 본다
  const target = state && versionOf(state.id) === state.version ? state : null;

  /**
   * 이 카드가 영역을 기다리게 한다. 같은 카드의 **같은 자리**를 다시 누르면 그만둔다.
   * @param id - 카드 id
   * @param onBbox - 잡은 영역을 받을 함수
   * @param figureIndex - 다시 자를 그림의 1-based 순번. 없으면 새로 붙이기
   */
  // ⚠️ 켜고 끄는 판단도, 넘기는 것도 **setState 업데이터 밖**에서 한다.
  //    업데이터는 StrictMode 에서 두 번 돌아서, 그 안에서 쪽을 넘기거나 onBbox 를 부르면
  //    같은 그림이 두 번 붙는다
  const start = useCallback((id: string, onBbox: CaptureHandler, figureIndex?: number) => {
    const wanted = figureIndex ?? null;
    if (target && target.id === id && target.figureIndex === wanted) {
      setState(null);
      return;
    }
    const version = versionOf(id);
    if (version === null) return;
    setState({ id, figureIndex: wanted, version, onBbox });
    // 원본을 그 항목이 실린 쪽으로 넘긴다 — 잡을 그림이 거기 있다.
    // (쪽 탭은 잡는 중에도 바꿀 수 있다 — 쪽을 넘어가는 지문의 그림은 뒤쪽에 있다)
    const page = pageOf(id);
    if (page) setPage(page);
  }, [target, versionOf, pageOf, setPage]);

  // 판이 달라져 잡기가 사라지면 **까닭을 말해 준다.** 안 그러면 배너와 강조가 갑자기
  // 없어지는 것만 보여 고장인 줄 안다(코덱스 리뷰 2R).
  // ⚠️ state 는 효과에서 지우지 않는다(`set-state-in-effect`) — 알리기만 하고, 다음
  //    `start`·`deliver` 가 갈아 끼운다. 한 번만 알리도록 ref 로 잠근다
  const toldRef = useRef<string | null>(null);
  const dropped = state !== null && target === null ? state.id : null;
  useEffect(() => {
    if (dropped === null) {
      toldRef.current = null;
      return;
    }
    if (toldRef.current === dropped) return;
    toldRef.current = dropped;
    toast.info('그 사이 항목이 바뀌어 잡기를 그만뒀어요. 다시 눌러 주세요.');
  }, [dropped]);

  const cancel = useCallback(() => setState(null), []);

  /**
   * 잡은 영역을 기다리던 카드에 넘긴다.
   * @param bbox - 0~1 정규화 영역
   * @param pageUrl - 그 쪽 이미지의 서명 URL
   */
  const deliver = useCallback((bbox: Bbox, pageUrl: string) => {
    // 판이 달라졌으면 `target` 이 이미 null 이라 넘기지 않는다(위 경고와 같은 까닭)
    if (!target) return;
    target.onBbox(bbox, pageUrl);
    setState(null);
  }, [target]);

  /** 왼쪽 원본 위에 띄울 안내. 잡는 중이 아니면 null */
  const banner = target === null ? null
    : target.figureIndex === null
      ? '원본에서 그림을 끌어서 잡아 주세요. 잡으면 그 카드의 본문 끝에 붙습니다.'
      : `${target.figureIndex}번 그림을 원본에서 다시 끌어 잡아 주세요.`
        + ' 그 자리의 그림만 바뀌고 본문의 칩은 그대로예요.';

  return { target, start, cancel, deliver, banner };
}
