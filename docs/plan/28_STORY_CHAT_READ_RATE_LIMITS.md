# Story Chat GET 비용·DoS 경계

상태: 로컬 migration·서버 adapter·browser surface 구현, hosted DB 미적용, runtime hard-disabled

## 목적

서버 렌더링 채팅 API는 승인된 release를 검증하고 짧은 만료 URL을 서명한다.
따라서 인증된 보호자가 `GET /api/chat/rooms` 또는 messages GET을 반복해도
DB·release loader·object signer 비용이 무제한 늘어나지 않아야 한다.

`0036_world_chat_read_rate_limits.sql`은 0033의 mutation budget과 완전히
분리된 60초 fixed-window read budget을 둔다.

- 보호자 전체 read: 90회/60초
- 아이별 `rooms_read`: 12회/60초
- 아이별 `messages_read`: 60회/60초

read 요청이 mutation allowance를 소비하거나 mutation 제한을 느슨하게 만들지
않는다. parent-global 축은 좁은 child/action 축에서 거절되는 요청도 attempt로
계수한다.

## 데이터 최소화와 권한

counter에는 인증된 `parent_id`, 소유한 `child_id`, 두 개의 고정 action,
window timestamp와 정수 count만 저장한다. 아이 입력, 대화 내용, request body,
IP, user-agent, device ID, fingerprint, 임의 JSON은 저장하지 않는다.

consume RPC는 `SECURITY DEFINER`와 빈 `search_path`를 사용하고 매 호출마다
다음을 다시 확인한다.

1. `children.id = child_id AND parent_id = 인증 subject`
2. 같은 parent/child의 철회되지 않은 `child_profile_activity` 동의

확인한 child와 consent 행은 transaction 동안 share-lock한다. RPC와 bounded
cleanup만 `service_role`이 실행할 수 있고, anon/authenticated/service role 모두
counter table을 직접 읽거나 쓰지 못한다. cleanup scheduler는 migration이
자동 등록하지 않는다. hosted activation 때 별도 operator job과 실패 알림을
구성해야 한다.

## 서버 실행 순서

rooms/messages browser surface는 아래 순서를 지킨다.

1. distributed read consume + ownership/active-consent 재확인
2. server-only chat reference read
3. exact release eligibility/signature 검증
4. 필요한 private asset URL 서명과 strict render projection
5. 응답 직전 ownership/active-consent final recheck
6. rendered DTO 반환

limiter 거절은 release load와 asset sign 이전에 발생한다. GET Route Handler는
공통 error boundary를 통해 generic `429`와 정수 `Retry-After`를 반환한다.
storage failure는 fail-closed `503`, ownership/consent race는 기존 bounded
`404`/`403` class로 반환한다.

room query와 projection/response는 모두 최대 20개로 제한한다. surface의 두
번째 hard bound는 다른 repository 구현이나 fixture가 실수로 더 많은 row를
돌려도 release 검증·서명 fan-out이 20을 넘지 않게 한다.

## release snapshot cache를 두지 않는 이유

현재는 cross-request cache뿐 아니라 한 rooms request 안의 동일 release-pin
coalescing도 하지 않는다. loader의 각 호출은 registry eligibility와 서명을
확인하는 보안 경계다. 첫 projection 이후 release가 철회되면 같은 request의
두 번째 room이 이미 얻은 snapshot을 재사용하는 순간 eligibility 재확인을
건너뛸 수 있다. child consent final recheck는 release 철회를 대신하지 못한다.

향후 coalescing은 immutable eligibility generation/token을 snapshot에 묶고,
각 asset sign 직전에 같은 generation이 여전히 eligible한지 재확인하는 설계와
revocation race test가 생긴 뒤에만 검토한다.

## 활성화 전 검증

- 독립 preview Supabase에 `0001`–`0036` clean apply
- PG17 harness로 순차·동시 12/60/90 상한, window reset, ownership/consent
  race, RPC/table privilege, bounded cleanup을 검증
- 실제 preview 부하에서 429 비율, loader/sign 호출 수, cleanup 지연 경보 확인
- runtime immutable-boundary kill switch는 별도 승인 전 계속 `false`

이 변경은 hosted DB, GCP secret, Cloud Run traffic, runtime flag를 수정하지 않는다.
