import { OCR_MAX_WARNINGS } from './constants';

/**
 * OCR 경고에 **어느 항목 얘기인지**를 붙이는 규약 (순수 함수).
 *
 * 예전에는 경고가 문자열 하나였다. 파서는 `Q3: 2번 선지를 읽지 못했어요` 처럼 적었는데,
 * `Q3` 는 **그 묶음 안에서만** 유효한 이름이라 DB 에도 화면에도 남지 않았다 —
 * 선생님은 어느 카드 얘기인지 알 수 없었다.
 *
 * 그래서 경고를 두 단계로 나눈다:
 *  - `DraftWarning` — 파서가 낸다. 아직 id 를 모르므로 `ref`(묶음 지역 이름)만 든다.
 *  - `OcrWarning` — 병합이 `ref` 를 **진짜 행 id** 로 바꿔 만든 최종형. 이게 DB 로 간다.
 *
 * ⚠️ `OcrWarning` 에 **문자열도 남겨 둔다.** 이미 저장된 출처의 `ocr_meta.warnings` 가
 *    전부 문자열이라, 객체만 받으면 옛 출처의 경고가 화면에서 통째로 사라진다.
 */

/**
 * 상한에 밀릴 때의 **차례**.
 *
 * 경고가 넘치면 무엇을 버릴지 정해 두어야 한다. 예전에는 `critical` 참·거짓 하나였는데,
 * 지켜야 할 것이 셋으로 늘면서 같은 등급끼리 서로를 밀어내는 일이 생겼다(코덱스 리뷰 6~7R).
 *
 *  - `'always'` — **못 바꾼 옛한글 표기.** 안 보이면 틀린 글자가 그대로 인쇄된다.
 *  - `'merge'`  — **병합이 값을 바꿨다**('작품을 뺐어요'·'다르게 냈어요'). 저장될 값이
 *    화면에 적힌 것과 다른데 아무 표시가 없으면 아무도 못 찾는다.
 *  - `'work'`   — **작품명을 알아본 것이다.** 확인 안 된 추측이 표준 표기로 굳는 것을 막는다.
 *  - 없음       — 보통 경고. 자리가 모자라면 먼저 밀려난다.
 */
export type WarningKeep = 'always' | 'merge' | 'work';

/** 차례를 숫자로 — 클수록 오래 남는다 */
export function keepRank(keep?: WarningKeep): number {
  if (keep === 'always') return 3;
  if (keep === 'merge') return 2;
  if (keep === 'work') return 1;
  return 0;
}

/** 경고가 가리키는 것의 종류 */
export type OcrWarningTargetKind = 'passage' | 'problem' | 'page';

/** 경고가 가리키는 항목 하나 */
export interface OcrWarningTarget {
  kind: OcrWarningTargetKind;
  /** 지문·문항의 행 id. 버려진 항목이나 쪽 단위 경고에는 없다 */
  id?: string;
  /** 원본 시험지의 쪽 번호 — 화면이 그 쪽으로 넘어가는 데 쓴다 */
  page?: number;
  /** 사람이 읽는 이름 ('3번', '2쪽 지문', '5쪽') */
  label: string;
}

/**
 * 경고가 **무엇에 대해 한 말인가** — 병합이 끝난 뒤 그 말이 아직 참인지 가리는 데 쓴다.
 *
 * 겹쳐 읽은 다음 묶음이 같은 문항을 더 온전하게 내놓으면 앞 묶음의 판단이 **틀린 말이 된다**
 * (지문을 못 찾았다던 문항이 지문에 붙고, 추측이라던 작품명이 다른 이름으로 바뀐다).
 * 그대로 두면 검수 화면이 **저장될 값과 모순되는 경고**를 띄운다(코덱스 리뷰 3R).
 */
export interface WarningAbout {
  /** 이 작품명에 대한 말이다 — 최종 목록에 없으면 버린다 */
  work?: string;
  /**
   * 그때 본 구분 표시('가'·'나').
   * 겹쳐 읽은 묶음이 같은 작품을 다른 표시로 내면 메시지가 달라 중복 제거에 안 걸린다 —
   * 최종 표시와 다른 말은 버린다(코덱스 리뷰 4R).
   */
  label?: string;
  /** '지문을 못 찾았다' 는 말이다 — 끝내 지문에 붙었으면 버린다 */
  unlinked?: true;
}

/** 대상이 붙은 경고 */
export interface OcrWarningObject {
  message: string;
  targets?: OcrWarningTarget[];
  /** 상한에 밀릴 때의 차례 — `DraftWarning.keep` 이 그대로 넘어온다 */
  keep?: WarningKeep;
  /** 병합 뒤에 이 말이 아직 참인지 가릴 단서. 최종 목록에는 남지 않는다 */
  about?: WarningAbout;
}

/** 저장·표시되는 경고. 문자열은 옛 저장분이거나 대상이 없는 묶음 단위 경고다 */
export type OcrWarning = string | OcrWarningObject;

/** 파서 단계의 경고 — 병합이 `ref` 를 id 로 바꾼다 */
export interface DraftWarning {
  message: string;
  /** 이 묶음 안에서만 유효한 이름 ('P1'·'Q3'). 버려진 항목에는 없다 */
  ref?: string;
  kind?: 'passage' | 'problem';
  /** 원본 쪽 번호 */
  page?: number;
  /** 시험지에 인쇄된 문항 번호 */
  number?: number | null;
  /**
   * 상한에 밀릴 때의 **차례** (`WarningKeep`).
   *
   * 자리가 모자라면 **아래 등급을 밀어내고** 들어간다. 같은 등급끼리는 밀어내지 않는다 —
   * 서로 밀면 차례만 바뀐다.
   */
  keep?: WarningKeep;
  /**
   * 모델이 스스로 적은 경고인가 — **가장 먼저 밀려난다**(코덱스 리뷰 2R).
   *
   * 우리 파서가 낸 경고는 '2번 선지를 못 읽었다' 처럼 **무엇이 빠졌는지 아는 말**이고
   * 가리킬 항목도 있다. 모델의 자유 서술을 남기고 그것을 버리면, 내용이 빠진 문항이
   * 검수 카드에 아무 표시 없이 남는다.
   */
  fromModel?: boolean;
  /** 병합 뒤에 이 말이 아직 참인지 가릴 단서 (`WarningAbout`) */
  about?: WarningAbout;
}

/**
 * 파서 경고를 상한 안에서 담는다.
 *
 * ⚠️ 메시지에 `ref` 를 적지 않는다. 'Q3' 는 **그 묶음 안에서만** 유효한 이름이라
 *    화면 어디에도 그런 이름이 없다 — 어느 문항 얘기인지 아무도 모른다.
 *    위치는 `ref`/`page`/`number` 로 **따로** 실어 보내고, 병합이 그것을 진짜 행 id 와
 *    사람이 읽는 이름('3번')으로 바꾼다.
 * @param warnings - 담을 목록 (제자리에서 늘어난다)
 * @param warning - 담을 경고
 * @param max - 상한. 넘으면 조용히 버린다
 */
export function pushDraftWarning(
  warnings: DraftWarning[],
  warning: DraftWarning,
  max: number = OCR_MAX_WARNINGS,
): void {
  if (warnings.length < max) { warnings.push(warning); return; }
  const rank = keepRank(warning.keep);
  if (rank === 0) return;

  // ⚠️ 상한이 찼다고 **필수 경고를 버리면 안 된다**(코덱스 리뷰). 모델 경고 20개가 먼저
  //    차면 못 바꾼 옛한글 표기 경고가 통째로 사라져, 틀린 글자가 검수 카드에 아무 표시
  //    없이 남았다. 자리가 없으면 하나를 밀어내고 들어간다.
  //
  // ⚠️ 밀어낼 차례가 있다(코덱스 리뷰 2R): **모델이 적은 경고가 먼저**다. 그냥 뒤에서부터
  //    밀면 방금 담은 '선지를 못 읽었다' 가 나가고 모델의 자유 서술 19개가 남는다 —
  //    내용이 빠진 문항이 아무 표시 없이 검수를 통과한다.
  //
  // ⚠️ 등급이 셋이다(코덱스 리뷰 4~7R). **자기보다 낮은 등급만** 밀어낸다 — 같은 등급끼리
  //    밀어내면 차례만 바뀌고, 낮은 등급이 높은 등급을 밀어내면 지켜야 할 것을 잃는다
  // ⚠️ 밀어낼 것은 **가장 낮은 등급 가운데**서 고른다(코덱스 리뷰 9R). 그냥 '나보다 낮은 것'
  //    에서 마지막을 고르면, 보통 경고 19개 뒤에 온 작품 경고가 옛한글 경고에게 밀려난다 —
  //    최종 상한(`capWarnings`)은 등급순으로 자르므로 두 곳의 판단이 어긋난다.
  // ⚠️ 모델 경고를 먼저 미는 것도 **그 등급 안에서만**이다(코덱스 리뷰 8R). 등급을 안 보고
  //    밀면 `fromModel` 이 붙은 높은 등급 경고가 낮은 등급에게 밀려난다
  let lowest = rank;
  for (const w of warnings) lowest = Math.min(lowest, keepRank(w.keep));
  if (lowest === rank) return; // 밀어낼 아래 등급이 없으면 더 넣지 않는다

  const atLowest = (w: DraftWarning) => keepRank(w.keep) === lowest;
  const victim = lastIndexWhere(warnings, (w) => w.fromModel === true && atLowest(w))
    ?? lastIndexWhere(warnings, atLowest);
  if (victim === undefined) return;

  warnings.splice(victim, 1);
  warnings.push(warning);
}

/**
 * 조건에 맞는 **마지막** 자리 — 없으면 undefined.
 * @param list - 찾을 목록
 * @param match - 조건
 * @returns 자리 또는 undefined
 */
function lastIndexWhere(
  list: readonly DraftWarning[],
  match: (w: DraftWarning) => boolean,
): number | undefined {
  for (let i = list.length - 1; i >= 0; i -= 1) if (match(list[i])) return i;
  return undefined;
}

/** 항목 하나를 가리키는 이름 — 번호를 모르면 쪽으로 말한다 */
export function itemTargetLabel(
  item: { kind?: 'passage' | 'problem'; page?: number; number?: number | null },
): string {
  if (item.kind === 'passage') return item.page ? `${item.page}쪽 지문` : '지문';
  if (item.number !== null && item.number !== undefined) return `${item.number}번`;
  return item.page ? `${item.page}쪽 문항` : '문항';
}

/**
 * 쪽 하나를 가리키는 대상.
 * @param page - 쪽 번호
 * @returns 대상
 */
export function pageTarget(page: number): OcrWarningTarget {
  return { kind: 'page', page, label: `${page}쪽` };
}

/**
 * 문자열이든 객체든 객체로 맞춘다.
 * @param warning - 경고
 * @returns 메시지와 대상
 */
export function toWarningObject(warning: OcrWarning): OcrWarningObject {
  return typeof warning === 'string' ? { message: warning } : warning;
}

/**
 * 경고를 평문 한 줄로 — 대상 이름까지 붙인다.
 * 토스트·로그처럼 버튼을 못 그리는 자리에서 쓴다.
 * @param warning - 경고
 * @returns '2번 선지를 읽지 못했어요. — 3번, 5번'
 */
export function warningText(warning: OcrWarning): string {
  const { message, targets } = toWarningObject(warning);
  if (!targets || targets.length === 0) return message;
  return `${message} — ${targets.map((t) => t.label).join(', ')}`;
}

/**
 * 같은 경고인지 가리는 키 — 중복 제거에 쓴다.
 * 메시지가 같아도 **대상이 다르면 다른 경고**다(문항마다 알려야 한다).
 * @param warning - 경고
 * @returns 비교용 문자열
 */
export function warningKey(warning: OcrWarning): string {
  const { message, targets } = toWarningObject(warning);
  const ids = (targets ?? []).map((t) => `${t.kind}:${t.id ?? ''}:${t.page ?? ''}`);
  return JSON.stringify([message, ids]);
}

/**
 * 같은 경고를 한 번만 남긴다 (순서 유지).
 * @param warnings - 경고 목록
 * @returns 중복 없는 목록
 */
export function dedupeWarnings(warnings: readonly OcrWarning[]): OcrWarning[] {
  const seen = new Set<string>();
  const out: OcrWarning[] = [];
  for (const warning of warnings) {
    const key = warningKey(warning);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(warning);
  }
  return out;
}

/**
 * 경고 개수에 상한을 건다 — 목록이 무한정 길어지면 아무도 안 읽는다.
 * @param warnings - 경고 목록
 * @param max - 최대 개수
 * @returns 잘라 낸 목록
 */
export function capWarnings(warnings: readonly OcrWarning[], max: number): OcrWarning[] {
  if (warnings.length <= max) return [...warnings];
  // ⚠️ 그냥 자르면 뒤에 붙은 **지켜야 할 경고**(못 바꾼 옛한글 표기 등)가 먼저 사라진다.
  // 등급이 높은 것부터 앞으로 당기고 나머지는 원래 차례를 지킨다(안정 정렬).
  // `pushDraftWarning` 과 **같은 차례**여야 한다 — 한쪽만 다르면 묶음에서는 살아남은 경고가
  // 최종 상한에서 사라진다
  const rankOf = (w: OcrWarning) => (typeof w === 'string' ? 0 : keepRank(w.keep));
  return [...warnings].sort((a, b) => rankOf(b) - rankOf(a)).slice(0, max);
}

/**
 * 항목 id → 그 항목에 걸린 경고 메시지들.
 *
 * 검수 화면의 카드가 "이 문항에 확인할 것이 있다" 를 스스로 보여 주는 데 쓴다.
 * @param warnings - 경고 목록
 * @returns id → 메시지 목록 (id 없는 대상은 빠진다)
 */
export function issuesByTargetId(warnings: readonly OcrWarning[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const warning of warnings) {
    const { message, targets } = toWarningObject(warning);
    for (const target of targets ?? []) {
      if (!target.id) continue;
      const list = out.get(target.id);
      if (list) {
        // 같은 카드에 같은 말을 두 번 적지 않는다
        if (!list.includes(message)) list.push(message);
      } else {
        out.set(target.id, [message]);
      }
    }
  }
  return out;
}

/**
 * 파서 경고를 최종 경고로 — `ref` 를 실제 행 id 로 바꾼다.
 *
 * ref 가 안 풀리는 경우가 정상적으로 있다: 항목이 검증에서 버려졌거나(보내지 않은 쪽,
 * 중복 이름) 애초에 ref 없이 낸 경고다. 그때는 **쪽**을 가리켜 최소한 어디를 볼지 알린다.
 * @param warning - 파서가 낸 경고
 * @param refToId - 이 묶음의 ref → 행 id
 * @returns 대상이 붙은 경고
 */
export function resolveDraftWarning(
  warning: DraftWarning,
  refToId: Map<string, string>,
): OcrWarning {
  const { message, ref, kind, page, number, keep, about } = warning;
  const id = ref ? refToId.get(ref) : undefined;
  // 차례 표시는 최종 경고까지 들고 간다 — 병합 뒤 상한(capWarnings)에서 또 걸러지기 때문
  const mark = {
    ...(keep ? { keep } : {}),
    ...(about ? { about } : {}),
  };

  if (id) {
    return {
      ...mark,
      message,
      targets: [{
        kind: kind ?? 'problem',
        id,
        page,
        label: itemTargetLabel({ kind, page, number }),
      }],
    };
  }
  if (page) return { ...mark, message, targets: [pageTarget(page)] };
  return { ...mark, message };
}

/**
 * 번호를 몇 개만 보여 준다 — 20개가 줄줄이 나오면 아무도 안 읽는다.
 * @param numbers - 번호들
 * @param limit - 보여 줄 개수
 * @returns '1, 2, 3 외 4개'
 */
export function listSome(numbers: readonly number[], limit = 8): string {
  const uniq = [...new Set(numbers)].sort((a, b) => a - b);
  const head = uniq.slice(0, limit).join(', ');
  return uniq.length > limit ? `${head} 외 ${uniq.length - limit}개` : head;
}

/**
 * 대상 이름을 몇 개만 보여 준다 (문자열 판).
 * @param labels - 이름들
 * @param limit - 보여 줄 개수
 * @returns '3번, 5번 외 2개'
 */
export function listSomeLabels(labels: readonly string[], limit = 8): string {
  const head = labels.slice(0, limit).join(', ');
  return labels.length > limit ? `${head} 외 ${labels.length - limit}개` : head;
}

/**
 * 병합이 끝난 뒤 **틀린 말이 된 경고**를 걷어낸다.
 *
 * 겹쳐 읽은 묶음이 같은 문항을 더 온전하게 내놓으면 앞 묶음의 판단이 뒤집힌다 —
 * 지문을 못 찾았다던 문항이 지문에 붙고, 추측이라던 작품명이 다른 이름으로 바뀐다.
 * 그 말을 남겨 두면 검수 화면이 **저장될 값과 모순되는 경고**를 띄운다(코덱스 리뷰 3R).
 *
 * ⚠️ 대상이 없는 경고는 건드리지 않는다 — 어느 문항 얘기인지 몰라 참거짓을 가릴 수 없다.
 * @param warnings - 병합이 모은 경고
 * @param problems - 최종 문항 (id → 딸린 지문·작품명)
 * @returns 아직 참인 경고만. `about` 은 떼어 낸다(저장할 값이 아니다)
 */
export function dropStaleWarnings(
  warnings: readonly OcrWarning[],
  problems: readonly { id: string; passage_id: string | null; work_titles: string[] }[],
  passages: readonly { id: string; works: { label: string; title: string }[] }[] = [],
): OcrWarning[] {
  const problemById = new Map(problems.map((p) => [p.id, p]));
  const passageById = new Map(passages.map((p) => [p.id, p]));
  const out: OcrWarning[] = [];
  /**
   * 이미 한 말을 한 작품(대상 + 제목 + 표시).
   *
   * ⚠️ 묶음마다 출처 판정이 갈리면(`inferred` ↔ 안 밝힘) **메시지가 달라** 중복 제거를
   *    통과한다 — 작품 하나에 말이 둘씩 붙어 여섯 편 지문이 열두 줄이 된다(코덱스 리뷰 5R).
   *    둘 다 '확인해 주세요' 라는 같은 뜻이라 먼저 온 것만 남긴다.
   */
  const saidAbout = new Set<string>();

  for (const warning of warnings) {
    if (typeof warning === 'string') { out.push(warning); continue; }
    const { about, ...rest } = warning;
    if (!about) { out.push(warning); continue; }

    const targets = rest.targets ?? [];
    // ⚠️ 단서는 **대상 하나짜리 경고**에만 뜻이 있다(`resolveDraftWarning` 이 그렇게 만든다).
    //    대상이 여럿인데 하나만 보고 지우면 나머지 대상의 말까지 함께 사라진다(코덱스 리뷰 6R)
    if (targets.length > 1) { out.push(rest); continue; }

    const problem = targets.find((t) => t.kind === 'problem' && t.id)?.id;
    const row = problem ? problemById.get(problem) : undefined;
    if (row) {
      if (about.unlinked && row.passage_id) continue;
      if (about.work && !row.work_titles.includes(about.work)) continue;
    }

    // 지문 쪽 작품 경고는 **구분 표시까지** 본다. 겹쳐 읽은 묶음이 같은 작품을 '(나)' 로
    // 다시 내면 메시지가 달라 중복 제거에 안 걸려, 같은 작품에 말이 둘 남는다
    const passage = targets.find((t) => t.kind === 'passage' && t.id)?.id;
    const doc = passage ? passageById.get(passage) : undefined;
    if (doc && about.work) {
      const work = doc.works.find((w) => w.title === about.work);
      if (!work) continue;
      if (about.label !== undefined && work.label !== about.label) continue;
    }

    if (about.work) {
      // ⚠️ 대상을 **id 로만** 가리면 안 된다 — 버려진 항목의 경고는 id 가 없어 쪽만 남는데,
      //    그때 서로 다른 쪽의 경고가 한 덩어리로 묶여 하나가 사라진다(코덱스 리뷰 6R)
      const owner = targets.map((t) => `${t.kind}:${t.id ?? ''}:${t.page ?? ''}`).join('|');
      const key = `${owner}\u0000${about.work}\u0000${about.label ?? ''}`;
      if (saidAbout.has(key)) continue;
      saidAbout.add(key);
    }

    out.push(rest);
  }

  return out;
}
