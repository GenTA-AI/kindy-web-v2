# 26. GCS immutable ContentRelease 경계

작성일: 2026-08-24
상태: **서버 adapter·config·단위 테스트만 로컬 구현, GCP 미프로비저닝, runtime hard-disabled**

## 결론

Supabase `service_role`이 같은 Cloud Run 프로세스에 남아 있어도 release object를
변조하지 못하게 만드는 다음 storage 경계를 코드로 준비했다. 새 adapter는
`ContentRelease` manifest, `ExperienceGraph`, 승인 media를 별도 private GCS
bucket에서 읽고, 브라우저에는 검증된 release가 선언한 단 하나의 object에 대한
15분 이하 V4 HTTPS signed URL만 발급한다.

이 변경은 현재 `server-runtime-content-release.ts` composition을 바꾸지 않고
`STORY_CHAT_RUNTIME_ENABLED`도 열지 않는다. GCP bucket/IAM/retention을 실제로
만들거나 수정하지 않았으므로 아직 activation-ready가 아니다.

## 로컬 코드 경계

- `GcsPrivateReleaseObjectStore`
  - constructor에 묶인 단 하나의 bucket과 `releases/...` object name만 사용한다.
  - GCS JSON API의 exact media URL을 서버가 직접 조립한다. caller/browser URL을
    받지 않고 redirect, cache, compressed response를 거절한다.
  - ADC token 획득부터 response EOF까지 4초 wall-clock deadline을 적용한다.
  - registry의 exact expected byte count와 loader absolute maximum을 모두 확인하며
    stream counter가 한 바이트라도 벗어나면 cancel/abort 후 `null`로 닫는다.
- `GcsPrivateReleaseAssetSigner`
  - V4 canonical GET request를 서버에서 만들고 IAM Credentials `signBlob`에
    canonical string-to-sign만 전달한다.
  - private key/JSON key를 읽거나 받지 않는다. Cloud Run attached service account의
    Application Default Credentials만 사용한다.
  - 결과 URL은 `https://storage.googleapis.com/<exact bucket>/<exact storageKey>`와
    정확히 6개 `X-Goog-*` query, signer identity, 발급시각, TTL, RSA signature를
    다시 검증한 뒤에만 반환한다.
  - IAM response도 64 KiB streaming upper bound와 같은 4초 deadline 안에서 읽는다.
- 모든 GCS adapter 코드는 `server-only`로 client import를 poison한다.

`server-only@0.0.1`은 direct runtime dependency로 고정했다. credential provider는
일반 `GoogleAuth` discovery를 사용하지 않고 exact attached service-account email의
Cloud Run metadata endpoint만 호출한다. 공식 runtime contract의 `default/email`을
먼저 읽어 config의 exact identity와 비교한 뒤 일치할 때만 `default/token`을 읽는다.
따라서 `GOOGLE_APPLICATION_CREDENTIALS`, gcloud user ADC, well-known key file을 보지
않고 요청의 `AbortSignal`도 두 metadata fetch까지 전달한다.

## fail-closed 환경 계약

새 `getGcsContentReleaseRuntimeConfig`는 기존 Supabase config와 별도다. 아래 값이
모두 exact match일 때만 `{ configured: true }`를 반환한다.

| 환경 | channel | private bucket | signer/runtime identity |
|---|---|---|---|
| preview | `staging` | `kindy-493701-content-releases-staging` | `kindy-preview-runtime@kindy-493701.iam.gserviceaccount.com` |
| production | `production` | `kindy-493701-content-releases-production` | `kindy-runtime@kindy-493701.iam.gserviceaccount.com` |

공통으로 `STORY_CONTENT_RELEASE_STORAGE_BACKEND=gcs`가 필요하다. legacy Supabase
reader JWT, custom credential JSON, private key, `GOOGLE_APPLICATION_CREDENTIALS`
환경값이 하나라도 있으면 GCS config는 닫힌다. ADC의 Cloud Run metadata credential
source만 사용한다.

이 config는 아직 배포 하네스나 production composition에 연결하지 않았다. 따라서
환경변수만 넣어도 storage backend가 자동 전환되지 않는다.

## 실제 GCP에서 먼저 만족해야 할 조건

1. staging/production을 물리적으로 분리한 두 bucket을 같은 region에 만든다.
2. Uniform bucket-level access와 Public Access Prevention을 강제한다.
3. Object Versioning을 켜고 retention policy를 설정한 뒤 검증 후 lock한다.
4. preview runtime SA에는 staging bucket `roles/storage.objectViewer`만, production
   runtime SA에는 production bucket `roles/storage.objectViewer`만 준다.
5. 각 runtime SA가 자기 identity로 V4 URL을 만들 수 있도록 자기 service account에
   `iam.serviceAccounts.signBlob`을 최소 범위로 부여한다. service-account key는
   생성하지 않는다.
6. publisher는 해당 channel bucket의 `roles/storage.objectCreator`만 갖고
   overwrite/delete/read 권한을 갖지 않는다. operator/runtime/publisher identity를
   분리한다.
7. bucket policy, retention lock, IAM deny test, cross-channel read denial, 동일 object
   name overwrite denial을 독립 smoke로 증명한다.
8. 각 bucket CORS는 channel별 exact web origin의 `GET`/`HEAD`와 실제 필요한
   response header만 허용한다. wildcard origin은 금지하고 preview origin이 production
   bucket을 읽거나 그 반대가 되지 않게 한다. 실제 9:16 video의
   `crossOrigin=anonymous` 재생과 WebVTT track 로드를 함께 smoke한다.

   | channel | CORS origin allowlist |
   |---|---|
   | staging | `https://kindy-landing-preview-g3d7kdf7ta-du.a.run.app` (적용 직전 Cloud Run `status.url` 재확인 필수) |
   | production | `https://kindy.kr` |

9. 그 다음에만 Supabase adapter 대신 GCS adapter를 server composition에 주입하고
   upload→hash/size verify→attest→activate의 첫 staging release를 검증한다.

현재 `ContentRelease v1`에는 GCS object generation이 없어서 browser URL은
bucket/path/time에는 묶이지만 SHA/generation query에는 묶이지 않는다. 따라서 위
locked retention + creator-only publisher + overwrite-denial 증거는 activation
blocker다. defense-in-depth 후속 계약에서는 manifest/registry에 exact GCS generation을
추가하고 object read와 V4 signed query 모두에 같은 generation을 묶는다.

위 외부 증거와 기존 DB/browser/safety gate가 모두 통과하기 전에는
`STORY_CHAT_RUNTIME_ENABLED=0`과 compile-time immutable-boundary gate를 그대로 둔다.

## 로컬 검증

```bash
NODE_OPTIONS=--conditions=react-server npx tsx --test \
  src/lib/releases/gcs-runtime-content-release-config.test.ts \
  src/lib/releases/gcs-runtime-content-release.test.ts
npx tsc --noEmit
npx eslint \
  src/lib/releases/gcs-runtime-content-release.ts \
  src/lib/releases/gcs-runtime-content-release-config.ts \
  src/lib/releases/gcs-runtime-content-release.test.ts \
  src/lib/releases/gcs-runtime-content-release-config.test.ts
```

단위 테스트는 exact GCS API URL/auth header, redirect/cache 거절, actual byte drift,
ADC 지연 deadline, IAM `signBlob`, V4 URL host/bucket/path/query/identity binding,
malformed signature와 credential/config drift의 fail-closed 동작을 검증한다.

## 공식 규격 근거

- [Cloud Storage JSON Objects: get](https://docs.cloud.google.com/storage/docs/json_api/v1/objects/get)
- [Cloud Storage V4 canonical requests](https://docs.cloud.google.com/storage/docs/authentication/canonical-requests)
- [Cloud Storage V4 signing with your own program](https://docs.cloud.google.com/storage/docs/access-control/signing-urls-manually)
- [IAM Credentials `projects.serviceAccounts.signBlob`](https://docs.cloud.google.com/iam/docs/reference/credentials/rest/v1/projects.serviceAccounts/signBlob)
- [Cloud Run container runtime metadata contract](https://docs.cloud.google.com/run/docs/container-contract#metadata-server)
