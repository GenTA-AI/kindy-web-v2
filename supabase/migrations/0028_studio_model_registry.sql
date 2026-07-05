-- SSOT: docs/plan/02 §7
-- 0028_studio_model_registry.sql
-- 마스터플랜 §6.1 Model Registry & Eval Harness 이식 + Inngest 파이프라인 상태 미러(CTX §C-4).

-- ═══════════════════════════════════════════════════════
-- 1. model_registry — capability 별 모델 라우팅 원장
-- ═══════════════════════════════════════════════════════
create table if not exists public.model_registry (
  id             uuid primary key default gen_random_uuid(),
  capability     text not null,        -- 'video_i2v' | 'keyframe_image' | 'tts_ko' | 'lipsync' | 'music' | ...
  provider       text not null,        -- 'fal', 'google', 'supertone', 'self-hosted' ...
  model_id       text not null,        -- 'seedance-1.5-pro', 'kling-3.0-elements' ...
  version        text,
  status         text not null default 'candidate'
                   check (status in ('candidate', 'benchmark', 'canary', 'prod', 'fallback', 'retired')),
  tier           text check (tier in ('hero', 'standard', 'filler')),
  unit_price     numeric,              -- $/sec 또는 $/장
  avg_latency_ms integer,
  quality_score  numeric,              -- 최근 골든셋 종합점수 0-100 (부록 C 루브릭)
  safety_score   numeric,
  policy_notes   text,                 -- 라이선스/상업사용/데이터보존 조항 요약
  benchmarked_at timestamptz,
  created_at     timestamptz not null default now()
);

create unique index if not exists idx_model_registry_cap_model
  on public.model_registry (capability, model_id);

comment on table public.model_registry is
  '마스터플랜 §6.1. 모델 교체 = 라우팅 행 하나 변경. status=fallback 은 §5 표의 2군(원문 §6.1 enum 에 없어 추가한 델타). '
  '승격/롤백 규칙은 §6.2 (canary=필러샷 10%, 롤백: QC -10%p·단가 +30%·안전 실패 1건).';

-- 초기값 시드 — CTX §C-7/C-8 확정. T3 골든셋 벤치가 최종 확정하며, 이 시드는 출발점이다.
insert into public.model_registry
  (capability, provider, model_id, status, tier, unit_price, policy_notes)
values
  ('video_i2v', 'fal', 'seedance-1.5-pro', 'prod', 'standard', 0.052,
   'docs/10 지정 1군(~$0.26/5s, start/end-frame 비트 그리드). T3 에서 seedance-2.0 과 대결 확정.'),
  ('video_i2v', 'fal', 'seedance-2.0', 'benchmark', 'standard', null,
   'T3 벤치 대상(1.5 Pro vs 2.0 — CTX §C-8). 네이티브 오디오는 docs/10 에서 기각($0.30/s).'),
  ('video_i2v', 'fal', 'seedance-2.0-fast', 'fallback', 'filler', 0.022,
   '마스터플랜 §5 필러 2군(~$0.022/s).'),
  ('video_i2v', 'fal', 'kling-3.0-elements', 'prod', 'hero', null,
   '히어로 컷 1군(CTX §C-8, Elements 1–4 ref). docs/10: 2배 과금 주의.'),
  ('video_i2v', 'fal', 'veo-3.1-quality', 'candidate', 'hero', 0.40,
   '마케팅 히어로 전용(docs/10, CTX §C-8) — 에피소드 예산 라우팅에서 제외.'),
  ('keyframe_image', 'fal', 'flux-2-kindytoy-lora-v1', 'prod', 'standard', null,
   'KINDYTOY 룩 LoRA v1(kindy-web/tmp/studio/lora-result.json, src/content/studio/lora/kindytoy-v1.json). 아티팩트 URL 생존 확인 = R0 체크(CTX §C-6).'),
  ('keyframe_image', 'fal', 'nano-banana-gemini-3-pro-image', 'fallback', 'standard', null,
   '2군(CTX §C-8). 기존 어댑터 보유(kindy-app pipeline gemini-3-pro-image 계보).'),
  ('tts_ko', 'google', 'gemini-2.5-flash-tts', 'prod', null, null,
   '현행 캐스팅 22개 mp3 검증(kindy-web/public/audio/village/). Sona 2 파운더 게이트 통과 전까지 1군(CTX §C-7).'),
  ('tts_ko', 'supertone', 'sona-2', 'candidate', null, null,
   '1군 후보 — 한국어 아동 보이스 가용성 확인 = 파운더 게이트(CTX §C-7). ElevenLabs 는 아동 보이스 정책 차단(docs/10 3중 검증)으로 미등록.'),
  ('tts_ko', 'self-hosted', 'qwen3-tts', 'candidate', null, null,
   'L2 호명(name_slot) 전용 후보 — 이름 외부 미전송 원칙(HERO E13-4, 마스터플랜 §1.3).'),
  ('lipsync', 'fal', 'omnihuman', 'candidate', null, 0.14,
   'VEED Fabric 대체 검증 대기(docs/10, 애덴덤 Q2). 클로즈업 선별 적용만(마스터플랜 §4.3).'),
  ('video_i2v', 'fal', 'wan-2.5', 'benchmark', 'filler', null,
   'T3 벤치 대상(03 §1-5 필러 후보) — 03 §7-4 벤치 명령의 wan-2.5 와 조인되는 행.'),
  ('lipsync', 'fal', 'veed-fabric-1.0', 'fallback', null, null,
   '2군(03 §1-5). omnihuman 검증 결과에 따라 폴백 — 클로즈업 선별 적용만(마스터플랜 §4.3).'),
  ('lipsync', 'fal', 'sync-lipsync-v2', 'fallback', null, null,
   '2군(03 §1-5). 클로즈업 선별 적용만(마스터플랜 §4.3).'),
  ('sfx', 'fal', 'mmaudio-v2', 'prod', null, null,
   '1군(03 §1-5). 상업 라이선스 조항 확인 = W1-2 파운더 게이트(03 §9) — 확인 결과를 이 policy_notes 에 기록.'),
  ('music', 'fal', 'minimax-music', 'prod', null, null,
   '1군(03 §1-5). 상업 라이선스 확인 = W1-2 파운더 게이트(03 §9). 곡별 출처·라이선스는 renders(kind=music).input_refs 의 license 필드로 기록.')
on conflict (capability, model_id) do nothing;

-- ═══════════════════════════════════════════════════════
-- 2. eval_runs — 골든셋 벤치 실행 로그 (마스터플랜 §6.1 원문 그대로)
-- ═══════════════════════════════════════════════════════
create table if not exists public.eval_runs (
  id                uuid primary key default gen_random_uuid(),
  model_registry_id uuid references public.model_registry(id),
  golden_task_id    text not null,
  output_url        text,
  scores            jsonb not null,    -- {consistency: 27, adherence: 22, motion: 18, child_safety: 15, artifact: 9}
  total             numeric not null,
  cost              numeric,
  latency_ms        integer,
  judge_model       text,
  human_override    numeric,           -- 인간 스팟체크 점수(있을 때)
  created_at        timestamptz not null default now()
);

create index if not exists idx_eval_runs_model
  on public.eval_runs (model_registry_id, created_at desc);

comment on table public.eval_runs is
  '골든셋 20태스크 × 후보 모델 벤치 로그(마스터플랜 §6.2·부록 C 루브릭 100점). prod 모델도 주간 재실행(T6 회귀: -3점 초과 시 알림).';

-- ═══════════════════════════════════════════════════════
-- 3. pipeline_runs — Inngest 스텝 상태 미러 (CTX §C-4)
-- ═══════════════════════════════════════════════════════
create table if not exists public.pipeline_runs (
  id             uuid primary key default gen_random_uuid(),
  episode_id     uuid not null references public.episodes(id) on delete cascade,
  stage          text not null
                   check (stage in (
                     'motif_report', 'script_draft', 'script_review', 'shotlist',
                     'keyframes', 'shot_generation', 'auto_qc', 'assembly',
                     'dubbing_mix', 'final_qc', 'publish')),
  status         text not null default 'running'
                   check (status in ('running', 'succeeded', 'failed', 'canceled')),
  output_ref     text,
  error          text,
  inngest_run_id text,
  attempt        int not null default 1,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz
);

create index if not exists idx_pipeline_runs_episode
  on public.pipeline_runs (episode_id, started_at desc);

comment on table public.pipeline_runs is
  'Inngest 스텝 함수 실행 1회 = 1행(CTX §C-4: BullMQ/Celery 대신 Inngest, 동시 제작 3편 초과 시 Temporal 재검토). '
  '각 스테이지는 멱등 — 실패 시 해당 스테이지만 재실행(마스터플랜 §2). episodes.status 는 최신 성공 스테이지를 따른다.';
comment on column public.pipeline_runs.output_ref is
  '스테이지 산출물 참조(Storage 경로·렌더 id 등). Inngest 재실행 시 status=succeeded 스테이지의 결과 재사용 입력(03 §4-2 계약).';

-- ═══════════════════════════════════════════════════════
-- 4. renders·personal_renders 전방 참조 FK 부착 (§2 의존성 표)
-- ═══════════════════════════════════════════════════════
alter table public.renders drop constraint if exists renders_model_registry_id_fkey;
alter table public.renders
  add constraint renders_model_registry_id_fkey
  foreign key (model_registry_id) references public.model_registry(id);

alter table public.personal_renders drop constraint if exists personal_renders_model_registry_id_fkey;
alter table public.personal_renders
  add constraint personal_renders_model_registry_id_fkey
  foreign key (model_registry_id) references public.model_registry(id);

-- ═══════════════════════════════════════════════════════
-- 5. RLS — 전부 service-role 전용
-- ═══════════════════════════════════════════════════════
alter table public.model_registry enable row level security;
alter table public.eval_runs enable row level security;
alter table public.pipeline_runs enable row level security;
-- 정책 없음 = deny by default. 소비자는 mori-studio(CTX §B-2)와 오케스트레이터 다이제스트뿐.
