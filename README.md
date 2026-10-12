# TALLO — 경험하며 발견하는 진로 탐색

> 고립·구직단념 위기에 놓인 청년이 **다양한 '일의 방식'을 미니게임으로 부담 없이 경험**하고, AI가 플레이 행동을 **CAN·LIKE·TRY·AVOID**로 나눠 **자기이해의 근거**를 쌓은 뒤, 이를 **직업 탐색과 게임 밖 실천(REAL QUEST)**, 필요하면 **공공 지원기관 연결**까지 이어 주는 웹 서비스입니다.

**경험 → 행동 데이터 → 자기이해 → 직업 탐색 → 현실 행동**

- 공모전: 2026 AI·디지털 기반 사회문제 해결 챌린지 · 분야 ① ‘민관협력 지원 플랫폼 활용’ 기반 사회현안 해결 **서비스 개발**
- 서비스 주소: **https://mindraft.yoosung.dev** (현재 PC의 Cloudflare Tunnel) · Cloud Run 직접 주소: **https://mindraft-772237580154.asia-northeast3.run.app** · 로컬: **http://localhost:3210**
- 공모전 제출 문서: [docs/](docs/)

## 서비스 흐름 (STEP 1~5)

| 단계 | 사용자 경험 | 구현 |
|---|---|---|
| 1. PLAY | 4가지 일의 방식을 미니게임으로 경험. **혼자 탐색**(4분, 라운드마다 최대 3번 시도, 넘어가기 가능) / 함께 도전(2~4인) / 협동 | `server.js` 매치·재도전·넘어가기, `lib/games.js` 문제·평가·힌트 |
| 2. OBSERVE | 해결 품질, 재도전, 처음 틀린 뒤 다시 해결, 직접 실험, 선택 변경, 중간 이탈, 플레이 후 2문항 자기평가(다시 하고 싶은지·부담감)를 기록 | `lib/insight.js` `playRecord`, `match:reflect` |
| 3. DISCOVER | CAN·LIKE·TRY·AVOID 분리, "잘하는 것 ≠ 좋아하는 것" 차이 발견, 근거 타임라인, AI 자기이해 리포트 | `analyze`, `ruleReport`, `lib/ai.js` |
| 4. EXPLORE | 16가지 직무 행동 ↔ 12개 직업(MVP 샘플) 연결. 적합도 % 없이 "관찰된 행동이 쓰이는 직업"으로 제시 | `BEHAVIORS`, `JOBS`, `exploreJobs` |
| 5. REAL QUEST | 개발자 심화 퀘스트 Lv.1(실제 웹사이트 문제 재현·기록) · Lv.2(버그 원인 가설→코드 수정, 서버 검증). 그 밖의 직업은 AI 맞춤 탐색 미션 | `lib/quests.js`, `quest:*` 이벤트 |

안전장치: 진단·적합도 표현 금지(AI 시스템 프롬프트 포함), 상시 "도움 연결"(109·1577-0199·129·1388, 청년미래센터 안내), 기록 활용 동의, 가명 처리된 AI 입력, 본인 플레이 기록 삭제. 계정별 AI 사용 횟수는 남용 방지를 위해 유지합니다.

## 내 PC에서 실행 / 중지

Node.js 22 이상, `cloudflared`, 그리고 `.runtime/tunnel.yml` 및 tunnel credentials 파일이 필요합니다. 이 PC에서는 `Start-Tallo-Public.bat`을 더블클릭하면 서버와 기존 `mindraft-web` Cloudflare Tunnel을 실행합니다. PowerShell을 직접 열어 실행해도 됩니다.

```powershell
cd D:\Github\Mindraft-web
npm install --cache .runtime/npm-cache
.\Start-Tallo.ps1             # PC 서버 + Cloudflare Tunnel
.\Start-Tallo.ps1 -LocalOnly  # 로컬 접속만
.\Stop-Tallo.ps1
npm run dev                     # 개발용 전경 실행 (기존 서버 먼저 중지)
npm test                        # 게임 규칙·멀티플레이·리포트 검증
```

실행 후 로컬 주소는 `http://localhost:3210`, 공개 주소는 `https://mindraft.yoosung.dev`입니다. 중지할 때는 `Stop-Tallo.ps1`을 실행하세요. 실행 로그는 `.runtime/server.log`, `.runtime/tunnel.log`에 기록됩니다.

### Cloudflare 라우팅 전환

현재 도메인은 Cloudflare DNS의 `mindraft-web` 터널 경로를 통해 이 PC로 연결됩니다. 이 구성을 쓰려면 PC가 켜져 있고 서버와 터널이 실행 중이어야 합니다. Cloud Run으로 되돌릴 때는 Cloudflare 대시보드에서 `mindraft-cloud-run-proxy` Worker에 `mindraft.yoosung.dev/*` Route를 다시 연결하고, 터널 DNS 경로를 제거하세요. Worker 코드는 [cloudflare/worker.js](cloudflare/worker.js)에 있습니다.

### 환경 변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `PORT` / `HOST` | `3210` / `127.0.0.1` | 컨테이너에서는 `HOST=0.0.0.0` |
| `DATA_DIR` | `./data` | 프로필·행동 기록 JSON 저장 위치 |
| `ALLOWED_ORIGINS` | – | 쉼표로 구분한 추가 허용 출처(배포 도메인) |
| `ANTHROPIC_API_KEY` | – | Gemini 키가 없을 때 Claude(`claude-opus-5-5`) 사용, 없으면 규칙 기반 |
| `AI_MODEL` | `claude-opus-5-5` | AI 모델 변경 |
| `AI_PROVIDER` | – | `rules`이면 AI 호출 없이 규칙 기반만 사용 |
| `DATA_BACKEND` | 로컬 파일 | `firestore`이면 Cloud Firestore에 프로필 저장 |
| `GOOGLE_CLOUD_PROJECT` | – | Firebase/Firestore 프로젝트 ID |
| `FIREBASE_API_KEY` / `FIREBASE_APP_ID` | – | Firebase 웹 앱의 공개 설정값 |
| `FIREBASE_AUTH_DOMAIN` | `<프로젝트 ID>.firebaseapp.com` | Firebase 로그인 도메인 |
| `GEMINI_API_KEY` | – | Gemini API 키. Cloud Run에서는 Secret Manager로 주입 |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` | Gemini 모델 |

Gemini 키가 있으면 Gemini를 우선 사용합니다. AI 호출이 실패하거나 거절되면 규칙 기반 결과로 대체하고 사용 횟수를 차감하지 않습니다. AI에는 닉네임·토큰 없이 `aiInput()`이 만든 행동 요약만 전달됩니다.

### 컨테이너 배포 (민관협력 지원 플랫폼 클라우드)

```bash
docker build -t tallo .
docker run -d -p 3210:3210 -v tallo-data:/data -e DATA_BACKEND=local -e ALLOWED_ORIGINS=https://<배포도메인> tallo
```

### Google Cloud 배포

대상 프로젝트: `psychic-linker-510120-k7`. [배포 절차](docs/google-cloud-deploy.md)에 Firebase 등록, Firestore 생성, Secret Manager 설정, 로컬 프로필 이전, Cloud Run 배포 명령을 정리했습니다. 게임은 닉네임으로 시작할 수 있으며, AI 생성에는 Google 로그인이 필요합니다. 성공한 AI 생성만 계정당 총 10회로 계산하고, 한 번 만든 결과를 다시 열 때는 횟수를 차감하지 않습니다.

## 데이터 / 서버 처리

- 로컬 `data/profiles.json`: 닉네임, XP, 훈장, 행동 기록(`log`, 최근 300건), 퀘스트 진행, 리포트. Cloud Run에서는 Firestore에 저장합니다.
- 익명 사용자는 브라우저 `localStorage`에 무작위 세션 토큰을 저장하고 서버에는 해시만 저장합니다. Google 로그인 후에는 Firebase ID 토큰으로 계정을 확인합니다.
- 다른 사용자에게는 이름·아바타·XP·훈장만 공개(`pub`), 행동 기록과 리포트는 본인 소켓에만 전송(`self`).
- 방, 초대, 진행 중 게임은 서버 메모리에 보관. 20초 이내 재접속 시 복구, 호스트 퇴장 시 권한 이양.
- 서버 권한 검증, 조기·중복·지연 제출 거부, 메시지 크기·빈도 제한, AI 요청 15초 제한.
- 정답은 출제 응답에 포함하지 않으며, 탐색 모드 재도전 힌트도 정답·최적값을 드러내지 않습니다.
- 로컬 실행은 JSON 저장소를 사용합니다. Cloud Run에서는 Firestore를 사용하고, 실시간 방 상태는 단일 인스턴스 메모리에 둡니다. 서버 배포·재시작 중에는 진행 중인 방이 종료될 수 있습니다.

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

## Cloudflare 도메인 연결

현재 `mindraft.yoosung.dev`는 `mindraft-web` Cloudflare Tunnel을 통해 이 PC의 `http://127.0.0.1:3210`으로 연결됩니다. Cloudflare Worker `mindraft-cloud-run-proxy`의 `mindraft.yoosung.dev/*` Route는 비활성화했습니다. Cloud Run 서비스와 Worker 코드([cloudflare/worker.js](cloudflare/worker.js))는 남아 있으며, Cloud Run으로 되돌릴 때는 Worker Route를 다시 연결하고 터널 경로를 해제해야 합니다. Firebase Authentication의 승인된 도메인에는 `mindraft.yoosung.dev`가 등록되어 있습니다.

### 로컬 터널 설정

터널 이름: `tallo-web`, ID: `94449648-004e-4731-b2c5-060c76cd8a8c`. 현재 PC의 `.runtime/tunnel.yml`과 `.runtime/tunnel-credentials.json`에 설정이 있으며 인증 파일은 Git에서 제외했습니다.

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
cloudflared tunnel info tallo-web
Get-Content .runtime/server-error.log -Tail 30
```

위 터널 설정은 현재 공개 도메인에 사용 중입니다. PC가 켜져 있고 서버와 터널이 실행되어 있어야 외부 접속이 가능합니다.


## Tallo 게임 리팩토링 (2026-10-12)

현재 카탈로그는 `robot`, `cargo`, `signal`, `cafe` 4종입니다. 기존 5종의 게임 생성·판정·조작 UI는 교체했습니다. 각 게임은 조작 연습과 하·중·상 3라운드로 구성됩니다. 혼자 탐색, 2~4인 경쟁, 2~4인 협동 모두 지원하며 한 판의 제한 시간은 4분입니다. 점수는 서버가 정확도를 기준으로 계산하고, 순서 기억 정확도와 리듬 간격 오차는 별도로 기록합니다.

- 회로: 연결된 분기 전체의 소비 전력, 필수 장치와 고장 회로를 판정합니다. 생성 시 전체 방향 조합을 탐색해 해법·최적 전력·최소 회전 수를 검증합니다.
- 화물: 4×4 / 5×5 / 6×6 화물칸, 회전과 배치, 미리보기, 재배치 제한, 장애물을 제공합니다. 연결된 블록으로 공간을 분할해 해법을 보장하며 테스트는 독립적인 정확 덮기 탐색으로 검증합니다. 선택 후 탭, 드래그, R 회전, 방향키와 Enter를 지원합니다.
- 신호: 3 / 5 / 7개 목표 신호, 방해 신호, 상 난이도 중간 규칙 전환을 제공합니다. 1~4 키나 화면 버튼으로 입력하며 시각 박자와 선택적 효과음이 있습니다.
- 카페: 1 / 2 / 3개 주문, 상품 수량, 한정된 재고, 상 난이도 마감과 처리 우선순위를 판정합니다. 탭 또는 드래그로 트레이를 채웁니다. 하 난이도에는 개별 주문 마감이 없어 수량 정확도에 집중할 수 있습니다.

`public/puzzles.js`는 화면과 서버가 공유하는 규칙, `lib/arcade.js`는 생성·서버 판정, `public/arcade.js`는 조작과 연습, `public/tallo.css`는 2.5D 스타일입니다. 그래픽은 사전 렌더링된 3D 아트와 CSS 깊이·조명·상호작용으로 구성되며 실시간 3D 엔진을 사용하지 않습니다.

문제 ID·난이도·문제 구성·서버 타임스탬프·조작 순서·제출·실패 후 수정 이력과 게임별 지표가 프로필에 저장됩니다. 중단 시 진행 중이던 조작도 보존합니다. 요약 기록은 최대 300건이며 프로필 크기가 600KB를 넘으면 오래된 상세 조작을 요약으로 압축합니다. 최근 결과에는 난이도별 정확도, 소요 시간, 행동 피드백이 표시됩니다.

서비스 브랜드, 패키지, 파비콘, 로그인 클라이언트 이름과 실행 스크립트는 Tallo로 변경했습니다. 기존 게스트 저장 키는 새 `tallo-token`으로 자동 이전합니다. 기존 배포 도메인, Cloudflare 터널 이름, 클라우드 서비스 ID와 저장소 경로는 연결 호환성을 위해 유지합니다. 디자인 레퍼런스와 과거 제출 증빙 파일은 원본으로 보존합니다.

### 아트 에셋

내장 imagegen으로 생성하고 `public/art/tallo/`에 저장했습니다. 아래는 사용한 프롬프트의 아트 지시사항입니다.

- `hero.png`: main-view 레퍼런스를 바탕으로 흰색·아이스블루 미래 작업실, 오른쪽에 별을 든 흰 로봇, 왼쪽에 제목을 위한 밝은 여백. 부드러운 세라믹 3D 렌더, 도시로 향하는 포털, 식물과 햇살. 글자·버튼·UI 제외.
- `worlds.png`: 동일한 2×2 구획의 로봇 정비실 / 라벤더 우주 화물 터미널 / 반딧불이 숲 / 크림·살구 카페. 둥근 형태, 물리적 재질, 공간감과 영화적 조명. 게임 조작을 올릴 중앙 여백, 글자·프레임 제외.
- `products.png`: 투명한 2×2 아이템 시트. 아메리카노 컵, 골든 크루아상, 딸기 라떼, 토스트 샌드위치. 3/4 시점의 부드러운 고품질 3D 음식 아이콘, 따뜻한 조명, 글자·UI 제외.
