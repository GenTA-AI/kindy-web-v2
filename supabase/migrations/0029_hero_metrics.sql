-- SSOT: docs/plan/02 §8
-- 0029_hero_metrics.sql
-- E15-1 아동 관찰 계측 7종(전부 비식별) + E13-7' 키오스크 데모 v2 + 홀드아웃 배정.
-- 계측 이벤트는 테이블 신설 없이 game_rounds(event_type + response_payload) 로 적재 — CHECK 와 뷰로 사전을 강제한다.

-- ═══════════════════════════════════════════════════════
-- 1. event_type 사전 v2 — 0024 CHECK 를 계측 7종으로 확장
--    (0017 의 purchases_bundle_type_check drop/재정의 패턴)
-- ═══════════════════════════════════════════════════════
alter table public.game_rounds drop constraint if exists game_rounds_event_type_check;
alter table public.game_rounds
  add constraint game_rounds_event_type_check
  check (event_type in (
    -- 0024 정의분
    'game_round', 'story_choice', 'episode_completed', 'expression_saved',
    -- E15-1 관찰 계측 7종
    'cp_timeout', 'passive_first_cp', 'tap_miss', 'assist_needed',
    'replay_view', 'naming_mode_used', 'session_fatigue_exit'
  ));

-- 계측 이벤트별 response_payload 필수 키 (이벤트 사전 v2 표와 1:1 — 본 문서 §9).
alter table public.game_rounds drop constraint if exists game_rounds_metric_payload_check;
alter table public.game_rounds
  add constraint game_rounds_metric_payload_check
  check (
        (event_type <> 'cp_timeout'           or (response_payload ? 'node' and response_payload ? 'lead_shown'))
    and (event_type <> 'passive_first_cp'     or response_payload ? 'node')
    and (event_type <> 'tap_miss'             or (response_payload ? 'x' and response_payload ? 'y'))
    and (event_type <> 'assist_needed'        or response_payload ? 'context')
    and (event_type <> 'replay_view'          or response_payload ? 'bookshelf_id')
    and (event_type <> 'naming_mode_used'     or response_payload ? 'mode')
    and (event_type <> 'session_fatigue_exit' or response_payload ? 'elapsed_min')
  );

comment on constraint game_rounds_metric_payload_check on public.game_rounds is
  'E15-1 계측 7종의 최소 페이로드 계약. 전체 필드 정의는 docs/plan/02_SCHEMA_RECONCILIATION.md §9 이벤트 사전 v2.';

-- ═══════════════════════════════════════════════════════
-- 2. 계측 뷰 — 대시보드·모니터링 (HERO §8: passive_first_cp 추이·tap_miss 핫스팟·fatigue 분포)
--    security_invoker: 부모는 자기 아이 행만(0016 RLS 상속), service-role 은 전체.
-- ═══════════════════════════════════════════════════════
create or replace view public.hero_metric_events
with (security_invoker = true) as
select
  id,
  child_id,
  event_type,
  (response_payload ->> 'node')        as cp_node,
  (response_payload ->> 'lead_shown')  as lead_shown,
  (response_payload ->> 'x')::numeric  as tap_x,
  (response_payload ->> 'y')::numeric  as tap_y,
  (response_payload ->> 'mode')        as naming_mode,
  (response_payload ->> 'elapsed_min') as fatigue_elapsed_min,
  response_payload,
  created_at
from public.game_rounds
where event_type in (
  'cp_timeout', 'passive_first_cp', 'tap_miss', 'assist_needed',
  'replay_view', 'naming_mode_used', 'session_fatigue_exit'
);

create or replace view public.hero_metric_daily
with (security_invoker = true) as
select
  date_trunc('day', created_at) as day,
  event_type,
  count(*)                      as events
from public.game_rounds
where event_type not in ('game_round')
group by 1, 2;

-- 폴백률 모니터링 (HERO §8: 폴백률 >5% 경보) — personal_renders(0025) 기반.
create or replace view public.hero_fallback_daily
with (security_invoker = true) as
select
  date_trunc('day', created_at)                       as day,
  count(*)                                            as renders,
  count(*) filter (where fallback_used)               as fallbacks,
  round(100.0 * count(*) filter (where fallback_used) / greatest(count(*), 1), 2) as fallback_pct
from public.personal_renders
group by 1;

-- ═══════════════════════════════════════════════════════
-- 3. 키오스크 데모 v2 (E13-7': 2스텝 단짝+색, 관 A/B 플래그)
-- ═══════════════════════════════════════════════════════
alter table public.kiosk_sessions
  add column if not exists demo_version text not null default 'v1'
    check (demo_version in ('v1', 'v2')),
  add column if not exists venue_arm text
    check (venue_arm in ('A', 'B')),
  add column if not exists companion int
    check (companion between 1 and 6),
  add column if not exists palette int
    check (palette between 1 and 8);

comment on column public.kiosk_sessions.demo_version is
  '데모 버전. v2 = 2스텝(단짝+색) "네가 주인공"(기획서 §4 K1). 기존 행은 v1.';
comment on column public.kiosk_sessions.venue_arm is
  '설치처(관) 단위 A/B 배정 — 데모 v2 vs v1 스캔율 실험(E13-7'', 기획서 §9 "주인공 데모=QR").';
comment on column public.kiosk_sessions.companion is
  'v2 1스텝 "함께 갈 단짝은?" 선택(1–6, avatars.companion 과 동일 코드). 호명은 "친구야" 고정 — 이름 수집 없음(결정 D6): '
  '이름 컬럼은 이 테이블에 의도적으로 부재하며 수집 코드 부재를 테스트로 보증(E13-7'' AC).';
comment on column public.kiosk_sessions.palette is
  'v2 2스텝 "좋아하는 색은?" 선택(1–8, avatars.palette 와 동일 코드).';

comment on table public.kiosk_events is
  '익명 키오스크 행동 이벤트(0015). 데모 v2 추가 event_type: step_companion_select | step_palette_select '
  '(payload {companion|palette}). event_type 은 0015 원문대로 CHECK 없는 자유 텍스트 — 사전은 docs/plan/02 §9.';

-- ═══════════════════════════════════════════════════════
-- 4. holdout_assignments — 실험 홀드아웃 배정 (HERO §1·§5, E13-8, 기획서 §7)
-- ═══════════════════════════════════════════════════════
create table if not exists public.holdout_assignments (
  child_id    uuid not null references public.children(id) on delete cascade,
  experiment  text not null
                check (experiment in ('ageband_defaults', 'tier_a', 'gacs_optimization')),
  arm         text not null check (arm in ('control', 'treatment')),
  assigned_at timestamptz not null default now(),
  primary key (child_id, experiment)
);

create index if not exists idx_holdout_experiment_arm
  on public.holdout_assignments (experiment, arm);

comment on table public.holdout_assignments is
  '실험 배정: ageband_defaults(연령 기본값 홀드아웃 — HERO §1·E13-16), tier_a(온/오프 50:50 — E13-8), '
  'gacs_optimization(홀드아웃 10% — 기획서 §7). 신규 실험은 CHECK 확장 마이그레이션으로 추가. '
  'RLS 는 service-role 전용(컨벤션 예외) — 무언 적용 원칙(기획서 §3 R6)상 배정 사실을 고객 표면에 비노출. 소비는 session-config API(HERO §5 ⑤).';

alter table public.holdout_assignments enable row level security;
-- 정책 의도적으로 없음 = service-role 전용 (예외 근거는 테이블 코멘트).
