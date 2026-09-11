'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { detectSetupOs } from '@/lib/ai/setupOs';
import AiSetupStepsMac from './AiSetupStepsMac';
import AiSetupStepsWindows from './AiSetupStepsWindows';

interface AiSetupGuideProps {
  /** 연결 포트. **페이지가 들고 있는 값**이라 카드에서 바꾸면 설치 명령도 함께 바뀐다 */
  port: number;
}

/**
 * 처음 설치하는 선생님을 위한 안내. 윈도우·맥 두 갈래다.
 *
 * ⚠️ OS 자동 감지는 **어느 탭을 먼저 펼칠지만** 정한다 — 탭을 없애지 말 것.
 *   선생님이 다른 선생님 컴퓨터에 깔아 주려고 이 화면을 여는 경우가 실제로 있다.
 *
 * ⚠️ 포트를 여기서 읽지 말 것. 같은 화면의 연결 카드에서 방금 바꾼 번호가 반영되지 않아,
 *   맥 설치 명령을 그대로 복사하면 브릿지가 옛 포트로 뜬다.
 */
export default function AiSetupGuide({ port }: AiSetupGuideProps) {
  const [os] = useState(() => detectSetupOs());

  return (
    <div className="space-y-4 text-sm text-gray-700">
      <p className="text-gray-500">
        내 컴퓨터에서 내 ChatGPT 계정으로 동작합니다. 학원 서버는 로그인 정보를 보지도 저장하지도
        않아요. <strong>한 번만</strong> 하시면 됩니다.
      </p>

      <Tabs defaultValue={os}>
        <TabsList>
          <TabsTrigger value="windows">윈도우</TabsTrigger>
          <TabsTrigger value="mac">맥</TabsTrigger>
        </TabsList>

        <TabsContent value="windows" className="pt-4">
          <AiSetupStepsWindows port={port} />
        </TabsContent>

        <TabsContent value="mac" className="pt-4">
          <AiSetupStepsMac port={port} />
        </TabsContent>
      </Tabs>

      <p className="rounded-md bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900">
        학원 관리 시스템에서 이미 설치했다면 다시 설치할 필요는 없습니다. 다만{' '}
        <strong>2026년 9월 이전에 파일 세 개로 설치하셨다면 위 2단계를 한 번만 다시</strong> 해
        주세요 — 예전 파일은 이 사이트 주소를 모르는 데다 <strong>스스로 갱신하지도 못해서</strong>,
        그대로 두면 계속 연결을 거부합니다. 한 번 새로 설치하면 그 뒤로는 켤 때마다 알아서
        최신이 됩니다. (맥은 설치 명령을 다시 실행하면 갱신됩니다)
      </p>
    </div>
  );
}
