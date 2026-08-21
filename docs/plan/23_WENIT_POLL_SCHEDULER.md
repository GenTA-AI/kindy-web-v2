# 23. Wenit 분산 poll scheduler

작성일: 2026-08-21
상태: migration·adapter 구현 및 로컬 PG17 검증 완료, hosted DB 미적용, runtime 비활성
정본 migration: `supabase/migrations/0034_wenit_poll_scheduler.sql`

## 목적

Wenit의 API key 단위 poll 제한을 여러 Cloud Run instance에서 함께 지킨다. 브라우저나 process-local limiter는 사용하지 않는다. PostgreSQL이 DB clock과 scope별 transaction advisory lock으로 예약 순서를 결정하고, application process가 예약 시각까지 기다린다. DB transaction 안에서는 sleep하지 않는다.

`credential_scope`는 API key나 key hash가 아닌 운영자가 정한 opaque credential identity/key-version label이다. 예시는 `wenit-primary-v1`이다.

- 동일 raw Wenit key를 공유하는 preview·production·모든 process는 반드시 동일 scope를 사용한다.
- key가 실제로 교체되면 새 key-version scope를 사용한다.
- scope가 같으면 실제 key도 같아야 한다. 환경 이름을 scope에 넣어 같은 key의 quota를 쪼개면 안 된다.
- DB·RPC에는 raw key, key hash, prompt, Wenit task id, child/user/network 식별자를 전달하거나 저장하지 않는다.

## 예약 계약

`reserve_wenit_poll_start`와 `claim_wenit_poll_start`는 service-role만 실행할 수 있는 `SECURITY DEFINER` RPC다. 예약은 queue admission일 뿐이며 실제 GET 허가는 두 번째 claim이 결정한다.

1. scope advisory transaction lock을 잡은 뒤 DB `clock_timestamp()`를 읽는다.
2. 동일 reservation UUID의 15분 receipt가 있으면 exact slot을 재생한다.
3. `max(DB now, earliest, scope cursor)`가 deadline 이상이면 cursor를 바꾸지 않고 거절한다.
4. 성공하면 1,100ms 간격의 초기 slot과 receipt를 한 transaction에서 기록한다.
5. adapter는 process에서 초기 slot까지 기다린 뒤 `claim_wenit_poll_start`를 호출한다.
6. claim RPC는 DB clock과 별도 actual-start cursor를 다시 잠근다. 이전 process가 늦게 깨어났다면 한 요청만 현재 시각을 claim하고 나머지에는 새 미래 시각을 반환한다. adapter는 DB 밖에서 다시 기다리고 claim을 반복한다.
7. actual claim cursor는 1,350ms 간격이고 adapter는 claim RPC 왕복이 250ms를 넘으면 poll을 폐기한다. 따라서 `acquire` 완료 시점은 전역으로 최소 1,100ms 간격을 유지한다.

RPC 오류, malformed row, timestamp 불일치, timer 실패, deadline 초과는 모두 `unavailable|deadline`으로 닫힌다. 예약 RPC 응답이 네트워크에서 유실되면 DB slot 한 개가 사용되지 않을 수 있지만 추가 poll은 발생하지 않는다. 현재 adapter는 불명확한 결과를 자동 재시도하지 않는다.

## 보관·권한

- scope cursor와 reservation receipt TTL은 15분이다.
- `cleanup_wenit_poll_scheduler(batch_size)`는 테이블별 요청 batch(최대 10,000행)만 `FOR UPDATE SKIP LOCKED`로 삭제한다.
- scope는 모든 receipt가 사라진 뒤에만 삭제하므로 cascade로 bounded cleanup을 우회하지 않는다.
- 두 테이블은 RLS를 켜고 `public`, `anon`, `authenticated`, `service_role`의 직접 권한을 모두 철회한다.
- service-role에는 예약/cleanup RPC execute만 부여한다.

운영 cleanup scheduler는 이 migration이 자동 등록하지 않는다. hosted activation 전 별도 운영 job을 만들고, 반환 delete count가 batch보다 작아질 때까지 bounded 반복과 실패 경보를 검증해야 한다.

## 검증과 남은 activation gate

`supabase/tests/0034_wenit_poll_scheduler.*.sql`로 Supabase PostgreSQL 17.6에서 다음을 검증했다.

- clean migration apply
- browser/service-role direct table 접근 거절 및 service-role RPC 권한
- empty `search_path`, RLS, 최소수집 column contract
- 같은 UUID exact reservation/claim replay, deadline 거절 시 cursor 불변
- 8개 독립 DB session의 동일 scope 동시 예약이 모두 고유한 1,100ms queue slot을 획득
- 두 process가 모두 늦게 깨어난 adversarial race에서 하나만 actual start를 claim하고 다른 하나는 최소 1,350ms 뒤로 이동
- bounded cleanup

이 migration을 hosted Supabase에 적용하거나 runtime을 켜지는 않았다. 외부 cohort 전에는 다음이 모두 필요하다.

- preview와 production의 DB/runtime identity 분리
- 0031–0034 승인 적용 및 hosted readback
- 동일 raw key를 쓰는 모든 service에 동일 `WENIT_SAFEGUARD_CREDENTIAL_SCOPE` 주입
- cleanup job과 scheduler 장애 경보
- input/output 양쪽 Wenit gate 통합 eval

현재 `WenitPollScheduler.acquire`에는 `AbortSignal`이 없다. 취소 중 예약 대기는 최대 15초 계속될 수 있지만, 이후 fetch는 이미 취소된 signal로 fail-closed되어 vendor poll을 추가 발생시키지 않는다. 이는 안전 우회가 아니라 bounded 자원·UX 문제이므로 runtime 활성화 전 P2로 개선한다.
