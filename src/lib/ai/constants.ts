// 코덱스 브릿지 설치 안내 상수
//
// 브릿지·설치 스크립트의 **원본은 ara-system 리포**(`public/ara-ai/`)에 있고,
// 선생님 PC 에는 그 한 벌만 깔린다 — 두 앱(ara-system, ara-exam)이 같은 브릿지를 공유한다.
// 여기서 파일을 다시 호스팅하면 포트 8899 를 두고 프로세스 둘이 다투게 되므로 하지 않는다.

/** 설치 파일을 내려받는 곳 (ara-system 프로덕션) */
export const ARA_AI_FILES_ORIGIN = 'https://www.araeducation.co.kr';

/** 설치 파일 목록 (**윈도우 전용**) — 세 개를 **같은 폴더**에 받아야 동작한다.
 *  맥은 파일을 받지 않는다 — `macInstaller.ts` 의 터미널 명령 한 줄로 설치한다. */
export const ARA_AI_FILES = [
  { name: 'install-autostart.cmd', desc: '이것만 두 번 눌러 설치합니다' },
  { name: 'start-codex.cmd', desc: '설치가 실행하는 시작 스크립트' },
  { name: 'bridge.cjs', desc: '브릿지 본체 (직접 실행하지 않습니다)' },
] as const;

/**
 * 이 앱이 요구하는 브릿지 최소 버전.
 *
 * ⚠️ 브릿지는 허용 목록에 없는 주소를 **403 으로 거부**한다. 브라우저에서는 그냥
 *    "연결 실패"로만 보이고 버전을 알아낼 방법이 없다 (핸드셰이크 이후는 raw TCP 라
 *    우리가 물어볼 창구가 없다). 그래서 연결이 실패하면 언제나 '다시 내려받기'
 *    안내를 함께 띄운다.
 *
 * ⚠️ **이 앱의 주소가 바뀌면 이 숫자도 올려야 한다.** v1 에는 ara-exam 이 아예 없었고,
 *    v2 는 옛 주소(ara-exam.vercel.app)만 알아서 **test.araeducation.co.kr 로 옮긴 뒤
 *    기출 읽기가 전부 403 으로 죽었다**(2026-09-11 장애). 그때 이 숫자가 2 로 남아
 *    있으면 안내문이 "v2 면 됩니다" 라고 **거짓말**을 해서, v2 를 깐 선생님이 자기
 *    설치는 최신이라고 믿고 원인을 영영 못 찾는다. 주소를 더한 브릿지 버전과 맞출 것.
 */
export const BRIDGE_MIN_VERSION = 3;
