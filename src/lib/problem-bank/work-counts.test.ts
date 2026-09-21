import { describe, it, expect } from 'vitest';
import {
  collectWorkAuthors, collectWorkKinds, tallyWorkCounts, toWorkFacets, workKindOfArea,
} from './work-counts';

describe('tallyWorkCounts', () => {
  it('한 문항이 여러 작품에 걸리면 **양쪽에서** 센다 — 조회가 배열 포함이라 그게 맞다', () => {
    const counts = tallyWorkCounts([['진달래꽃', '엄마 걱정'], ['진달래꽃']]);
    expect(counts.get('진달래꽃')).toBe(2);
    expect(counts.get('엄마 걱정')).toBe(1);
  });

  it('한 문항 안의 중복은 한 번만 센다 — 옛 행에 같은 제목이 두 번 있을 수 있다', () => {
    expect(tallyWorkCounts([['동백꽃', '동백꽃']]).get('동백꽃')).toBe(1);
  });

  it('빈 이름은 세지 않는다', () => {
    expect(tallyWorkCounts([['', '동백꽃'], []]).size).toBe(1);
  });
});

describe('collectWorkAuthors', () => {
  const work = (title: string, author: string) => ({ label: '', title, author });

  it('지문의 작품에서 제목 → 지은이를 모은다', () => {
    const authors = collectWorkAuthors([[work('진달래꽃', '김소월'), work('엄마 걱정', '기형도')]]);
    expect(authors.get('진달래꽃')).toBe('김소월');
    expect(authors.get('엄마 걱정')).toBe('기형도');
  });

  it('같은 제목에 지은이가 갈리면 가장 많이 쓰인 이름을 고른다', () => {
    const authors = collectWorkAuthors([
      [work('동백꽃', '김유정')], [work('동백꽃', '김유정')], [work('동백꽃', '오기')],
    ]);
    expect(authors.get('동백꽃')).toBe('김유정');
  });

  it('지은이가 비면 담지 않는다 — 트리가 지은이 미입력 폴더로 받는다', () => {
    expect(collectWorkAuthors([[work('동백꽃', '')]]).size).toBe(0);
  });
});

describe('workKindOfArea', () => {
  it("대영역이 '문학' 이면 문학이다", () => {
    expect(workKindOfArea(['문학', '산문 문학'])).toBe('literary');
    expect(workKindOfArea(['문학'])).toBe('literary');
  });

  it('다른 대영역은 비문학이다', () => {
    expect(workKindOfArea(['독서와 작문', '독서'])).toBe('nonliterary');
    expect(workKindOfArea(['화법과 언어', '화법'])).toBe('nonliterary');
  });

  it('문법 영역은 비문학이 아니라 문법이다 — 『훈민정음』이 독서 지문에 섞이면 안 된다', () => {
    expect(workKindOfArea(['화법과 언어', '언어'])).toBe('grammar');
  });

  it('문법 판정은 검수 화면과 같은 함수를 쓴다 — 영역 이름을 여기 따로 적지 않는다', () => {
    // isGrammarArea 가 알아보는 이름이면 깊이와 무관하게 문법이다
    expect(workKindOfArea(['화법과 언어', '언어', '음운'])).toBe('grammar');
    expect(workKindOfArea(['문학', '산문 문학'])).toBe('literary');
  });

  it('영역이 없으면 모르는 것이다 — 비문학이라고 단정하지 않는다', () => {
    expect(workKindOfArea([])).toBe('unknown');
    expect(workKindOfArea([''])).toBe('unknown');
  });
});

describe('collectWorkKinds', () => {
  const row = (titles: string[], areaPath: string[]) => ({
    works: titles.map((title) => ({ label: '', title, author: '' })),
    area_path: areaPath,
  });

  it('지문의 영역으로 작품의 갈래를 정한다', () => {
    const kinds = collectWorkKinds([
      row(['동백꽃'], ['문학', '산문 문학']),
      row(['거울 뉴런'], ['독서와 작문', '독서']),
    ]);
    expect(kinds.get('동백꽃')).toBe('literary');
    expect(kinds.get('거울 뉴런')).toBe('nonliterary');
  });

  it('지은이가 없어도 문학은 문학이다 — 지은이 유무로 가리지 않는다', () => {
    const kinds = collectWorkKinds([row(['홍길동전'], ['문학', '산문 문학'])]);
    expect(kinds.get('홍길동전')).toBe('literary');
  });

  it('지은이가 있어도 비문학은 비문학이다', () => {
    const kinds = collectWorkKinds([row(['왜 속도를 고민해야 하는가?'], ['독서와 작문', '독서'])]);
    expect(kinds.get('왜 속도를 고민해야 하는가?')).toBe('nonliterary');
  });

  it('문법 지문의 작품은 문법이다', () => {
    const kinds = collectWorkKinds([row(['훈민정음'], ['화법과 언어', '언어'])]);
    expect(kinds.get('훈민정음')).toBe('grammar');
  });

  it('갈래 셋이 섞여도 많은 쪽을 따른다', () => {
    const kinds = collectWorkKinds([
      row(['훈민정음'], ['화법과 언어', '언어']),
      row(['훈민정음'], ['화법과 언어', '언어']),
      row(['훈민정음'], ['독서와 작문', '독서']),
    ]);
    expect(kinds.get('훈민정음')).toBe('grammar');
  });

  it('동률 우선순위는 문학 › 문법 › 비문학이다', () => {
    const both = collectWorkKinds([row(['훈민정음'], ['문학']), row(['훈민정음'], ['화법과 언어', '언어'])]);
    expect(both.get('훈민정음')).toBe('literary');

    const tie = collectWorkKinds([
      row(['통일 시대의 우리말'], ['화법과 언어', '언어']),
      row(['통일 시대의 우리말'], ['독서와 작문', '독서']),
    ]);
    expect(tie.get('통일 시대의 우리말')).toBe('grammar');
  });

  it('갈리면 많은 쪽을 따른다', () => {
    const many = [row(['꽃'], ['문학']), row(['꽃'], ['문학']), row(['꽃'], ['독서와 작문'])];
    expect(collectWorkKinds(many).get('꽃')).toBe('literary');

    const other = [row(['수영'], ['독서와 작문']), row(['수영'], ['독서와 작문']), row(['수영'], ['문학'])];
    expect(collectWorkKinds(other).get('수영')).toBe('nonliterary');
  });

  it('동률이면 문학으로 둔다', () => {
    const kinds = collectWorkKinds([row(['머리카락'], ['문학']), row(['머리카락'], ['독서와 작문'])]);
    expect(kinds.get('머리카락')).toBe('literary');
  });

  it('영역이 없는 지문은 표를 던지지 않는다 — 그 제목은 지도에 없다', () => {
    expect(collectWorkKinds([row(['모르는 글'], [])].map((r) => r)).size).toBe(0);
  });

  it('영역 없는 지문이 섞여도 있는 쪽만 센다', () => {
    const kinds = collectWorkKinds([row(['동백꽃'], []), row(['동백꽃'], ['문학'])]);
    expect(kinds.get('동백꽃')).toBe('literary');
  });

  it('제목이 빈 작품은 세지 않는다', () => {
    expect(collectWorkKinds([row([''], ['문학'])]).size).toBe(0);
  });
});

describe('toWorkFacets', () => {
  it('제목 한글 사전순으로 세우고 모르는 지은이는 빈 문자열이다', () => {
    const facets = toWorkFacets(
      new Map([['엄마 걱정', 3], ['진달래꽃', 5]]),
      new Map([['진달래꽃', '김소월']]),
      new Map([['엄마 걱정', 'literary'], ['진달래꽃', 'literary']]),
    );
    expect(facets).toEqual([
      { title: '엄마 걱정', author: '', count: 3, kind: 'literary' },
      { title: '진달래꽃', author: '김소월', count: 5, kind: 'literary' },
    ]);
  });

  it('갈래를 못 정한 작품은 unknown 이다 — 트리가 영역 미지정 폴더로 받는다', () => {
    const facets = toWorkFacets(new Map([['거울 뉴런', 1]]), new Map(), new Map());
    expect(facets[0].kind).toBe('unknown');
  });
});
