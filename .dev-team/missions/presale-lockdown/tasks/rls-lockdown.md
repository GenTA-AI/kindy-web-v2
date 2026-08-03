# rls-lockdown: authenticated 직접 쓰기 전면 회수 + 페이월 원본 차단 (0030 마이그레이션)
effort: xhigh
high_risk: 1

## Goal

브라우저에서 인증된 사용자가 PostgREST로 앱을 우회해 경제·성과·콘텐츠 데이터를 직접 조작하는
경로를 DB 레이어에서 전면 차단하는 마이그레이션 `0030`을 작성한다.

지금 뚫려 있는 것(전부 실제 확인됨):
- `purchases`를 본인이 UPDATE할 수 있어서 **카드 청구 없이 유료 구독을 켤 수 있다**
  (결제 라우트가 `purchases.status === 'paid'`면 청구를 건너뛴다).
- `game_sessions`를 DELETE해서 **무료체험 3회를 무한 리셋**할 수 있다(체험 카운터가 이 테이블의 행 수다).
- `credits`를 DELETE하고 아이를 추가하면 트리거가 3크레딧을 **재발급**한다(`ON CONFLICT DO NOTHING`만 있음).
- `library_videos`를 직접 SELECT하면 페이월을 건너뛰고 **재생 가능한 서명 URL과 스크립트**를 얻는다.

이 태스크가 끝나면 위 네 가지가 DB에서 거부된다.

**이 회수가 앱을 깨지 않는 근거(작업 전 반드시 재확인할 것)**: 브라우저 Supabase 클라이언트
(`src/lib/supabase-browser.ts`)는 인증 호출에만 쓰인다 — `src/app/auth/login/page.tsx`,
`src/app/onboarding/page.tsx`, `src/app/start/AttributionTracker.tsx` 세 곳뿐. 모든 데이터
읽기·쓰기는 service-role 클라이언트(`src/lib/supabase.ts`)를 쓰는 API 라우트를 거친다. service-role은
RLS를 우회하므로 정책 회수의 영향을 받지 않는다.

**작업 시작 시 이 전제를 직접 검증하라.** `src/lib/supabase-browser.ts`의 `createBrowserClient`
사용처를 전수 조사해서, `auth.*` 이외의 호출(`.from(...)`, `.rpc(...)`)이 하나라도 있으면
**정책을 회수하지 말고 그 목록을 핸드오프에 적어라.** 그것이 이 태스크의 가장 중요한 산출물이 된다.

## Scope
- `supabase/migrations/0030_authenticated_write_lockdown.sql` NEW — 이 미션의 유일한 마이그레이션
- `supabase/manual/README.md` 적용 절차 안내가 필요하면 여기에만 추가

## Constraints
- **기존 마이그레이션 파일을 절대 수정하지 마라.** `0006`/`0014`/`0016`은 그대로 두고, `0030`에서
  `drop policy if exists`로 덮는다. 이력이 진실이다.
- `supabase db push`·`supabase link`를 실행하지 마라. 파일 작성까지가 이 태스크다. 적용은 사람 게이트.
- `0024_hero_world_state.sql`~`0029_hero_metrics.sql`의 정책 컨벤션을 **읽고 그대로 따라라**
  (owner-scoped SELECT만 부여, DML 정책 없음). 새 패턴 발명은 반려 사유다.
- 모든 문장은 **멱등**이어야 한다(`drop policy if exists` → `create policy`). 재적용해도 안전해야 한다.
- `supabase/manual/0099_rls_disable_rollback.sql`을 `migrations/`로 옮기거나 참조하지 마라.
- RLS 자체를 비활성화하지 마라. 정책만 좁힌다.
- service-role 접근을 막지 마라 — 앱 전체가 그걸로 동작한다.
- 프로드 `pgcrypto`는 `extensions` 스키마다. 이 태스크에서 쓸 일은 없겠지만 필요하면 한정해라.

## Deliverables

`0030` 마이그레이션이 다음을 수행한다.

1. **authenticated INSERT/UPDATE/DELETE 정책 전면 회수** — 아래 11개 테이블의 DML 정책을 drop한다.
   SELECT 정책은 owner-scoped로 유지한다(앱이 안 쓰더라도 회귀 위험 없이 남길 수 있다).
   `videos` · `credits` · `purchases` · `view_events` · `emoji_reactions` · `quiz_results` ·
   `word_profiles` · `syllabus_enrollments` · `lesson_progress` · `game_sessions` · `game_rounds`
   (정확한 정책 이름은 `0006_rls_policies.sql`·`0014_syllabus.sql`·`0016_game_events.sql`에서 확인하라.)

2. **`children`의 직접 INSERT 회수** — `children_insert_own`을 drop한다. 아이 생성은 동의 증적을
   함께 남기는 `/api/children`만 통해야 한다(PIPA 증적 무결성). SELECT/UPDATE/DELETE 정책의
   처리는 판단해서 정하고, **결정과 이유를 마이그레이션 주석과 핸드오프에 남겨라.**

3. **페이월 원본 차단** — `library_videos`의 `library_videos_select_published` 정책을 drop해서
   원본 테이블을 service-role 전용으로 만든다. `syllabuses`·`syllabus_lessons`의 카탈로그 SELECT도
   같은 기준으로 검토해 처리한다(`0014_syllabus.sql` 참조).
   - 브라우저가 카탈로그 메타데이터를 직접 읽는 곳이 **없다는 것을 먼저 확인**하라. 있으면 회수하지
     말고 핸드오프에 적어라.

4. **`waitlist`의 anon INSERT 회수** — `0007_waitlist_invite.sql`의 `waitlist_insert_own`
   (`to anon, authenticated with check (true)`)을 drop한다. 대기자 등록은 `/api/waitlist`만 통한다.

5. **함수 EXECUTE 회수** — `can_purchase`·`consume_credit`의 PUBLIC EXECUTE를 회수한다
   (`0022_revoke_public_function_execute.sql`가 다른 두 함수에 쓴 패턴을 그대로 따라라).
   시그니처를 정확히 맞춰야 한다 — `0004_credits_purchases.sql`과 `0017_subscriptions.sql`에서 확인.

6. **파일 상단 주석**에 다음을 적어라: 무엇을 왜 회수하는지, 앱이 깨지지 않는 근거(위 Goal의 전제),
   그리고 롤백 방법(이 파일의 drop을 되돌리는 SQL 또는 이전 마이그레이션 재적용 절차).

## Validation

```bash
npm run lint
npx next typegen && npx tsc --noEmit
npm test
npm run build
```

앱 코드를 한 줄도 바꾸지 않으므로 위 검증은 **전부 통과해야 정상**이다. 하나라도 깨지면
정책 회수 전제가 틀렸다는 뜻이므로 즉시 멈추고 핸드오프에 보고하라.

추가로 SQL 문법을 다음으로 자체 점검하라(설치돼 있을 때만, 없으면 생략하고 그 사실을 적어라):

```bash
command -v psql >/dev/null && echo "psql available" || echo "psql absent - skipped syntax check"
```

## Handoff requirements

최종 메시지 끝에 다음을 포함하라: summary, files_changed, validation(명령어 + **실제 출력**),
risks, handoff_note.

`handoff_note`에는 반드시 아래를 담아라.
- 브라우저 Supabase 클라이언트 전수 조사 결과 — `.from()`/`.rpc()` 호출이 있었는가, 있었다면 어디.
- `children`·`syllabuses` 정책을 어떻게 처리했고 왜 그렇게 정했는가.
- 이 마이그레이션 적용 후 **사람이 실행해야 할 검증 절차**(리드가 대행할 것이므로 구체적으로).
- 회수했는데 나중에 필요해질 수 있는 정책이 있다면 그 목록과 되살리는 방법.
