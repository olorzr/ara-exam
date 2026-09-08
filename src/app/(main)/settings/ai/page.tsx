'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAiEnabled } from '@/hooks/useAiEnabled';
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
              <AiConnectionCard />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">처음 설치하기</CardTitle>
            </CardHeader>
            <CardContent>
              <AiSetupGuide />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
