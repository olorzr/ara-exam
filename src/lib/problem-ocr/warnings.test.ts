import { describe, it, expect } from 'vitest';
import {
  capWarnings, dedupeWarnings, type DraftWarning, issuesByTargetId, itemTargetLabel,
  listSome, listSomeLabels, pageTarget, pushDraftWarning, resolveDraftWarning,
  toWarningObject, warningKey, warningText,
} from './warnings';

describe('itemTargetLabel', () => {
  it('문항은 번호로 부른다', () => {
    expect(itemTargetLabel({ kind: 'problem', page: 2, number: 3 })).toBe('3번');
  });

  it('번호가 없으면 쪽으로 부른다 — 번호를 못 읽은 문항도 찾아갈 수 있어야 한다', () => {
    expect(itemTargetLabel({ kind: 'problem', page: 2, number: null })).toBe('2쪽 문항');
  });

  it('지문은 쪽으로 부른다', () => {
    expect(itemTargetLabel({ kind: 'passage', page: 4 })).toBe('4쪽 지문');
  });
});

describe('warningText', () => {
  it('문자열 경고는 그대로', () => {
    expect(warningText('정답표가 안 보여요')).toBe('정답표가 안 보여요');
  });

  it('대상이 있으면 이름을 뒤에 붙인다 — 버튼을 못 그리는 자리를 위해', () => {
    const text = warningText({
      message: '선지를 읽지 못했어요.',
      targets: [{ kind: 'problem', id: 'a', label: '3번' }, { kind: 'problem', id: 'b', label: '5번' }],
    });
    expect(text).toBe('선지를 읽지 못했어요. — 3번, 5번');
  });

  it('대상이 빈 배열이면 메시지만', () => {
    expect(warningText({ message: '읽지 못했어요', targets: [] })).toBe('읽지 못했어요');
  });
});

describe('warningKey · dedupeWarnings', () => {
  it('같은 메시지·같은 대상은 한 번만 남는다', () => {
    const w = { message: '같은 말', targets: [{ kind: 'problem' as const, id: 'a', label: '1번' }] };
    expect(dedupeWarnings([w, { ...w }])).toHaveLength(1);
  });

  it('메시지가 같아도 대상이 다르면 남긴다 — 문항마다 알려야 한다', () => {
    const res = dedupeWarnings([
      { message: '선지 없음', targets: [{ kind: 'problem', id: 'a', label: '1번' }] },
      { message: '선지 없음', targets: [{ kind: 'problem', id: 'b', label: '2번' }] },
    ]);
    expect(res).toHaveLength(2);
  });

  it('문자열과 같은 내용의 객체는 같은 것으로 본다', () => {
    expect(warningKey('읽지 못했어요')).toBe(warningKey({ message: '읽지 못했어요' }));
  });
});

describe('capWarnings', () => {
  it('상한을 넘으면 자른다', () => {
    expect(capWarnings(['a', 'b', 'c'], 2)).toEqual(['a', 'b']);
  });

  // ⚠️ 코덱스 리뷰: 그냥 자르면 뒤에 붙은 필수 경고가 먼저 사라졌다
  it('필수 경고는 상한에 밀려도 남는다 — 앞으로 당겨 살린다', () => {
    const must = { message: '못 바꾼 표기가 있어요', critical: true };
    const capped = capWarnings(['a', 'b', 'c', must], 2);
    expect(capped).toContainEqual(must);
    expect(capped).toHaveLength(2);
  });

  it('필수 경고가 없으면 순서를 흔들지 않는다', () => {
    expect(capWarnings([{ message: 'a' }, { message: 'b' }, { message: 'c' }], 2))
      .toEqual([{ message: 'a' }, { message: 'b' }]);
  });
});

describe('pushDraftWarning', () => {
  it('상한 안에서는 순서대로 담는다', () => {
    const list: DraftWarning[] = [];
    pushDraftWarning(list, { message: 'a' }, 2);
    pushDraftWarning(list, { message: 'b' }, 2);
    pushDraftWarning(list, { message: 'c' }, 2);
    expect(list.map((w) => w.message)).toEqual(['a', 'b']);
  });

  // ⚠️ 코덱스 리뷰: 모델 경고가 상한을 채우면 옛한글 경고가 통째로 사라졌다 —
  //    틀린 글자는 남아 있는데 고치라는 말만 없어져 그대로 인쇄된다
  it('상한이 찼어도 필수 경고는 들어간다 — 평범한 경고를 뒤에서 밀어낸다', () => {
    const list: DraftWarning[] = [{ message: 'a' }, { message: 'b' }];
    pushDraftWarning(list, { message: '못 바꾼 표기가 있어요', critical: true }, 2);
    expect(list).toHaveLength(2);
    expect(list.map((w) => w.message)).toEqual(['a', '못 바꾼 표기가 있어요']);
  });

  // ⚠️ 코덱스 리뷰 2R: 그냥 뒤에서 밀면 방금 담은 '선지를 못 읽었다' 가 나가고
  //    모델의 자유 서술이 남아, 내용이 빠진 문항이 아무 표시 없이 검수를 통과했다
  it('밀어낼 때는 모델이 적은 경고가 먼저다 — 우리 파서 경고가 더 값지다', () => {
    const list: DraftWarning[] = [
      { message: '흐릿해요', fromModel: true },
      { message: '2번 선지를 못 읽었어요', ref: 'Q1' },
    ];
    pushDraftWarning(list, { message: '못 바꾼 표기가 있어요', critical: true }, 2);
    expect(list.map((w) => w.message)).toEqual([
      '2번 선지를 못 읽었어요', '못 바꾼 표기가 있어요',
    ]);
  });

  it('모델 경고가 없으면 평범한 경고를 뒤에서 밀어낸다', () => {
    const list: DraftWarning[] = [{ message: 'a' }, { message: 'b' }];
    pushDraftWarning(list, { message: '필수', critical: true }, 2);
    expect(list.map((w) => w.message)).toEqual(['a', '필수']);
  });

  it('전부 필수 경고면 더 넣지 않는다 — 목록이 무한정 길어지면 안 된다', () => {
    const list: DraftWarning[] = [
      { message: 'x', critical: true }, { message: 'y', critical: true },
    ];
    pushDraftWarning(list, { message: 'z', critical: true }, 2);
    expect(list.map((w) => w.message)).toEqual(['x', 'y']);
  });
});

describe('resolveDraftWarning', () => {
  it('필수 표시를 최종 경고까지 들고 간다 — 병합 뒤 상한에서 또 걸러진다', () => {
    const resolved = resolveDraftWarning(
      { message: '못 바꾼 표기가 있어요', ref: 'Q1', kind: 'problem', critical: true },
      new Map([['Q1', 'row-1']]),
    );
    expect(resolved).toMatchObject({ critical: true });
  });

  it('평범한 경고에는 표시를 붙이지 않는다', () => {
    const resolved = resolveDraftWarning({ message: '그냥 경고', page: 2 }, new Map());
    expect(resolved).not.toHaveProperty('critical');
  });
});

describe('issuesByTargetId', () => {
  it('id 가 있는 대상만 모은다 — 쪽 대상은 붙일 카드가 없다', () => {
    const map = issuesByTargetId([
      { message: '정답이 없어요', targets: [{ kind: 'problem', id: 'a', label: '1번' }] },
      { message: '쪽을 못 읽었어요', targets: [pageTarget(3)] },
    ]);
    expect(map.get('a')).toEqual(['정답이 없어요']);
    expect(map.size).toBe(1);
  });

  it('한 항목에 여러 경고가 붙는다', () => {
    const map = issuesByTargetId([
      { message: '첫째', targets: [{ kind: 'problem', id: 'a', label: '1번' }] },
      { message: '둘째', targets: [{ kind: 'problem', id: 'a', label: '1번' }] },
    ]);
    expect(map.get('a')).toEqual(['첫째', '둘째']);
  });

  it('같은 항목에 같은 말을 두 번 적지 않는다', () => {
    const map = issuesByTargetId([
      { message: '같은 말', targets: [{ kind: 'problem', id: 'a', label: '1번' }] },
      { message: '같은 말', targets: [{ kind: 'problem', id: 'a', label: '1번' }, { kind: 'problem', id: 'b', label: '2번' }] },
    ]);
    expect(map.get('a')).toEqual(['같은 말']);
    expect(map.get('b')).toEqual(['같은 말']);
  });

  it('문자열 경고는 아무 카드에도 안 붙는다', () => {
    expect(issuesByTargetId(['옛 경고']).size).toBe(0);
  });
});

describe('resolveDraftWarning', () => {
  const refToId = new Map([['Q3', 'uuid-q3'], ['P1', 'uuid-p1']]);

  it('ref 가 풀리면 그 행을 가리킨다', () => {
    const res = toWarningObject(resolveDraftWarning(
      { message: '선지가 비었어요', ref: 'Q3', kind: 'problem', page: 2, number: 7 },
      refToId,
    ));
    expect(res.targets).toEqual([{ kind: 'problem', id: 'uuid-q3', page: 2, label: '7번' }]);
  });

  it('지문 ref 도 푼다', () => {
    const res = toWarningObject(resolveDraftWarning(
      { message: '지문이 잘렸어요', ref: 'P1', kind: 'passage', page: 4 },
      refToId,
    ));
    expect(res.targets?.[0]).toMatchObject({ kind: 'passage', id: 'uuid-p1', label: '4쪽 지문' });
  });

  it('ref 가 안 풀리면 쪽을 가리킨다 — 버려진 항목이라 행이 없다', () => {
    const res = toWarningObject(resolveDraftWarning(
      { message: '같은 이름이 두 번 나왔어요', ref: 'Q9', page: 5 },
      refToId,
    ));
    expect(res.targets).toEqual([{ kind: 'page', page: 5, label: '5쪽' }]);
  });

  it('ref 도 쪽도 없으면 메시지만 남는다 — 모델이 낸 자유 경고', () => {
    const res = toWarningObject(resolveDraftWarning({ message: '정답표가 안 보여요' }, refToId));
    expect(res.targets).toBeUndefined();
    expect(res.message).toBe('정답표가 안 보여요');
  });
});

describe('listSome · listSomeLabels', () => {
  it('번호는 정렬·중복 제거 후 몇 개만', () => {
    expect(listSome([3, 1, 1, 2])).toBe('1, 2, 3');
    expect(listSome([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe('1, 2, 3, 4, 5, 6, 7, 8 외 2개');
  });

  it('이름은 순서를 지킨다 — 읽은 순서가 곧 시험지 순서다', () => {
    expect(listSomeLabels(['3번', '1번'])).toBe('3번, 1번');
    expect(listSomeLabels(['a', 'b', 'c'], 2)).toBe('a, b 외 1개');
  });
});
