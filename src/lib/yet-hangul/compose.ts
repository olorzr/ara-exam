import { CHOSEONG, JONGSEONG, JUNGSEONG, TONE_MARKS } from './jamo-tables';

/**
 * 옛한글 **대체 표기**를 첫가끝 자모로 바꾼다 (순수 함수).
 *
 * 왜 대체 표기가 필요한가: 모델이 조합형 자모를 직접 내지 못하고 현대 글자로 뭉개거나
 * `□` 로 두는 일이 있다. 그럴 때 음절 하나를 `⟦ㅎㆍㄴ⟧` 처럼 **낱자로 풀어** 적게 하고
 * 여기서 조합한다(프롬프트 규칙은 prompt-rules.ts 가 단일 출처다).
 *
 * ⚠️ **괄호 안만 건드린다.** 문법 문항의 본문에는 낱자가 그대로 나온다("ㄱ. 첫째",
 *    "ㆍ의 소실"). 괄호 밖 낱자를 조합하면 멀쩡한 문항이 깨진다.
 */

/** 대체 표기의 여는 괄호 — 빠른 길과 미변환 판정이 같은 글자를 본다 */
const NOTATION_OPEN = '⟦';

/** 첫가끝 자모 — 이 글자가 있어야 풀 일이 생긴다 */
const CONJOINING_JAMO_RE = /[\u1100-\u11FF\uA960-\uA97F\uD7B0-\uD7FF]/;

/** 사슬을 푸는 횟수 상한 — 한 음절이 두 번 넘게 풀릴 일은 없다(무한 루프 방지) */
const MAX_DECOMPOSE_PASSES = 3;

/**
 * 실체 참조를 되돌려도 되는 글자 범위 — **마크업이 될 수 없는 것만** 담는다.
 * 완성형 음절까지 넣는 까닭: `&#xAC00;&#x11EB;` 처럼 둘 다 참조로 온 경우 한쪽만 풀면
 * 정규화가 그 음절을 못 보고 섞인 모양이 남는다.
 */
const DECODABLE: readonly (readonly [number, number])[] = [
  [0x00B7, 0x00B7], // 가운뎃점 — 모델이 아래아 대신 쓰는 별칭
  [0x1100, 0x11FF], // 첫가끝 자모
  [0x27E6, 0x27E7], // ⟦ ⟧ 대체 표기 괄호
  [0x302E, 0x302F], // 방점
  [0x3131, 0x318E], // 호환 자모(낱자)
  [0xA960, 0xA97F], // 확장 A 초성
  [0xAC00, 0xD7A3], // 완성형 음절
  [0xD7B0, 0xD7FF], // 확장 B 중성·종성
  [0xE0BC, 0xF8F7], // 한양 PUA
];

/** 완성형 음절 — 뒤에 중성·종성이 이어지면 그 음절도 자모로 풀어야 한다 */
const SYLLABLE_BEFORE_JAMO_RE = /[\uAC00-\uD7A3](?=[\u1160-\u11FF\uD7B0-\uD7FF])/g;

/**
 * **초성 뒤에 붙은** 완성형 음절 — 이것도 한 음절이다.
 *
 * 첫가끝은 유니코드에 낱자가 없는 어두 자음군을 초성 여럿(`ᄇ`+`ᄉ`+`ᅡ`)으로 적을 수 있는데,
 * NFC 가 뒤의 `ᄉ`+`ᅡ` 만 `사` 로 합쳐 `ᄇ사` 라는 깨진 모양을 만든다(코덱스 리뷰 4R).
 * ⚠️ **초성만** 본다 — 종성 뒤의 완성형은 다음 음절이다(`ᄒᆞᆫ` + `글`).
 * ⚠️ 뒤돌아보기(lookbehind)를 쓰지 않는다 — 옛 사파리에서 정규식 자체가 문법 오류가 된다.
 */
const SYLLABLE_AFTER_CHOSEONG_RE = /([\u1100-\u115F\uA960-\uA97F])([\uAC00-\uD7A3])/g;

/**
 * 저장 형태를 **첫가끝 한 가지로** 맞춘다.
 *
 * 왜 필요한가: 같은 옛한글 낱말이 두 모양으로 들어온다. 모델이 자모를 그대로 낸
 * `ᄀ+ᅡ+ᇫ`(`\u1100\u1161\u11EB`)와, NFC 를 지난 `가+ᇫ`(`\uAC00\u11EB`)는 **유니코드상 같은
 * 글자**지만 문자열로는 다르다. 그대로 두면 겹쳐 읽은 같은 지문이 중복 판정 키(merge-keys)에서
 * 갈라져 **같은 글이 두 번 저장되고**, 검색(`search_text`)도 어긋난다.
 *
 * 두 단계다:
 *  1. NFC — 자모로 갈린 **현대** 글자(맥에서 복사해 온 NFD)를 완성형으로 되돌린다.
 *  2. 뒤에 자모가 이어지는 완성형 음절을 **다시 자모로 푼다** — 옛한글 음절을 통째로 첫가끝으로.
 *
 * ⚠️ **NFC 만 쓰면 안 된다**(코덱스 리뷰 3R 뒤 실측). NFC 는 옛 종성을 못 합쳐 `가+ᇫ` 같은
 *    **섞인 모양**을 남기는데, 안전망 글꼴(자모만 담은 부분 글꼴)에는 완성형 글자가 없어
 *    그 모양이 `가`(Pretendard) + `ᇫ`(부분 글꼴) **두 글자로 쪼개져 보인다.** 동국정운식 한자음
 *    (`바+ᇰ`)처럼 흔한 표기가 목록 줄·제목에서 깨지는 자리다. 첫가끝으로 통일하면 세 글꼴
 *    어디서나 한 글자로 합쳐진다(CoreText 로 확인, public/fonts/README.md).
 * ⚠️ NFKC 는 절대 쓰지 않는다 — 호환 자모(낱자 ㆍ·ㅿ)까지 바꿔 표기를 갈라 놓는다.
 * @param text - 본문 HTML 또는 평문 (태그는 ASCII 라 그대로 넣어도 된다)
 * @returns 첫가끝으로 맞춘 글
 */
export function normalizeYetHangul(text: string): string {
  const composed = text.normalize('NFC');
  if (!CONJOINING_JAMO_RE.test(composed)) return composed;
  // 자모가 이어지는 동안 되풀이한다 — `가ᇫ` 처럼 한 번에 풀리지 않는 사슬이 있을 수 있다
  let out = composed;
  for (let pass = 0; pass < MAX_DECOMPOSE_PASSES; pass += 1) {
    const next = out
      .replace(SYLLABLE_BEFORE_JAMO_RE, (syllable) => syllable.normalize('NFD'))
      .replace(SYLLABLE_AFTER_CHOSEONG_RE, (_, cho: string, syllable: string) =>
        cho + syllable.normalize('NFD'));
    if (next === out) break;
    out = next;
  }
  return out;
}

/**
 * `⟦ㅎㆍㄴ⟧` · `⟦ㄴㆍ:⟧` — 괄호 안은 호환 자모 2~3자(사이 공백 허용)에 방점 표시(선택).
 * 가운뎃점(U+00B7)은 모델이 아래아 대신 낼 때가 있어 낱자로 함께 받는다.
 */
const NOTATION_RE = /⟦\s*([ㄱ-ㆎ·](?:\s*[ㄱ-ㆎ·]){1,2})\s*([.:])?\s*⟧/g;

/**
 * 낱자 열을 옛한글 음절 하나로 조합한다.
 *
 * 현대 자모 열(`ㄴㅏ`)은 NFC 가 완성형(`나`)으로 접고, 옛한글은 완성형이 없어 조합형인
 * 채로 남는다 — 저장 형태가 한 가지로 모인다.
 * @param letters - 초성·중성[·종성] 낱자, 끝에 방점 표시(`.`·`:`)를 붙일 수 있다
 * @returns 조합된 음절. 자리가 안 맞거나 표에 없는 낱자면 null
 */
export function composeSyllable(letters: string): string | null {
  const packed = letters.replace(/\s/g, '');
  const tone = TONE_MARKS[packed.slice(-1)] ?? '';
  const body = [...(tone ? packed.slice(0, -1) : packed)];
  if (body.length < 2 || body.length > 3) return null;

  const [cho, jung, jong] = body;
  const initial = CHOSEONG[cho];
  const medial = JUNGSEONG[jung];
  const final = jong === undefined ? '' : JONGSEONG[jong];
  if (!initial || !medial || final === undefined) return null;

  // ⚠️ 완성형으로 접는 것은 **현대 음절일 때뿐**이다. 옛 자모가 하나라도 섞이면 NFC 가
  //    `가+ᇫ` 같은 섞인 모양을 만드는데, 자모만 담은 안전망 글꼴이 그 모양을 못 합친다
  //    (normalizeYetHangul 의 설명). 접힌 결과가 한 글자가 아니면 첫가끝 그대로 둔다
  const jamo = `${initial}${medial}${final}`;
  const composed = jamo.normalize('NFC');
  return (composed.length === 1 ? composed : jamo) + tone;
}

/**
 * 본문 안의 대체 표기를 모두 자모로 바꾼다.
 *
 * ⚠️ 못 바꾸는 괄호는 **그대로 둔다.** 조용히 지우면 그 자리에 무엇이 있었는지 사라진다 —
 *    남겨 두면 검수 화면에 눈에 띄고 경고(warn.ts)가 선생님에게 넘긴다.
 * @param html - 모델이 낸 본문 HTML 또는 평문
 * @returns 대체 표기가 자모로 바뀐 글 (`⟦` 가 없으면 입력 그대로)
 */
export function convertYetHangulNotation(html: string): string {
  if (!html.includes(NOTATION_OPEN)) return html;
  return html.replace(
    NOTATION_RE,
    (whole, letters: string, tone?: string) => composeSyllable(letters + (tone ?? '')) ?? whole,
  );
}

/**
 * 숫자 실체 참조 — `&#x11EB;` · `&#X11EB;` · `&#4587;`.
 * ⚠️ 접두사 `x` 는 **대소문자 둘 다**이고 세미콜론은 **없을 수도 있다**(HTML 파서가 그렇게 읽는다,
 *    코덱스 리뷰 6R). 범위 밖 값은 원문 그대로 돌려주므로 느슨하게 잡아도 글이 상하지 않는다.
 */
const NUMERIC_ENTITY_RE = /&#([xX][0-9a-fA-F]+|[0-9]+);?/g;

/**
 * 실체 참조로 적힌 **옛한글 글자만** 되돌린다.
 *
 * 왜 필요한가: 정화기(DOMPurify)는 **태그가 하나도 없는 조각을 그대로 돌려준다**(선지가 그렇다).
 * 그래서 `가&#x11EB;` 같은 입력은 실체 참조가 풀리지 않은 채 저장되고, 화면에서 브라우저가
 * 그때서야 풀어 **섞인 모양**으로 그린다 — 저장값으로는 검색·중복 판정도 어긋난다(코덱스 리뷰 5R).
 *
 * ⚠️ **아무 실체 참조나 풀면 안 된다.** `&lt;script&gt;` 를 풀면 정화가 막아 둔 마크업이 되살아난다.
 *    한글 음절·자모·방점·한양 PUA·대체 표기 괄호처럼 **마크업이 될 수 없는 글자만** 푼다.
 * @param text - 모델이 낸 글
 * @returns 옛한글 글자가 되돌려진 글
 */
export function decodeYetHangulEntities(text: string): string {
  if (!text.includes('&#')) return text;
  return text.replace(NUMERIC_ENTITY_RE, (whole, digits: string) => {
    const code = digits[0] === 'x' || digits[0] === 'X'
      ? Number.parseInt(digits.slice(1), 16)
      : Number.parseInt(digits, 10);
    return Number.isInteger(code) && DECODABLE.some(([lo, hi]) => code >= lo && code <= hi)
      ? String.fromCodePoint(code)
      : whole;
  });
}

/**
 * **정화를 마친 뒤** 옛한글을 저장 형태로 굳힌다.
 *
 * ⚠️ 정화(DOMPurify)가 HTML 실체 참조를 푼다(코덱스 리뷰 4R). 정화 **전에만** 맞추면
 *    `가&#x11EB;` 같은 입력이 풀린 뒤 `가`+`ᇫ`(섞인 모양)으로 저장돼 목록 줄에서 쪼개져 보인다.
 *    그래서 저장값을 만드는 마지막 자리에서 한 번 더 맞춘다 — 멱등이라 두 번 돌아도 같다.
 * @param html - 정화를 마친 HTML
 * @returns 대체 표기를 풀고 첫가끝으로 맞춘 HTML
 */
export function finalizeYetHangul(html: string): string {
  return normalizeYetHangul(convertYetHangulNotation(decodeYetHangulEntities(html)));
}

/**
 * 바꾸지 못한 대체 표기가 남아 있는가 — 경고를 낼지 정하는 데 쓴다.
 * @param text - 변환을 마친 글
 * @returns 남아 있으면 true
 */
export function hasUnconvertedNotation(text: string): boolean {
  return text.includes(NOTATION_OPEN);
}
