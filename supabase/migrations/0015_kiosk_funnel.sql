-- 0015_kiosk_funnel.sql
-- 아산 꿈샘 키오스크의 Kindy 데모("AI 책 놀이") → 가정 전환 퍼널 측정.
-- 익명 키오스크 구간(kiosk_sessions / kiosk_events) + 익명→실명 다리(parent_attribution).
-- 설계 정본: KIOSK_KINDY_퍼널추적_설계.md §4.
-- 쓰기는 service-role 인제스트(/api/kiosk/events, RLS 우회). 직접 anon 쓰기는 차단(정책 없음 = deny).
-- PIPA: 식별정보 미수집 — 무작위 토큰 + 선택값(캐릭터/주제/기분)·행동 이벤트만.

create extension if not exists pgcrypto;

-- 키오스크 1회 사용 = 세션 1개. qr_token 이 익명→실명 다리(QR 에 심김).
create table if not exists public.kiosk_sessions (
  id                  uuid primary key default gen_random_uuid(),
  qr_token            text unique not null default encode(gen_random_bytes(16), 'hex'),
  location_code       text not null,                       -- 'asan-kkumsaem' 등 설치처
  character           text,                                -- 선택값 princess/space/dino/forest
  topic               text,                                -- science/english/hangul/music
  mood                text,                                -- gentle/lively/mystery/warm
  started_at          timestamptz not null default now(),
  last_event_at       timestamptz,
  qr_token_expires_at timestamptz not null default (now() + interval '90 days')
);
create index if not exists idx_kiosk_sessions_location on public.kiosk_sessions (location_code, started_at);
create index if not exists idx_kiosk_sessions_qr_token on public.kiosk_sessions (qr_token);

-- 익명 행동 이벤트 (인증 없음). 완주율 = position_sec/duration_sec.
create table if not exists public.kiosk_events (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.kiosk_sessions(id) on delete cascade,
  event_type    text not null,                             -- demo_started | step_select | video_started
                                                           --  | video_progress | video_completed
                                                           --  | quiz_started | quiz_completed | quiz_skipped
                                                           --  | game_started | game_round_completed | game_completed | qr_shown
  demo_video_id text,
  position_sec  numeric,
  duration_sec  numeric,
  quiz_score    int,
  payload       jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists idx_kiosk_events_session on public.kiosk_events (session_id);
create index if not exists idx_kiosk_events_type on public.kiosk_events (event_type, created_at);

-- 익명 세션 ↔ 부모 계정 연결 (가입 시 first-touch 1행). parent_id = auth.uid().
create table if not exists public.parent_attribution (
  parent_id         text primary key,
  kiosk_session_id  uuid not null references public.kiosk_sessions(id),
  attributed_at     timestamptz not null default now(),
  first_touch       boolean not null default true
);
create index if not exists idx_parent_attribution_session on public.parent_attribution (kiosk_session_id);

-- RLS: 세 테이블 모두 활성화. 쓰기는 service-role 인제스트가 RLS 우회로 수행.
-- 직접 anon/authenticated insert·update 는 허용 정책이 없으므로 차단(deny by default).
alter table public.kiosk_sessions enable row level security;
alter table public.kiosk_events enable row level security;
alter table public.parent_attribution enable row level security;

-- 집 구간 조인용: 부모는 본인 attribution 행만 조회 가능. (쓰기는 여전히 service-role 전용)
drop policy if exists parent_attribution_select_own on public.parent_attribution;
create policy parent_attribution_select_own
  on public.parent_attribution
  for select
  to authenticated
  using (parent_id = auth.uid()::text);
