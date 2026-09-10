'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAiEnabled } from '@/hooks/useAiEnabled';
import { getCodexPort } from '@/lib/ai/localPort';
import AiConnectionCard from '@/components/ai/AiConnectionCard';
import AiSetupGuide from '@/components/ai/AiSetupGuide';

/**
 * AI 연결 설정 (`/settings/ai`).
 *
 * 기출 PDF 를 읽는 OCR 은 **선생님 컴퓨터의 ChatGPT** 로 동작한다. 학원 서버는 AI 를
 * 호출하지 않으므로 추가 비용이 없고, 대신 컴퓨터마다 한 번씩 설치가 필요하다.
 */
export default function AiSettingsPage() {
  const ai = useAiEnabled();
  // 연결 포트의 **단일 출처**. 두 카드가 한 화면에 있어, 여기서 들고 있지 않으면
  // 포트를 바꾼 직후 바로 아래 설치 명령이 옛 번호로 남는다(그대로 실행하면 연결이 안 된다).
  // lazy 초기화 — 효과에서 setState 하면 `react-hooks/set-state-in-effect` 에 걸린다.
  const [port, setPort] = useState(() => getCodexPort());

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">✨ AI 연결</h1>
        <p className="mt-1 text-sm text-gray-500">
          기출 PDF 를 읽어 문제로 옮기는 기능은 선생님 컴퓨터의 ChatGPT 를 씁니다. 학원 서버는
          로그인 정보를 보지도 저장하지도 않아요.
        </p>
      </div>

      {!ai.enabled ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-gray-500">
            아직 열리지 않은 기능이에요. 준비가 되면 안내드릴게요.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">연결 상태</CardTitle>
            </CardHeader>
            <CardContent>
              <AiConnectionCard port={port} onPortChange={setPort} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">처음 설치하기</CardTitle>
            </CardHeader>
            <CardContent>
              <AiSetupGuide port={port} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
