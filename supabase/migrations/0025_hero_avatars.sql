-- SSOT: docs/plan/02 §4
-- 0025_hero_avatars.sql
-- HERO v1.0 §3·§4 아바타·이름 시스템: avatars(144조합) / personal_renders(개인화 렌더 원장) / name_pool(추천 풀).

-- ═══════════════════════════════════════════════════════
-- 1. avatars — 아이당 1행 (상시 개명·재조합 = update)
-- ═══════════════════════════════════════════════════════
create table if not exists public.avatars (
  child_id        uuid primary key references public.children(id) on delete cascade,
  base            int not null check (base between 1 and 3),
  palette         int not null check (palette between 1 and 8),
  companion       int not null check (companion between 1 and 6),
  companion_name  text not null default '단짝아',
  name_mode       text not null default 'default'
                    check (name_mode in ('recommend', 'voice', 'chosung', 'default')),
  photoreal_check text not null default 'n/a',
  version         int not null default 1,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.avatars is
  'HERO v1.0 §3 아바타. 원문 §4 의 config jsonb 단일 컬럼을 base/palette/companion 으로 분해(문서화된 강화 델타 — REVISION_SPEC §D-1): '
  'CHECK 3개의 곱 = 144 조합 전량을 DB 가 강제. '
  '사진·카메라·이미지 업로드 컬럼은 의도적으로 없음 — 코드 부재를 테스트로 보증(E13-10, v1.0 §3, 기획서 §4 A0 AC).';
comment on column public.avatars.companion_name is
  '단짝 이름. 무입력 기본 "단짝아", 상시 개명 가능(HERO §3 결정 D5).';
comment on column public.avatars.name_mode is
  '이름 확정 경로: recommend=추천 3택, voice=음성(재시도 1회), chosung=초성(6·7세 판정 시만), default=무입력 기본값.';
comment on column public.avatars.photoreal_check is
  '실사 유사도 판정 결과(HERO v1.0 §4 원문: default ''n/a''). v1.0 §3 "실사 유사 금지: 스타일화 3D만" — E13-10 판정기가 144조합 전수 통과 결과를 기록.';
comment on column public.avatars.version is
  '아바타 구성 버전(HERO v1.0 §4 원문). 재조합·개명 update 시 +1 — world_state 리듀서가 아바타 변경 이벤트를 폴드할 때의 참조점.';

-- ═══════════════════════════════════════════════════════
-- 2. personal_renders — 아이별 개인화 렌더 원장 (HERO v1.0 §4 원문 5-kind)
-- ═══════════════════════════════════════════════════════
create table if not exists public.personal_renders (
  id                uuid primary key default gen_random_uuid(),
  child_id          uuid not null references public.children(id) on delete cascade,
  episode_id        uuid,                     -- FK 는 0027 에서 부착
  slot              text,
  kind              text not null default 'avatar_still'
                      check (kind in ('name_tts', 'avatar_still', 'moving_cut', 'recap', 'birthday')),
  status            text not null default 'queued'
                      check (status in ('queued', 'running', 'succeeded', 'failed')),
  model_registry_id uuid,                     -- FK 는 0028 에서 부착 (model_registry 가 0028 에서 생성됨)
  output_url        text,
  cost              numeric,
  fallback_used     boolean not null default false,
  created_at        timestamptz not null default now(),
  unique (child_id, episode_id, slot, kind),
  constraint personal_renders_slot_required_check
    check (kind not in ('avatar_still', 'moving_cut') or slot is not null)
);

create index if not exists idx_personal_renders_child
  on public.personal_renders (child_id, created_at desc);

comment on table public.personal_renders is
  '아이별 개인화 렌더 원장(HERO v1.0 §4 원문). kind 5종 = name_tts | avatar_still | moving_cut | recap | birthday. '
  '티어A 사전조합(avatar_still): 에피소드당 주인공 스틸 2컷×144 조합(공유 자산, Storage 경로 키 b{base}-p{palette}-c{companion})을 '
  '아이 조합으로 해석해 1행 기록(E13-5). 실패 시 fallback_used=true + 지정 폴백 URL. '
  'moving_cut(티어B, E13-11)·recap(티어C, E13-12)·birthday(E13-13)는 온디맨드 잡 — 피처 플래그 tier_b/tier_c 뒤(v1.0 §0). '
  '잡 SLA(HERO v1.0 §5 ④): still<2m, moving<15m, recap<60m.';
comment on column public.personal_renders.slot is
  '개인화 슬롯 키(우리 추가 델타 — 사전조합 해석 키). avatar_still/moving_cut 은 episodes.avatar_slots[].shot_id(v1.0 §3 슬롯 규격)와 일치, '
  'name_tts/recap/birthday 는 null.';
comment on column public.personal_renders.status is
  '잡 상태(v1.0 §4 원문 default ''queued''). CHECK 값 집합은 우리 강화 델타 — POST /internal/renders/personal(§12 ④) 잡 큐의 라이프사이클.';
comment on column public.personal_renders.model_registry_id is
  '렌더에 사용한 모델(HERO v1.0 §4 원문) — 0028 model_registry 조인으로 개인 레이어 비용·품질 추적.';

-- ═══════════════════════════════════════════════════════
-- 3. name_pool — 이름 추천 풀 (E13-17: 큐레이션 100 + 금칙·발음 검사)
-- ═══════════════════════════════════════════════════════
create table if not exists public.name_pool (
  name           text primary key,
  banned         boolean not null default false,
  phonetic_check text not null default 'pending'
                   check (phonetic_check in ('pending', 'pass', 'fail')),
  source         text not null default 'curated',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_name_pool_servable
  on public.name_pool (name)
  where banned = false and phonetic_check = 'pass';

comment on table public.name_pool is
  'A0 이름 추천 3택의 풀(목표 100행 — E13-17 큐레이션 파이프가 scripts/seed-name-pool.ts 로 적재). '
  '추천 서빙 조건: banned=false and phonetic_check=pass. 클라이언트 직접 읽기 금지(금칙 목록 노출 방지) — API route 가 service-role 로 3개 샘플링.';

-- ═══════════════════════════════════════════════════════
-- 4. RLS
-- ═══════════════════════════════════════════════════════
alter table public.avatars enable row level security;
alter table public.personal_renders enable row level security;
alter table public.name_pool enable row level security;

drop policy if exists avatars_select_own on public.avatars;
create policy avatars_select_own
  on public.avatars for select
  using (
    exists (
      select 1 from public.children
      where children.id = avatars.child_id
        and children.parent_id = auth.uid()::text
    )
  );

drop policy if exists personal_renders_select_own on public.personal_renders;
create policy personal_renders_select_own
  on public.personal_renders for select
  using (
    exists (
      select 1 from public.children
      where children.id = personal_renders.child_id
        and children.parent_id = auth.uid()::text
    )
  );

-- name_pool: 정책 없음 = service-role 전용 (select 포함 — 금칙/검사 상태 비노출).
-- avatars/personal_renders 쓰기: 정책 없음 = service-role 전용 (A0 저장은 API route 경유).
