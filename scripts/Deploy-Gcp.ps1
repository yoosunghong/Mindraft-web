param(
  [string]$ProjectId = 'psychic-linker-510120-k7',
  [string]$Region = 'asia-northeast3',
  [Parameter(Mandatory = $true)][string]$FirebaseApiKey,
  [Parameter(Mandatory = $true)][string]$FirebaseAppId,
  [string]$FirebaseAuthDomain = '',
  [string]$GeminiSecret = 'mindraft-gemini-api-key'
)

$ErrorActionPreference = 'Stop'
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
  throw 'Google Cloud CLI(gcloud)를 설치하고 로그인해야 합니다.'
}
if (-not $FirebaseAuthDomain) { $FirebaseAuthDomain = "$ProjectId.firebaseapp.com" }
$ServiceAccount = "mindraft-run@$ProjectId.iam.gserviceaccount.com"

& gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com firestore.googleapis.com secretmanager.googleapis.com --project $ProjectId
if ($LASTEXITCODE -ne 0) { throw '필요한 Google Cloud API를 활성화하지 못했습니다.' }

& gcloud iam service-accounts describe $ServiceAccount --project $ProjectId *> $null
if ($LASTEXITCODE -ne 0) {
  & gcloud iam service-accounts create mindraft-run --display-name 'Mindraft Cloud Run' --project $ProjectId
  if ($LASTEXITCODE -ne 0) { throw 'Cloud Run 서비스 계정을 만들지 못했습니다.' }
}
& gcloud projects add-iam-policy-binding $ProjectId --member "serviceAccount:$ServiceAccount" --role roles/datastore.user --quiet | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Firestore 접근 권한을 설정하지 못했습니다.' }

& gcloud secrets describe $GeminiSecret --project $ProjectId *> $null
if ($LASTEXITCODE -ne 0) { throw "Secret Manager에 '$GeminiSecret' 비밀값을 먼저 만들어주세요." }
& gcloud secrets add-iam-policy-binding $GeminiSecret --member "serviceAccount:$ServiceAccount" --role roles/secretmanager.secretAccessor --project $ProjectId --quiet | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Gemini 키 접근 권한을 설정하지 못했습니다.' }

$Environment = "DATA_BACKEND=firestore,GOOGLE_CLOUD_PROJECT=$ProjectId,FIREBASE_API_KEY=$FirebaseApiKey,FIREBASE_APP_ID=$FirebaseAppId,FIREBASE_AUTH_DOMAIN=$FirebaseAuthDomain,GEMINI_MODEL=gemini-3.1-flash-lite"
& gcloud run deploy mindraft `
  --source . `
  --project $ProjectId `
  --region $Region `
  --service-account $ServiceAccount `
  --port 3210 `
  --cpu 1 `
  --memory 512Mi `
  --concurrency 80 `
  --min-instances 0 `
  --max-instances 1 `
  --timeout 3600 `
  --set-env-vars $Environment `
  --set-secrets "GEMINI_API_KEY=${GeminiSecret}:latest" `
  --allow-unauthenticated
if ($LASTEXITCODE -ne 0) { throw 'Cloud Run 배포에 실패했습니다.' }
