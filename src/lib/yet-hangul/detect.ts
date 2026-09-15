/**
 * 옛한글(중세국어) 글자 감지 (순수 함수).
 *
 * 저장 형태는 유니코드 **첫가끝 조합형 자모**다(초성 U+1100~ · 중성 U+1160~ · 종성 U+11A8~,
 * 확장 A/B 포함). 현대 한글은 완성형 음절(U+AC00~U+D7A3)로 저장되므로 조합형 자모가
 * 글에 섞여 있다는 것은 곧 옛한글이라는 뜻이다.
 *
 * 이 감지는 **글꼴을 고르는 데** 쓰인다(정화기를 넓히지 않으려고 렌더 시점에 판단한다).
 */

/** 첫가끝 조합형 자모 세 블록 */
const CONJOINING_JAMO_RE = /[\u1100-\u11FF\uA960-\uA97F\uD7B0-\uD7FF]/;

/**
 * 방점(성조 부호) — 거성 U+302E · 상성 U+302F.
 * ⚠️ 문자 클래스에 넣지 않는다. 결합 문자라 `no-misleading-character-class` 에 걸린다.
 */
const TONE_MARK_RE = /\u302E|\u302F/;

/** 한양 PUA — 아래아한글이 옛한글을 저장하는 사용자 정의 영역 */
const HANYANG_PUA_RE = /[\uE0BC-\uF8F7]/;

/** 한양 PUA 를 한꺼번에 바꿀 때 쓰는 판(전역 플래그는 `test` 와 섞으면 상태가 남는다) */
const HANYANG_PUA_ALL_RE = /[\uE0BC-\uF8F7]/g;

/**
 * PDF 글자 레이어가 담지 못한 옛한글 음절의 **자리 표시**.
 * 한양 PUA 코드는 모델이 읽을 수 없으므로 자리만 알리고 글자는 이미지에서 읽게 한다.
 * 프롬프트([prompt-rules.ts])가 이 값을 그대로 설명한다.
 */
export const YET_HANGUL_MARKER = '〔옛〕';

/**
 * `globals.css` 안전망 `@font-face` 의 `unicode-range` 와 **글자 그대로** 같아야 한다.
 * 한쪽만 바꾸면 글꼴이 안 걸리는 글자가 생기므로 `detect.test.ts` 가 CSS 를 읽어 대조한다.
 */
export const YET_HANGUL_UNICODE_RANGE =
  'U+1100-11FF, U+A960-A97F, U+D7B0-D7FF, U+302E-302F, U+3165-318E, U+E0BC-F8F7';

/**
 * 이 글에 옛한글이 있는가.
 *
 * ⚠️ 낱자(호환 자모 `ㆍ`·`ㅿ`)만 있는 글은 **false** 다. '아래아의 소실' 을 묻는 문법 문항이
 *    통째로 옛한글 글꼴로 바뀌면 안 된다 — 낱자 하나는 안전망 글꼴이 알아서 그린다.
 *
 * ⚠️ **자모로 갈린 현대 글자(NFD)도 false 다**(코덱스 리뷰 3R). `'한글'.normalize('NFD')` 는
 *    조합형 자모로만 이뤄져 있어 옛한글과 글자 범위가 같다 — 그대로 두면 맥에서 복사해 온
 *    현대 글이 옛한글로 판정돼 **대조 검증을 빠져나간다**. NFC 로 접으면 현대 글자는 완성형으로
 *    합쳐지고 옛한글은 합칠 완성형이 없어 그대로 남는다. 접는 값이 비싸므로 **자모가 보일 때만**
 *    접는다(대부분의 글은 첫 검사에서 끝난다).
 * @param text - 본문 HTML 또는 평문 (태그는 ASCII 라 그대로 넣어도 된다)
 * @returns 옛 자모·방점·한양 PUA 가 하나라도 있으면 true
 */
export function hasYetHangul(text: string): boolean {
  if (!text) return false;
  if (TONE_MARK_RE.test(text) || HANYANG_PUA_RE.test(text)) return true;
  if (!CONJOINING_JAMO_RE.test(text)) return false;
  return CONJOINING_JAMO_RE.test(text.normalize('NFC'));
}

/**
 * 한양 PUA 글자 수 — '옮길 수 있는 글자' 를 셀 때 이만큼을 뺀다.
 *
 * 그 자리는 모델에게 `〔옛〕` 자리 표시로만 넘어가므로 **참고 텍스트로서는 빈 자리**다
 * (pdfText 의 `hasUsableText`, 코덱스 리뷰 2R).
 * @param text - 평문
 * @returns 한양 PUA 글자 수
 */
export function hanyangPuaCount(text: string): number {
  return (text.match(HANYANG_PUA_ALL_RE) ?? []).length;
}

/**
 * 한양 PUA 글자를 자리 표시로 바꾼다.
 *
 * 그대로 보내면 모델에게는 뜻 없는 코드라 '참고 텍스트가 이미지보다 정확하다' 는 규칙이
 * 거짓이 된다. 자리만 알려 주고 그 글자는 이미지에서 읽게 한다.
 * @param text - PDF 에서 뽑은 평문
 * @returns PUA 글자가 `〔옛〕` 으로 바뀐 평문
 */
export function markHanyangPua(text: string): string {
  return text.replace(HANYANG_PUA_ALL_RE, YET_HANGUL_MARKER);
}
