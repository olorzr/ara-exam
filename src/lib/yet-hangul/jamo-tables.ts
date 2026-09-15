/**
 * 호환 자모(낱자) → 첫가끝 조합형 자모 표 (데이터만).
 *
 * 왜 표를 손으로 두는가: `normalize('NFKD')` 로는 자리를 알 수 없다. 호환 자모는 낱자마다
 * **한 자리로만** 풀리기 때문이다(ㄱ → 초성 U+1100, ㅄ → 종성 U+11B9). 옛한글 음절은
 * 초성·중성·종성 자리를 우리가 정해 줘야 하므로 자리별 표가 따로 있어야 한다.
 *
 * 값은 `\uXXXX` 이스케이프로 적는다 — 자모 글자는 소스에서 서로 구분이 안 된다.
 * 표에 없는 낱자는 그 자리에 쓸 수 없다는 뜻이다(`composeSyllable` 이 null 을 돌려준다).
 */

/** 초성 — 현대 19자 + 중세 어두 자음군·옛 글자 */
export const CHOSEONG: Readonly<Record<string, string>> = {
  'ㄱ': '\u1100', 'ㄲ': '\u1101', 'ㄴ': '\u1102', 'ㄷ': '\u1103', 'ㄸ': '\u1104',
  'ㄹ': '\u1105', 'ㅁ': '\u1106', 'ㅂ': '\u1107', 'ㅃ': '\u1108', 'ㅅ': '\u1109',
  'ㅆ': '\u110A', 'ㅇ': '\u110B', 'ㅈ': '\u110C', 'ㅉ': '\u110D', 'ㅊ': '\u110E',
  'ㅋ': '\u110F', 'ㅌ': '\u1110', 'ㅍ': '\u1111', 'ㅎ': '\u1112',
  'ㅀ': '\u111A', // RIEUL-HIEUH — 중세 표기에 드물게 나온다(NFKD 교차검증도 이 자리를 가리킨다)
  'ㅥ': '\u1114', // SSANGNIEUN
  'ㅦ': '\u1115', // NIEUN-TIKEUT
  'ㅮ': '\u111C', // MIEUM-PIEUP
  'ㅱ': '\u111D', // KAPYEOUNMIEUM (순경음 ㅁ)
  'ㅲ': '\u111E', // PIEUP-KIYEOK
  'ㅳ': '\u1120', // PIEUP-TIKEUT
  'ㅄ': '\u1121', // PIEUP-SIOS (어두 자음군)
  'ㅴ': '\u1122', // PIEUP-SIOS-KIYEOK
  'ㅵ': '\u1123', // PIEUP-SIOS-TIKEUT
  'ㅶ': '\u1127', // PIEUP-CIEUC
  'ㅷ': '\u1129', // PIEUP-THIEUTH
  'ㅸ': '\u112B', // KAPYEOUNPIEUP (순경음 ㅂ)
  'ㅹ': '\u112C', // KAPYEOUNSSANGPIEUP
  'ㅺ': '\u112D', // SIOS-KIYEOK
  'ㅻ': '\u112E', // SIOS-NIEUN
  'ㅼ': '\u112F', // SIOS-TIKEUT
  'ㅽ': '\u1132', // SIOS-PIEUP
  'ㅾ': '\u1136', // SIOS-CIEUC
  'ㅿ': '\u1140', // PANSIOS (반치음)
  'ㆀ': '\u1147', // SSANGIEUNG
  'ㆁ': '\u114C', // YESIEUNG (옛이응)
  'ㆄ': '\u1157', // KAPYEOUNPHIEUPH
  'ㆅ': '\u1158', // SSANGHIEUH
  'ㆆ': '\u1159', // YEORINHIEUH (여린히읗)
};

/** 중성 — 현대 21자 + 옛 중성(아래아 계열) */
export const JUNGSEONG: Readonly<Record<string, string>> = {
  'ㅏ': '\u1161', 'ㅐ': '\u1162', 'ㅑ': '\u1163', 'ㅒ': '\u1164', 'ㅓ': '\u1165',
  'ㅔ': '\u1166', 'ㅕ': '\u1167', 'ㅖ': '\u1168', 'ㅗ': '\u1169', 'ㅘ': '\u116A',
  'ㅙ': '\u116B', 'ㅚ': '\u116C', 'ㅛ': '\u116D', 'ㅜ': '\u116E', 'ㅝ': '\u116F',
  'ㅞ': '\u1170', 'ㅟ': '\u1171', 'ㅠ': '\u1172', 'ㅡ': '\u1173', 'ㅢ': '\u1174',
  'ㅣ': '\u1175',
  'ㆇ': '\u1184', // YO-YA
  'ㆈ': '\u1185', // YO-YAE
  'ㆉ': '\u1188', // YO-I
  'ㆊ': '\u1191', // YU-YEO
  'ㆋ': '\u1192', // YU-YE
  'ㆌ': '\u1194', // YU-I
  'ㆍ': '\u119E', // ARAEA (아래아)
  'ㆎ': '\u11A1', // ARAEA-I
  // 모델이 아래아를 가운뎃점으로 낼 때가 있다. **중성 자리에서만** 아래아로 본다
  '\u00B7': '\u119E',
};

/** 종성 — 현대 27자 + 옛 종성 */
export const JONGSEONG: Readonly<Record<string, string>> = {
  'ㄱ': '\u11A8', 'ㄲ': '\u11A9', 'ㄳ': '\u11AA', 'ㄴ': '\u11AB', 'ㄵ': '\u11AC',
  'ㄶ': '\u11AD', 'ㄷ': '\u11AE', 'ㄹ': '\u11AF', 'ㄺ': '\u11B0', 'ㄻ': '\u11B1',
  'ㄼ': '\u11B2', 'ㄽ': '\u11B3', 'ㄾ': '\u11B4', 'ㄿ': '\u11B5', 'ㅀ': '\u11B6',
  'ㅁ': '\u11B7', 'ㅂ': '\u11B8', 'ㅄ': '\u11B9', 'ㅅ': '\u11BA', 'ㅆ': '\u11BB',
  'ㅇ': '\u11BC', 'ㅈ': '\u11BD', 'ㅊ': '\u11BE', 'ㅋ': '\u11BF', 'ㅌ': '\u11C0',
  'ㅍ': '\u11C1', 'ㅎ': '\u11C2',
  'ㅦ': '\u11C6', // NIEUN-TIKEUT
  'ㅧ': '\u11C7', // NIEUN-SIOS
  'ㅨ': '\u11C8', // NIEUN-PANSIOS
  'ㅩ': '\u11CC', // RIEUL-KIYEOK-SIOS
  'ㅪ': '\u11CE', // RIEUL-TIKEUT
  'ㅫ': '\u11D3', // RIEUL-PIEUP-SIOS
  'ㅬ': '\u11D7', // RIEUL-PANSIOS
  'ㅭ': '\u11D9', // RIEUL-YEORINHIEUH
  'ㅮ': '\u11DC', // MIEUM-PIEUP
  'ㅯ': '\u11DD', // MIEUM-SIOS
  'ㅰ': '\u11DF', // MIEUM-PANSIOS
  'ㅱ': '\u11E2', // KAPYEOUNMIEUM
  'ㅸ': '\u11E6', // KAPYEOUNPIEUP
  'ㅺ': '\u11E7', // SIOS-KIYEOK
  'ㅼ': '\u11E8', // SIOS-TIKEUT
  'ㅽ': '\u11EA', // SIOS-PIEUP
  'ㅿ': '\u11EB', // PANSIOS (반치음)
  'ㆁ': '\u11F0', // YESIEUNG (옛이응)
  'ㆂ': '\u11F1', // YESIEUNG-SIOS
  'ㆃ': '\u11F2', // YESIEUNG-PANSIOS
  'ㆄ': '\u11F4', // KAPYEOUNPHIEUPH
  'ㆆ': '\u11F9', // YEORINHIEUH
  'ㅥ': '\u11FF', // SSANGNIEUN
};

/**
 * 방점 표시 → 유니코드 성조 부호.
 * 대체 표기 `⟦ㄴㆍ:⟧` 의 닫는 괄호 앞 글자가 이 표의 키다.
 */
export const TONE_MARKS: Readonly<Record<string, string>> = {
  '.': '\u302E', // 거성(한 점)
  ':': '\u302F', // 상성(두 점)
};
