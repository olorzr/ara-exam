import { describe, it, expect } from 'vitest';
import {
  capWarnings, dedupeWarnings, type DraftWarning, issuesByTargetId, itemTargetLabel,
  listSome, listSomeLabels, pageTarget, pushDraftWarning, resolveDraftWarning,
  dropStaleWarnings, toWarningObject, warningKey, warningText,
  type OcrWarning, type OcrWarningObject,
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
    const must: OcrWarningObject = { message: '못 바꾼 표기가 있어요', keep: 'always' };
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
    pushDraftWarning(list, { message: '못 바꾼 표기가 있어요', keep: 'always' }, 2);
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
    pushDraftWarning(list, { message: '못 바꾼 표기가 있어요', keep: 'always' }, 2);
    expect(list.map((w) => w.message)).toEqual([
      '2번 선지를 못 읽었어요', '못 바꾼 표기가 있어요',
    ]);
  });

  it('모델 경고가 없으면 평범한 경고를 뒤에서 밀어낸다', () => {
    const list: DraftWarning[] = [{ message: 'a' }, { message: 'b' }];
    pushDraftWarning(list, { message: '필수', keep: 'always' }, 2);
    expect(list.map((w) => w.message)).toEqual(['a', '필수']);
  });

  it('전부 필수 경고면 더 넣지 않는다 — 목록이 무한정 길어지면 안 된다', () => {
    const list: DraftWarning[] = [
      { message: 'x', keep: 'always' }, { message: 'y', keep: 'always' },
    ];
    pushDraftWarning(list, { message: 'z', keep: 'always' }, 2);
    expect(list.map((w) => w.message)).toEqual(['x', 'y']);
  });
});

describe('resolveDraftWarning', () => {
  it('필수 표시를 최종 경고까지 들고 간다 — 병합 뒤 상한에서 또 걸러진다', () => {
    const resolved = resolveDraftWarning(
      { message: '못 바꾼 표기가 있어요', ref: 'Q1', kind: 'problem', keep: 'always' },
      new Map([['Q1', 'row-1']]),
    );
    expect(resolved).toMatchObject({ keep: 'always' });
  });

  it('평범한 경고에는 표시를 붙이지 않는다', () => {
    const resolved = resolveDraftWarning({ message: '그냥 경고', page: 2 }, new Map());
    expect(resolved).not.toHaveProperty('keep');
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

describe('dropStaleWarnings', () => {
  const problem = (over: Partial<{ id: string; passage_id: string | null; work_titles: string[] }> = {}) => ({
    id: 'q1', passage_id: 'p1', work_titles: ['엄마 걱정'], ...over,
  });
  const at = (id: string) => [{ kind: 'problem' as const, id, label: '1번' }];

  it('지문에 붙은 문항의 "지문을 못 찾았다" 는 걷어낸다 — 저장될 값과 모순된다', () => {
    const out = dropStaleWarnings(
      [{ message: '딸린 지문을 못 찾았어요.', targets: at('q1'), about: { unlinked: true } }],
      [problem()],
    );
    expect(out).toEqual([]);
  });

  it('끝내 지문이 없으면 남긴다', () => {
    const out = dropStaleWarnings(
      [{ message: '딸린 지문을 못 찾았어요.', targets: at('q1'), about: { unlinked: true } }],
      [problem({ passage_id: null })],
    );
    expect(out).toHaveLength(1);
  });

  it('최종 목록에 없는 작품에 대한 말은 걷어낸다', () => {
    const out = dropStaleWarnings(
      [{ message: '작품명을 본문으로 알아봤어요(엉뚱).', targets: at('q1'), about: { work: '엉뚱' } }],
      [problem()],
    );
    expect(out).toEqual([]);
  });

  it('아직 붙어 있는 작품에 대한 말은 남기되 단서는 떼어 낸다 — 저장할 값이 아니다', () => {
    const out = dropStaleWarnings(
      [{
        message: '작품명을 본문으로 알아봤어요(엄마 걱정).',
        targets: at('q1'),
        keep: 'always',
        about: { work: '엄마 걱정' },
      }],
      [problem()],
    );
    expect(out).toEqual([{
      message: '작품명을 본문으로 알아봤어요(엄마 걱정).',
      targets: at('q1'),
      keep: 'always',
    }]);
  });

  it('단서가 없거나 문자열인 경고는 건드리지 않는다', () => {
    const kept = ['옛 문자열 경고', { message: '선지를 못 읽었어요.', targets: at('q1') }];
    expect(dropStaleWarnings(kept, [problem()])).toEqual(kept);
  });

  it('가리키는 문항을 못 찾으면 그대로 남긴다 — 참거짓을 가릴 근거가 없다', () => {
    const one = [{ message: '지문을 못 찾았어요.', targets: at('없는id'), about: { unlinked: true as const } }];
    expect(dropStaleWarnings(one, [problem()])).toEqual([{
      message: '지문을 못 찾았어요.', targets: at('없는id'),
    }]);
  });
});

describe('필수 경고의 차례 — 자리를 내주는 등급', () => {
  const work = (n: number): DraftWarning => ({
    message: `작품 ${n}`, keep: 'work',
  });

  it('작품 경고가 자리를 다 채워도 옛한글 경고는 들어간다 — 안 보이면 틀린 글자가 인쇄된다', () => {
    const list: DraftWarning[] = [];
    for (let i = 0; i < 20; i += 1) pushDraftWarning(list, work(i), 20);
    pushDraftWarning(list, { message: '못 바꾼 표기', keep: 'always' }, 20);
    expect(list).toHaveLength(20);
    expect(list.map((w) => w.message)).toContain('못 바꾼 표기');
  });

  it('같은 등급끼리는 밀어내지 않는다 — 서로 밀면 차례만 바뀐다', () => {
    const list: DraftWarning[] = [];
    for (let i = 0; i < 20; i += 1) pushDraftWarning(list, work(i), 20);
    pushDraftWarning(list, work(99), 20);
    expect(list.map((w) => w.message)).not.toContain('작품 99');
  });

  it('상한을 넘겨 자를 때도 자리를 내주는 경고는 다른 필수 경고 뒤에 선다', () => {
    const out = capWarnings([
      { message: '보통' },
      { message: '작품', keep: 'work' },
      { message: '못 바꾼 표기', keep: 'always' },
    ], 2);
    expect(out.map((w) => (typeof w === 'string' ? w : w.message))).toEqual(['못 바꾼 표기', '작품']);
  });
});

describe('dropStaleWarnings — 지문 쪽 작품', () => {
  const passage = { id: 'p1', works: [{ label: '가', title: '진달래꽃' }] };
  const at = [{ kind: 'passage' as const, id: 'p1', label: '1쪽 지문' }];

  it('구분 표시가 달라진 말은 걷어낸다 — 메시지가 달라 중복 제거에 안 걸린다', () => {
    const out = dropStaleWarnings(
      [{ message: '작품명을 본문으로 알아봤어요((나) 진달래꽃).', targets: at, about: { work: '진달래꽃', label: '나' } }],
      [], [passage],
    );
    expect(out).toEqual([]);
  });

  it('표시까지 같으면 남긴다', () => {
    const out = dropStaleWarnings(
      [{ message: '작품명을 본문으로 알아봤어요((가) 진달래꽃).', targets: at, about: { work: '진달래꽃', label: '가' } }],
      [], [passage],
    );
    expect(out).toHaveLength(1);
  });

  it('지문에서 빠진 작품에 대한 말은 걷어낸다', () => {
    const out = dropStaleWarnings(
      [{ message: '작품명을 본문으로 알아봤어요(엄마 걱정).', targets: at, about: { work: '엄마 걱정' } }],
      [], [passage],
    );
    expect(out).toEqual([]);
  });
});

describe('dropStaleWarnings — 같은 작품에 대한 말은 한 번만', () => {
  const passage = { id: 'p1', works: [{ label: '가', title: '진달래꽃' }] };
  const at = [{ kind: 'passage' as const, id: 'p1', label: '1쪽 지문' }];

  it('출처 판정이 묶음마다 갈려 메시지가 달라도 하나만 남긴다', () => {
    const out = dropStaleWarnings([
      { message: '작품명을 본문으로 알아봤어요((가) 진달래꽃).', targets: at, about: { work: '진달래꽃', label: '가' } },
      { message: '작품명((가) 진달래꽃)이 인쇄된 것인지 알 수 없어요.', targets: at, about: { work: '진달래꽃', label: '가' } },
    ], [], [passage]);
    expect(out).toHaveLength(1);
    expect((out[0] as { message: string }).message).toContain('본문으로 알아봤어요');
  });

  it('대상이 다르면 따로 남긴다 — 문항마다 알려야 한다', () => {
    const other = [{ kind: 'problem' as const, id: 'q1', label: '1번' }];
    const out = dropStaleWarnings([
      { message: 'A', targets: at, about: { work: '진달래꽃', label: '가' } },
      { message: 'B', targets: other, about: { work: '진달래꽃' } },
    ], [{ id: 'q1', passage_id: 'p1', work_titles: ['진달래꽃'] }], [passage]);
    expect(out).toHaveLength(2);
  });
});

describe('dropStaleWarnings — 대상을 가리는 규칙', () => {
  it('쪽만 가리키는 경고는 쪽이 다르면 따로 남긴다 — 버려진 항목에는 id 가 없다', () => {
    const out = dropStaleWarnings([
      { message: 'A', targets: [{ kind: 'page', page: 2, label: '2쪽' }], about: { work: '진달래꽃' } },
      { message: 'B', targets: [{ kind: 'page', page: 3, label: '3쪽' }], about: { work: '진달래꽃' } },
    ], [], []);
    expect(out).toHaveLength(2);
  });

  it('대상이 여럿이면 건드리지 않는다 — 하나만 보고 지우면 나머지 말까지 사라진다', () => {
    const many = [{
      message: '지문을 못 찾았어요.',
      targets: [
        { kind: 'problem' as const, id: 'q1', label: '1번' },
        { kind: 'problem' as const, id: 'q2', label: '2번' },
      ],
      about: { unlinked: true as const },
    }];
    const out = dropStaleWarnings(many, [
      { id: 'q1', passage_id: 'p1', work_titles: [] },
      { id: 'q2', passage_id: null, work_titles: [] },
    ], []);
    expect(out).toHaveLength(1);
  });
});

describe('세 등급이 서로를 밀어내는 차례', () => {
  const many = (n: number, keep: 'work' | 'merge'): OcrWarningObject[] =>
    Array.from({ length: n }, (_, i) => ({ message: `${keep} ${i}`, keep }));

  it('작품 경고가 자리를 다 채워도 병합 경고가 들어간다 — 값이 말없이 달라진 자리다', () => {
    const capped = capWarnings([...many(60, 'work'), { message: '뺐어요', keep: 'merge' }], 60);
    expect(capped.map((w) => (typeof w === 'string' ? w : w.message))).toContain('뺐어요');
    expect(capped).toHaveLength(60);
  });

  it('병합 경고가 자리를 다 채워도 옛한글 경고가 들어간다', () => {
    const capped = capWarnings([...many(60, 'merge'), { message: '못 바꾼 표기', keep: 'always' }], 60);
    expect(capped.map((w) => (typeof w === 'string' ? w : w.message))).toContain('못 바꾼 표기');
  });

  it('작품 경고는 병합·옛한글 경고를 밀어내지 못한다', () => {
    const list: DraftWarning[] = [
      { message: '못 바꾼 표기', keep: 'always' },
      { message: '뺐어요', keep: 'merge' },
    ];
    pushDraftWarning(list, { message: '작품', keep: 'work' }, 2);
    expect(list.map((w) => w.message)).toEqual(['못 바꾼 표기', '뺐어요']);
  });

  it('병합 경고는 작품 경고를 밀어낸다 — 아래 등급만 밀어낸다', () => {
    const list: DraftWarning[] = [
      { message: '못 바꾼 표기', keep: 'always' },
      { message: '작품', keep: 'work' },
    ];
    pushDraftWarning(list, { message: '뺐어요', keep: 'merge' }, 2);
    expect(list.map((w) => w.message)).toEqual(['못 바꾼 표기', '뺐어요']);
  });

  it('상한 안에서는 차례를 흔들지 않는다', () => {
    const list: OcrWarning[] = ['a', { message: '작품', keep: 'work' }, 'b'];
    expect(capWarnings(list, 5)).toEqual(list);
  });
});

describe('모델 경고를 먼저 미는 것도 아래 등급 안에서만', () => {
  it('등급이 높은 모델 경고는 밀어내지 않는다 — 등급이 먼저다', () => {
    const list: DraftWarning[] = [
      { message: '모델이 적었지만 옛한글', fromModel: true, keep: 'always' },
      { message: '작품', keep: 'work' },
    ];
    pushDraftWarning(list, { message: '뺐어요', keep: 'merge' }, 2);
    expect(list.map((w) => w.message)).toEqual(['모델이 적었지만 옛한글', '뺐어요']);
  });

  it('같은 등급의 모델 경고도 밀어내지 않는다', () => {
    const list: DraftWarning[] = [
      { message: '모델이 적은 병합급', fromModel: true, keep: 'merge' },
      { message: '보통' },
    ];
    pushDraftWarning(list, { message: '뺐어요', keep: 'merge' }, 2);
    expect(list.map((w) => w.message)).toEqual(['모델이 적은 병합급', '뺐어요']);
  });

  it('아래 등급이면 모델 경고를 먼저 민다 — 우리 파서가 낸 말이 더 값지다', () => {
    const list: DraftWarning[] = [
      { message: '모델 자유 서술', fromModel: true },
      { message: '선지를 못 읽었어요' },
    ];
    pushDraftWarning(list, { message: '못 바꾼 표기', keep: 'always' }, 2);
    expect(list.map((w) => w.message)).toEqual(['선지를 못 읽었어요', '못 바꾼 표기']);
  });
});

describe('밀어낼 것은 가장 낮은 등급 가운데서 고른다', () => {
  it('보통 경고를 두고 작품 경고를 밀어내지 않는다 — 최종 상한과 판단이 같아야 한다', () => {
    const list: DraftWarning[] = [
      ...Array.from({ length: 19 }, (_, i) => ({ message: `보통 ${i}` })),
      { message: '작품', keep: 'work' },
    ];
    pushDraftWarning(list, { message: '못 바꾼 표기', keep: 'always' }, 20);
    const said = list.map((w) => w.message);
    expect(said).toContain('작품');
    expect(said).toContain('못 바꾼 표기');
    expect(said).not.toContain('보통 18');
  });

  it('묶음 상한과 최종 상한이 같은 것을 남긴다', () => {
    const list: DraftWarning[] = [
      ...Array.from({ length: 19 }, (_, i) => ({ message: `보통 ${i}` })),
      { message: '작품', keep: 'work' },
    ];
    pushDraftWarning(list, { message: '못 바꾼 표기', keep: 'always' }, 20);
    const capped = capWarnings(
      [...Array.from({ length: 19 }, (_, i) => ({ message: `보통 ${i}` })),
        { message: '작품', keep: 'work' as const },
        { message: '못 바꾼 표기', keep: 'always' as const }],
      20,
    ).map((w) => (typeof w === 'string' ? w : w.message));
    for (const kept of ['작품', '못 바꾼 표기']) {
      expect(list.map((w) => w.message)).toContain(kept);
      expect(capped).toContain(kept);
    }
  });
});
