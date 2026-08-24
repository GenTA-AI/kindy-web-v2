# 25. Story Chat server-rendered browser surface

작성일: 2026-08-24
상태: 로컬 구현·검증 완료, hosted migration 미적용, runtime hard-disabled

## 결론

`/api/chat` route는 DB reference row나 AI action plan을 브라우저에
직렬화하지 않는다. 모든 성공 응답은 다음 단일 server-only 경계를
통과한다.

```text
Supabase auth
  → child ownership
  → active consent
  → room/session + DB rate limit
  → authored CAS commit or bounded read
  → exact room ContentRelease pin
  → registry/head/key + Ed25519 + object bytes verification
  → fixed reviewed child alias
  → exact approved asset signed URL
  → final child ownership + active consent recheck
  → strict rendered room/message DTO
```

서명·해시·storage key·session/turn 원장·전체 graph·quiz 정답·game
solution·AI provider receipt는 브라우저로 복사하지 않는다. 로더, signer,
projection 중 하나라도 실패하면 raw DTO 폴백 없이 `503`으로 닫힌다.

## 구현 경계

- `src/lib/story-chat/server-browser-surface.ts`
  - 유일 production composition root.
  - Supabase backend identity, repository, consent, limiter, verified loader,
    exact-object signer를 한 곳에서 조립한다.
- `/api/chat/**`
  - Supabase public auth 구성이 없으면 로컬 preview 가상 보호자로
    폴백하지 않고 `401`로 닫히며, 서버 credential도 별도로 필수다.
- `src/lib/story-chat/browser-surface.ts`
  - rooms/messages/session/authored-turn을 최종 rendered DTO로 변환한다.
  - turn은 DB CAS commit과 persisted-row 재조회 후에만 렌더링한다.
- `src/lib/story-chat/render-projection.ts`
  - verified snapshot의 표시 정보만 프로젝션한다.
- `src/lib/releases/private-release-asset-signer.ts`
  - configured Supabase origin, `content-releases` bucket, exact approved
    `storageKey`, 15분 이하 TTL, 단일 token query를 모두 묶는다.

## 아이 이름 정책

이 파일럿에서는 DB의 아이 이름을 읽지 않고 코드에 고정된 검수 alias
`"친구"`만 사용한다. `{{child_name}}` 치환과 protagonist display name에
같은 유한 상수를 사용하므로 moderation 후 실명·연락처·유해 문구가
삽입되는 경로를 닫는다. 실명 개인화는 별도 안전검사·동의·불변
approved-name 계약 전에는 켜지 않는다.

## DB browser bypass 차단

`0035_story_chat_browser_boundary.sql`은 0031의 authenticated owner SELECT
policy/grant를 모두 제거한다. 로그인한 보호자도 Supabase REST로
`world_chat_rooms|sessions|turns|messages|events`를 직접 읽을 수 없다.
이로써 route의 consent/kill-switch/release projection을 우회하는 경로를 닫는다.
`service_role`도 이 다섯 table은 SELECT만 가능하고, session/turn 변경은
권한·동의·CAS를 재검사하는 SECURITY DEFINER RPC로만 수행한다.
렌더링과 asset URL 서명이 끝난 뒤에도 소유권·active consent를 한 번 더
확인하고, 철회가 관측되면 완성된 응답 전체를 폐기한다.

PG17 하네스는 anon/authenticated direct SELECT=`42501`, backend SELECT
가능, authenticated/public policy 부재를 검증한다.

## AI/free-text 경계

`SafeNarrativeTurn` outcome/action plan은 server-internal이며 browser projection export를
제거했다. 향후에도 AI plan을 브라우저에 보내지 않고, 그 plan을
verified graph에 재검증한 뒤 atomic commit하고 이 문서의 rendered message
DTO만 반환한다. `child_free_text_ai` 동의·DLP/NER·AI 전용 limiter·
in-flight idempotency·abort/CAS 하네스 전에는 자유입력을 계속 끄는다.

## 현재 외부 상태

- hosted Supabase migration은 여전히 `0029`에서 멈춰 있다.
- `0030`–`0036`는 로컬 PG17에서만 clean apply·권한 검증한다. 0036의
  GET 비용 경계는 `28_STORY_CHAT_READ_RATE_LIMITS.md`를 따른다.
- preview/production Supabase project는 여전히 같다.
- `STORY_CHAT_RUNTIME_IMMUTABLE_BOUNDARY_READY=false`이므로 route는 404로 닫히고,
  hosted DB/GCP/traffic에 변경은 없다.

## 다음 gate

1. 독립 preview Supabase project 생성 후 `0001`–`0036` 적용.
2. immutable GCS 또는 RPC-only runtime identity 경계 구축.
3. 첫 staging ContentRelease upload→byte verify→attest→activate.
4. authenticated browser route smoke와 direct PostgREST denial 재검증.
5. 이 gate 전에는 runtime flag, free-text, 아동 cohort를 활성화하지 않음.
