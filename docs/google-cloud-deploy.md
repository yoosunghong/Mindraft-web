# Mindraft Google Cloud 배포

대상 프로젝트는 `psychic-linker-510120-k7`, 지역은 서울 `asia-northeast3`입니다. 서버는 Cloud Run 한 인스턴스로 운영하고, 프로필과 AI 사용 횟수는 Firestore에 저장합니다. 게임은 익명으로 시작할 수 있고 AI 생성 시 Google 로그인을 연결합니다.

2026-09-30 공개 주소: `https://mindraft.yoosung.dev`. Cloud Run 직접 주소: `https://mindraft-772237580154.asia-northeast3.run.app`. 두 주소의 `/api/health`에서 `ok: true`, `ai: true`를 확인했습니다.

## 1. Google Cloud 및 Firebase 준비

1. 프로젝트의 결제 계정을 연결합니다.
2. 해당 Google Cloud 프로젝트를 Firebase에 추가하고, Firebase Authentication에서 **Google** 로그인 제공자를 켭니다.
3. Firebase 웹 앱을 등록합니다. 웹 앱 설정에서 `apiKey`, `appId`, `authDomain`을 확인합니다. 이 값들은 웹 앱 공개 설정이며 Gemini API 키가 아닙니다.
4. Authentication의 승인된 도메인에 배포 후 표시되는 Cloud Run 호스트 이름을 추가합니다. 현재 도메인 `mindraft.yoosung.dev`를 연결할 때도 승인된 도메인에 추가합니다.
5. Firestore Native 모드의 `(default)` 데이터베이스를 서울 `asia-northeast3`에 생성합니다. 첫 기본 데이터베이스의 위치는 나중에 쉽게 바꿀 수 없으므로 생성 전에 확인합니다.
   Firebase Firestore 보안 규칙은 `allow read, write: if false;`로 유지합니다. 웹 브라우저는 Firestore에 직접 연결하지 않고 Cloud Run 서버만 서비스 계정으로 접근합니다.
6. Secret Manager에 `mindraft-gemini-api-key`라는 비밀을 만들고 Gemini API 키를 최신 버전으로 저장합니다. 키를 소스 코드나 Firebase 웹 앱 설정에 넣지 않습니다.
   Gemini 키는 Generative Language API만 허용하고 Cloud Run 서비스 계정에 연결한 인증 키를 사용합니다.

## 2. 기존 데이터 이전

2026-09-30 배포 작업에서 로컬 `data/profiles.json`의 프로필 7개를 Firestore로 이전했습니다. 이미 존재하는 프로필은 아래 스크립트로 덮어쓰지 않습니다. 이후 추가된 로컬 기록은 주소 전환 전에 별도로 확인해야 합니다.

```powershell
gcloud auth login
gcloud auth application-default login
$env:GOOGLE_CLOUD_PROJECT = 'psychic-linker-510120-k7'
node scripts/import-profiles.js data/profiles.json
```

이전이 끝나기 전에 기존 PC 서버를 종료하거나 주소를 바꾸지 마세요. 이전 후에도 로컬 서버에서 기록이 계속 추가되면 마지막 변경분은 별도로 다시 이전해야 합니다.

## 3. Cloud Run 배포

Google Cloud CLI를 설치하고 로그인한 뒤, 프로젝트 루트에서 다음 스크립트를 실행합니다. `FirebaseApiKey`와 `FirebaseAppId`는 1단계의 웹 앱 설정값입니다.

```powershell
.\scripts\Deploy-Gcp.ps1 -FirebaseApiKey '<Firebase apiKey>' -FirebaseAppId '<Firebase appId>'
```

스크립트는 전용 서비스 계정을 만들고 Firestore 및 Gemini 비밀 접근 권한을 부여합니다. Cloud Run은 CPU 1개, 메모리 512MiB, 최대 인스턴스 1개, 최소 인스턴스 0개, 요청 제한 60분으로 배포됩니다. Cloud Run이 표시하는 `run.app` 주소를 Firebase Authentication 승인된 도메인에 추가하세요. `ALLOWED_ORIGINS`를 별도로 설정하지 않아도 같은 출처에서 앱을 열면 Socket.IO에 연결할 수 있습니다.

## 4. 전환 확인

- `https://<Cloud Run 주소>/api/health`가 `ok: true`, `ai: true`를 반환하는지 확인합니다.
- 이전한 로컬 프로필과 게임 기록이 보이는지 확인합니다.
- Google 로그인 후 AI 리포트 또는 퀘스트를 생성하고 남은 횟수가 9/10으로 표시되는지 확인합니다.
- 다른 브라우저에서 같은 Google 계정으로 로그인했을 때 같은 횟수가 보이는지 확인합니다.
- 두 브라우저로 방을 만들고 참가해 실시간 연결을 확인합니다.

Cloud Run 서울 리전은 직접 도메인 매핑 지원 지역이 아니므로 Cloudflare Worker `mindraft-cloud-run-proxy`에 `mindraft.yoosung.dev/*` 라우트를 추가했습니다. Worker 코드는 [`cloudflare/worker.js`](../cloudflare/worker.js)에 있습니다. 기존 Cloudflare Tunnel의 DNS 레코드는 유지되지만 공개 요청은 Worker 라우트가 먼저 받아 Cloud Run으로 전달합니다. Worker의 실행 실패 시 라우트는 `Fail closed`로 설정되어 로컬 저장소로 요청이 돌아가지 않게 했습니다. Firebase Authentication 승인된 도메인에도 `mindraft.yoosung.dev`를 등록했습니다.

Cloud Run의 WebSocket은 최대 60분 후 재연결되며, 배포나 인스턴스 재시작 시 진행 중인 방은 종료될 수 있습니다. 프로필과 AI 횟수는 Firestore에 유지됩니다. Cloud Run 비용은 연결이 열린 시간에도 발생하므로 Google Cloud 결제 알림을 설정하는 것이 좋습니다.

## 예상 비용

현재 설정은 Cloud Run 서울 리전, CPU 1개, 메모리 512MiB, 요청 기반 과금, 최소 인스턴스 0개입니다. 방문자가 드물고 실시간 연결이 짧으면 월 약 $0~10 수준을 예상합니다. WebSocket 연결이 사실상 24시간 유지되어 인스턴스가 계속 활성 상태라면 30일 기준 Cloud Run 컴퓨팅 비용만 약 $85~90입니다. 무료 사용량은 결제 계정 단위로 공유되므로 다른 프로젝트가 이미 사용했다면 이보다 높아질 수 있습니다. 트래픽, 빌드와 이미지 저장, Secret Manager 비용은 별도입니다.

Cloudflare Worker 무료 요금제는 하루 10만 요청까지 포함하며, WebSocket 연결은 연결을 시작할 때 1회 요청으로 계산합니다. 다른 Worker 사용량과 무료 한도를 공유하므로 Cloudflare 대시보드에서도 요청 수를 확인하세요.

Firestore 기본 데이터베이스에는 저장 1GiB, 읽기 5만 건/일, 쓰기 2만 건/일의 무료 사용량이 있습니다. Gemini 3.1 Flash-Lite 유료 요금은 텍스트 입력 100만 토큰당 $0.25, 출력 100만 토큰당 $1.50입니다. 계정당 성공한 AI 생성 최대 10회 제한은 앱 서버와 Firestore 트랜잭션에서 적용합니다. 실제 청구액은 Google Cloud 결제 보고서에서 확인하세요.

- [Cloud Run 요금](https://cloud.google.com/run/pricing)
- [Firestore 요금](https://cloud.google.com/firestore/pricing)
- [Gemini API 요금](https://ai.google.dev/gemini-api/docs/pricing)
- [Cloudflare Workers 요금](https://developers.cloudflare.com/workers/platform/pricing/)
