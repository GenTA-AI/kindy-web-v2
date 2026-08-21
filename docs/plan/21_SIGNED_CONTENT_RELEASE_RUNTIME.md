# 21. 서명된 ContentRelease runtime registry/loader

작성일: 2026-08-21
상태: 로컬 구현·PG17 검증 완료, **운영 runtime hard-disabled (`0`)**

## 결론

Kindy authored chat은 Mori Studio가 발행한 `ContentRelease v1`의 서명된
`ExperienceGraph`만 읽는다. demo/unsigned/local-catalog fallback은 없다. 현재
계약·registry·loader·publisher 경계는 구현됐지만, 같은 Cloud Run 프로세스가
Supabase `service_role`을 보유하는 동안 그 키가 Storage RLS를 우회해 release
object를 덮어쓰거나 지울 수 있다. 따라서 아래 둘 중 하나가 실제 구축·검증되기
전에는 `STORY_CHAT_RUNTIME_ENABLED=1`을 열지 않는다.

1. ContentRelease를 별도 GCS bucket으로 이동: runtime SA=`objectViewer`, publisher
   SA=`objectCreator`(overwrite/delete 없음), Object Versioning + retention/lock.
2. Cloud Run에서 Supabase `service_role`을 완전히 제거하고 필요한 DB 작업을
   custom RPC-only runtime identity로 제한.

배포 하네스, readiness, route runtime config 세 곳이 모두 `1`을 거절한다. 별도
Storage reader JWT는 방어심층일 뿐 위 P0 경계를 대신하지 않는다.

## 서명 계약

Kindy와 Mori의 `ExperienceGraph v1` 계약과 fixture는 byte-identical하다. root
`presentation`에는 `title`, `subtitle`, `summary`, `coverMediaId`, `coverAltText`,
`primaryCharacterId`가 필수다. primary character는 protagonist와 달라야 하고
square avatar가 필요하며 cover는 dimensioned image여야 한다. cinematic은
`title`, `description`, `posterMediaId`, `subtitleMediaId`가 필수이고 video/poster는
정확한 9:16, subtitle은 `text/vtt`여야 한다. child-name/unknown token은 허용
경계 밖이면 fail-closed한다.

`ContentRelease v1` manifest 형식은 유지한다. Ed25519 서명은 canonical manifest,
approval scope, graph 및 모든 asset hash/size를 묶는다. semver 각 component와
activation sequence는 TypeScript와 PostgreSQL 모두 `Number.MAX_SAFE_INTEGER`
이하만 허용한다.

## 발행 경계

Mori의 `recordVerifiedReleaseBundle`은 canonical manifest bytes,
ExperienceGraph bytes, manifest에 선언된 모든 asset bytes의 실제 `Uint8Array`만
받는다. 함수 내부에서 byte count와 SHA-256을 계산하고 `verifyContentRelease`가
manifest, approval, Ed25519, graph, media 선언, 모든 asset byte를 통과시킨 뒤에만
`record_application_verified_content_release_attestation`을 호출한다. caller가
전달한 관측 hash/size만으로 attestation을 만들 수 없다.

SQL record RPC 자체는 download/hash/signature/crypto를 수행하지 않는다. 이름과
comment가 이 한계를 명시하며, 별도 `kindy_content_release_publisher` Postgres
role만 EXECUTE할 수 있다. 이 role은 registry table을 직접 mutate하지 못한다.
활성화·철회·minimum floor 변경은 별도 `kindy_content_release_operator` role만
수행한다. Mori publisher는 활성화 권한이 없다.

## registry와 lifecycle

`0032_content_release_runtime_registry.sql`은 다음을 추가한다.

- `content_release_trusted_keys`: Ed25519 key allowlist, issuer=`mori-studio`,
  audience=`kindy-web`, channel, validity, revocation.
- `content_release_registry`: verified attestation과 private immutable storage key.
  manifest/graph JSON, public URL, signed URL은 저장하지 않는다.
- `content_release_channel_heads`: experience/channel별 strictly increasing semver
  head와 monotonic minimum floor.
- publisher-only record RPC, operator-only activate/revoke/floor RPC.
- 5-argument `is_world_chat_release_pin_available(..., release_channel)`과 최종
  `confirm_content_release_runtime_eligibility` read-only RPC.

Cloud Run `service_role`은 registry/key/head SELECT와 두 read-only eligibility RPC만
가능하다. publisher/operator RPC와 registry table INSERT/UPDATE/DELETE는 명시적으로
REVOKE된다. 기본 PUBLIC EXECUTE도 제거한다.

room pin은 release id/version/manifest SHA/channel의 exact tuple이다. staging pin을
production process가 열거나 commit할 수 없다. channel은 provision 직후부터
불변이고, 다른 pin field는 `invited + revision 0 + message 0 + session history 없음`
인 방에서만 현재 channel head로 바꿀 수 있다. open 후에는 pin이 불변이며 commit
RPC도 graph를 읽을 때 사용한 exact pin tuple을 CAS한다.

새 commit은 release → channel head → signing key를 `FOR SHARE`로 잠근 뒤에만 room을
변경한다. operator revoke/floor는 같은 registry lock order를 사용하므로 check와
mutation 사이에 끼어들지 못한다. 이미 commit된 client UUID replay는 release가
나중에 철회돼도 immutable 결과를 반환하지만 새 revision은 즉시
`CHAT_RELEASE_UNAVAILABLE`로 닫힌다.

## runtime loader

`VerifiedContentReleaseGraphLoader`는 exact room pin/channel registry row를 읽고
private storage key로 manifest와 graph를 가져온다. manifest object SHA/size,
canonical JSON, approval scope, Ed25519 allowlist/issuer/audience/channel/time,
graph SHA/size/identity/media를 다시 검증한 뒤 final eligibility RPC로 I/O 중
revocation/head/floor 변경을 재확인한다. 오류·timeout·parse drift·hash/signature
mismatch는 모두 `null`로 닫히며 unsigned fallback은 없다.

`VerifiedStoryGraphProvider`가 authored runtime에 이 loader를 주입한다. presentation
projector/UI/API 접합은 이번 배치에서 수정하지 않았고, 향후 동일 verified snapshot을
재사용해야 한다.

Supabase adapter는 `.download()`를 사용하지 않는다. 30초 signed URL을 메모리에만
보유하고 exact Supabase origin/signed-object path만 허용하며 redirect와 cache를
거절한다. 응답은 exact `Content-Length` preflight 뒤 stream으로 읽고 실제 byte
counter가 registry size 또는 2 MiB manifest/8 MiB graph 상한을 벗어나면 reader를
cancel하고 request를 abort한다. signed URL 생성과 object GET에는 4초 wall-clock
deadline이 있다. URL을 DB/로그/cache에 저장하지 않는다.

다만 custom Supabase Storage role의 hosted `createSignedUrl`은 아직 검증되지 않았고,
preview/production channel confidentiality도 별도 project/bucket 없이 완전 격리되지
않는다. 무엇보다 동일 process의 `service_role`이 BYPASSRLS이므로 이 adapter는
launch-ready immutability 경계가 아니다.

## 환경과 활성화 gate

```dotenv
STORY_CHAT_RUNTIME_ENABLED=0
STORY_CONTENT_RELEASE_BUCKET=content-releases
STORY_CONTENT_RELEASE_CHANNEL=staging
STORY_CONTENT_RELEASE_STORAGE_READER_KEY=
```

bucket은 정확히 `content-releases`, channel은 preview=`staging`,
production=`production`만 받는다. reader key가 없으면 loader는 구성되지 않는다.
reader key가 있어도 현재 runtime hard gate는 열리지 않는다.

공개 preview에는 같은 Supabase project의 service-role secret을 하나도 주입하지
않는다. GCP release harness는 preview revision의 secret refs를 `--clear-secrets`로
지우며 readiness도 preview에 service-role 값이 있으면 실패한다. 별도 preview
project 또는 RPC-only identity 전에는 preview DB write path도 열지 않는다.

## 로컬 검증

- Kindy contract/loader/config focused tests 및 TypeScript/lint.
- Mori contract/publisher actual-byte tests 및 TypeScript/lint.
- Kindy↔Mori shared contract/fixture/verifier byte parity.
- PostgreSQL 17 clean `0031 → 0032` apply.
- 실제 `SET ROLE service_role` publisher/operator mutation denied.
- publisher record / operator activate·revoke / runtime read·confirm allowed.
- `9007199254740992.0.0` registry/floor poison rejected.
- staging/production mismatch, room channel immutability, exact commit pin CAS.
- revoked release 신규 commit 거절·revision 불변·기존 UUID replay 허용.
- 두 session concurrent open에서 open row count=1.
- availability hook SHARE lock 동안 operator revoke가 `lock_timeout`으로 차단.

재현 SQL은 `supabase/tests/0032_content_release_runtime_registry.*.sql`에 있다.

## 남은 외부 gate

- `0032` 실제 Supabase migration 적용(현재 외부 read-only 확인은 PGRST205).
- 운영 Ed25519 public key 등록·회전·철회 절차.
- publisher/operator login membership과 감사 가능한 별도 CI identity.
- immutable GCS 또는 완전 RPC-only DB runtime identity P0 경계.
- 첫 signed staging/production release의 실제 upload→byte verify→attest→activate.
- Supabase custom Storage JWT를 유지한다면 공식 role membership 패턴과 hosted
  `createSignedUrl` 실제 smoke; 이것만으로 P0 immutability가 해결되지는 않는다.
- verified presentation snapshot을 room-list projector/UI/API에 연결.
- asset delivery의 동일 hash/byte bound와 ephemeral URL 경계.
