/**
 * 디자인 표지에 늘 찍히는 문구 — 시안(클로드 디자인 '문제지 표지 시안', 2026-10-06)에서 그대로 옮긴 것.
 *
 * 컴포넌트와 글꼴 준비(`coverFontSample`)가 **같은 글자**를 써야 한다. 글꼴은 글자가 든 조각만
 * 내려받으므로(unicode-range), 여기 없는 고정 문구는 인쇄 전에 미리 받지 못한다.
 *
 * ⚠️ 시안의 회차 자리(vol.3 · 제 3 회 · No. 03)는 옮기지 않았다 — 표지에 회차 칸이 없다(사용자 결정
 *    2026-10-13). 작품 갈래를 가리키던 영문(Poetry · Modern Poetry)도 상표 문구로 바꿨다 — 어느 갈래의
 *    문제지에든 붙기 때문이다.
 */
export const COVER_COPY = {
  brandKo: '아라국어논술',
  brandEn: 'ARA KOREAN & ESSAY',
  subject: '국어 · 논술',
  sheet: '문제지',
  paperSize: 'A4',
  nameLabel: '이름',
  dateLabel: '날짜',
  courseLabel: '과정',
  topicsLabel: '단원',
  yearSuffix: '학년도',
  copyright:
    '본 문제지는 아라국어논술 수업용으로 제작되었습니다. 수록된 작품의 저작권은 원저작자에게 있으며 외부 배포를 금합니다.',
  ringsHead: '아라국어논술 문제지',
  ringsTagline: 'reading between the lines',
  ringsLeft: 'AR',
  ringsRight: 'KO',
  spinesTagline: 'Korean & Essay',
  spinesRepeat: 'ARA · ARA · ARA',
  softMark: 'ara.',
  softTagline: 'A quiet reading. A close reading.',
  softNote: '수업용 문제지 · 외부 배포 금지',
  sketchWord: 'Korean',
  sketchMemo1: '* 풀이는 연필로, 답은 또박또박.',
  sketchMemo2: '모르는 문제는 ○ 표시 후 넘어가기.',
} as const;
