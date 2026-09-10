# Codex 연동 — 어떻게 동작하는가

> 이 문서는 ara-system `app/lib/ai/codex/README.md` 에서 이식했다.
> **브릿지(`bridge.cjs`)와 설치 파일의 원본은 여전히 ara-system 리포**에 있고
> (`public/ara-ai/`), 선생님 PC 에는 그 한 벌만 깔린다 — 두 앱이 같은 브릿지를 쓴다.
> 그래서 ara-exam 오리진이 브릿지의 `ALLOWED_ORIGINS` 에 들어 있어야 한다.

**선생님 PC에서 도는 codex app-server에 브라우저가 직접 붙는다.**
학원 서버(Vercel)는 프롬프트를 만들고 감사 로그만 남긴다. AI를 호출하지 않는다.

```
[브라우저 — 관리자센터]
   │ ① POST /api/ai/report-prompt      (게이트: flag → 역할 → 담당 반 → 학부모 동의)
   │    서버가 DB 조회 후 고정 템플릿으로 프롬프트 조립
   ▼
   │ ② ws://127.0.0.1:8899             (선생님 PC의 브릿지 → codex)
   │    브릿지가 Origin 헤더를 떼고 내부 포트 codex로 전달(직결은 codex가 403)
   │    initialize → thread/start(ephemeral) → turn/start(outputSchema) → item/completed
   ▼
   │ ③ schemas.ts 로 검증 → 초안 미리보기
   │ ④ 선생님이 "초안 적용" → 기존 저장 버튼
   │ ⑤ POST /api/ai/audit              (메타데이터만)
```

**`auth.json`이 선생님 PC를 벗어나지 않는다.** 학원 서버는 토큰을 보지도 저장하지도 않는다.
교사 간 격리는 "각자 다른 컴퓨터"라 구조적으로 보장된다.

---

## 파일

| 파일 | 역할 |
|---|---|
| `protocol.ts` | 타입·상수·헬퍼. **실제 응답으로 확인한 형태**를 담는다 |
| `jsonRpcClient.ts` | JSONL 프레이밍. 전송 계층 주입식이라 브라우저/Node 양쪽에서 동작 |
| `wsTransport.ts` | 브라우저 WebSocket 어댑터 |
| `localClient.ts` | initialize → 상태조회 / 모델 목록 |
| `generateDraft.ts` | thread/start → turn/start → 최종 답변 (300줄 규칙으로 분리) |

---

## 실측으로 확인한 사실 (codex-cli 0.144.5)

문서가 아니라 **실제 통신 결과**다.

```
initialize          → { userAgent, codexHome, platformFamily, platformOs }
account/read        → { account: { type: "chatgpt", email, planType: "plus" } }
account/rateLimits  → { rateLimits, rateLimitsByLimitId, rateLimitResetCredits }
model/list          → 5개
thread/start        → { thread: { id, ephemeral }, sandbox, cwd, approvalPolicy, ... }
turn/start          → { turn: { id, status: "inProgress" } }   ← 비동기
item/completed      → { item: { type:"agentMessage", phase:"final_answer", text:"<JSON>" } }
turn/completed      → { turn: { status: "completed", durationMs } }
ws://127.0.0.1:8899 → HTTP 101 Switching Protocols
```

### 문서만 봤으면 틀렸을 것들

| 흔한 오해 | 실제 |
|---|---|
| `UsageLimitExceeded` | `usageLimitExceeded` (camelCase) |
| `Unauthorized` | `unauthorized` |
| `history.persistence="none"` 로 ephemeral | `ThreadStartParams.ephemeral` 필드 |
| `account/login/completed` 가 요청 | ServerNotification |
| threadId가 `result.threadId` | **`result.thread.id`** |
| `input: [{type:'text', text}]` | **`text_elements: []` 가 필수** |
| userAgent로 codex인지 판별 | userAgent는 **우리 clientInfo.name을 되돌려준다** → `codexHome`/`platformOs`로 판별 |
| `thread/delete`로 정리 | ephemeral 스레드는 **삭제 불가**(`"thread is not persisted"`) — 애초에 디스크에 없다 |
| `approval_policy="never"` = 명령 실행 금지 | **아니다.** "승인을 묻지 않고 실패를 모델에 반환". 실행은 된다 |
| `turn/interrupt { threadId }` | **turnId가 필수** — 없으면 `missing field turnId`로 거부. turn/start 응답(즉시 옴)의 `turn.id`를 써야 한다 |
| 모델은 codex 기본값 고정 | `turn/start`가 `model`/`effort` 턴 단위 오버라이드를 받는다(실측 수용 확인). 목록·지원 effort는 `model/list`가 준다. **잘못된 model id도 turn/start는 일단 수용**되고 이후 `error` 알림으로 비동기 실패한다 |

**우리가 쓰는 메서드는 전부 stable — `experimentalApi` 불필요.**

### 페이로드에 대해 아는 것 / 모르는 것

이 구분을 흐리면 없는 제약을 만들어 기능을 잘라내게 된다 — 실제로 그랬다.

| | 내용 |
|---|---|
| **실측(통과 확인)** | 이미지 5장 · data URL 단일 프레임 **3.2MB 통과**. vision 인식 확인 |
| **미측정** | 프레임/메시지의 **상한과 실패점**. 3.2MB 는 통과한 값이지 천장이 아니다. 6MB·10MB 가 실패한다는 관측은 없다 |
| **상한을 거는 주체** | 있다면 codex app-server(선생님 PC의 Rust 바이너리)뿐 — 우리 손 밖이다. 브릿지(`public/ara-ai/bridge.cjs`)는 101 이후 raw TCP splice라 프레임을 파싱조차 하지 않는다 |
| **클램프(우리 값)** | `protocol.ts` `MAX_TURN_IMAGES = 8` — 버그로 수십 장이 나가는 걸 막는 최종 방어선 |
| **정책(우리 값)** | `pdfPages.ts` `PAGES_PER_BATCH = 5` — 실측된 유일한 조합(5장·120초)을 유지한다. 쪽이 더 많으면 **묶음을 늘려** 해결하지 장수를 늘리지 않는다 |
| **워치독** | `TURN_TIMEOUT_MS = 120초`가 기본. 정답표 경로는 `GenerateOptions.timeoutMs` 로 `60초 + 30초×장수`(상한 300초)를 쓴다 — 지연을 지배하는 건 장수가 아니라 **출력 토큰 수**다 |

> 한때 `pdfPages.ts` 주석이 "5장은 브릿지 프로토콜 한계", "3.2MB를 넘으면 전송 자체가 실패한다"고
> 단정했는데 **둘 다 근거가 없었다.** 5는 우리가 건 안전판이었고, 3.2MB는 성공 관측이었다.
> 그 오해 때문에 "PDF는 5쪽까지만"이라는 제약이 오래 남아 있었다.

---

## 실행 격리 — 이게 진짜 보안 경계다

codex가 선생님 PC에서 **선생님 권한으로** 돈다. 컨테이너가 없으므로 실행 시점 설정이 유일한 방어선이다.
프로토콜에 `command/exec`·`fs/writeFile`·`plugin/install`이 **실재한다**(`FORBIDDEN_METHODS` 참조).

> 모델에게 "도구를 쓰지 마라"라고 프롬프트에 쓰는 건 보안 경계가 아니다.

### 적용하는 것 (실측 확인됨)

**1) 스레드·턴 단위 잠금** — `localClient.ts`가 매번 지정한다:
```ts
thread/start { ephemeral: true, sandbox: 'read-only', approvalPolicy: 'never' }
turn/start   { sandboxPolicy: { type: 'readOnly', networkAccess: false }, approvalPolicy: 'never' }
```
→ 응답으로 `{"type":"readOnly","networkAccess":false}` 가 그대로 돌아옴을 확인했다.

**2) 프로세스 기동 시 기능 차단** — `public/ara-ai/bridge.cjs`가 codex를 spawn할 때 거는
`--disable apps` 등 16개(`buildCodexArgs`). **적용 전에는 `codex_apps` MCP가 자동 기동되지만, 적용 후 MCP 알림이 완전히 사라진다**(실측).

**3) 전용 빈 작업 디렉터리** — `%LOCALAPPDATA%\ara-ai-workspace`.
학생 데이터도 저장소 파일도 없다.

**4) `history.persistence="none"`** + ephemeral 스레드 → 대화 기록이 디스크에 남지 않는다.

⚠️ `DISABLED_FEATURES`(protocol.ts)와 `bridge.cjs`의 `--disable` 목록은 **반드시 같아야 한다.**
`__tests__/lib/aiDisabledFeaturesSync.test.ts`가 bridge.cjs의 export를 protocol.ts와 대조해 고정한다.

---

## 브라우저는 codex에 직접 못 붙는다 — 로컬 브릿지 (2026-07-21)

**codex app-server는 `Origin` 헤더가 붙은 ws 요청을 403으로 거부한다**(CSWSH 방지, 의도적,
옵션으로 못 끔). 브라우저는 Origin을 강제로 붙이므로 **직결 불가**. 이전 세션의 "ws→101 실측"은
Origin 없는 도구(Node/curl)로 한 것이었고, 브라우저는 아니었다.

→ `public/ara-ai/bridge.cjs`(선생님 PC, Node 내장 `net`만, 의존성 0)가 사이에 선다:
```
브라우저 → 브릿지 :8899 → (Origin 헤더 제거) → codex :내부포트
```
- 브릿지가 8899를 점유, codex를 OS 배정 빈 포트로 spawn. **브라우저·앱 코드 변경 0**(8899 그대로).
- 첫 HTTP Upgrade 요청에서 **`Origin:` 한 줄만 제거**(`stripOriginHeader`), 이후 양방향 raw TCP splice.
  `Sec-WebSocket-Key`는 바이트 보존 → codex의 101 accept가 브라우저 검증을 통과.
- 기동 시 `selfTestHandshake`로 codex에 Origin 없는 핸드셰이크를 쏴 101을 확인
  (`handshake self-test: OK`) — 선생님 PC에서 실제로 붙는지 확인하는 게이트다.
  맥은 LaunchAgent로 배경에서 도는 탓에 이 줄을 화면으로 볼 수 없으니 `~/.ara-ai/ara-ai.log`에서 읽는다.

### ⚠️ Safari 는 아예 못 붙는다 (2026-09-10 실측)

**WebKit 은 https 문서의 `ws://127.0.0.1` 을 mixed content 로 동기 차단한다.** 권한도, 설정도,
브릿지를 켜는 것도 이 문제를 풀지 못한다 — 맥 선생님은 **Chrome 을 써야 한다.**

근거: 같은 https 문서에서 `wss://127.0.0.1:8899` 는 차단 지점을 통과해 TLS 까지 갔고(브릿지가
평문이라 거기서 멈춤), `ws://` 는 0ms 만에 onerror 였다. 같은 주소가 http 문서에서는 열린다.

⚠️ 아래의 "127.0.0.1 은 potentially trustworthy 라 https 에서도 ws:// 가 차단되지 않는다" 는
**Chromium 기준**이다. 화면 분기는 `src/lib/ai/setupOs.ts` 의 `detectBrowser` 가 한다.

### 브라우저 게이트 (Local Network Access) — 부차적

- **mixed content는 아니다.** `127.0.0.1`은 potentially trustworthy라 차단되지 않는다.
- LNA(Chrome 142+)는 loopback 접근을 권한 프롬프트로 게이팅할 수 있으나, **실측 PC에선 `granted`라
  무관**했다. 진짜 관문은 위의 Origin이었다.
- 연결 실패 진단은 `app/lib/ai/localNetworkAccess.ts`(실패 경로에서만, `denied`면 안내, 그 외 fail-open).

---

## 미확인

**OpenAI 이용약관 원문을 확인하지 못했다.** `openai.com`/`help.openai.com`이 자동 조회를
403(Cloudflare)으로 차단한다. WebFetch·curl(브라우저 UA) 모두 실패했다.

다만 이 구조는 "학원 서버가 선생님 자격증명을 보유해 제3자에게 서비스"하는 형태가 아니라
**선생님이 본인 PC에서 본인 계정으로 본인이 쓰는** 형태다. 그래도 확정 사실이 아니므로 미확인으로 남긴다.

---

## 스키마 재생성

```bash
codex app-server generate-ts --out ./schema
codex app-server generate-json-schema --out ./schema-json
```

CLI를 올린 뒤에는 `CODEX_CLI_VERIFIED_VERSION`을 갱신하고
`__tests__/lib/aiProtocol.test.ts`가 깨지는지 확인할 것.
