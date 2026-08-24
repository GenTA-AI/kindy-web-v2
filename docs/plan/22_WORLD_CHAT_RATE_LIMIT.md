# 22. World Chat 분산 Rate Limit P1

작성일: 2026-08-21
상태: 외부 cohort 전 필수 서버 경계
정본 migration: `supabase/migrations/0033_world_chat_rate_limits.sql`

현재 public preview와 production이 같은 Supabase project 및 BYPASSRLS service-role identity를 공유하므로 chat runtime 자체는 compile-time gate로 꺼져 있다. 별도 preview project 또는 완전 RPC-only runtime identity 경계를 독립 검증하기 전까지 외부 activation은 0이며, 이 limiter가 존재한다는 이유로 runtime을 켜면 안 된다.

## 적용 위치

두 POST 경로가 동일한 PostgreSQL limiter를 사용한다.

```text
JSON / same-origin-or-Bearer boundary
  → Supabase auth
  → child ownership
  → active child_profile_activity consent
  → owned room + 기본 상태 확인
  → consume_world_chat_rate_limit
  → signed release/graph 및 mutation RPC
```

limiter DB 장애, malformed RPC 결과, timeout은 허용으로 우회하지 않고 `503`으로 닫는다. 한도를 넘으면 축·현재 count·보호자/아이/방 정보를 노출하지 않는 generic `429`와 정수 `Retry-After`를 반환한다. 모든 응답은 `Cache-Control: private, no-store`다.

## 고정 정책

창과 한도는 브라우저 입력이나 환경변수로 받지 않고 migration 함수 안의 서버 상수로 고정한다.

| 축 | 60초 상한 | 계산 방식 |
|---|---:|---|
| 보호자 전체 | 45 | 모든 인증·소유권·동의 통과 mutation 시도 |
| 방 `session_open` | 8 | 고유 `client_session_id` |
| 방 `authored_turn` | 30 | 고유 `client_turn_id` |

보호자 전체 축은 같은 UUID 반복도 transport abuse 시도로 센다. 방·행동 축은 15분 UUID receipt를 확인하여 재전송과 동시 retry를 한 번만 센다. 이미 커밋된 authored turn은 서비스가 limiter보다 먼저 찾아 즉시 replay하므로 보호자 축도 다시 사용하지 않는다.

한 transaction이 room → child → consent를 잠근 뒤 parent advisory key → room/action advisory key → counter row 순으로 직렬화한다. 시간은 advisory lock 획득 후 DB `clock_timestamp()`를 한 번 캡처한다. 창 만료와 consume가 동시에 일어나도 하나의 transaction만 reset/increment할 수 있다.

## 최소수집과 권한

저장하는 값은 다음뿐이다.

- Supabase parent subject
- owned room UUID
- `session_open | authored_turn`
- client-generated idempotency UUID
- window/expiry timestamp와 정수 count

아이 입력, JSON body, prompt, hash, IP, user-agent, device ID, fingerprint, cookie, access token은 저장하지 않는다.

세 테이블은 RLS를 켜고 `public`, `anon`, `authenticated`의 모든 권한을 철회한다. `service_role`도 직접 DML 권한 없이 읽기만 가능하며, mutation은 execute 권한이 제한된 SECURITY DEFINER RPC만 수행한다.

## 정리 전략

- 60초 counter는 만료 후 삭제 가능하다.
- UUID receipt는 15분 후 삭제 가능하다.
- `cleanup_world_chat_rate_limits(batch_size)`는 테이블별 최대 1,000행을 `FOR UPDATE SKIP LOCKED`로 지우며 최대 10,000행까지만 허용한다.
- 외부 cohort 전 운영 scheduler가 이 RPC를 주기적으로 호출하도록 별도 승인·배포한다. 한 번의 대량 delete 대신 반환 count가 batch보다 작아질 때까지 bounded 호출한다.

현재 작업은 외부 Supabase scheduler나 GCP를 변경하지 않는다.

## 남은 방어층

이 limiter는 인증된 world-chat mutation 비용을 제어한다. 로그인 전 대역폭·credential stuffing·다중 parent 계정 공격은 다루지 않는다. 외부 cohort 전 Cloud Armor/API gateway 계층의 coarse IP/ASN 방어와 경보를 별도 적용하되, 아이/기기 fingerprint를 애플리케이션 DB에 복제하지 않는다.
