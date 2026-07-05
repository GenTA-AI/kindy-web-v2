# t3-worldstate-reducer: E13-2 world_state 리듀서 + session-config + 골든테스트 12 + CI 확장
effort: xhigh

## Goal
world_state 이벤트 소싱의 코드 레이어를 만든다: ① 리듀서(`world-state.ts`) — game_rounds 이벤트 스트림을 폴드해 world_states 스냅샷(v1 스키마)을 만드는 순수 함수 + `world_processed_at` 멱등 프로젝터 골격 ② 세션 설정(`session-config.ts`) — `resolveSessionConfig(birthYm, defaultsRows, holdoutArm, moodState?) → {age_band, defaults, holdout_arm, mood_preset}` ③ **골든테스트 12본**(연속성 10 + 연령 기본값 3밴드 + CP 2택 서브셋) ④ CI에 test 잡 확장. 절차·시나리오 정본: `docs/plan/04_R0_EXECUTION_PLAN.md` Task 2.2 + `docs/plan/02_SCHEMA_RECONCILIATION.md` §10(테스트 시나리오·배선)·§3(0024 코멘트의 리듀서 매핑 원문·world_state v1 스키마).

## Scope
- `NEW: src/lib/hero/world-state.ts`
- `NEW: src/lib/hero/world-state.golden.test.ts`
- `NEW: src/lib/hero/session-config.ts`
- `NEW: src/lib/hero/session-config.golden.test.ts`
- `NEW: src/lib/hero/cp-variants.golden.test.ts`
- `NEW: src/lib/hero/cp-variants.ts` (테스트 대상 구현 — 동어반복 금지 제약의 필연 산물, 리드 스펙 보정 2026-07-05)
- `NEW: src/lib/hero/product-defaults.ts` (0026 시드 하드코딩 상수 — 드리프트 감지용)
- `package.json` (test 스크립트 확장)
- `.github/workflows/ci.yml` (test 잡 추가)

## Constraints
- 리듀서 매핑은 0024 코멘트의 **HERO v1.0 §2 원문 4규칙 그대로**: story_choice(prosocial=help)→characters_met.append(relation:'helped')+open_threads 생성 / expression_saved(T7)→items_invented / episode_completed→places_visited·version++ / 무응답 기본경로→상태 무변경(중립 — 아이 불이익 금지). state 필드명은 v1 스키마 원문(companion, characters_met[{id,relation,ep,choice_node}], items_invented[{id,name,ep,asset_ref}], places_visited[], open_threads[{id,desc,opened_ep,resolve_by_ep}], mood_pref{gacs[4]}, safety_flags[]) — 필드명 창작 금지.
- 멱등 프로젝터는 기존 `src/lib/c6/diagnosis-agent.ts`의 `growth_processed_at` 클레임 패턴을 따르되(참조·복제), diagnosis-agent 자체는 **수정 금지**(그 개정은 R1 티켓).
- 골든테스트 12본의 시나리오·기대는 02 §10 표(원문 인용 케이스 ①~⑩ + #11 3밴드 + #12 2택 서브셋)를 그대로 구현. 스냅샷 테스트·tautology 금지(LEAD 렌즈 #3) — 입력 이벤트 픽스처→기대 상태를 명시적으로 단언.
- mood_preset: GACS 파생·저장 테이블 없음·콜드스타트 'gentle'(02 §10). DB 접속 없는 순수 함수로(rows는 파라미터 주입).
- ci.yml: 기존 `ci` 잡 유지, `npm run test` 스텝 추가(02 §10 배선 — `test:golden` 포함 체인).
- worktree에 node_modules 없으면 `npm ci` 먼저. 커밋은 시도하되 샌드박스 거부 시 미커밋 상태로 handoff(리드가 대행).

## Deliverables
- 리듀서·세션설정 순수 함수 + 골든테스트 12본 그린 + CI test 잡

## Validation
```bash
npx tsx --test src/lib/hero/world-state.golden.test.ts
npx tsx --test src/lib/hero/session-config.golden.test.ts
npx tsx --test src/lib/hero/cp-variants.golden.test.ts
grep -q "test:golden" package.json && echo wired
grep -q "npm run test" .github/workflows/ci.yml && echo ci-ok
npm run lint
npx tsc --noEmit
```

## Handoff requirements
End your final message with: summary, files_changed, validation, risks, handoff_note — 특히 02 §10 시나리오와 다르게 해석한 지점(없어야 정상)과 리듀서의 open_threads 생성 규칙 처리(원문 "생성 규칙표 참조" — 규칙표 부재 시 최소 구현 + TODO 주석으로 명시).
