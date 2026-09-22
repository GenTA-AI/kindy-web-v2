# 03. Mori Story Studio 구축 계획 (별도 레포 ~/dev/mori-studio)

> **목적**: Mori Story Studio 마스터플랜 v1.0을 기존 kindy-web/kindy-app 자산·리서치와 정합시켜, 별도 TypeScript 레포 `~/dev/mori-studio`로 12주 안에 파일럿 1편·누적 4편·베타 50가구까지 도달하는 실행 계획을 확정한다.
>
> **원천 문서**:
> - Mori Story Studio 마스터플랜 v1.0 — `/Users/jongwonlee/Downloads/Mori_Story_Studio_마스터플랜_v1.0.md` (이하 "마스터플랜")
> - 스튜디오 v2 에이전트 팀 설계 — `/Users/jongwonlee/dev/kindy-web/docs/10_STUDIO_V2_AGENT_TEAM_2026-07-03.md` (이하 "docs/10")
> - HERO 개발실행계획서 v1.1 — `/Users/jongwonlee/Downloads/files/HERO_개발실행계획서_v1.1_통합정본.md`
> - **통합 제품 마스터플랜 v1.0** — `/Users/jongwonlee/Downloads/아이별_문서세트_2026-07-05/01_현행정본/Kindy_통합_제품_마스터플랜_v1.0.md` (2026-07-05 수령. §4.5 실행 백로그 = 이하 "**정본 백로그**" — E6·E7·E10·E11 티켓 AC의 정본 출처, §5-0 매핑 표)
> - HERO 개발실행계획서 v1.0 — `/Users/jongwonlee/Downloads/아이별_문서세트_2026-07-05/03_이력보관/HERO_개발실행계획서_v1.0.md` (2026-07-05 수령. §4 `personal_renders` DDL·§5 ④ 렌더 잡 SLA 원문 — §4-4)
> - 아이별 제품기획서 v2.2 — `/Users/jongwonlee/Downloads/files/아이별_제품기획서_v2.2_통합정본.md`
> - C6 창의 성장지도 구현 정본 — `/Users/jongwonlee/dev/kindy-web/.dev-team/memory/c6-spec-v1.md`
> - 재무모델 v1.3 추출본 — `(tool-results)/bwm0u0orh.txt` (에피소드 제작 원가 ₩200,000/편 라인)
> - 조사 보고: survey-web-infra.md · survey-app-ios.md · survey-addendum.md (scratchpad, 2026-07-05)
> - 확정 결정 컨텍스트 DECISIONS_CONTEXT.md §B/C/D/E (2026-07-05 사용자·플랜 확정 결정, 이하 "확정 결정 §…")
> - 코드: `/Users/jongwonlee/dev/kindy-web/src/lib/episode-pipeline.ts`, `src/lib/video-providers/*`, `/Users/jongwonlee/dev/kindy-app/pipeline/qa_gate.py`
>
> **이 문서가 SSOT인 범위**: mori-studio 레포 구조·이식 지도·오케스트레이션 설계·골든셋/벤치 실행 계획·스튜디오 비용 모델·스튜디오 12주 로드맵. **정본 백로그의 E6 전체·E7 전체·E10(오케스트레이터)의 실행 계획도 본 문서(트랙B) 소관**이다 — HERO v1.1 백로그 개정 R1 행이 "유지: … E6 전체, E7 전체"로 명시한 스코프이며, 트랙A(kindy-web.v2) 부하로 산정하지 않는다(§5-0 매핑 표, 05 §5 부하 재검산 전제). (DB는 **개념 설계만 본 문서가 규정** — DDL·SQL 전문은 02_SCHEMA_RECONCILIATION.md가 정본이며, 마이그레이션 채번·적용은 kindy-web.v2 마이그레이션 대장이 SSOT. 에피소드 스키마 개념 정의는 마스터플랜 §7, C6 축 정의는 c6-spec-v1.md가 상위.)

---

## 1. 마스터플랜 대비 확정 수정 5건

마스터플랜 v1.0은 kindy-web/kindy-app에 이미 존재하는 자산·실측 리서치를 모르는 상태에서 작성되었다(survey-addendum.md OPEN QUESTIONS 2). 아래 5건은 확정 결정 §C-4~8에 따른 의도적 수정이며, 나머지 마스터플랜 조항(다이아몬드 구조 §1.1, 3중 게이트 §9, 스테이트 머신 §2, 부록 A 스키마 등)은 원문 그대로 채택한다.

### 1-1. 워크플로 엔진: BullMQ/Celery → Inngest (마스터플랜 §2 "구현 스택 권장" 수정)

- **원문**: "워크플로는 Postgres 상태 테이블 + 워커 큐(BullMQ 또는 Celery)로 시작한다."
- **수정**: **Inngest** 스텝 함수로 시작한다. 상태는 원문대로 Postgres(`episodes.status` + `pipeline_runs`)에 둔다. (확정 결정 §C-4)
- **근거**: kindy-web이 이미 Inngest를 프로덕션에서 운용 중 — `src/inngest/functions/video-generation.ts`(fn `video/generate`, retries 2, concurrency 5로 fal 쿼터 가드, 5–15분 실행 실증) + `src/app/api/inngest/route.ts` 서빙, Secret Manager에 `INNGEST_SIGNING_KEY`/`INNGEST_EVENT_KEY` 배선 완료(survey-web-infra.md §1·§4). BullMQ 도입은 Redis 인프라 신설을 요구하지만 Inngest는 재시도·스텝 멱등·`waitForEvent`(HITL 대기)·크론(주간 벤치)을 추가 인프라 0으로 제공한다.
- **잔여 리스크**: ① 에피소드 완주가 HITL 대기 포함 수 일~수 주 — 스텝 단위로 쪼개고 HITL 대기는 `step.waitForEvent`(타임아웃 7일, 초과 시 다이제스트 재알림)로 처리해야 함(§4에 설계). ② 에피소드 동시 제작 3편 초과 시 Temporal 재검토 트리거는 원문대로 유지(마스터플랜 §2, 확정 결정 §C-4). ③ Inngest 플랜 한도(동시 실행·스텝 수)는 W1 스캐폴드 때 실측 확인.

### 1-2. 아티팩트 저장: GCS → Supabase Storage (마스터플랜 §2 아키텍처 도식 "아티팩트: GCS" 수정)

- **원문**: 아티팩트 GCS, 상태/로그 Postgres, "기존 GCP 인프라 위에 Cloud Run 워커 + GCS + Cloud SQL".
- **수정**: 아티팩트는 **Supabase Storage `videos` 버킷**(기존 패턴), DB는 기존 Supabase 프로젝트(lzzaiqruxxfhhalgvejb, 서울)를 그대로 쓴다. GCS·Cloud SQL 도입하지 않음. (확정 결정 §B-3·§C-5)
- **근거**: ① `src/lib/supabase-storage.ts`(uploadBytes/getSignedUrl/pathFor/removePrefix)가 이미 있고 `episode-pipeline.ts`가 실제로 업로드에 사용 중(survey-web-infra.md §1). ② 발행 대상(`library_videos`)이 같은 Supabase에 있으므로 storage-relative 경로 규약(마이그레이션 0021, survey-addendum.md Q1-4)·서명 URL·RLS가 일원화된다. ③ 신규 버킷 권한·수명주기 학습 비용 0.
- **잔여 리스크**: 에피소드당 렌더 ~200클립(마스터플랜 §1.1) × 4편이면 수십 GB — 스토리지·egress 비용 증가. 대응: `renders` 원본은 90일 보존 후 정리(파괴적 SQL은 `supabase/manual/` 규약, 확정 결정 §C-3), 최종 마스터·키프레임·승인 프레임만 영구 보존. 대용량 병목이 실측되면 그때 GCS 콜드 보관을 재검토(원안 복귀 경로).

### 1-3. 캐릭터 마스터: 모리 3D 외주 → 기존 LoRA-first (마스터플랜 §4.2 하이브리드 파이프라인 1단계 수정)

- **원문**: "주인공 모리만 전문 모델러 1회 외주(₩200–500만) 권장" + Blender 턴어라운드 렌더가 레퍼런스 원본.
- **수정**: **기존 자산 우선** — ① KINDYTOY 룩 FLUX.2 LoRA v1(학습 완료: `kindy-web/tmp/studio/lora-result.json` — fal safetensors 332MB + `kindy-web/src/content/studio/lora/kindytoy-v1.json`), ② 승인 캐스트 6인 프레임(`kindy-web/src/content/studio/approved-frames/20260703-cast-{mori,kkumi,naong,owl,bangul,doto}.png`), ③ BRAND_DNA.md(대표 승인 2026-07-03, "소프트매트 3D 토이 KINDYTOY 룩" 정본)를 캐릭터 바이블 레퍼런스로 사용해 키프레임을 생성한다. 3D 마스터 외주는 QC에서 드리프트가 반복 검출될 때만 승격한다. (확정 결정 §C-6)
- **근거**: 마스터플랜이 요구한 "모델이 바뀌어도 유지되는 회사 자산"(§4.2-2)이 이미 LoRA+승인 프레임 형태로 존재한다. docs/10 §2도 "룩 고정은 LoRA, 모션 일관성은 reference/element" 2중 앵커를 확정했고, "v1의 승인 프레임 축적 루프는 LoRA 재학습 데이터셋으로 승격"이 설계에 포함돼 있다. 외주비 ₩200–500만과 발주 리드타임(마스터플랜 §12 주1–2 "모리 3D 마스터 발주")이 제거된다. 정본 백로그 E7-1("모리 3D 마스터 외주 발주·검수(턴어라운드 8각·표정 8종) — IP 귀속 계약 명기", 통합 마스터플랜 v1.0 §4.5)이 동일 항목이며, 본 수정(D-6)이 이를 대체한다 — 승격 경로 유지(§5-0 각주).
- **잔여 리스크**: ① **LoRA 아티팩트 fal URL 생존 미확인**(survey-addendum.md OPEN QUESTIONS 4) — R0 체크 항목: URL 생존 확인 즉시 safetensors를 Supabase Storage와 로컬에 이중 백업. ② 턴어라운드 8각도·표정 시트는 아직 없음 — LoRA 추론으로 생성해 HITL 승인 후 승인 프레임 세트를 확장(마스터플랜 §12 주1–2 "모리 턴어라운드 승인" 기준 유지). ③ 드리프트 반복 검출 시 3D 마스터 외주 승격(원안 §4.2 경로 유지, 마스터플랜 §13 캐릭터 드리프트 행과 동일).

### 1-4. TTS: ElevenLabs 1군 → Supertone/Gemini/Qwen3 3단 구성 (마스터플랜 §4.3·§5 tts_ko 행 필수 수정)

- **원문**: "1군 ElevenLabs Eleven v3 … 벤치 대상 Supertone·Typecast, 비용/개인정보 옵션 Qwen3-TTS".
- **수정**: **ElevenLabs는 벤치 대상에서 제외**(정책 결격 → registry 미등록, 사유는 sona-2 행 `policy_notes`에 기록 — 02 §7 시드). 1군 후보 = **Supertone Sona 2**(아동 보이스 가용성 확인이 파운더 게이트), 현행 prod = **Gemini 2.5 Flash TTS 캐스팅 체계**, L2 호명 전용 후보 = **Qwen3-TTS 셀프호스팅**. (확정 결정 §C-7)
- **근거**: docs/10 §0-3 — "한국어 아동 음성은 ElevenLabs가 정책상 봉쇄(아동 음성·아동 모사 성인 음성 모두 금지, 3표 검증)". 폴백은 실증 완료 자산: Gemini 캐스팅 22개 mp3(`kindy-web/public/audio/village/` + 매니페스트 `src/data/worlds/animal-village-voice.json`, survey-web-infra.md §5)와 `src/lib/video-providers/gemini-tts.ts`. 호명(name_slot)은 HERO E13-4 "외부 미전송 검증"(HERO v1.1 백로그 E13-4 행)에 따라 이름 단독 세그먼트를 로컬/셀프호스팅으로 합성한다 — 마스터플랜 §1.3 L2 개인정보 주의 조항과 동일 원칙.
- **잔여 리스크**: ① Supertone 아동 음색 존재·약관 미확인(docs/10 §4-2 대표 게이트) — 게이트 실패 시 Gemini 유지(폴백 사다리, docs/10 §2). ② Gemini TTS는 감정 연기 폭이 좁음 — 캐스팅+감정 오버라이드(`animal-village-bible.ts`의 `resolveVoiceStyle`)로 보완하되 T3 tts_ko 벤치에 감정 축 포함. ③ Qwen3-TTS 셀프호스팅은 GPU 상시 비용 — L2 이름 세그먼트 배치 합성 전용(콜드 스타트 허용)으로 한정.

### 1-5. 비디오·키프레임 모델 레지스트리 초기값 (마스터플랜 §5 표 조정)

- **원문**: video_i2v 표준 1군 Kling 3.0 / 히어로 Veo 3.1 Quality / keyframe 1군 FLUX.2(일반).
- **수정**(확정 결정 §C-8, docs/10 §1·§2 실측 반영):

| Capability | 1군(prod) | 2군(fallback/필러) | 후보(canary/benchmark) | 단가(실측·게이트웨이) |
|---|---|---|---|---|
| video_i2v 표준 | **Seedance 1.5 Pro** (start/end frame, camera_fixed) | Seedance 2.0 Fast(필러) | Seedance 2.0 (T3에서 1.5 Pro와 비교 확정), Wan 2.5/2.6 | 1.5 Pro ~$0.26/5s = $0.052/s(docs/10 §1 #6) · Fast ~$0.022/s(마스터플랜 §5) · Wan 2.5 $0.10/s(docs/10) |
| video_i2v 히어로 | **Kling 3.0 Pro @Element**(레퍼런스 1–4장) | Seedance 1.5 Pro | Kling Video O3 | Element 사용 시 2배 과금 $0.224–0.336/s(docs/10 §1 #6·§5) |
| video_i2v 마케팅 | Veo 3.1 — **마케팅 히어로 전용, 에피소드 라우팅 제외** | — | — | $0.40/s(docs/10 §2) |
| keyframe_image | **FLUX.2 + KINDYTOY LoRA v1** | nano-banana(Gemini 3 Pro Image, 기존 어댑터) | GPT Image 2, Seedream | LoRA 추론 ~$0.04/장(docs/10 §1 #5) · nano-banana ~$0.039/장(survey-web-infra.md §1) |
| lipsync(선별) | OmniHuman(실증 게이트 후) | VEED Fabric(실증 완료 $0.72클립) / Sync Lipsync | Kling 립싱크 | OmniHuman $0.14/s · VEED $0.08–0.15/s(docs/10 §1 #8, survey-web-infra.md §1) |
| sfx / music | MMAudio V2 / MiniMax Music | 라이선스 라이브러리 구매 | — | $0.001/s · $0.035/곡(docs/10 §1 #2·#9) |
| tts_ko | Gemini 2.5 Flash TTS(현행) | — | Supertone Sona 2(게이트), Qwen3-TTS(셀프호스팅·L2 전용) | ~$0.1/90s편(docs/10 §1 #7) |
| script_llm / vlm_judge | Claude(마스터플랜 §5 유지) | — | 신규 릴리즈 자동 벤치 | $10–30/에피소드(마스터플랜 §11) |

  Seedance 2.0 네이티브 오디오는 채택 보류(음질 조악 + $0.30/s — docs/10 §2), 전 모델 fal.ai 경유(확정 결정 §C-8).
- **근거**: docs/10은 딥리서치 107 에이전트(주장별 3표 적대 검증) + fal 엔드포인트 라이브 확인(2026-07-03) + 자체 실증(VEED 클립·FLUX 키프레임·캐스팅 TTS 22개)으로 도출된 실측 티어이고, `seedance2.ts` 어댑터가 이미 존재해 이식 비용이 최소다. 마스터플랜 스스로 "이 표는 registry 초기값이며 벤치마크로 갱신"(§5 서두)이라고 규정했으므로 이 조정은 마스터플랜 설계 의도 안에 있다.
- **잔여 리스크**: ① 870초 규모 멀티씬 연속성은 Seedance 2.0(레퍼런스 12개·15s 단일패스, 마스터플랜 §5 video_multiref)이 우위일 수 있음 — **T3 골든셋 벤치가 1.5 Pro vs 2.0 최종 확정**(확정 결정 §C-8). ② Seedance는 씬 >10s에서 싱크 열화(docs/10 §1 #6) — 샷 4–8s 유지 규칙을 콘티 에이전트에 하드코딩. ③ Kling Element 2배 과금 누락 리스크(docs/10 §5) — cost-guard 단가표에 Element 여부 필드로 반영. ④ fal 단일 게이트웨이 종속 — 월 생성량 집중 모델은 직결 계약 이전(마스터플랜 §5 접근 경로 유지).

> Python 파이프라인(kindy-app/pipeline) 처리(확정 결정 §C-9)는 §3 이식 지도의 qa_gate.py 포팅 명세에서 다룬다. 꼬꼬마을 세계관·선형 스크립트는 폐기하고 로직만 포팅한다(동물마을+모리 LOCK이 정본).

---

## 2. 레포 구조: `~/dev/mori-studio`

**원칙**: packages 워크스페이스 없는 **단일 TypeScript 프로젝트**(확정 결정 §B-2). 웹 UI 없음 — HITL 화면은 kindy-web.v2 `/studio`가 담당(§4-3). DB DDL도 없음 — 스튜디오 producer 테이블(episodes/episode_nodes/shots/renders/model_registry/eval_runs/pipeline_runs, 마스터플랜 §6.1·§7)은 같은 Supabase 프로젝트이므로 **kindy-web.v2 `supabase/migrations/` 0024+ 대역에서 채번·적용**하고(확정 결정 §B-3·§C-3), mori-studio는 service-role로 읽고 쓴다.

```
mori-studio/
├── package.json                      # 단일 프로젝트. deps: @anthropic-ai/sdk, @fal-ai/client, @google/genai,
│                                     #   @supabase/supabase-js, inngest, zod, vitest (kindy-web package.json 계보 승계)
├── tsconfig.json
├── vitest.config.ts
├── .env.example                      # ANTHROPIC_API_KEY, FAL_KEY, GOOGLE_API_KEY, SUPERTONE_API_KEY,
│                                     #   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, INNGEST_SIGNING_KEY,
│                                     #   INNGEST_EVENT_KEY, SEEDANCE_TIER, EPISODE_BUDGET_USD(기본 400)
├── README.md
├── src/
│   ├── agents/                       # 11 에이전트 = 마스터플랜 §3.1(4) + §4.1(7)
│   │   ├── story-director.ts         # 스토리팀장: 브리프 수락·작업 분배·3회 반려 에스컬레이션·다이제스트
│   │   ├── motif-scout.ts            # 리서치: 퍼블릭 도메인 코퍼스 → motif_report (마스터플랜 §3.2)
│   │   ├── story-smith.ts            # 작가: branching_script JSON 집필 (§3.3 제약 하드코딩)
│   │   ├── safety-guardian.ts        # 검수: §3.4 체크리스트 + 오리지널리티 게이트
│   │   ├── showrunner.ts             # 스튜디오팀장: production_plan·샷 티어링·예산 배분 (§4.1 ①)
│   │   ├── storyboard.ts             # 콘티: 씬→샷 분해, tier 태깅, 비트 그리드 수신 (docs/10 #4)
│   │   ├── art-director.ts           # 키프레임 생성·선별, 룩/캐릭터 바이블 관리 (§4.1 ③)
│   │   ├── gen-operator.ts           # 샷 I2V 생성·시드/모델/버전 로깅·리트라이 (§4.1 ④)
│   │   ├── assembly.ts               # ffmpeg 편집·비트 스냅 컷·분기 마커·branch manifest (§4.1 ⑤)
│   │   ├── voice-sound.ts            # TTS 캐스팅·name_slot·BGM/SFX·-16 LUFS 믹스 (§4.1 ⑥, docs/10 #2·#9·#10)
│   │   ├── qc.ts                     # VLM 프레임 판정+오디오 체크 → pass/regenerate/reroute/human_review (§4.4)
│   │   └── prompts/                  # 시스템 프롬프트·룩 프리셋 (버전 관리 — 마스터플랜 부록 B)
│   │       ├── story-smith.v1.md
│   │       ├── safety-guardian.v1.md
│   │       ├── storyboard.v1.md
│   │       └── look-preset.v1.md     # 부록 B 프리셋 × BRAND_DNA KINDYTOY 룩 병합본(프리셋 ID 참조 구조)
│   ├── adapters/
│   │   ├── gen-adapter.ts            # GenAdapter 인터페이스 (마스터플랜 §6.1 원문 구현)
│   │   ├── fal/
│   │   │   ├── seedance.ts           # ← kindy-web seedance2.ts 이식 + 1.5 Pro 엔드포인트 추가
│   │   │   ├── kling.ts              # 신규: Kling 3.0 Pro @Element (히어로)
│   │   │   ├── flux2-lora.ts         # ← kindy-web tmp/studio/test-lora-inference.ts 이식 (keyframe 1군)
│   │   │   ├── wan.ts                # 신규: 오픈소스 라인 (canary/셀프호스팅 대비)
│   │   │   ├── omnihuman.ts          # 신규: 말하는 장면 (docs/10 #8, 실증 게이트)
│   │   │   ├── veed-fabric.ts        # ← 이식 (립싱크 폴백, 실증 완료)
│   │   │   ├── sync-lipsync.ts       # ← 이식 (fal-lipsync.ts 래퍼 흡수)
│   │   │   ├── mmaudio.ts            # 신규: SFX (docs/10 #9)
│   │   │   ├── minimax-music.ts      # 신규: BGM (docs/10 #2)
│   │   │   └── whisper.ts            # ← src/lib/whisper.ts 이식 (자막 VTT·대사-자막 정렬 QC)
│   │   ├── gemini/
│   │   │   ├── nano-banana.ts        # ← 이식 (keyframe 2군)
│   │   │   └── gemini-tts.ts         # ← 이식 (tts_ko prod)
│   │   ├── supertone/
│   │   │   └── sona2.ts              # 신규: 파운더 게이트 통과 시 활성 (TtsProvider 뒤에 — docs/10 #7)
│   │   └── anthropic/
│   │       └── claude.ts             # ← claude-director.ts의 클라이언트·프라이싱·프롬프트 캐싱 계층 이식
│   ├── orchestrator/
│   │   ├── inngest/
│   │   │   ├── client.ts             # Inngest 클라이언트 (app id 'mori-studio')
│   │   │   ├── serve.ts              # HTTP 서빙 엔트리 (Cloud Run 배포 — kindy-web api/inngest/route.ts 패턴)
│   │   │   ├── episode-produce.ts    # 스테이트 머신 본체 fn `studio/episode.produce` (§4)
│   │   │   ├── shot-generate.ts      # 샷 팬아웃 fn `studio/shot.generate` (concurrency 5 = fal 쿼터 가드)
│   │   │   ├── weekly-benchmark.ts   # T6 회귀 크론 (prod 모델 주간 골든셋 재실행, 마스터플랜 §6.2-5)
│   │   │   ├── model-scout-cron.ts   # 주 1회 신모델 감시 (마스터플랜 §6.2-1)
│   │   │   └── digest.ts             # 팀장 다이제스트 일 1회·오케스트레이터 주 1회 (마스터플랜 §6.4)
│   │   ├── model-registry.ts         # model_registry CRUD + 승격/롤백 규칙 (마스터플랜 §6.2-3·4)
│   │   ├── router.ts                 # tier(hero/standard/filler) → prod 모델 라우팅 (마스터플랜 §6.3)
│   │   ├── cost-guard.ts             # 에피소드 예산 상한 $400·80% 자동 강등·하드스톱 (마스터플랜 §6.3)
│   │   ├── eval-harness.ts           # 골든셋 실행 + VLM 저지 채점 → eval_runs (§7)
│   │   └── model-scout.ts            # fal/릴리즈 피드 크롤·policy_notes 요약 (마스터플랜 §6.2-1)
│   ├── schemas/
│   │   ├── branching-script.ts       # 부록 A 전문 zod 스키마 (아래 발췌)
│   │   ├── shotlist.ts               # ← director.types.ts 이식·확장 (Seedance 4–15s 제약 승계)
│   │   ├── qc-report.ts              # ← src/lib/studio/qa-agent.ts QcReport 타입 이식
│   │   └── player-map.ts             # branching_script ↔ 기존 interactive-session.ts(Scene/ChoiceOption/
│   │                                 #   EndingRule) 필드 매핑 표 (확정 결정 §C-10, 플레이어 증축용 계약)
│   ├── qc/
│   │   ├── qa-gate.ts                # ← kindy-app/pipeline/qa_gate.py 포팅 (§3-2 명세)
│   │   ├── gacs.ts                   # ← kindy-app/pipeline/gacs.py 어휘·안전경계 포팅 (프롬프트 컨디셔닝 겸용)
│   │   ├── vision-rubric.ts          # 비전 5축 루브릭 (Claude 저지) + 골든셋 100점 루브릭 (§7)
│   │   └── audio-checks.ts           # 라우드니스·무음·대사-자막 정렬·플래시 판정 (마스터플랜 §4.4)
│   ├── render/
│   │   └── limited-animation.ts      # ← 이식: 폴백 바닥 렌더러 (docs/10 §2 "폴백 사다리")
│   ├── db/
│   │   ├── supabase.ts               # service-role 클라이언트 (쓰기 전용 규약 — 확정 결정 §C-3)
│   │   ├── storage.ts                # ← src/lib/supabase-storage.ts 이식 (videos 버킷)
│   │   └── publish.ts                # episodes → library_videos 1행 미러 발행 (확정 결정 §C-2)
│   └── content/
│       ├── bible/
│       │   └── animal-village-bible.ts   # ← 이식. 이식 후 정본은 mori-studio(§3-1 주석 참조)
│       ├── approved-frames/              # ← 승인 캐스트 6 PNG 복사 + README(승인 이력)
│       └── lora/
│           └── kindytoy-v1.json          # ← 복사 + R0에서 safetensors 이중 백업 경로 추가
├── scripts/
│   ├── golden-set.ts                 # 골든 태스크 정의 파일 로드·검증 (src/content/golden/*.json)
│   ├── bench.ts                      # T3 벤치 러너 (§7-4 실행 방법)
│   ├── pilot.ts                      # T2 파일럿 에피소드 완주 러너 (브리프 → published, §6)
│   ├── train-lora.ts                 # ← tmp/studio/train-kindytoy-lora.ts 이식 (재학습·캐스트 확장용)
│   └── smoke-adapter.ts              # 어댑터별 1콜 스모크 (kindy-web scripts/smoke-* 계보)
└── docs/
    └── RUNBOOK.md                    # 배포(Cloud Run)·시크릿·재실행 절차
```

**배포**: kindy-web과 동일 GCP 프로젝트(kindy-493701, asia-northeast3)에 Cloud Run 서비스 `mori-studio`로 배포, 시크릿은 Secret Manager만 사용(불변 ⑥, survey-web-infra.md §4의 cloudbuild.yaml·deploy-cloud-run.sh 패턴 복제). ffmpeg는 kindy-web Dockerfile과 동일하게 런타임 이미지에 포함(survey-web-infra.md §4).

**부록 A zod 스키마 골자** (`src/schemas/branching-script.ts` — 마스터플랜 부록 A 전문 반영):

```ts
export const Dialogue = z.object({
  char: z.string(), text: z.string(), name_slot: z.boolean().default(false),
});
export const Shot = z.object({
  shot_id: z.string(),                       // 'S1_03'
  duration_s: z.number().min(4).max(15),     // Seedance 제약 승계(director.types.ts)
  tier: z.enum(['hero', 'standard', 'filler']),
  keyframe_prompt: z.string(),               // <룩 프리셋 ID> + 장면 서술
  motion_prompt: z.string(),
  characters: z.array(z.string()),
  dialogue: z.array(Dialogue).default([]),
});
export const SegmentNode = z.object({
  id: z.string(), type: z.literal('segment'), duration_s: z.number(),
  scenes: z.array(z.object({
    scene_id: z.string(), learning_beat: z.string(), shots: z.array(Shot),
  })),
  next: z.string(),
});
export const ChoiceOption = z.object({
  id: z.string(), label: z.string(), icon: z.string(), next: z.string(),
  report_sentence: z.string(),               // 부모 리포트 근거 문장(부록 B 템플릿 문법)
});
export const ChoiceNode = z.object({
  id: z.string(), type: z.literal('choice'),
  axis_id: z.enum(['C1_focus_flow','C2_observation_inquiry','C3_pattern_problem',
    'C4_language_expression','C5_imagination_analogy','C6_social_emotional']), // c6-spec-v1.md §1
  thinking_tool: z.string(),
  prompt_line: z.string(), wait_loop_shot: z.string(),
  options: z.array(ChoiceOption).min(2).max(3),
  timeout_ms: z.literal(15000), timeout_default: z.string(),
});
export const BranchingScript = z.object({
  episode_id: z.string().uuid(), story_seed_id: z.string().uuid(),
  target_axis: z.string(), world_region: z.string(),
  nodes: z.array(z.discriminatedUnion('type', [SegmentNode, ChoiceNode])),
});
// superRefine 검증 규칙(부록 A 원문): ① 전 노드 도달 가능(고아 0) ② 종단은 E* 노드만
// ③ 경로 길이 분산 ±10% ④ 모든 choice에 axis_id·report_sentence ⑤ name_slot 총 3–5개
```

---

## 3. 이식 지도

### 3-1. kindy-web(TS) → mori-studio

| # | 원본 (kindy-web) | 대상 (mori-studio) | 이식 방식·비고 |
|---|---|---|---|
| 1 | `src/lib/video-providers/claude-director.ts` (ClaudeDirector: Opus/Sonnet 프라이싱·프롬프트 캐싱, 브리프→VideoScript) | `src/adapters/anthropic/claude.ts`(클라이언트·비용 계층) + `src/agents/story-smith.ts`·`storyboard.ts`(7축 연출 프롬프트 자산 분해 승계) | 단일 감독을 Story Smith(대본)/콘티(샷 분해)로 분리 — 마스터플랜 §3.1·§4.1 역할 모델에 맞춤 |
| 2 | `src/lib/video-providers/director.types.ts` (VideoBrief/EpisodeScript, Seedance 4–15s 제약, Gemini 보이스 풀) | `src/schemas/shotlist.ts` | 타입 승계 + branching_script와 필드 정렬 |
| 3 | `src/lib/video-providers/seedance2.ts` (fal `bytedance/seedance-2.0/reference-to-video`, standard/fast 티어) | `src/adapters/fal/seedance.ts` | 1.5 Pro 엔드포인트·start/end frame·camera_fixed 파라미터 추가(docs/10 #6) |
| 4 | `src/lib/video-providers/nano-banana.ts` (Gemini 3 Pro Image, ~$0.039/장) | `src/adapters/gemini/nano-banana.ts` | keyframe 2군 그대로 |
| 5 | `src/lib/video-providers/gemini-tts.ts` + `src/lib/gemini-tts.ts` (8보이스, WAV 24kHz, 톤·WPM) | `src/adapters/gemini/gemini-tts.ts` | 두 파일 병합, TtsProvider 인터페이스 뒤로(엔진 교체 대비 — docs/10 #7) |
| 6 | `src/lib/video-providers/veed-fabric.ts` / `sync-lipsync.ts`(+`fal-lipsync.ts` 래퍼) | `src/adapters/fal/veed-fabric.ts` / `sync-lipsync.ts` | 립싱크 폴백 2종. OmniHuman 실증 게이트 통과 시 2군으로 강등 |
| 7 | `src/lib/whisper.ts` (fal Whisper → WebVTT) | `src/adapters/fal/whisper.ts` | QC 대사-자막 정렬(마스터플랜 §4.4 오디오 판정) 입력 |
| 8 | `src/lib/limited-animation.ts` (Ken Burns·입 개폐 렌더러) | `src/render/limited-animation.ts` | "언제나 동작하는 바닥"(docs/10 §2 폴백 사다리) |
| 9 | `src/lib/studio/qa-agent.ts` (runEpisodeQc, QcVerdict pass/warn/fail) | `src/qc/vision-rubric.ts` 기반부 + `src/schemas/qc-report.ts` | qa_gate.py 5축과 병합(§3-2) |
| 10 | `src/lib/supabase-storage.ts` (uploadBytes/getSignedUrl(s)/pathFor/removePrefix) | `src/db/storage.ts` | 경로 프리픽스만 `studio/{episode_id}/...`로 확장 |
| 11 | `src/content/studio/animal-village-bible.ts` (룩 프리셋 `mandatorySuffix`·`wrapWithPromptRules`·보이스 캐스팅 `resolveVoiceCasting`/`resolveVoiceStyle`) + `animal-village-bible.test.ts` | `src/content/bible/animal-village-bible.ts` + `src/agents/prompts/look-preset.v1.md` | **이식 후 정본은 mori-studio**(제작 소비자가 스튜디오이므로). kindy-web.v2에는 소비 전용 사본만 남기고 BRAND_DNA.md의 "기술 정본" 포인터를 갱신 — 불변 ④(캐릭터 레퍼런스 고정) 유지 |
| 12 | `src/lib/studio/approved-frames.ts` + `src/content/studio/approved-frames/*.png` (승인 캐스트 6인, 2026-07-03) | `src/content/approved-frames/` | 재생성 금지(불변 ④) — 신규 승인 프레임만 추가 |
| 13 | `src/content/studio/lora/kindytoy-v1.json` + `tmp/studio/lora-result.json`·`train-kindytoy-lora.ts`·`test-lora-inference.ts` | `src/content/lora/kindytoy-v1.json` + `scripts/train-lora.ts` + `src/adapters/fal/flux2-lora.ts` | R0: fal URL 생존 확인 + safetensors 이중 백업(§1-3 리스크) |
| 14 | `src/inngest/functions/video-generation.ts` (retries 2, concurrency 5) | `src/orchestrator/inngest/episode-produce.ts`·`shot-generate.ts` | 함수 자체가 아니라 재시도·쿼터 가드 패턴 승계(§4) |
| 15 | `src/lib/episode-pipeline.ts` (1,284L 단일 오케스트레이터: 감독→refs→키프레임→Seedance→TTS→립싱크→limited-animation→concat→업로드) | 해체 이식 — 스테이지 로직을 §2의 agents/·orchestrator/ 스텝으로 분해 | 90s 선형 전제(EpisodeScript)를 870s 분기(branching_script) 전제로 재구성. 원본은 kindy-web.v2에서 라이브러리 90s 배치용으로 계속 가동(§5 W3–8 재고 병행 생산) |

### 3-2. kindy-app(Python) → mori-studio: `qa_gate.py` 포팅 명세

원본: `/Users/jongwonlee/dev/kindy-app/pipeline/qa_gate.py`(275L, 스모크 통과 2026-06-11 — survey-app-ios.md §3). 재작성이 아니라 **로직 포팅**(확정 결정 §C-9). 대상: `src/qc/qa-gate.ts` + `src/qc/gacs.ts` + `src/qc/vision-rubric.ts`.

| qa_gate.py 요소 | 포팅 명세 |
|---|---|
| (a) **GACS 재측정** — `gacs.check_image_against_coordinate`: 이미지에서 형용사 5개+tone 추출(Kim/Kim/Park 2025 JBR 프로토콜), 목표 좌표 형용사와 임베딩 코사인 ≥0.5, `tone='dark'` 즉시 실패 (qa_gate.py:113–133) | `src/qc/gacs.ts`: gacs.py의 형용사 어휘·안전 경계(tone≥0.35, valence≥0.4, arousal≤0.85, novelty≤0.7 — GACS.swift와 동일 값, survey-app-ios.md §2 Personalization)를 상수로 포팅. 임베딩은 원본과 동일하게 `gemini-embedding-001`(폴백 `text-embedding-004`, `pipeline/config/settings.py` 기준 — GOOGLE_API_KEY 기존 배선). 같은 모듈이 좌표→형용사 앵커 변환을 제공해 키프레임 **프롬프트 컨디셔닝**(kindy_pd_agent.py의 GACS 조건화 역할)도 겸한다 |
| (b) **비전 5축 루브릭** — style_consistency / character_accuracy / age_safety / technical_quality / emotional_delivery 각 1–10, 평균 ≥7 통과. LLM 산수 오류 방지를 위해 평균·판정을 코드에서 재계산(qa_gate.py:102–108) | `src/qc/vision-rubric.ts`: 5축·임계·코드 재계산 로직 그대로. 스타일 가이드 참조는 `style_guide.json`(꼬꼬마을) → `animal-village-bible.ts`+BRAND_DNA로 교체. **저지 모델은 Claude로 전환**(마스터플랜 §4.4 "비전 모델(Claude)"·§5 vlm_judge 행) — 프롬프트는 모델 불가지론으로 작성하고 `eval_runs.judge_model`에 기록, 저지 편향 점검용으로 Gemini 교차 채점 10% 유지(원본이 Gemini 저지였으므로 회귀 비교 가능) |
| **qa_manifest.json / regen_queue.json** — 실패 항목 재생성 큐, 최대 2회 재시도 (qa_gate.py:177–201) | 파일 기반 큐 → DB 기반: `renders.qc_result('pass'|'regenerate'|'reroute'|'human_review')`·`qc_scores jsonb`·`attempt`(마스터플랜 §7 renders 테이블). **재시도 상한은 3회로 상향 통일**(원본 2회 vs 마스터플랜 §4.4 "샷당 자동 재시도 상한 3회" — 마스터플랜 채택, §6.3 리트라이 예산 1.4x와 셋트) |
| **FINAL RULE** — `human_approved=false / published=false` 기본값, 사람 전용 `--approve`만 뒤집음, 어떤 코드 경로도 `published=true`를 설정하지 않음 (qa_gate.py:13–15, 222–239) | `episodes.approval_status draft→in_review→approved`(story_seeds와 동일 상태 모델 — 마스터플랜 §2) + `episodes.published`는 **kindy-web.v2 `/studio` HITL#3 승인 액션만** 뒤집는다(§4-3). mori-studio 코드에 published=true 쓰기 경로 자체를 만들지 않음 — 불변 ②(휴먼 QA 게이트 없는 published=true 금지) |
| `--ep` 배치 실행·요약 카운트 | `qa-gate.ts`는 노드/에피소드 단위 배치 판정 함수로 노출, 결과 요약은 스튜디오팀장 다이제스트(마스터플랜 §6.4)에 집계 |

`gacs_sim.py`(교차 검증 하네스)는 포팅하지 않고, `src/qc/gacs.test.ts`에서 gacs.py의 스모크 기대값(유사도 0.67 사례 — survey-app-ios.md §3)을 고정 픽스처로 회귀 검증한다. 꼬꼬마을 스크립트(`convert_season.py`, `scripts/ep*.json`)·선형 파이프라인(`generate_video.py` 등)은 폐기(확정 결정 §C-9).

음악·SFX 산출물 규약: `renders(kind='music')` 행은 곡별 출처·라이선스 메타를 `input_refs` jsonb의 `license` 필드로 기록한다(§9-5 라이선스 게이트 규약).

---

## 4. 스테이트 머신: Inngest 함수·스텝 매핑

### 4-1. 스테이지 → 스텝 매핑

마스터플랜 §2 플로우 `brief_accepted → … → published`를 Inngest 함수 `studio/episode.produce`(`src/orchestrator/inngest/episode-produce.ts`)의 스텝으로 1:1 매핑한다. `episodes.status`가 스테이트 머신 SSOT(Postgres), Inngest는 실행자다(확정 결정 §C-4).

| 스테이지(마스터플랜 §2) | Inngest 구현 | 담당 에이전트 | 산출물(DB/Storage) |
|---|---|---|---|
| brief_accepted | 이벤트 `studio/episode.requested` 수신, `step.run('accept-brief')` | story-director | `episodes` 행 생성(status='brief_accepted') — brief_accepted는 `pipeline_runs` 기록 대상 아님(스테이지 기록은 motif_report부터 — 0028 stage CHECK, 02 §7) |
| motif_report | `step.run('motif-report')` | motif-scout | motif_report(Storage `studio/{id}/motif.json`) |
| script_draft | `step.run('script-draft')` — 스키마 검증 실패 시 자동 재생성(§3.1 실패 정책) | story-smith | branching_script(zod 통과본) |
| script_review | `step.run('script-review')` — 3회 revise 초과 시 인간 큐(§3.1) | safety-guardian | pass/revise + 오리지널리티 점수 |
| **HITL#1** | `step.waitForEvent('studio/hitl.approved', {match: episode_id+gate:1, timeout:'7d'})` | 인간(/studio) | `episodes.approval_status='approved'`(대본) |
| shotlist | `step.run('shotlist')` — tier 태깅(히어로 10–15%·필러 30–40%, §6.3) | showrunner+storyboard | `shots` 행 일괄 생성 |
| keyframes | 샷 배치를 `step.run('keyframes-batch-N')`로 분할 | art-director | `renders(kind='keyframe')` + Storage |
| **HITL#2** | `waitForEvent(gate:2)` — 노드당 대표 3장 스팟체크(§9 표) | 인간(/studio) | 키프레임 보드 승인 |
| shot_generation | 샷별 이벤트 `studio/shot.generate` 팬아웃 → 별도 fn(concurrency 5 — fal 쿼터 가드, video-generation.ts 패턴), 완료 대기 | gen-operator | `renders(kind='clip')` + cost-guard 차감 |
| auto_qc | `step.run('auto-qc')` — pass/regenerate/reroute/human_review, 재시도 3회(§3-2) | qc | `renders.qc_result/qc_scores` |
| assembly | `step.run('assembly')` — ffmpeg concat·분기 마커·branch manifest | assembly | `episode_nodes.video_url`(세그먼트별) |
| dubbing_mix | `step.run('dubbing-mix')` — TTS·name_slot 세그먼트 분리·BGM/SFX·-16 LUFS | voice-sound | 오디오 트랙 + 믹스본 |
| final_qc | `step.run('final-qc')` — 광과민·라우드니스·자막 정렬 전수 | qc | qc_report(에피소드 레벨) |
| **HITL#3** | `waitForEvent(gate:3)` — 최장 1경로 전체 + 전 엔딩 시사(§9 표) | CEO/위임자(/studio) | 시사 승인 |
| published | `step.run('publish')` — `episodes.published=true` + `library_videos` 1행 미러(published 게이트·FK·RLS 유지, 확정 결정 §C-2) | db/publish.ts | `library_videos.episode_id` FK 연결 |

### 4-2. 멱등성·재실행 정책

- **스텝 멱등**: Inngest 스텝은 완료 시 결과가 메모이즈되어 함수 재실행 시 완료 스텝을 건너뛴다 — "각 스테이지는 멱등이며 실패 시 해당 스테이지만 재실행"(마스터플랜 §2)을 엔진 수준에서 충족. 함수 `id`는 `episode:{episode_id}:v{run}`으로 고정해 중복 트리거를 흡수한다.
- **DB 멱등**: 스텝 내부 쓰기는 `pipeline_runs`(컬럼 정의는 0028 DDL이 정본 — 02 §7; 결과 참조는 `output_ref text` 컬럼)에 스테이지 단위로 기록하고, 재실행 시 `status='succeeded'`인 스테이지는 `output_ref`의 결과를 재사용한다 — 기존 `growth_processed_at` 멱등 프로젝터 패턴(`kindy-web/src/lib/c6/diagnosis-agent.ts:66-68`, survey-addendum.md Q1-2)과 동일 계보.
- **재시도**: 함수 레벨 retries 2(video-generation.ts 실증값), 샷 레벨은 QC 주도 재생성 3회(§3-2). 리트라이 평균 1.4x 초과 시 콘티 프롬프트 회귀 리포트(마스터플랜 §6.3·§13).
- **동시성**: `studio/episode.produce` concurrency 3(에피소드 동시 제작 상한 — 초과 수요 발생 시 Temporal 재검토 트리거, 확정 결정 §C-4), `studio/shot.generate` concurrency 5(fal 쿼터).
- **HITL 타임아웃**: `waitForEvent` 7일 — 타임아웃 시 실패가 아니라 다이제스트 재알림 후 재대기 루프(승인 큐는 상시 채널, 마스터플랜 §6.4).

### 4-3. HITL#1~3 승인 큐(= 정본 백로그 **E11-1**) — kindy-web.v2 `/studio` 운영 페이지로 확정

**결정**: 별도 스튜디오 프런트를 만들지 않고, **kindy-web.v2 안에 `/studio` 운영 페이지**를 둔다. 같은 Supabase의 producer 테이블을 service-role로 읽고, 접근은 오퍼레이터 키 게이트로 막는다. 이 승인 큐는 정본 백로그 **E11-1**("승인 큐(대본 diff/키프레임 보드/시사 링크)+원클릭 승인·반려 사유" — 통합 마스터플랜 v1.0 §4.5)과 **동일물**이며 명칭을 통일한다(별도 구현 아님, §5-0 매핑 표).

- 페이지: `src/app/studio/queue/page.tsx`(승인 대기 큐 — 게이트별 목록), `src/app/studio/episodes/[id]/page.tsx`(대본 diff·키프레임 보드·최종 시사 링크 + 원클릭 승인/반려 — 마스터플랜 §6.4 승인 큐 채널 사양).
- 승인 API: `src/app/api/studio/approve/route.ts` — service-role로 `episodes.approval_status` 갱신 + `INNGEST_EVENT_KEY`로 `studio/hitl.approved {episode_id, gate}` 이벤트 발송(동일 Inngest 계정이므로 kindy-web.v2에서 mori-studio 함수의 waitForEvent를 깨울 수 있다).
- 게이트: `KINDY_OPERATOR_KEY` 검증(미설정 시 503) — 기존 `src/app/api/videos/bespoke/route.ts`의 실증된 오퍼레이터 게이트 패턴 그대로(survey-web-infra.md §1).

**근거**: ① 같은 Supabase 프로젝트(확정 결정 §B-3)라 데이터 접근에 추가 배선이 없다. ② HITL 승인자(CEO/운영·아트 담당 — 마스터플랜 §9 표)가 kindy-web 운영자와 동일 인물이고, 인증·배포(Cloud Run+LB)·이메일(Resend) 스택을 재사용한다. ③ mori-studio는 헤드리스 파이프라인으로 단일 책임을 유지한다(§2 원칙). ④ 오퍼레이터 키 게이트는 이미 코드·시크릿 관리 관행이 있는 검증된 최소 구현이다. 대안(별도 스튜디오 웹앱)은 배포 파이프라인·도메인·인증을 하나 더 만드는 비용 대비 12주 내 이득이 없어 기각한다. 쓰기는 전부 service-role API 경유(불변 ⑥·확정 결정 §C-3 — anon 클라이언트에서 producer 테이블 접근 불가).

### 4-4. 개인 레이어 렌더 워커 — `personal_renders` 잡 규격 (HERO v1.0 §4 DDL·§5 ④)

L2/L3 개인화 산출물은 에피소드 제작 스테이트 머신(§4-1)과 분리된 **개인 레이어 렌더 잡**으로 처리한다. 잡 레코드 SSOT는 `personal_renders` 테이블 — **DDL 정본은 02_SCHEMA_RECONCILIATION.md**(HERO v1.0 §4 원문 승계: `kind` 5종, `status` default 'queued', `model_registry_id`·`cost`·`fallback_used`·`output_url`). 큐 투입 API는 `POST /internal/renders/personal {child_id, kind, episode_id}`(HERO v1.0 §5 ④ — Next.js route 매핑은 02 API 인벤토리 절)이며, 워커는 HERO 측(kindy-web.v2) 잡이 Studio capability(어댑터·프리셋 계약)를 소비하는 구조다 — E13-5 사전조합이 keyframe capability를 쓰는 패턴(확정 결정 §C-11)과 동일. 본 문서는 capability·SLA 규격만 규정한다.

| kind (HERO v1.0 §4 원문 5종) | 산출물 | 사용 capability/어댑터 | SLA (HERO v1.0 §5 ④) |
|---|---|---|---|
| `name_tts` | 호명 이름 단독 세그먼트(E13-4) | 로컬/셀프호스팅 TTS(Qwen3-TTS 후보) — 외부 미전송 원칙(§9-3, 확정 결정 §C-7) | 명시 SLA 없음 — 세션 전 배치 사전 합성 |
| `avatar_still` | 아바타 스틸(144조합 사전조합 E13-5 포함) | keyframe_image(`flux2-lora.ts`, 프리셋 ID 계약 — §5 W3–4 프리즈) | **still < 2m** |
| `moving_cut` | 아바타·단짝 움직이는 컷 | video_i2v 표준 티어(`seedance.ts`) | **moving < 15m** |
| `recap` | 회고 재생 컷 — `bookshelf.path_taken`("선택 경로 기록 = 회고 재생 키", HERO v1.0 §4) 기반 세그먼트 재조합 | assembly(기존 세그먼트 우선, 신규 생성 최소화) | **recap < 60m** |
| `birthday` | 생일 축하 컷 | keyframe_image + video_i2v 표준 티어 | moving 규격 준용(원문 미지정) |

- 비용은 잡별 `cost` 컬럼에 기록해 cost-guard 대장과 합산하고, 폴백 사용 시 `fallback_used=true`(폴백 사다리 — nano-banana·`limited-animation.ts`, docs/10 §2)를 남긴다.
- `personal_renders`는 child_id를 갖는 **HERO 도메인 테이블이며 producer 테이블이 아니다** — mori-studio 어댑터에는 아바타 조합 파라미터·에피소드 자산 참조만 전달하고 아동 식별 정보는 프롬프트에 포함하지 않는다(§9-3 원칙 유지, name_tts는 로컬 경로 전용).

---

## 5. 12주 로드맵 상세 (W1=2026-07-06, 확정 결정 §E)

### 5-0. 정본 백로그 매핑 — E6·E7·E10 ↔ 본 문서 구현물 (통합 제품 마스터플랜 v1.0 §4.5)

HERO v1.1 백로그 개정 R1 행의 "유지: … **E6 전체, E7 전체**"와 E10(오케스트레이터)은 전부 **본 문서(트랙B/mori-studio) 소관**이다 — 트랙A(kindy-web.v2) 개발 부하가 아니다(05 §5 부하 재검산에서 제외). 티켓 AC 원문은 정본 백로그(통합 제품 마스터플랜 v1.0 §4.5)가 정본이며, 본 문서 구현물과의 대응은 다음과 같다.

| 정본 티켓 (마스터플랜 v1.0 §4.5 원문 요지) | 본 문서 구현물 | 비고 |
|---|---|---|
| E6-1 3에이전트(Motif/Smith/Guardian) 가동 — 골든 브리프 10건 스키마 100%·금지어 검출 ≥98% | `src/agents/motif-scout.ts`·`story-smith.ts`·`safety-guardian.ts`(+총괄 `story-director.ts`) — §2, §5 W3–4 ① | AC = T1 통과 기준과 동일(마스터플랜 §10) |
| E6-2 branching JSON 검증기(도달성·길이분산±10%·axis 태깅 필수) | `src/schemas/branching-script.ts` superRefine 규칙(부록 A 원문) — §2 | |
| E6-3 "물방울이 사라진 날" 분기 대본 HITL#1 승인 | §6 파일럿 실행 명세 + `/studio/queue`(§4-3) — §5 W3–4 ② | 브리프 출처 캐비앳은 §6-1 유지 |
| E6-4 오리지널리티 게이트(시놉시스 임베딩 유사도+대조 코퍼스) | §9-2 + `safety-guardian.ts` | |
| E7-1 모리 3D 마스터 외주 발주·검수(턴어라운드 8각·표정 8종) — IP 귀속 계약 명기 | §1-3 캐릭터 바이블 v1 — §5 W1–2 ③ | **D-6 LoRA-first 수정 결정 재확인**(하단 각주) |
| E7-2 조연 4종 Tripo 생성→캐릭터 시트 | 승인 캐스트 6인 프레임 + LoRA 시트 생성·승인 경로(§1-3) | D-6과 동일 계보 — Tripo 신규 발주 불요 |
| E7-3 키프레임 어댑터(FLUX.2, 골든 20태스크 일관성 채점) | `src/adapters/fal/flux2-lora.ts`(2군 nano-banana) + §7 K01–K20 벤치 | |
| E7-4 I2V 어댑터(시드·모델버전·비용 로깅) | `src/adapters/fal/seedance.ts`·`kling.ts` + `renders` 전수 기록(§6-3) | 1군 배치는 §1-5 표(T3가 최종 확정) |
| E7-5 어셈블리(ffmpeg)+TTS 믹스(-16 LUFS, 더킹, 분기 마스터+매니페스트) | `src/agents/assembly.ts`·`voice-sound.ts` — §4-1 assembly·dubbing_mix 스텝 | |
| E7-6 QC VLM 게이트(일관성·공포 프레임·광과민→재생성 루프) | `src/qc/*`(§3-2 포팅 명세) — §4-1 auto_qc·final_qc 스텝 | |
| E7-7 파일럿 완성·HITL#3 시사(최장 1경로+전 엔딩), **원가 ≤₩50만** | §5 W5–6 T2 + §6 실행 명세 | ₩50만 ≈ $357 — 우리 $400 상한과 정합(§6-4 병기) |
| E10-1~4 오케스트레이터 v1(registry·주간 회귀 / Model Scout / 카나리 10%→롤백 / 3채널 다이제스트+승인 큐) | `src/orchestrator/*`(model-registry·eval-harness·weekly-benchmark·model-scout(-cron)·router·digest) — §5 W9–10 ① | 정본 대역 W10–16, 본 문서 W9–10 착수로 정합 |
| E11-1 승인 큐(대본 diff/키프레임 보드/시사 링크)+원클릭 승인·반려 사유 | kindy-web.v2 `/studio` 운영 페이지(§4-3) — **동일물, 명칭 통일** | 화면 구현은 트랙A(DEV), HITL 게이트 소비자는 본 문서 §4 |

> **E7-1 각주 — D-6 재확인**: 정본 백로그 E7-1 원문은 "모리 3D 마스터 외주 발주·검수(턴어라운드 8각·표정 8종) — IP 귀속 계약 명기"(마스터플랜 v1.0 §4.5)이나, 확정 결정 **D-6(00 §2) = LoRA-first**가 이를 대체한다(§1-3 — 기학습 KINDYTOY LoRA v1+승인 캐스트 6인, 드리프트 반복 검출 시에만 3D 외주 승격). 턴어라운드·표정 시트 산출물 요구 자체는 유지하되 LoRA 추론 생성→HITL 승인 경로로 공급한다(§1-3 잔여 리스크 ②). **시트 규격 구분(4 vs 8 해소)**: 표정 8종 = 모리 마스터 시트 규격(E7-1 원문), 표정 4종 = 아바타 베이스·단짝 시트 규격(HERO v1.0 §3 "캐릭터 시트(8각도×표정 4)") — 서로 다른 자산의 규격이므로 충돌 아님.

> **2026-07-07 대표 결정 — E6-3/E7-7 파일럿 재매핑**: 위 표의 "물방울이 사라진 날" 항목은 정본 백로그 이력으로 보존한다. 실행 초안의 첫 파일럿은 `docs/plan/06_CLASSIC_THEATER_LINE.md`에 정의한 **"아기돼지 삼형제" 각색판**이며, §6-1의 CP 구조는 CP1=재료 선택, CP2=위기 대응, CP3=결말 분기로 재매핑한다. "물방울이 사라진 날"은 폐기하지 않고 C6 과학 브리프 자산 및 후순위 에피소드 후보로 이동한다. 근거: `docs/research/pd-classics/00-synthesis.md` "B 채택 시 파생 결정", `docs/research/pd-classics/01-plan-fit.md` §2.1·§2.7·§5.

Studio 12주 = 전체 타임라인 W1–12(7/6–9/27). HERO 릴리즈 트레인(R0=W1–2, R1=W3–8, R2=W9–12)과 교차점을 명시한다.

| 주차(날짜) | 산출물 | 성공 기준 | 의존성·HERO 교차점 |
|---|---|---|---|
| **W1–2** (7/6–7/19) | ① mori-studio 스캐폴드(§2 트리)+어댑터 스모크 ② producer 스키마 DDL 확정 → kindy-web.v2 0024+ 대역 채번·적용 ③ 캐릭터 바이블 v1: **LoRA 생존 확인·이중 백업 + 턴어라운드·표정 시트 LoRA 생성·승인**(§1-3, 마스터플랜 §12 주1–2의 "3D 마스터 발주"를 대체) ④ 골든셋 태스크 파일 확정(§7) ⑤ T3 초기 벤치 1회 → registry 초기 순위 | 모리 턴어라운드 승인(마스터플랜 §12), T3 실행 완료·registry에 eval_runs 기록, Inngest 함수 dev 완주(더미 스테이지) | HERO R0와 병행. R0 체크포인트 **완료(2026-07-05)**: 상위 문서 3벌 전량 수령, §6 브리프 원문(§8.1) 대조 — 일치 확인·보정 불필요(§6-1 출처 명시) |
| **W3–4** (7/20–8/2) | ① Story Guild 4에이전트 가동 ② "물방울이 사라진 날" 대본 HITL#1 승인 ③ 어댑터 레이어 v1(fal/gemini 전체) ④ kindy-web.v2 `/studio/queue` HITL#1 화면(=E11-1, §4-3) ⑤ **룩 프리셋 v1 프리즈**(look-preset.v1.md) | 대본 승인 리드타임 ≤3일(마스터플랜 §12), T1 에이전트 단위 통과(골든 브리프 10개: 스키마 100%·금지어 검출 ≥98% — 마스터플랜 §10) | **HERO E13-5(아바타 사전조합 144×slots, 에피당 <2h — HERO v1.1 백로그 E13-5)가 Studio keyframe capability를 사용** → keyframe 어댑터(flux2-lora.ts)+프리셋 ID 계약을 W3 말까지 프리즈해 R1의 E13-5 배치가 참조 가능하게 함(확정 결정 §C-11) |
| **W5–6** (8/3–8/16) | ① Studio Guild E2E → **파일럿 1편 완성(T2)** ② HITL#2·#3 툴(/studio 확장) ③ 비용 가드 실동작 | 예산 ≤$400 · **≤₩50만(정본 백로그 E7-7 표기 병기, ≈$357)**·리드타임 ≤5일·시사 통과(마스터플랜 §10 T2·§12, 통합 마스터플랜 v1.0 §4.5). **시사 완료는 W5 말(8/7) 목표, 지연 상한 8/12** — Phase B 투입 마감 | 콘텐츠 재고: R1 기간 런칭 재고 "체감 40+"(제품기획서 v2.2 §8 콘텐츠 계약 정본)는 kindy-web.v2의 기존 90s 배치 파이프라인(`scripts/generate-library-batch.ts` 계보)이 담당 — Studio 10분 에피소드는 재고의 質 상층부(§3-1 #15 병행 체제) |
| **W6–7** (8/10–8/23) | **T5 1차 키즈 파일럿 = HERO Phase B 아동 검증 통합 실행**(확정 결정 §E) — 파일럿 에피소드로 15–20명: 검사감·CP 이탈·선택 UI 이해도(마스터플랜 §10 T5). **아동 세션 배정은 8/13(수) 이후 — 8/10–12는 리허설·기기 세팅**(HITL#3 시사·현장 참관 충돌 방지, 04 Task 4.6 동일 제약) | 첫 세션 완료율 ≥70%, CP 무응답률 ≤25%(마스터플랜 §10 — HERO R1 게이트 "5세 첫 CP 무응답 ≤25%"와 동일 임계, HERO v1.1 R1 행) | Phase B 프로토콜은 플레이테스트 리포트 §6이 정본(HERO v1.1 골든테스트 절) — 문서 수령 후 과업표 대조(R0 체크포인트 연장) |
| **W7–8** (8/17–8/30) | ① InteractiveVideoPlayer를 episode_nodes 소비형으로 증축(kindy-web.v2 — `player-map.ts` 계약, 확정 결정 §C-10) ② story_choice 로깅 → `game_rounds`(event_type='story_choice') → `child_growth_profiles` 환류(확정 결정 §C-1, 마스터플랜 §7 C6 환류) ③ 부모 리포트 근거카드에 report_sentence 연결 ④ 플레이어 계약 추가 3건(마스터플랜 §8): ⓐ story_choice·계측 이벤트의 오프라인 로컬 큐잉→동기화(02 §9 큐잉 규약, 유실 <0.1% 예산 내) ⓑ 에피소드 종료 후 자동 다음 재생 없음 + 연속 시청 알림(AAP 미디어 가이드 정합 — A4 클로저 AC, 01 E13-6) ⓒ 자막 기본 표시(whisper VTT 산출물) | 선택 이벤트가 리포트에 표시(마스터플랜 §12 주7–8), 분기 프리로드 전환 끊김 없음(§8 재생 구조) | 플레이어·리포트 코드는 kindy-web.v2 소관(본 문서는 계약만 규정). 기존 플레이어 메커니즘은 완성 상태 — 분기 실사 푸티지가 유일한 결손(survey-addendum.md Q4) |
| **W9–10** (8/31–9/13) | ① 오케스트레이터 v1 완성: Model Scout 크론·카나리 승격·자동 롤백·다이제스트(마스터플랜 §6.2·6.4) ② 에피소드 +3편 착수(누적 4) | 신모델 1개 카나리 실주행(필러샷 10% 배정 — §6.2-3), 다이제스트 3채널 발송 | HERO R2 개시와 병행. 추천 v0.1 접합: 추천 씨앗=에피소드(마스터플랜 §12 주9–10) — `story_seeds`↔`episodes.story_seed_id` FK(마스터플랜 §7) |
| **W11–12** (9/14–9/27) | ① **T5 2차 = 베타 50가구**(마스터플랜 §12 주11–12) ② L2 호명 가동(name_slot 갭리스 교체 — HERO E13-4 로컬 합성 경로) ③ 티어 믹스 튜닝 ④ **T4 레드팀 1차 30건**(§9) | 첫 세션 완료율 70%·리포트 열람률 60%(마스터플랜 §12), 레드팀 누수 0건(§10 T4) | 재무 앵커: M+2(8월말) 유료 20가구 게이트 통과 후 베타 ₩19,000 도서관 한정가 코호트(확정 결정 §E). L2는 E13-4 구현(kindy-web.v2)과 오디오 세그먼트 규격 공유 |

12주 이후: 12편 라이브러리 완성 → L3 프리미엄 베타 → 풀 3D 타당성 재평가(마스터플랜 §12 말미 유지).

---

## 6. 파일럿 에피소드 "물방울이 사라진 날" 실행 명세 (T2)

> **2026-07-07 대표 결정 — 본 절의 실행 대상 변경**: 본 §6은 C6 원본 §8.1 대조 이력과 물방울 브리프 자산을 보존하기 위해 삭제하지 않는다. 단, 첫 Studio T2 실행 대상은 `docs/plan/06_CLASSIC_THEATER_LINE.md` §2의 **"아기돼지 삼형제" 각색판**으로 교체한다. 아래 물방울 명세는 후순위 C6 과학 에피소드 후보이며, 다이아몬드 구조와 HITL/예산 규격은 새 파일럿에 승계된다. 근거: `docs/research/pd-classics/00-synthesis.md` "한 줄 결론"·"B 채택 시 파생 결정", `docs/research/pd-classics/01-plan-fit.md` §2.1·§5·§6.

### 6-1. 브리프

> **출처 명시 (원문 대조 완료 2026-07-05)**: C6 원본 PDF(`~/Documents/GenTA/연구자료/Mori_C6_창의성장지도_연구_및_서비스적용_명세서_v1.0.pdf`) 수령·대조 완료. 원문 §8.1은 단일 에피소드가 아니라 **"물방울이 사라진 날" 8세션 브리프 시리즈**(1.물은 모양이 바뀐다 / 2.얼음이 녹는다 / 3.물방울은 어디로 갔을까 / 4.비가 오는 이유 / 5.젖은 것과 마른 것 / 6.물이 필요한 친구들 / 7.소리 나는 물 / 8.나만의 물방울 발명 — 각각 과학개념·C6축·생각도구·게임 지정)이며, 마스터플랜 §1.2가 이를 **단일 10분 다이아몬드로 압축**한 것이다: CP1(웅덩이·발자국 관찰)↔1·5화 C2, CP2(사라진 순서)↔3·4화 C3, CP3(목마른 친구들)↔6화 C6, L3(나만의 물방울 도구)↔8화 창의적 통합. 아래 재구성 브리프는 이 압축 해석과 **일치 확인** — 보정 불필요. **잔여 7세션 소재는 에피소드 2~8 백로그**(W9–10 누적 4편·12편 라이브러리의 소재원)로 승계한다.

| 필드 | 값 | 근거 |
|---|---|---|
| title | 물방울이 사라진 날 | 마스터플랜 §1.2·§10 T2 |
| target_axis | `C2_observation_inquiry` (보조: C3, C6) | 마스터플랜 부록 A 예시 target_axis + §1.2 CP 표 |
| world_region | `droplet_lab`(물방울 실험터) | 부록 A. c6-spec-v1.md §1에서 물방울 실험터는 C3의 지도 지역 — 에피소드 무대이며 target_axis(C2)와 별개임을 명시 |
| age_band | 5–7세 | 마스터플랜 문서 대상 정의 |
| subject_domain | 물의 증발(상태 변화) — 잘못된 과학 개념 금지(§9 레드팀 항목) | 마스터플랜 §1.2 CP2 "물방울이 사라진 순서" |
| story_problem | 작고 안전한 문제: 실험터의 물방울 웅덩이가 하나둘 사라진다 — 어디로 갔을까? (어둠·괴물·버려짐·처벌 모티프 금지 — §3.3) | 마스터플랜 §3.3 공포·위협 금지 |
| thinking_tools | CP1 `observation`(≒T1_HIDDEN_CLUE), CP2 `pattern_recognition`(≒T3_SEQUENCE), CP3 `empathizing`(≒T6_HEART_LAKE) | 마스터플랜 §1.2 표 × c6-spec-v1.md §4 T1/T3/T6 |
| L3 훅(베타) | T7_CREATE_SCENE(별빛 작업실) "나만의 물방울 도구" 10–15초 컷 | 마스터플랜 §1.3 L3 |
| name_slot | 3–5개, 문장 첫머리 독립 발화(§3.3) | 부록 A 검증 규칙 |
| learning_claim | "물이 사라지는 게 아니라 모양을 바꾼다는 것을 관찰로 발견한다" — 부모에게 말할 수 있는 관찰 가능한 학습 목표 | **C6 원문 부록 C 필수 필드** |
| parent_report_evidence | CP별 report_sentence(부록 A) + "OO이는 반짝이는 단서를 먼저 살펴봤어요" 계열 근거 문장 후보 | C6 원문 부록 C — 리포트에 쓸 근거 문장 사전 지정 |
| HITL_notes | 정서 안전(공포 모티프 0)·문화 민감도·모리 톤(평가보다 질문) 검수 포인트 | C6 원문 부록 C |

> **브리프 스키마 계약**: `src/schemas/brief.ts`(zod)는 **C6 원문 부록 C 15필드**(episode_title, story_seed_id, world_region, target_axis/secondary_axis, thinking_tools 1–3, subject_domain, learning_claim, story_problem, video_A, game_1, video_B, game_2_or_quiz, expression_output, parent_report_evidence, HITL_notes)를 기반으로 하되, 세션 구조 필드(video_A/game_1/video_B/game_2_or_quiz — C6의 세션형 전제)는 **다이아몬드 노드 구조(부록 A branching_script)로 대체**되고, HERO v1.0 §2의 `world_state_digest`(≤500자 + open_threads) 필드가 추가된다. 이 대체·추가는 문서화된 델타다.

### 6-2. 다이아몬드 노드 목록 (마스터플랜 §1.1)

| 노드 | 유형 | 길이 | 내용 골자 | C6 태깅 |
|---|---|---|---|---|
| S0 | segment | 90s | 인트로 — 모리가 실험터 도착, 물방울 친구들 소개, {{child_name}} 첫 호명 | — |
| S1 | segment | 60s | 관찰씬 — 사라진 웅덩이 자리의 단서들(반짝임·젖은 발자국) | C2 연관 |
| CP1 | choice | (15s 타임아웃) | "어디부터 살펴볼까? 반짝이는 웅덩이? 젖은 발자국?" | C2 / observation |
| S2a | segment | 75s | 웅덩이 조사 경로 — 햇빛과 반짝임 관찰 | C2 |
| S2b | segment | 75s | 발자국 추적 경로 — 젖은 것과 마른 것 비교(부록 A learning_beat) | C2 |
| S3 | segment | 90s | 개념씬(재합류) — 물이 하늘로 올라간다(증발) | C3 준비 |
| CP2 | choice | (15s) | "사라진 순서를 맞춰볼까, 아니면 하늘에 물어볼까?" | C3 / pattern_recognition |
| S4a | segment | 75s | 순서 맞추기 경로 — 상태 변화 시퀀스 | C3 |
| S4b | segment | 75s | 하늘에 묻기 경로 — 구름과의 문답 | C3 |
| S5 | segment | 60s | 재합류 — 비가 되어 돌아올 물, 목마른 친구들 등장 | C6 준비 |
| CP3 | choice | (15s) | "목마른 친구들 중 누구에게 먼저 물을 줄까?" (3택) | C6 / empathizing, prosocial_choice |
| E1/E2/E3 | segment | 각 90s | 선택별 엔딩 — 어느 경로든 감정 보상 동등(§3.3 분기 등가성) | — |

합계: 공통 300s(S0+S1+S3+S5) + 분기 300s(S2a/b+S4a/b) + 엔딩 270s = **870s 제작 / 540s 시청 경로 / 12가지 여정(2×2×3)** — 마스터플랜 §1.1 표와 일치. 무응답 시 15초 후 모리가 기본 경로 대신 선택(§1.1 분기 설계 원칙).

### 6-3. 산출물 체크리스트

- [ ] branching_script JSON — `src/schemas/branching-script.ts` zod 통과(도달성·E* 종단·±10%·name_slot 3–5)
- [ ] Safety Guardian 전 항목 통과(§3.4 표: 세계관·C6 정합·금지 카피 0건·정서 안전·문화 편향·오리지널리티·스키마)
- [ ] HITL#1 대본 승인(/studio/queue) — 승인 리드타임 기록
- [ ] shotlist ~145샷(평균 6s), tier 분포: 히어로 10–15%·필러 30–40%(§6.3)
- [ ] 채택 키프레임 ~220장(145×1.5), 생성 ~330장(선별·재생성 ×1.5 — §8-1 비용 기준) + HITL#2 노드당 대표 3장 승인(§9 표)
- [ ] 렌더 ~200회(리트라이 1.4x 예산) — `renders`에 model_id+version+seed 전수 기록(§6.2-5)
- [ ] auto_qc: 광과민(3회/초 플래시 금지)·해부학·텍스트 아티팩트·캐릭터 일관성(§4.4)
- [ ] 오디오: 통합 TTS 트랙(네이티브 오디오 미사용 — §4.3), 대사 -16 LUFS·BGM -12dB 더킹·-1 dBTP, name_slot 별도 세그먼트 파일
- [ ] 세그먼트별 HLS + 분기 그래프 JSON(episode_nodes) + branch manifest(§8)
- [ ] HITL#3: 최장 1경로 전체 + 전 엔딩(E1·E2·E3) 시사(§9 표)
- [ ] `episodes.published=true` → `library_videos` 미러 1행 + `episode_id` FK(확정 결정 §C-2)
- [ ] 비용 대장: cost_ledger 합계, 스테이지별 분해(§8 표와 대조)

### 6-4. 예산·리드타임

- **예산 ≤ $400 · ≤₩50만(정본 병기)**(마스터플랜 §10 T2, 확정 결정 §E; 정본 백로그 E7-7 "원가 ≤₩50만" ≈ $357 @1,400원/$ — 우리 $400 상한과 정합, 통합 마스터플랜 v1.0 §4.5) — §8 재계산 기준 기대치 $110–165이므로 파일럿 특유의 시행착오(리트라이 1.4x 초과, 프롬프트 튜닝)를 흡수할 여유가 2배 이상. cost-guard는 $320(80%) 도달 시 자동 강등 + 경고(§6.3).
- **리드타임 ≤ 5일**(T2): D1 motif+대본+HITL#1 / D2 shotlist+키프레임+HITL#2 / D3–4 샷 생성+auto_qc+assembly+더빙 믹스 / D5 final_qc+HITL#3+발행. HITL 대기가 병목이므로 파일럿 주간은 승인자(대표) 캘린더를 사전 블로킹한다.

---

## 7. 골든셋·벤치(T3) 실행 계획

### 7-1. 대상 capability와 태스크 수

마스터플랜 §6.2-2 "capability별 고정 골든 태스크 20개(부록 C)" 기준. MVP 벤치 대상은 **video_i2v 20 · keyframe_image 20 · tts_ko 20**, 선별 적용 capability는 축소 운영 — lipsync 10(클로즈업 선별 적용이므로 — §4.3), music 6(곡 단위 산출물, 산출 곡은 곡별 출처·라이선스 메타 `input_refs.license` 규약 적용 — §9-5). 태스크 정의는 `src/content/golden/*.json`, 러너는 `scripts/bench.ts`.

**video_i2v 20** (V01–V06 = 부록 C 발췌 ①–⑥, V07–V20 = 확장. ③의 "다람이"는 승인 캐스트에 없어 **꾸미로 치환** — `approved-frames/20260703-cast-kkumi.png`):

| ID | 태스크 | 검증 초점 |
|---|---|---|
| V01 | 모리 턴어라운드 워크사이클 | 정체성 유지(부록 C ①) |
| V02 | 물방울 증발 슬로모션 | 물리(②) |
| V03 | 모리+꾸미 2캐릭터 하이파이브 | 멀티캐릭터(③ 캐스트 치환) |
| V04 | 빗속 우산 씬 | 파티클(④) |
| V05 | 카메라 팬 + 캐릭터 고정 | 정체성 유지(⑤) |
| V06 | 한국어 짧은 대사 클로즈업 | 립싱크 후보(⑥) |
| V07 | first→last frame 체이닝 2컷 연속 | 씬 연결(§4.2-5) |
| V08 | camera_fixed 고정 숏 + 등장 바운스 반복 동작 | 핑크퐁 문법(docs/10 §1 #4) |
| V09 | 3캐릭터 군중 + 배경 보케 | video_multiref(§5) |
| V10 | 밤 장면의 '안전한 어둠'(공포 없는 조도) | 아동 적합성 하한(qa_gate tone≠dark) |
| V11 | 밝기 급변·플래시 유도 프롬프트 저항 | 광과민 안전(§4.4) |
| V12 | 물뿌리개 들고 걷기(소품 상호작용) | 손·소품 해부학 |
| V13 | 걱정→미소 감정 전환 5초 | 표정 연속성 |
| V14 | 달리기 사이드 스크롤 | 다리 모션·블러 아티팩트 |
| V15 | 물 반사·투명 재질 표현 | 재질(에피소드 소재 특화) |
| V16 | 간판 있는 배경(텍스트 무 강제) | 텍스트 아티팩트(§4.4) |
| V17 | 15초 단일 패스 장문 프롬프트 | 장초수 싱크 열화(docs/10 #6) |
| V18 | 정면 응시 대기 루프 3–5s | CP 대기 루프 소재(§8 선택 UI) |
| V19 | 부엉이 할아버지 단독 씬 | 조연 LoRA 일관성 |
| V20 | 30° 궤도 카메라, 배경 고정 | 공간 일관성 |

**keyframe_image 20**: K01–K06 승인 캐스트 6인 단독(레퍼런스 대조), K07–K08 2캐릭터 구도, K09 모리 표정 시트 8종(E7-1 규격 — 아바타·단짝은 표정 4종, §5-0 각주 규격 구분 참조), K10 턴어라운드 8각도 시트, K11–K12 배경 단독(물방울 실험터·마음 호수 — c6-spec-v1.md §1 world_region), K13–K14 캐릭터+배경 통합, K15 소품 클로즈업, K16 야간 조도 안전, K17 군중, K18 네거티브 준수(로고·텍스트·실사 금지 — 부록 B NEGATIVE), K19–K20 아바타 슬롯 합성 2종(HERO E13-5 계약 검증 — 확정 결정 §C-11).

**tts_ko 20**: 모리 평서/질문(CP prompt_line)/격려/속삭임/놀람(5), name_slot 단독 세그먼트 — 2음절·3음절 이름 × 받침 유무 조사 결합(4, KoreanJosa 로직 — survey-app-ios.md §2 Content), 조연 4보이스 각 1(4), 12어절 문장 속도 적정(§3.3 어휘 제약)(2), 의성어·숫자 읽기(2), 감정 오버라이드 3종(3 — `resolveVoiceStyle` 검증).

### 7-2. 루브릭 (100점)

- **video_i2v** (부록 C 원문): 캐릭터 일관성 30 · 프롬프트 준수 25 · 모션/물리 20 · 아동 적합성(공포·왜곡 프레임 무) 15 · 아티팩트 무결성 10.
- **keyframe_image** (video 루브릭의 정지화 변형 — 본 문서 확장): 캐릭터 일관성 30 · 프롬프트 준수 25 · 구도/조형 20 · 아동 적합성 15 · 아티팩트 10.
- **tts_ko** (본 문서 확장): 발음 정확성 30 · 감정 연기 25 · 아동 청감 적합(속도·피치·안전 수위) 20 · 명료도 15 · 노이즈/아티팩트 10.
- 비용·지연은 점수와 **별도 축**으로 `eval_runs.cost/latency_ms`에 기록해 라우팅에 사용(부록 C 원문).

### 7-3. 저지

**VLM 저지 = Claude**(마스터플랜 §4.4·§5 vlm_judge 행): 클립 1fps 샘플 프레임 + 태스크 프롬프트 + 레퍼런스(승인 프레임)를 입력해 루브릭 채점, `eval_runs.scores jsonb`(§6.1 스키마: {consistency, adherence, motion, child_safety, artifact}) 기록. 산수는 코드 재계산(qa_gate.py:102–108 포팅 규칙). 인간 스팟체크는 상위 후보 10%(`human_override` 우선 — §6.2-2·부록 C). 저지 편향 점검: Gemini 교차 채점 10%(§3-2). tts_ko는 청취 스팟체크 비중을 30%로 상향(오디오 VLM 판정 신뢰도 한계 — docs/10 §1 #11의 오디오 체크는 보조 지표).

### 7-4. 벤치 스크립트 실행 방법

```bash
# T3 초기 벤치 (W1–2): capability 전체, 후보 모델 지정
npm run bench -- --capability video_i2v \
  --models seedance-1.5-pro,seedance-2.0,seedance-2.0-fast,kling-3.0-elements,wan-2.5
npm run bench -- --capability keyframe_image --models flux-2-kindytoy-lora-v1,nano-banana-gemini-3-pro-image
npm run bench -- --capability tts_ko --models gemini-2.5-flash-tts,sona-2

# 동작: golden-set.ts 로드 → 어댑터 호출(시드 고정) → Storage 저장 →
#       eval-harness 저지 채점 → eval_runs INSERT → 순위표 markdown 출력
# 옵션: --dry-run(비용 견적만), --tasks V01..V05(부분), --judge claude|gemini
```

- **모델 ID 사전은 0028 시드(02 §7)가 정본** — 위 `--models` 값은 `model_registry.model_id`와 1:1(벤치 결과가 `eval_runs.model_registry_id` FK로 조인되어야 R0 Exit #11이 성립). `wan-2.5`는 0028 시드의 benchmark 행 `('video_i2v','fal','wan-2.5','benchmark','filler',…)` 참조.
- **승격/롤백 규칙은 마스터플랜 §6.2-3·4 원문 그대로**: benchmark 총점 ≥ prod+3 또는 동급&비용 -20% → canary(필러샷 10%만, 2주 관찰); QC 통과율 -10%p·단가 +30%·안전 실패 1건 → 즉시 강등.
- **1회 실행 비용 견적**: video 5모델 × 20태스크 × ~6s ≈ 모델당 120s — Seedance 1.5 Pro $6.2 + 2.0 Fast $2.6 + Kling Element $27–40 + Wan $12 + Seedance 2.0(standard, T3에서 실측) ≈ **$55–70/회**(단가: §1-5 표). keyframe 2모델 40장 ≈ $1.6, tts 무시 가능. 주간 회귀(T6)는 prod 모델만 → $10–15/주. 예산 상한 $100/회를 cost-guard에 등록.
- 초기값 확정 산출물: `model_registry` status='prod' 행 확정(§1-5 표가 가설, T3 결과가 확정 — 확정 결정 §C-8 "초기값은 T3 골든셋 벤치가 최종 확정").

---

## 8. 비용 모델 재계산 (마스터플랜 §11 갱신)

### 8-1. 에피소드당 생성 비용 (870s 제작, 리트라이 1.4x = ~1,218s 생성)

| 항목 | 마스터플랜 §11 원문 | 확정 스택 재계산 | 근거 단가 |
|---|---|---|---|
| 영상 — 필러 40% (487s) | Seedance Fast $0.022/s | **$10.7** (동일 유지) | 마스터플랜 §5 |
| 영상 — 표준 45% (548s) | Kling 3.0 (단가 $0.02–0.15/s 광폭) | **$28.5** — Seedance 1.5 Pro $0.052/s | docs/10 §1 #6 (~$0.26/5s) |
| 영상 — 히어로 15% (183s) | Veo 3.1 Quality $0.15–0.50/s | **$41.0–61.5** — Kling 3.0 Pro @Element $0.224–0.336/s(2배 과금 반영) | docs/10 §1 #6·§5. Veo는 마케팅 전용 제외(§1-5) |
| **영상 소계** | $80–250 | **$80–101** | 상단이 절반 이하로 수렴 |
| 키프레임 ~330장(145샷×1.5장×1.5) | $10–45 ($0.03–0.13/장) | **$13.2** — FLUX.2+LoRA $0.04/장 (nano-banana $0.039 동급) | docs/10 §1 #5, survey-web-infra.md §1 |
| LLM(대본·콘티·QC 판정) | $10–30 | **$10–30 유지** — 90s 편 실측(작가 $0.8+PD $0.1+콘티 $0.2, docs/10 §1)의 10분 분기 스케일업 + QC 프레임 판정 ~1,200장 포함 | 마스터플랜 §11 + docs/10 §1 |
| TTS·립싱크 | $5–15 | **$5–13** — Gemini TTS ~$1(90s 편 ~$0.1의 스케일), 클로즈업 립싱크 OmniHuman $0.14/s × 30–60s = $4.2–8.4(폴백 VEED $0.08–0.15/s), Supertone은 구독제($14.99/mo) 안분 | docs/10 §1 #7·#8 |
| 음악·SFX | $5–10 | **$1–5** — MiniMax Music $0.035×3트랙 + MMAudio $0.001/s×870s ≈ $1 + SFX 라이브러리 구매 안분 | docs/10 §1 #2·#9 |
| **합계(1회성)** | **$110–350** | **약 $110–165** (중앙값 ~$135) | — |
| LoRA 학습(선행 1회) | (해당 없음 — 3D 외주 ₩200–500만) | **$0 추가**(v1 학습 완료) + 재학습 시 $6.4/1000스텝 | §1-3, docs/10 §1 #5 |
| L2 호명 | $0.01–0.05/아이 | 유지(로컬 합성 시 GPU 안분으로 동급 이하) | 마스터플랜 §1.3 |
| L3 나만의 장면 | $0.3–2/아이 | 유지 — 키프레임 $0.04 + I2V 12.5s × $0.052 ≈ **$0.69/아이** 중앙값 확인 | §1-5 단가 |

12편 라이브러리 생성비: 12 × $110–165 = **$1,320–1,980** (마스터플랜 §11의 $1,300–4,200에서 상단 절반으로 갱신).

### 8-2. 재무모델 정합 판정

재무모델 v1.3(추출본 bwm0u0orh.txt)의 가정: **에피소드 제작 원가 ₩200,000/편**("4~5분 에피소드, AI 파이프라인 기준(모델 스택 마스터플랜 참조)", 상태 "가정→R1 실측") × 월 신규 8편 = 콘텐츠 제작비 ₩1,600,000/월 라인.

- **판정: 정합** — 환율 1,400원/$ 가정 시 Studio 10분 인터랙티브 편 생성비 중앙값 ~$135 ≈ **₩189,000 ≤ ₩200,000**. 주의: 재무모델의 ₩20만은 4–5분 에피소드 기준인데 Studio 편은 제작 분량 14.5분(시청 10분)이므로, **분당 원가로는 재무 가정보다 약 3배 효율적**이다(₩20만/4.5분 ≈ ₩4.4만/분 vs $135/14.5분 ≈ ₩1.3만/분). 즉 동일 예산으로 재고의 質 상층부(10분 인터랙티브)를 공급할 수 있다.
- **월 예산 정합**: 월 8편을 전부 10분 인터랙티브로 만들어도 8 × $135 ≈ $1,080 ≈ ₩151만 ≤ ₩160만/월 라인. 히어로 상단 시나리오(8 × $165 = ₩185만)는 초과 — cost-guard의 편당 80% 강등 + 티어 믹스 튜닝(W11–12)이 상한 관리 장치다.
- **상한 체계**: 편당 하드스톱 $400(확정 결정 §E) ≈ ₩56만은 재무 가정의 2.8배 — 파일럿·실험 편에만 허용되는 안전 상한이며, 정본 백로그 E7-7의 파일럿 원가 상한 **≤₩50만(≈$357)** 도 이 안에서 충족된다(통합 마스터플랜 v1.0 §4.5 — §6-4 병기). 정상 운영 목표선은 ₩20만(재무모델)으로 잡고 R1 실측(재무모델 스스로의 검증 조건)을 §6-3 비용 대장으로 공급한다.
- **HITL 인건비는 생성비 외수**: 재무모델의 "콘텐츠·검수 인건비 ₩3,000,000/월" 라인이 흡수(마스터플랜 §11 "생성비 + HITL 인건비" 구분과 일치).

---

## 9. 안전·법무

### 9-1. 3중 게이트 (마스터플랜 §9 그대로 채택)

| 게이트 | 시점 | 주체 | 기준 | 구현 위치 |
|---|---|---|---|---|
| 자동 검수 | 상시 | Safety Guardian(§3.4)·QC(§4.4) | 금지어 0건·주인공 문법 5(아이별 주인공 체계 콘텐츠에 적용 — E16-1 카피 린터와 규칙 공유)·정서 안전·광과민·해부학·오리지널리티 | `src/agents/safety-guardian.ts`, `src/qc/*` |
| HITL#1 대본 | 스크립트 확정 | 교육팀/운영(M7 채용 전 = CEO 일 30분 승인 큐 — 00 §6·재무모델 인건비 시작월) | C6 문서 12절 표 전체 + 개인정보·AI기본법 체크리스트(마스터플랜 §13 아동 데이터 행) | kindy-web.v2 `/studio/queue`(§4-3) |
| HITL#2 키프레임 | 키프레임 완료 | 디자이너 PT | 캐릭터 바이블 정합·룩 통일(노드당 대표 3장) | 동상 |
| HITL#3 최종 시사 | 인코딩 완료 | CEO/위임자 | 최장 1경로 전체 + 전 엔딩 시청 | 동상 |

published=true는 HITL#3 승인 액션만 가능(불변 ②, qa_gate FINAL RULE 포팅 — §3-2). 아이 표면에는 AI 흔적 0(불변 ⑤), 점수·등급·진단 어휘 노출 금지(불변 ③ — report_sentence는 관찰 문장 문법만, c6-spec-v1.md §0-5 금지 카피 사전을 Safety Guardian 금지어 사전에 포함).

### 9-2. 오리지널리티 게이트 (마스터플랜 §3.2)

- 소재 코퍼스는 퍼블릭 도메인만(전래동화·그림 형제·안데르센·이솝의 구조·모티프·감정 비트), 원문 표현 재사용 금지. 동시대 상업작은 분석 전용 — 이미지 프롬프트에 브랜드명·캐릭터명 금지어 리스트 적용(부록 B NEGATIVE "brand logos"와 이중화).
- Safety Guardian이 완성 대본 시놉시스를 임베딩 유사도로 코퍼스·주요 아동작품 시놉시스 DB와 대조, 임계 초과 자동 반려. 임베딩 모델은 `gemini-embedding-001`(§3-2와 동일 — 단일 임베딩 스택). 시각물은 QC 단계 동일 게이트.
- B2G(도서관) 채널 특성상 무관용(마스터플랜 §13 저작권 행) — 임계 근접 사례는 반려 통계로 스토리팀장 다이제스트에 보고(§6.4).
- **2026-07-07 대표 결정 — 고전 극장 원전 처리 보강**: PD 고전 각색은 복수 원전 대조→공통 골격 추출→자체 재화→자체 시각화→KIPRIS 상표 검색을 HITL#1 진입 조건으로 추가한다. 현대 번역본·출판사 각색본·삽화·타사 캐릭터 디자인 차용은 금지하며, 체크리스트는 `docs/plan/06_CLASSIC_THEATER_LINE.md` §3을 따른다. 근거: `docs/research/pd-classics/03-copyright.md` §2·§3·§5, `docs/research/pd-classics/00-synthesis.md` "저작권(03)".

### 9-3. 아동 데이터

- **L2 이름(개인정보)**: 이름 단독 발화 세그먼트만 처리, 문맥 미포함, 외부 API 미전송 원칙 — Qwen3-TTS 셀프호스팅 로컬 합성이 기본안(마스터플랜 §1.3 개인정보 주의 + 확정 결정 §C-7), HERO E13-4 "외부 미전송 검증"(HERO v1.1 백로그)이 수용 기준. 게이트 통과 전까지 L2는 비활성(L1만 런칭 — 마스터플랜 §1.3 시점 표에서 L2 런칭을 검증 후행으로 조정).
- **행동 로그**: 선택 이벤트는 기존 `game_rounds` 스트림(event_type='story_choice')으로 적재(확정 결정 §C-1) — 기존 비식별화 파이프라인 경유(마스터플랜 §13). mori-studio는 아동 식별 데이터를 저장하지 않는다(producer 테이블에 child_id 없음 — L3 산출물만 renders(kind='l3_personal')로 리포트에 연결, 마스터플랜 §7).
- **법정 체크리스트**: 개인정보보호법·AI기본법 항목을 HITL#1 체크리스트에 포함(마스터플랜 §13). 부모 표면의 법정 AI 고지는 kindy-web.v2 소관(불변 ⑤ "부모는 법정 고지").

### 9-4. 레드팀 분기 계획 (마스터플랜 §9·§10 T4)

- **1차 W11–12**(§5 로드맵): 시나리오 30건 — ① 무서운 프레임 유도 프롬프트 ② 편향 유도(가족 형태·외모·성별 역할) ③ 잘못된 과학 개념(증발 소재 특화 오개념 주입) ④ 금지 카피 우회 표현(동의어·초성 변형) — 통과 기준 누수 0건(마스터플랜 §10 T4).
- **이후 분기별 반복**(마스터플랜 §9 "아동안전 레드팀(분기별)"): 2차 = 2026 Q4(R3–R4 기간). 누수 1건 = 해당 규칙 즉시 패치 + 해당 게이트 회귀 태스크를 골든셋에 영구 추가(레드팀 → 골든셋 환류).
- 실행 하네스: `scripts/bench.ts --capability safety --tasks R01..R30`(레드팀 시나리오를 골든 태스크와 동일 파일 형식으로 관리 — 게이트 누수율을 eval_runs로 계측).

### 9-5. 음악·SFX 라이선스 (마스터플랜 §4.3 음악 조항)

- **상업 라이선스 확인 = W1–2 파운더 게이트**: MiniMax Music·MMAudio V2의 상업 라이선스 조항 확인(fal "Commercial use" 표기 기준 + 트랙별 약관 재확인 — docs/10 §5 권장)을 W1–2 파운더 게이트로 등재하고, 확인 결과를 `model_registry.policy_notes`에 기록한다. 미충족 시 폴백 = 라이선스 라이브러리 구매(§1-5 표 2군).
- **곡별 출처 기록**: `renders(kind='music')` 행마다 곡별 출처·라이선스 메타를 `input_refs` jsonb 내 `license` 필드 규약으로 기록한다(learning_claim 계보 — 마스터플랜 §4.3 "곡별 출처 기록"). B2G 저작권 무관용 원칙(§9-2)과 동일 선상.

---

**마지막 원칙**(마스터플랜 결문 승계) — 파이프라인은 자동이지만, 세계관·안전·아이에게 하는 말은 사람이 지킨다. AI는 후보를 만들고, 모리의 목소리는 승인된 것만 아이에게 닿는다.
