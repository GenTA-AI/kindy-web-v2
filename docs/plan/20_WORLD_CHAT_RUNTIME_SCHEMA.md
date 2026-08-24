# 20. 보호된 World Chat Runtime 스키마 v1

작성일: 2026-08-21
상태: Authored Core 파일럿 구현 계약
정본 migration: `supabase/migrations/0031_world_chat_runtime.sql`

## 범위

이 스키마는 검증된 `ContentRelease v1`을 따라가는 보호된 웹 파일럿의 최소 데이터 경계다. Mori 제작 테이블을 복제하거나 직접 참조하지 않는다.

- `world_chat_rooms`: 아이·배포 채널별 세계관 입구, immutable release/channel pin, 현재 node, revision.
- `world_chat_sessions`: 방에 들어와 활동한 방문 단위. 한 방에 열린 세션은 하나다.
- `world_chat_turns`: 저작된 선택 전이와 idempotency/CAS 결과.
- `world_chat_messages`: 화면이 release에서 해석할 authored content ID와 선택 부모 node context의 순서열.
- `world_chat_events`: 영상 완료·세션 종료 등 최소 authored runtime 이벤트.

방 상태는 제품 UI와 동일하게 `invited | active | awaiting_child | cinematic_ready | generating_art | paused | chapter_complete | locked`를 사용한다. 선택/빠른 답장 turn은 `active` 또는 `awaiting_child`에서만 커밋할 수 있다. 초대 수락, 영상 완료, 생성 완료, 일시정지·종료 상태 전이는 각 전용 서버 endpoint가 담당한다.

세션 열기 상태 규칙은 더 좁게 고정한다.

| 시작 상태 | `POST /api/chat/rooms/:roomId/sessions` 결과 |
|---|---|
| `invited` | 첫 입장 세션을 만들고 `active`로 전환 |
| `active` | 상태를 유지하며 시작 또는 열린 세션 재개 |
| `awaiting_child` | 선택 경계를 유지하며 시작 또는 열린 세션 재개 |
| `paused` | 동일 authored cursor에서 재개하고 `active`로 전환 |
| 그 외 | `CHAT_ROOM_NOT_OPENABLE`로 거부 |

`experience_id`, `release_id`, `release_version`, `release_channel`, `release_manifest_sha256`가 제작 원본과의 경계다. `release_channel`은 서버가 provision하는 `staging|production` 불변값이며 `(child_id, experience_id, release_channel)`당 방 하나만 허용해 shared Supabase에서도 두 환경이 충돌하지 않는다. 기존 `story_seeds`, `episodes`, `episode_nodes`는 Mori/콘텐츠 제작 원장이고, `world_states`는 child-global HERO 스냅샷이므로 채팅 테이블에서 FK로 연결하거나 재사용하지 않는다.

## 데이터 소유권과 삭제

```text
children
  └─ world_chat_rooms
       ├─ world_chat_sessions
       ├─ world_chat_turns
       ├─ world_chat_messages
       └─ world_chat_events
```

모든 FK는 아이 또는 방 삭제에 `ON DELETE CASCADE`로 이어진다. message/event의 `(room_id, session_id, turn_id)` FK는 다른 방이나 세션의 turn ID를 섞을 수 없게 한다. 0035 이후 브라우저 role은 chat 테이블을 직접 `SELECT`할 수 없고, 보호자는 consent-gated rendered API만 사용한다. 작성과 raw read는 server-only 경로만 허용한다.

기존 `parent_consents`는 법적 증적이므로 아이 삭제 때 `child_id = null`로 남는 0018의 정책을 유지한다. 이 과거 행은 child ID가 일치하지 않으므로 활성 동의가 아니다.

## Authored Core 최소수집

첫 출시는 자유입력을 저장하지 않는다.

- message에는 `authored_content_id`와 nullable `authored_context_id`만 있고 `text`, `body`, `prompt`, 임의 `payload`가 없다. 첫 `child_choice`의 context는 option을 소유한 `from_node_id`이며 나머지는 null이다.
- turn에는 authored input/node ID와 canonical request hash만 있다.
- event에는 moderation reason/evidence나 임의 JSON payload가 없다.
- media URL도 저장하지 않는다. pin된 release의 storage key를 서버가 검증하고 signed URL로 바꾼다.

따라서 선택 라벨과 캐릭터 문장은 immutable release에서 렌더한다. 향후 Strict Free Text를 켜더라도 이 테이블에 raw text 컬럼을 덧붙이지 않는다. 별도 법무 승인, 암호화, 짧은 retention, 삭제 SLA가 확정된 별도 저장소 migration을 사용한다.

## 별도 부모 동의

`child_free_text_ai`는 `child_profile_activity`와 독립된 scope다. 현재 migration은 scope와 `revoked_at` evidence만 마련하며 자유입력을 활성화하지 않는다.

활성 판정 조건은 모두 충족해야 한다.

```sql
parent_id = :authenticated_parent_id
and child_id = :owned_child_id
and consent_scope = 'child_free_text_ai'
and revoked_at is null
```

동의 확인·소유권 확인·global kill switch는 API/service가 수행한다. Authored Core의 선택/빠른 답장은 `child_profile_activity` 활성 동의를 요구하지만 `child_free_text_ai` scope 없이 동작한다.

## Atomic authored turn 계약

브라우저는 DB에 직접 쓰지 않는다. 서버는 graph allowlist와 소유권을 확인한 뒤 `commit_world_chat_authored_turn` RPC를 service role로 호출한다.

1. room row를 잠그고 `p_parent_id`의 자녀 소유권과 활성 `child_profile_activity` 동의를 다시 확인·잠근다.
2. 같은 `(room_id, client_turn_id)`가 있으면 request hash와 전이 필드가 같은 경우 기존 결과를 반환한다.
3. 같은 idempotency key의 다른 요청은 `CHAT_CLIENT_TURN_CONFLICT`로 거부한다.
4. `expected_revision`, `current_node_id`, 쓰기 가능한 room 상태를 CAS 검사하고 해당 session row를 잠근다.
5. 첫 message가 정확히 `child/child_choice/p_authored_input_id`이고 뒤에 child actor가 없는지 확인한다.
6. turn, reference-only messages, `turn_committed` event, room cursor/revision/target status를 한 transaction으로 기록한다.

입력 배열:

- `message_actors`: `child | character | system`
- `message_kinds`: `character_text | child_choice | child_prompt | quick_reply | choice | cinematic | generated_image | quiz | minigame | system_transition | ending`
- `message_content_ids`: 같은 순서의 ExperienceGraph node/option ID

RPC는 보호자 ID `p_parent_id`와 resolver가 확정한 `p_target_status`(`awaiting_child | chapter_complete`)도 받는다. 첫 `child_choice` 행의 `authored_context_id`는 RPC가 `p_from_node_id`로 기록한다.

actor-kind 조합은 고정한다. 아이가 누른 authored option만 `child/child_choice`, 캐릭터 대사 node만 `character/character_text`, 나머지 prompt·선택 카드·미디어·퀴즈·전환·ending descriptor는 `system`이다. turn의 `source_kind`도 `choice | quick_reply`만 허용한다.

RPC 결과:

```text
turn_id
committed_revision
last_message_sequence
committed_node_id
idempotent_replay
```

오류 계약:

| message | SQLSTATE | 의미 |
|---|---|---|
| `CHAT_INVALID_TURN_REQUEST` | `22023` | 잘못된 enum, ID, hash, message 배열 |
| `CHAT_ROOM_NOT_FOUND` | `P0002` | 방 없음 |
| `CHAT_CHILD_ACCESS_DENIED` | `P0002` | RPC 재검증에서 보호자-아이 소유권 불일치 |
| `CHAT_CONSENT_REQUIRED` | `42501` | RPC 재검증에서 활성 authored-core 동의 없음 |
| `CHAT_SESSION_NOT_OPEN` | `P0002` | 해당 방의 열린 세션 없음 |
| `CHAT_CLIENT_TURN_CONFLICT` | `23505` | idempotency key 재사용·요청 불일치 |
| `CHAT_STALE_REVISION` | `40001` | 다른 turn이 먼저 커밋됨 |
| `CHAT_CURRENT_NODE_MISMATCH` | `40001` | 현재 graph node가 요청과 다름 |
| `CHAT_ROOM_NOT_ACTIVE` | `55000` | 완료·보관된 방에 쓰기 시도 |

RPC는 bearer/session auth나 ExperienceGraph 전이의 진위를 판단하지 않는다. service-role만 실행할 수 있으며 route/service가 인증, 아이 소유권, release signature/pin, allowed transition, consent를 먼저 검증한다. RPC도 전달받은 보호자 ID로 소유권·활성 동의를 transaction 안에서 재확인해 race와 우회 호출을 막는다.

## Atomic session open/resume 계약

브라우저는 서버가 미리 provision한 방만 열 수 있다. 방 생성·release repin API는 제공하지 않는다. `POST /api/chat/rooms/:roomId/sessions`는 1 KiB 이하의 strict JSON `{ child_id, client_session_id }`만 받고, 쿠키 요청은 same-origin `Origin`, 모바일 요청은 이후 Supabase가 검증할 Bearer credential을 요구한다.

route/service는 인증 → 아이 소유권 → 활성 `child_profile_activity` 동의 → 방 소유·서버 배포 채널·상태 순으로 확인한다. 클라이언트 본문에는 채널이 없고 서버의 exact `STORY_CONTENT_RELEASE_CHANNEL`만 open/commit RPC로 전달한다. 두 RPC는 room row를 직렬화한 뒤 소유권과 동의 evidence를 다시 확인하고 잠그며, room pin의 채널과 서버 채널이 다르면 mutation 전에 `CHAT_RELEASE_UNAVAILABLE`로 닫는다. 따라서 동의 철회·자녀 소유권 변경·채널 혼선·동시 open과 mutation이 원자 경계 밖에서 race하지 않는다.

현재 런타임은 동일 Cloud Run process의 Supabase service-role/Storage RLS 우회 위험이 분리될 때까지 컴파일 상수로 hard-disabled다. immutable GCS identity 또는 완전 RPC-only DB runtime identity를 독립 검증한 뒤에만 이 P0 상수를 열 수 있으며, 그 이후에도 `STORY_CHAT_RUNTIME_ENABLED=1`과 `KINDY_LAUNCH_MODE=protected_chat_pilot` exact match를 함께 요구한다. open preview, production presale, 누락·오타 launch mode는 계속 route의 storage/auth/body 작업 전에 fail-closed해야 한다.

- `client_session_id`는 임의 본문 없는 client-generated UUID다. 같은 UUID의 열린 세션 재전송은 동일 결과와 `idempotent_replay=true`를 반환한다.
- 다른 UUID가 동시에 도착해도 방당 열린 세션은 하나만 생성된다. 후발 요청은 기존 세션과 그 canonical `client_session_id`를 받아 채택하며 `resumed_existing=true`가 된다.
- 이미 종료된 세션 UUID 재사용은 `CHAT_CLIENT_SESSION_CONFLICT`로 거부한다.
- session open은 authored turn revision을 증가시키지 않는다. 새 방문 또는 상태 전환 때만 room `updated_at`을 갱신한다.
- 0031의 5-인자 `is_world_chat_release_pin_available(..., release_channel)`는 기본 `false`다. signed registry migration이 exact channel의 verified·activated·non-revoked pin 검사로 교체하기 전에는 모든 open과 신규 turn commit이 `CHAT_RELEASE_UNAVAILABLE`로 fail-closed한다. commit RPC는 graph 검증에 사용한 room snapshot의 release id/version/manifest hash/channel을 모두 room lock 뒤 CAS하고, turn request hash에도 이 pin을 포함한다. 따라서 graph A 검증과 commit 사이에 room이 B로 repin되거나 기존 UUID가 다른 pin에서 재생되는 TOCTOU도 실패한다. 이미 커밋된 same-pin exact UUID replay는 registry revoke 뒤에도 읽을 수 있다. unsigned/demo 우회는 없다.
- RPC는 `session_started` reference-only event 외에는 message/turn을 만들지 않으며 raw text, body, prompt, 기기 ID, 임의 payload를 받거나 저장하지 않는다.

세션 close endpoint는 이 최소 입장 경로에서 보류한다. 이유는 탭 종료를 곧바로 학습 세션 종료로 간주하면 모바일 백그라운드·네트워크 단절에서 열린 세션이 잘못 닫히기 때문이다. 후속 작업에서 명시적 나가기, idle expiry, 앱 resume 정책과 `session_exited | session_completed` 의미를 함께 확정한 뒤 별도 원자 RPC로 추가한다. 그 전까지 새 client UUID도 열린 canonical 세션을 재개하므로 중복 세션을 만들지 않는다.
