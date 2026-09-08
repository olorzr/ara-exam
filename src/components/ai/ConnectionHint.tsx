'use client';

import { ARA_AI_FILES_ORIGIN, BRIDGE_MIN_VERSION } from '@/lib/ai/constants';
import type { HintKind } from '@/lib/ai/connectionStatusText';

interface ConnectionHintProps {
  kind: HintKind;
  /** 'Codex 실행 안 됨' 안내에 브라우저 권한 프롬프트 설명을 덧붙일지 */
  showPromptNote?: boolean;
}

/**
 * 연결 실패 안내. 선생님이 **취해야 할 조치**만 보여준다.
 * 어떤 안내를 그릴지는 순수 함수(connectionStatusText)가 정하고 여기서는 그리기만 한다.
 */
export default function ConnectionHint({ kind, showPromptNote }: ConnectionHintProps) {
  if (kind === 'login_required') {
    return (
      <div className="rounded-md bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
        <p className="font-semibold">ChatGPT 로그인이 필요해요.</p>
        <p className="mt-1">
          내 컴퓨터에서 명령 프롬프트를 열고 <code className="px-1 bg-amber-100 rounded">codex login</code> 을
          실행한 뒤 브라우저에서 ChatGPT 에 로그인해 주세요. 로그인 정보는 내 컴퓨터에만 저장됩니다.
        </p>
      </div>
    );
  }

  if (kind === 'browser_blocked') {
    return (
      <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-900">
        <p className="font-semibold">브라우저가 내 컴퓨터 연결을 막고 있어요.</p>
        <p className="mt-1">
          주소창 왼쪽 자물쇠 아이콘 → 사이트 설정에서 <strong>로컬 네트워크</strong> 권한을 허용으로
          바꾼 뒤 새로고침해 주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md bg-gray-50 border border-gray-200 p-4 text-sm text-gray-700 space-y-2">
      <p className="font-semibold text-gray-900">ARA AI 가 실행되어 있지 않아요.</p>
      <p>바탕화면의 <strong>ARA AI</strong> 를 두 번 눌러 실행한 뒤 아래 &lsquo;다시 확인&rsquo;을 눌러 주세요.</p>
      {showPromptNote && (
        <p className="text-gray-500">
          연결 권한을 묻는 창이 뜨면 <strong>허용</strong>을 눌러 주세요.
        </p>
      )}
      <p className="text-gray-500">
        예전에 설치했다면 <strong>다시 내려받아야</strong> 할 수 있어요 — 이 화면은 브릿지 v
        {BRIDGE_MIN_VERSION} 이상이 필요합니다({ARA_AI_FILES_ORIGIN.replace('https://', '')} 에서 받은 파일).
      </p>
    </div>
  );
}
