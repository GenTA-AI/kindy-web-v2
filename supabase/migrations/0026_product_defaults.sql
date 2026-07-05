-- SSOT: docs/plan/02 §5 (validation token: insert into product_defaults)
-- 0026_product_defaults.sql
-- HERO v1.1 §4 "005_usability.sql" 이식: 연령 밴드 기본값 (기획서 §3 표와 1:1).
-- 소비자: GET /api/children/[id]/session-config (HERO §5 ⑤, CTX §C-12). 캐시 24h.

create table if not exists public.product_defaults (
  age_band        int primary key check (age_band in (5, 6, 7)),
  session_len_min int not null check (session_len_min between 10 and 30),
  cp_options      int not null check (cp_options between 2 and 3),
  cp_lead_count   int not null check (cp_lead_count between 0 and 2),
  tts_rate        numeric not null check (tts_rate between 0.5 and 1.5),
  workshop_mode   text not null check (workshop_mode in ('tap', 'tap_drag_exp')),
  refresh_points  int not null check (refresh_points between 1 and 10),
  updated_at      timestamptz not null default now()
);

insert into public.product_defaults
  (age_band, session_len_min, cp_options, cp_lead_count, tts_rate, workshop_mode, refresh_points, updated_at)
values
  (5, 14, 2, 2, 0.9, 'tap', 6, now()),
  (6, 17, 2, 1, 1.0, 'tap', 5, now()),
  (7, 20, 3, 0, 1.0, 'tap_drag_exp', 5, now())
on conflict (age_band) do nothing;

comment on table public.product_defaults is
  '연령 밴드(출생연월 판정) 기본값 — HERO §4 005 / 기획서 §3. 무언 적용: 아이·부모 화면 어디에도 "연령 맞춤" 문구 없음(기획서 §3 R6). '
  '홀드아웃 배정은 0029 holdout_assignments. cp_options 는 콘텐츠의 cp_options_variants(0027)에서 서브셋을 고른다.';
comment on column public.product_defaults.cp_lead_count is
  '5세 음성 리드 횟수(6s/11s — 기획서 §6 리드 스크립트). cp_timeout 이벤트의 lead_shown 과 대조.';

alter table public.product_defaults enable row level security;

-- 비식별 제품 구성값 — c6_axes(0023:93) 패턴의 읽기 개방. 정식 소비는 session-config API.
drop policy if exists product_defaults_select_all on public.product_defaults;
create policy product_defaults_select_all
  on public.product_defaults for select
  to authenticated
  using (true);

-- 쓰기 정책 없음 = service-role 전용 (Phase B 결과로 파라미터 v2 교체 — E15-2).
