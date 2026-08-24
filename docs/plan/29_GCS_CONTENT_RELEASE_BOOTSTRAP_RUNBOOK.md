# 29. GCS ContentRelease bootstrap/check 런북

작성일: 2026-08-24

상태: **로컬 하네스·테스트만 구현, GCP 변경 미실행, retention 미승인/미잠금**

## P0 activation hard blocker: 별도 project + 8일 quarantine 필요

현재 `kindy-493701`에는 Cloud Run을 운영하기 위한 project-level
`roles/run.serviceAgent` 같은 service-agent binding이 필요하다. 그 live role에는
service-account token/signing 및 project-wide Storage object 권한이 포함될 수 있어,
같은 project 안에서 bucket IAM 두 binding만으로 effective access를 격리했다고 증명할
수 없다. 이를 예외 allowlist로 풀면 안 된다.

따라서 현재 하네스의 project scanner는 모든 bound predefined role permission이 아주
작은 **exact read-only permission allowlist** 안에 있을 때만 통과하며, 현재 project의
standard service-agent role은 의도적으로 실패할 것으로 예상한다. 별도 GCS content
project로 bucket·publisher·runtime 경계를 이전하고 새 exact identifiers를 코드 리뷰한
뒤에만 bootstrap을 승인한다. 또는 동일 수준의 verified IAM Deny evidence를 하네스가
직접 검증하는 기능이 별도로 구현돼야 한다. 현재 하네스는 IAM Deny evidence를 읽지
않으므로 그 우회는 없다. 이 blocker가 해소될 때까지 compile-time runtime hard-off와
`STORY_CHAT_RUNTIME_ENABLED=0`을 유지한다.

추가로 GCS resumable upload session URI는 발급 후 추가 인증 없이 upload를 이어갈 수
있고 최대 1주 유효하다. IAM을 no-writer로 바꾼 직후 object/XML multipart 목록이 비어
있어도 과거 session을 열거하거나 부정할 수 없으므로 retention과 publisher grant를 바로
추가하면 안 된다. 별도 project에서 no-writer 봉인 → 최소 8일 quarantine → second
all-version/soft-delete/folder/multipart empty proof + Audit Log 검토를 거치는 two-phase
하네스가 구현되기 전에는 fresh/existing bucket 모두 bootstrap할 수 없다.

## 목적과 정본

`scripts/gcp-content-release.sh`는 Kindy의 immutable ContentRelease GCS 경계 계약을
read-only 검증하고 후속 two-phase 구현을 준비하는 하네스다. 프로젝트, 서울 리전, 두 bucket, 네 service
account, CORS origin을 코드에 exact allowlist로 고정한다. mutable gcloud default나
임의 environment 값으로 channel을 바꾸지 않는다.

| channel | bucket | runtime (read/sign) | future publisher identity (write-only role) | browser origin |
|---|---|---|---|---|
| staging | `kindy-493701-content-releases-staging` | `kindy-preview-runtime@kindy-493701.iam.gserviceaccount.com` | `kindy-content-publisher-staging@kindy-493701.iam.gserviceaccount.com` | `https://kindy-landing-preview-g3d7kdf7ta-du.a.run.app` |
| production | `kindy-493701-content-releases-production` | `kindy-runtime@kindy-493701.iam.gserviceaccount.com` | `kindy-content-publisher-production@kindy-493701.iam.gserviceaccount.com` | `https://kindy.kr` |

runtime은 자기 bucket의 `roles/storage.objectViewer`, publisher는 자기 bucket의
`roles/storage.objectCreator`만 받는다. bucket policy 전체에는 이 두 단일-member
binding 외 어떤 role/principal/condition도 허용하지 않는다. 새 bucket의 provider
기본 binding도 `legacyBucketOwner`의 exact project owner/editor와
`legacyBucketReader`의 exact project viewer, `legacyObjectOwner`의 exact project
owner/editor, `legacyObjectReader`의 exact project viewer라는 네 role만 허용한다.
`storage.admin`, 임의 user, 다른 project member가 보이거나 네 role 중 하나라도 빠지면
생성 직후 경로라도 교체하지 않는다. 허용된 초기 policy만
live etag에 묶인 exact policy로 원자 교체하며, 기존 bucket은 unexpected binding이
하나라도 있으면 교체하지 않고 닫힌다. publisher에는
read/delete/overwrite 권한이 없다. runtime의 V4 URL 서명은
`iam.serviceAccounts.signBlob` 하나만 가진 project custom role을 각 runtime service
account가 자기 자신에게 부여하는 방식이다. service-account policy도 이 self binding
하나 외 `serviceAccountUser`, 다른 custom role, extra member를 전부 거절한다.
publisher service-account resource policy는 정확히 empty여야 한다.
`roles/iam.serviceAccountTokenCreator`, `serviceAccountOpenIdTokenCreator`, primitive
Editor/Owner와 user-managed key도 검사가 거절한다. runtime/publisher에 속한 active,
inactive, recently-deleted GCS HMAC key도 0개여야 한다. API key list의 모든 key ID를
각각 `api-keys describe`해 protected service account에 묶인 authorization key가
하나도 없음을 확인한다. list/describe가 불완전하거나 실패해도 닫힌다.

하네스가 확인하는 storage control은 Uniform bucket-level access, Public Access
Prevention=`enforced`, Object Versioning, 2,592,000초(30일) retention policy,
channel별 단 하나의 CORS rule(`GET`, `HEAD`, `Content-Type`, `Range`)이다. staging과
production runtime/publisher가 반대 bucket policy에 한 번이라도 나타나면 실패한다.
네 identity가 project-level role에 직접 바인딩된 경우도 광범위한 상속 위험으로
간주해 실패한다. project policy의 custom role과 group/domain/principalSet 같은 간접
member path도 증명 불가로 실패한다. 남은 모든 predefined role은 live role descriptor를
읽고, 모든 included permission이 코드에 고정된 project/service-usage/SA/key/bucket
metadata용 exact read-only allowlist 안에 있을 때만 통과한다. 따라서 API-key binding,
API-key string, HMAC, Cloud Build/Deployment Manager/Compute/Run 등 간접 execution 또는
미래의 알 수 없는 permission도 별도 denylist 누락 없이 실패한다. role descriptor를
읽지 못해도 activation blocker다.

## 현재 허용된 read-only 실행 순서

현재 이 명령들은 **실행하지 않았다**. 아래 current-project 명령은 계약 검토용
예시일 뿐이고 P0 blocker 때문에 실행 승인 대상이 아니다. 먼저 별도 content project를
확정해 script/CORS/런타임 config의 project, bucket, service-account exact allowlist를
한 묶음으로 변경·리뷰하고 모든 회귀 검사를 다시 통과해야 한다. 그 이후에만 staging을
진행하고 모든 증거가 통과한 뒤 production을 별도 승인한다.

### 0. offline plan과 origin 확인

`plan`은 gcloud를 전혀 호출하지 않는다.

```bash
bash scripts/gcp-content-release.sh plan staging
gcloud run services describe kindy-landing-preview \
  --project=kindy-493701 \
  --region=asia-northeast3 \
  --format='value(status.url)'
```

두 번째 결과가 exact staging origin과 다르면 bootstrap하지 말고 코드·CORS
allowlist를 review/commit한 뒤 다시 시작한다. wildcard나 두 origin을 한 bucket에
함께 넣지 않는다.

### 1. bootstrap mutation hard-off

`bootstrap` command entry는 confirmation 값과 무관하게 첫 gcloud 호출 전에 실패한다.
현재 helper의 IAM/retention 순서 코드는 테스트·차기 설계 준비물일 뿐 실행 승인된
bootstrap이 아니다. fresh bucket의 provider-default IAM window와 existing bucket의
과거 resumable session을 즉시 empty proof로 배제할 수 없기 때문이다.

후속 two-phase bootstrap은 별도 project에서 identity/credential/effective IAM을 먼저
증명하고, bucket을 no-writer로 봉인한 시각과 IAM 지속성을 감사 가능하게 기록한 뒤 최소
8일 기다려야 한다. 그 다음 second empty proof와 Audit Log review가 모두 통과할 때만
unlocked retention 및 final publisher grant를 별도 승인 단계로 진행한다. 이 설계와
회귀 테스트가 승인되기 전에는 `bootstrap`을 다시 열지 않는다.

### 2. 비가역 단계 전 검사

```bash
bash scripts/gcp-content-release.sh prelock-check staging
```

이 검사는 retention policy가 아직 unlocked여도 나머지 control이 정확하면 통과한다.
그 외 어떤 drift도 먼저 수정하지 않고 원인을 조사한다. 하네스가 출력·로그에 access
token이나 service-account key를 남기는 경로는 없어야 한다.

### 3. publisher runner 미구현 activation blocker

현재 하네스에는 upload 명령과 publisher impersonation 경로가 **의도적으로 없다**.
publisher service-account resource IAM을 exact-empty로 요구하고 project-level
TokenCreator/WIF/custom/간접 실행 경로를 모두 거절하는 계약에서, 사람이 실행하는
`--impersonate-service-account` 명령을 제공하면 정적 guard와 모순되기 때문이다.

후속 설계는 별도 content/execution project에서 Mori publisher가 exact publisher
identity를 attached keyless ADC로 직접 사용하는 runner여야 한다. runner의 deployer,
service agent, build system, metadata identity와 effective permissions까지 독립 검토하고
하네스가 그 exact 실행 경로를 증명하기 전에는 object를 발행하지 않는다. 이 wiring은
현재 P0 activation blocker다.

후속 runner가 승인되더라도 upload는 GCS JSON API의
`ifGenerationMatch=0` precondition을 강제해야 한다. 같은 key의 두 번째 요청이
precondition failure로 닫히는 증거와 첫 object의 generation, size, SHA-256을 별도
verifier가 ContentRelease attestation과 대조한 증거를 보존한다. publisher는 object를
읽을 수 없으므로 publisher 자신이 검증자가 되어서는 안 된다.

### 4. 9:16 video/WebVTT CORS와 channel denial smoke

- staging origin에서 signed `https://storage.googleapis.com/<bucket>/<key>` URL로
  9:16 MP4/WebM을 `crossOrigin="anonymous"`로 재생한다.
- 같은 화면에서 WebVTT track과 Range seek가 동작하는지 확인한다.
- production origin에서 staging asset 접근, staging runtime의 production bucket
  read, production runtime의 staging bucket read가 모두 거절되는 증거를 남긴다.
- 승인된 runner가 구현된 뒤에만 publisher가 list/get/delete/overwrite를 모두 못 하고
  conditional-create만 가능한지 effective IAM negative test로 확인한다. folder/org
  상속 권한도 별도 Policy Troubleshooter로 확인한다.

이 실제 negative smoke와 첫 release hash/size 검증 전에는 runtime activation gate를
열지 않는다. 정적 bucket/project IAM 검사는 외부 organization/folder 상속을 전부
증명하지 못하므로 실제 identity probe를 생략할 수 없다.

### 5. retention lock: 미승인 비가역 mutation hard-off

live metageneration 조회만 허용된다.

```bash
bash scripts/gcp-content-release.sh metageneration staging
```

`lock-retention` command entry도 첫 gcloud 호출 전에 항상 실패한다. 30일 lock은
제거·단축·unlock할 수 없는 비가역 mutation이고 사용자의 별도 승인이 없으며 위
separate-project/quarantine gate도 미충족이기 때문이다. 공식 JSON API의
metageneration-bound POST와 token-safe curl helper는 테스트 준비물로 남지만 public
command에서는 unreachable이다. 새 explicit 승인과 two-phase 증거 없이는 열지 않는다.

### 6. locked static check와 production 반복

```bash
bash scripts/gcp-content-release.sh check staging
```

`check`는 retention이 실제로 locked일 때만 통과하지만 **activation readiness를
단독 증명하지 않는다**. 출력에도 organization/folder/group inherited IAM이 정적으로
증명되지 않았다는 blocker가 남는다. Policy Troubleshooter와 실제 identity negative
probe, 첫 signed release, browser CORS, cross-channel denial, DB
consent/browser/safety gate 증거가 모두 있어야 compile-time/runtime story chat gate
변경을 별도 PR로 검토할 수 있다.

staging의 two-phase bootstrap/quarantine, publisher runner 계약, 최소 1개 release와
rollback/withdrawal 훈련까지 끝낸 뒤에만 production 절차를 별도 설계·승인한다. 현재는
어느 channel에도 bootstrap/lock mutation command를 제공하지 않는다.

## 로컬 테스트

```bash
bash -n scripts/gcp-content-release.sh
node --check scripts/gcp-content-release-policy-check.mjs
bash scripts/gcp-content-release.test.sh
```

bash test는 외부 gcloud/curl을 stub 처리해 wildcard CORS, unlocked static check,
교차 channel IAM, 임의 bucket/SA role·principal·extra member, project-level 광범위
권한·custom role·간접 member·dangerous live role permissions, publisher exact-empty,
user-managed/HMAC/API authorization key와 TOCTOU 순서를 거절하는지 확인한다. 또한
offline plan이 gcloud를 호출하지 않고, bootstrap과 lock-retention command가 첫 gcloud
전에 hard-fail하며, 아직 증명되지 않은 `publish-create`/impersonation 경로가 CLI에
없고 plan이 publisher runner/quarantine를 activation blocker로 출력하는지 검증한다.
새 bucket 초기 IAM은 네 provider-default role exact allowlist만 받고, no-writer IAM 뒤
live/noncurrent·soft-deleted·managed-folder·multipart empty proof와 retention이 끝나기
전에 publisher creator를 추가하지 않는지도 검증한다. HMAC/API authorization key와
exact read-only project role permission도 회귀 fixture로 확인한다. lock test는 curl `-q`가 첫
인자라 malicious curlrc를 무시하고, bearer가 argv에 없고 확인한 metageneration이 URL
precondition에 있으며, 412·malformed response가 fail-closed인지 확인한다.

## 공식 근거

- [Cloud Storage Object Creator 역할](https://docs.cloud.google.com/storage/docs/access-control/iam-roles)
- [generation-match request precondition](https://docs.cloud.google.com/storage/docs/request-preconditions)
- [Bucket retention policy lock](https://docs.cloud.google.com/storage/docs/using-bucket-lock)
- [Cloud Storage CORS](https://docs.cloud.google.com/storage/docs/cross-origin)
- [IAM Credentials signBlob](https://docs.cloud.google.com/iam/docs/reference/credentials/rest/v1/projects.serviceAccounts/signBlob)
- [Authorization key 판별](https://docs.cloud.google.com/docs/authentication/api-keys#determine_key_type)
- [Soft-deleted object 조회](https://docs.cloud.google.com/storage/docs/use-soft-deleted-objects)
- [Pending multipart upload 조회](https://docs.cloud.google.com/storage/docs/xml-api/get-bucket-uploads)
- [Resumable uploads와 session URI 보안](https://docs.cloud.google.com/storage/docs/resumable-uploads)
