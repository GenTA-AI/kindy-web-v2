# Review: c6-axes-foundation

## decision
approve

## critical
- 없음.

## should_fix
- 없음.

## nice_to_have
- `src/lib/c6/axes.ts:276` `C6_EVENT_STANDARD_FIELDS` 런타임 배열 + `C6EventStandardField` 타입은 패키지가 "이벤트 표준 필드 **문서 주석**"만 요구한 부분에 대한 소폭 추가분(주석은 별도로 이미 존재). 순수 상수라 무해하고 증거 엔진이 소비할 여지가 있어 유지 무방하나, 요구 목록에 없던 export임을 기록.

## validation_notes
- **게이트 신뢰**: validation_exit=0, scope_ok=1, high_risk=1(마이그레이션). 결정론적 신호 재도출하지 않음. `validation.log`는 `npm run lint && npx tsc --noEmit` 실행 흔적 확인.
- **스코프 확인**: `git status --porcelain` — 추적 변경은 정확히 `supabase/migrations/0023_c6_growth_map.sql`, `src/lib/c6/axes.ts` 2건뿐. 스코프 밖 변경 없음. codex-result 초반에 보이던 ` M .gitignore`는 현재 워크트리에 없음(작업 전 존재분, 이번 패키지가 건드리지 않음).
- **c6-profile 무수정**: `git diff -- src/lib/game/c6-profile.ts` 빈 출력 확인. axes.ts는 `import type { C6ToolKey }` 타입 전용 import만 사용 — 패키지 허용 범위. 순수 모듈(런타임 외부 의존 0).
- **0023 SQL 스키마 정독(전문)**: c6_axes·story_seeds·child_growth_profiles·recommendation_logs 4개 신설 테이블의 컬럼·타입·default·PK·FK가 패키지 §6 정본과 완전 일치. library_videos(4컬럼)·game_rounds(9컬럼, `growth_processed_at` 계획 추가분 포함)는 전부 `add column if not exists` 순수 additive. 신설 테이블도 전부 `create table if not exists`. 기존 테이블에 `enable/disable rls`·`drop policy`·컬럼 변경/삭제 없음 → 기존 RLS·계약 약화 없음(invariant 6·10 준수). `supabase/manual/` 유입 없음.
- **FK 생성 순서**: c6_axes → story_seeds → library_videos alter → game_rounds alter → child_growth_profiles → recommendation_logs → 인덱스 → RLS → 시드. 모든 FK 대상이 참조 이전에 존재. 유효.
- **인덱스 4개 일치**: `idx_game_rounds_child_axis (child_id, axis_id) where axis_id is not null`(partial), `idx_child_growth_profiles_child (child_id)`, `idx_recommendation_logs_child_created (child_id, created_at)`, `idx_story_seeds_target_axis_published (target_axis) where published`(partial). 스펙과 정확 일치.
- **RLS 일치**: 4개 테이블 모두 `enable row level security`. c6_axes select `using(true)`; story_seeds select `using(published = true and approval_status = 'approved')`; child_growth_profiles·recommendation_logs select `exists(... children.id = <table>.child_id and children.parent_id = auth.uid()::text)` — 0016_game_events.sql 패턴과 동일. insert/update/delete 정책 없음(쓰기=service-role 전용, RLS 우회) → 스펙 일치. `drop policy if exists`는 신설 테이블의 신규 정책명만 대상이라 기존 정책 미영향(0016 멱등 패턴).
- **시드 6행 검증**: C1~C6 6행 값(id·name_ko·world_region·parent_label·child_label·description)이 패키지 표와 한 글자 단위로 일치. `on conflict (id) do nothing`. 시드 insert가 RLS enable 이후 실행되나, 마이그레이션은 owner/service-role로 실행되어 RLS 우회 → 삽입 성공(문제 없음).
- **axes.ts 정독**: C6AxisId(6)·C6_AXIS_IDS·C6AxisMeta·C6_AXES(표와 일치)·C6_AXIS_BY_ID 정상. ThinkingTool 13개 정확. TaskTemplate T1-T7 primary/secondary axis + 수집 변수 배열 전부 스펙 §4·패키지와 일치(T1 C2/C1, T2 C1/C3, T3 C3, T4 C4, T5 C5, T6 C6, T7 C4/C5). LEGACY_TOOL_TO_THINKING(observe→observation…compose→synthesis)·LEGACY_TOOL_TO_AXIS(observe→C2, imagine→C5, pattern→C3, transform→C3, design→C4, compose→C4) 매핑 정확, `satisfies Record<C6ToolKey, ...>`로 완전성 강제(양호). `inferAxisFromLegacyRound` 우선순위 정확: `sel_` 접두→C6 최우선 → objective_code 매핑(creativity_*) → game_type 폴백 → null. objective_code가 있으나 미매핑일 때도 game_type 폴백하는 동작은 "없으면 game_type" 취지에 부합.
- **의존성/시크릿**: 새 npm 의존성 없음, .env/시크릿 접근 없음. 마이그레이션 DB 미적용(파일만) — 워커 핸드오프가 HUMAN 단계(`supabase db push`, c6-diagnosis-agent 배포 전 선행)를 명시.
