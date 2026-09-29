# MINDRAFT — 경험하며 발견하는 진로 탐색

> 고립·구직단념 위기에 놓인 청년이 **다양한 '일의 방식'을 미니게임으로 부담 없이 경험**하고, AI가 플레이 행동을 **CAN·LIKE·TRY·AVOID**로 나눠 **자기이해의 근거**를 쌓은 뒤, 이를 **직업 탐색과 게임 밖 실천(REAL QUEST)**, 필요하면 **공공 지원기관 연결**까지 이어 주는 웹 서비스입니다.

**경험 → 행동 데이터 → 자기이해 → 직업 탐색 → 현실 행동**

- 공모전: 2026 AI·디지털 기반 사회문제 해결 챌린지 · 분야 ① ‘민관협력 지원 플랫폼 활용’ 기반 사회현안 해결 **서비스 개발**
- 공개 주소(시연): **https://mindraft.yoosung.dev** · 로컬: **http://localhost:3210**
- 공모전 제출 문서: [docs/](docs/)

## 서비스 흐름 (STEP 1~5)

| 단계 | 사용자 경험 | 구현 |
|---|---|---|
| 1. PLAY | 5가지 일의 방식을 미니게임으로 경험. **혼자 탐색**(10분, 문제마다 최대 3번 시도, 넘어가기 가능) / 함께 도전(2~4인) / 협동 | `server.js` 매치·재도전·넘어가기, `lib/games.js` 문제·평가·힌트 |
| 2. OBSERVE | 해결 품질, 재도전, 처음 틀린 뒤 다시 해결, 직접 실험, 선택 변경, 중간 이탈, 플레이 후 2문항 자기평가(다시 하고 싶은지·부담감)를 기록 | `lib/insight.js` `playRecord`, `match:reflect` |
| 3. DISCOVER | CAN·LIKE·TRY·AVOID 분리, "잘하는 것 ≠ 좋아하는 것" 차이 발견, 근거 타임라인, AI 자기이해 리포트 | `analyze`, `ruleReport`, `lib/ai.js` |
| 4. EXPLORE | 13가지 직무 행동 ↔ 12개 직업(MVP 샘플) 연결. 적합도 % 없이 "관찰된 행동이 쓰이는 직업"으로 제시 | `BEHAVIORS`, `JOBS`, `exploreJobs` |
| 5. REAL QUEST | 개발자 심화 퀘스트 Lv.1(실제 웹사이트 문제 재현·기록) · Lv.2(버그 원인 가설→코드 수정, 서버 검증). 그 밖의 직업은 AI 맞춤 탐색 미션 | `lib/quests.js`, `quest:*` 이벤트 |

안전장치: 진단·적합도 표현 금지(AI 시스템 프롬프트 포함), 상시 "도움 연결"(109·1577-0199·129·1388, 청년미래센터 안내), 기록 활용 동의, 가명 처리된 AI 입력, 본인 기록 전체 삭제.

## 실행 / 중지

Node.js 22 이상이 필요합니다. 외부 공개에는 cloudflared가 필요합니다.

```powershell
cd D:\Github\Mindraft-web
npm install --cache .runtime/npm-cache
.\Start-Mindraft.ps1            # 서버 + Cloudflare Tunnel (백그라운드)
.\Stop-Mindraft.ps1
.\Start-Mindraft.ps1 -LocalOnly # 로컬 서버만
npm run dev                     # 개발용 전경 실행 (기존 서버 먼저 중지)
npm test                        # 21개 테스트
```

### 환경 변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `PORT` / `HOST` | `3210` / `127.0.0.1` | 컨테이너에서는 `HOST=0.0.0.0` |
| `DATA_DIR` | `./data` | 프로필·행동 기록 JSON 저장 위치 |
| `ALLOWED_ORIGINS` | – | 쉼표로 구분한 추가 허용 출처(배포 도메인) |
| `ANTHROPIC_API_KEY` | – | 있으면 Claude(`claude-opus-5-5`)로 리포트·맞춤 퀘스트 생성, 없으면 규칙 기반 |
| `AI_MODEL` | `claude-opus-5-5` | AI 모델 변경 |
| `AI_PROVIDER` | – | `rules`이면 AI 호출 없이 규칙 기반만 사용 |

AI 호출이 실패하거나 거절되면 자동으로 규칙 기반 결과로 대체되어 서비스가 멈추지 않습니다. AI에는 닉네임·토큰 없이 `aiInput()`이 만든 행동 요약만 전달됩니다.

### 컨테이너 배포 (민관협력 지원 플랫폼 클라우드)

```bash
docker build -t mindraft .
docker run -d -p 3210:3210 -v mindraft-data:/data -e ALLOWED_ORIGINS=https://<배포도메인> mindraft
```

## 데이터 / 서버 처리

- `data/profiles.json`: 닉네임, XP, 훈장, 행동 기록(`log`, 최근 300건), 퀘스트 진행, 리포트. 임시 파일 후 rename으로 저장.
- 브라우저 `localStorage`: 무작위 세션 토큰. 서버에는 토큰 해시만 저장.
- 다른 사용자에게는 이름·아바타·XP·훈장만 공개(`pub`), 행동 기록과 리포트는 본인 소켓에만 전송(`self`).
- 방, 초대, 진행 중 게임은 서버 메모리에 보관. 20초 이내 재접속 시 복구, 호스트 퇴장 시 권한 이양.
- 서버 권한 검증, 조기·중복·지연 제출 거부, 메시지 크기·빈도 제한, AI 요청 15초 제한.
- 정답은 출제 응답에 포함하지 않으며, 탐색 모드 재도전 힌트도 정답·최적값을 드러내지 않습니다.
- 데모용 단일 서버 + JSON 저장소입니다. 운영 단계 계획(간편 로그인, DB, 공공 직업정보 API 연동)은 [docs/상세기획서_초안.md](docs/상세기획서_초안.md)에 있습니다.

## 미니게임 / 직무 행동

| 게임 | 조작 | 직무 행동 |
|---|---|---|
| 고장 난 작업실 | 입출력 추리, 문제당 직접 실험 2회 | 원인 추적, 가설 실험 |
| 다리 건축가 | 세 구간 재료 조합, 하중·예산 충족 | 조건 분석, 설계·구성, 비용 효율 판단 |
| 하루 상점 | 수요·비용을 고려한 주문량 선택 | 수요 예측, 비용 효율 판단 |
| 위기 대응 센터 | 위험도/시간으로 우선순위 선택(협동 가능) | 우선순위 판단, 신속한 실행 (+협업) |
| 마을 중재소 | 세 주민의 최저 만족도를 높이는 합의 | 이해관계 조율, 공정한 합의 설계 |

공통 행동: 반복 개선(재도전·퀘스트), 문제 기록·재현(REAL QUEST). 경쟁 점수·XP·훈장 체계는 기존대로 유지합니다.

이 서비스의 기록은 게임 속 행동 지표이며 검증된 적성 검사 결과가 아닙니다.

## Cloudflare Tunnel (현재 시연 환경)

터널 이름: `mindraft-web`, ID: `94449648-004e-4731-b2c5-060c76cd8a8c`. 현재 PC의 `.runtime/tunnel.yml`과 `.runtime/tunnel-credentials.json`에 설정이 있으며 인증 파일은 Git에서 제외했습니다.

```yaml
tunnel: 94449648-004e-4731-b2c5-060c76cd8a8c
credentials-file: D:\Github\Mindraft-web\.runtime\tunnel-credentials.json
ingress:
  - hostname: mindraft.yoosung.dev
    service: http://127.0.0.1:3210
  - service: http_status:404
```

```powershell
Invoke-RestMethod http://localhost:3210/api/health
Invoke-RestMethod https://mindraft.yoosung.dev/api/health
cloudflared tunnel info mindraft-web
Get-Content .runtime/server-error.log -Tail 30
```

PC 종료·절전 시 외부 접속이 끊기므로, 본선 시연 전 민관협력 지원 플랫폼 클라우드로 이전합니다.
