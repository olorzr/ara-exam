/**
 * 디자인 표지에 늘 찍히는 문구 — 시안(클로드 디자인 '문제지 표지 시안', 2026-10-06 · 2026-10-25 판)에서 옮긴 것.
 *
 * 컴포넌트와 글꼴 준비(`coverFontSample`)가 **같은 글자**를 써야 한다. 글꼴은 글자가 든 조각만
 * 내려받으므로(unicode-range), 여기 없는 고정 문구는 인쇄 전에 미리 받지 못한다.
 *
 * ⚠️ 시안의 회차 자리(vol.3 · 제 3 회 · No. 03)는 옮기지 않았다 — 표지에 회차 칸이 없다(사용자 결정
 *    2026-10-13). 2026-10-25 판에서 원장님이 영문 상표(ARA KOREAN & ESSAY · ara. · Korean …)를 전부
 *    한글로 바꿨다 — 영문은 꾸밈 문장(태그라인)에만 남는다.
 */
export const COVER_COPY = {
  brandKo: '아라국어논술',
  brandShort: '아라',
  subject: '국어 · 논술',
  sheet: '문제지',
  paperSize: 'A4',
  teacherLabel: '선생님',
  studentLabel: '학생',
  copyright:
    '본 문제지는 아라국어논술 수업용으로 제작되었습니다. 수록된 작품의 저작권은 원저작자에게 있으며 외부 배포를 금합니다.',
  note: '수업용 문제지 · 외부 배포 금지',
  copyrightMark: '©',
  /** 에디토리얼 글자 깔림 */
  motto: '읽고, 묻고, 다시 읽는다.',
  /** 링의 제목과 단원 사이 */
  cross: '×',
  ringsTagline: 'reading between the lines',
  ringsLeft: '아라',
  ringsRight: '국어논술',
  spinesHead: '아라국어논술 — 문제지',
  /** 책등 과정 상자 — 과정이 비었을 때(` · ` 에서 줄을 나눈다) */
  spinesBox: '아라 · 국어 · 논술',
  spinesRepeat: '아라국어논술 · 아라국어논술',
  softKicker: '아라국어논술 — 문제지',
  softVertical: 'A QUIET READING · A CLOSE READING',
  softTagline: 'A quiet reading. A close reading.',
  /** 블러·스케치의 큰 글자 */
  mark: '아라.',
  sketchTagline: 'a close reading.',
  sketchMemo1: '* 풀이는 연필로, 답은 또박또박.',
  sketchMemo2: '모르는 문제는 ○ 표시 후 넘어가기.',
  zineMotto: '읽고\n묻고\n다시 읽다',
  zineNote: '천천히,\n정확하게',
  zineYearTail: '.—',
  zineSubject: '국어.',
} as const;
