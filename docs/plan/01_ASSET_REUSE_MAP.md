# 01. 자산 재활용 지도 (ASSET REUSE MAP)

**목적**: kindy-web(`codex/ai-diagnosis-demo`, 26a5f5f)·kindy-app의 기존 자산을 HERO v1.1 백로그 티켓 단위로 매핑하여, "무엇을 그대로 쓰고, 무엇을 개조하고, 무엇을 새로 짓는지"를 한 장으로 확정한다.

**원천 문서**: HERO 개발실행계획서 v1.1(`/Users/jongwonlee/Downloads/files/HERO_개발실행계획서_v1.1_통합정본.md`) · 아이별 제품기획서 v2.2(`/Users/jongwonlee/Downloads/files/아이별_제품기획서_v2.2_통합정본.md`) · Mori Story Studio 마스터플랜 v1.0(`/Users/jongwonlee/Downloads/Mori_Story_Studio_마스터플랜_v1.0.md`) · **문서세트 2026-07-05 수령분**(BASE=`/Users/jongwonlee/Downloads/아이별_문서세트_2026-07-05`): 통합 제품 마스터플랜 v1.0(`BASE/01_현행정본/Kindy_통합_제품_마스터플랜_v1.0.md` — 이하 "**정본 §4.5**" = 동 문서 §4.5 실행 백로그)·통합 마스터플랜 v1.1 개정판(P-1 얼리버드)·HERO v1.0 원문(`BASE/03_이력보관/HERO_개발실행계획서_v1.0.md`)·플레이테스트 리포트 v2.1(E15-2 정본) · kindy-web/kindy-app 코드·문서·인프라 조사 4벌 + 갭 검증 애덴덤(DECISIONS_CONTEXT §A) · 확정 결정 컨텍스트(DECISIONS_CONTEXT §B–§E).

**이 문서가 SSOT인 범위**: 티켓↔기존 코드 매핑, 재활용 등급(그대로/개조/신규), kindy-app 이식 목록, 폐기 목록, 콘텐츠·데이터 자산 인벤토리. (스키마 상세는 02 문서, 스튜디오 설계는 마스터플랜+03 문서 소관.)

**재활용 등급 정의** — **그대로**: 경로 이동·환경 변수 외 코드 변경 없음 / **개조**: 기존 파일을 증축·수정 / **신규**: 새로 작성(단, 기존 패턴·자산을 레퍼런스로 씀). 규모: S(≤2일), M(≤1주), L(>1주) 추정.

---

## 1. v2 부트스트랩 자산 개요 — 복제로 통째로 상속되는 것

v2는 kindy-web `codex/ai-diagnosis-demo` 브랜치(main+50커밋, 최신 26a5f5f)를 복제해 시작한다(DECISIONS_CONTEXT §B.1 — 백지 재작성 금지). 미추적 파일 `키오스크_앱_개발플랜.md`·`KIOSK_하드웨어_제작계획.md`(git status `??` 확인)도 함께 복사한다. 복제 시점에 다음이 전부 작동 상태로 상속된다(경로는 복제 후 kindy-web.v2 기준 동일).

| 계층 | 자산 | 근거 |
|---|---|---|
| 프레임워크 | Next.js 16(App Router)·React 19·TS 5·Tailwind 4·Supabase JS·Toss SDK v2·Anthropic/fal/Google GenAI SDK·Inngest 4 | `package.json` (survey-web-code §1) |
| DB 스키마 | 마이그레이션 `supabase/migrations/0001`–`0023` 21본 전체: children/videos/view_events(0001), credits·purchases(0004), RLS 전면(0006), library_videos(0010–0013, 0020–0021), syllabus(0014), 키오스크 퍼널(0015), game_sessions·game_rounds(0016), 구독 3종(0017/0019/0022), parent_consents(0018), **C6 성장지도 5테이블+시드 6축**(0023) | survey-web-code §3. v2 증축은 0024부터(§B.3) |
| C6 코어 IP | `src/lib/c6/` 9파일 2,016LOC — `axes.ts`(6축+13생각도구), `evidence.ts`(축 업데이트 공식 v0.1 축자 구현+단위테스트), `diagnosis-agent.ts`(`growth_processed_at` 멱등 프로젝터, 66–68행), `recommendation.ts`(+테스트), `growth-view.ts`(내부 숫자→외부 씨앗 상태 경계), `report-data.ts` | survey-addendum Q3 |
| 게임·세션 | `src/components/game/SessionShell.tsx`(1062L, 2막 세션 오케스트레이터), 미니게임 4종(`PuzzleGame` 753L 외), `src/lib/game/engine.ts`(534L 적응 난이도), `sel-report.ts`(310L, 개수-만 집계), `/play`(405L 세션 진입+무료 3회 게이트), `FirstJourneyShell.tsx`(890L 입장 여행) | survey-web-code §2.3, §6 |
| 분기 플레이어 | `src/components/game/InteractiveVideoPlayer.tsx`(446L) — 씬 그래프 분기, 탈리 임계 멀티엔딩, 15s TTS 리프롬프트+30s 자동 선택, iOS Safari 폴백, 선택→`game_rounds` 적재. 타입 `src/types/interactive-session.ts` | survey-addendum Q4 |
| 결제 | Toss v2 빌링 풀스택: `src/lib/toss.ts`, `billing-crypto.ts`(AES-256-GCM), `subscription.ts`, `src/app/subscribe/*`, `api/payments/*`, `src/inngest/functions/subscription-renewal.ts`(286L 멱등 갱신+더닝) | survey-web-code §6, survey-web-infra §7 |
| 제작 파이프라인 | `src/lib/episode-pipeline.ts`(1284L), `limited-animation.ts`(478L 저비용 렌더러), `src/lib/video-providers/` 10모듈(claude-director/nano-banana/seedance2/gemini-tts/veed-fabric/sync-lipsync 등), `src/lib/studio/qa-agent.ts`, 생성·검증 스크립트 20여 본(`scripts/`) — **video-providers·episode-pipeline은 mori-studio로도 이식**(§B.2) | survey-web-infra §1 |
| 키오스크 퍼널 | `src/app/demo/kiosk/page.tsx`(466L), `src/lib/kioskTrack.ts`, `/start`+`AttributionTracker.tsx`, `api/kiosk/events`·`api/attribution/claim`, 0015 스키마 | survey-web-code §6 |
| 배포 | `Dockerfile`(ffmpeg+tini 포함)·`cloudbuild.yaml`·`scripts/deploy-cloud-run.sh` — GCP kindy-493701, Cloud Run 서울, Secret Manager 6종 | survey-web-infra §4 |
| 문서 SSOT 계보 | `docs/00_HANDOFF`(용어 가드레일)·`SERVICE_OVERVIEW`·`07`(갭 감사)·`09`(실행 정본)·`10`(스튜디오 v2)·`RUNBOOK`·`BRAND_DNA.md`(07-03 대표 승인)·`DESIGN.md`(토큰)·`.dev-team/memory/c6-spec-v1.md`·`docs/curriculum/teaching-spine.md`·`docs/superpowers/specs/` 2본 | survey-web-docs §5 대체 지도 |
| 브랜드·콘텐츠 자산 | §5 상세 — LoRA·승인 프레임 6인·22 TTS mp3·동물마을 세계 데이터·데모 그래프 | — |

**상속과 동시에 지켜야 할 불변 조항**은 DECISIONS_CONTEXT §D의 8개 조항이며 본 문서 전 행에 적용된다.

---

## 2. HERO 백로그 티켓 ↔ 기존 코드 매핑

**공통 머지 게이트 각주**: R1 화면 티켓 공통 머지 게이트 = 기획서 §11 QA 체크리스트 15항(PR 템플릿 배선은 05_R1_SEQUENCING.md §운영 규칙).

### 2.0 정본 확보 고지 — E1~E12는 추정 아님 (반드시 읽을 것)

**추정 아님 — 정본 백로그 확보**: 통합 제품 마스터플랜 v1.0 §4.5(에픽 12 × 티켓 46, "각 티켓 문구는 그대로 Claude Code 작업지시서로 사용 가능하도록 완료 기준(AC)을 내장")를 **2026-07-05 수령**했다. 아래 표의 E1~E12 행은 전부 정본 AC로 갱신되었고, 종전 ◪(추정) 표기는 제거했다. E13~E16 계열·E5-2'·E8-2'의 티켓 체계는 HERO v1.1 §6 + 우리 신설(E16)을 유지한다. 정본 §4.5의 주차(W1~) 배치는 HERO v1.1 릴리즈 트레인(R0~R4) 기준으로 아래 절에 배치했다(실행 주차 확정은 05 문서).

**종전 추정 대비 정정 6건** (대조 기록 — 재발 방지용):

| 종전 추정(오류) | 정본(§4.5) |
|---|---|
| E1-3~6 = 온보딩 5단계 | E1 = 커머스·계정: E1-3 1탭 해지 / E1-4 결제 D-3 알림 / E1-5 얼리버드 가격 락 / E1-6 현금영수증·세금계산서. 온보딩 5단계 개정은 E1-2 확장+기획서 W2 |
| E3 = 분기 에피소드 유료 배포 | E3 = C6 데이터 레이어(HERO v1.1이 R2 유지) — 분기 배포는 E8+E13-9 소관 |
| E4 = 아이 앱 표면 골격(A1·A2) | E4 = **부모 리포트(L2 최우선, R1)** — A1·A2 화면은 정본에 대응 에픽 없음(§2.2 별도 행) |
| E6 = 부모 리포트 | E6 = Story Guild — **트랙B(mori-studio) 소관**(03 문서) |
| E7 = 결제·구독·해지 | E7 = Studio 파이프라인 — **트랙B 소관**(03 문서). 결제는 E1-1 |
| E11-2 = 해지·데이터 삭제 | E11-2 = 12절 검수 체크리스트 폼(원문 표기 그대로). 해지=E1-3, 30일 삭제 E2E③=E1-3+D-4 파기 파이프(§2.2 E1-3~6 행) |

E12-1'은 v1.1 §6 제목 + 정본 §4.5 E12-1 AC + 기획서 v2.2 W1(화면 정본)을 합쳐 읽는다. E9는 폐지가 아니라 승계: E13-4가 R1으로 앞당겨진 것이며(HERO v1.0 §6 "구 E9 앞당김" — 정본 §4.5의 E9-1~2 AC는 E13-4에 흡수), **E9-3(호명 코호트 vs 대조군 유지율 실험, W12)만 잔존 개념**이다.

### 2.1 R0 (W1–2)

| 티켓 | 요구사항 요약 | 재활용 기반 (경로 : 역할) | 등급 | 규모 |
|---|---|---|---|---|
| E1-1~2 | **E1-1** Toss 결제위젯+웹훅: 테스트카드 결제→entitlement 활성→환불 왕복 성공, 웹훅 멱등(재시도 중복 과금 0) / **E1-2** PIPA 3동의 플로우(법정대리인·국외이전·**GACS 민감정보**): consents 기록+철회 경로, 법무 문구 버전 관리 (정본 §4.5 W1–2) | 결제는 **기구현 — 라이브 키 게이트만 잔여**: `src/lib/toss.ts`·`billing-crypto.ts`(AES-256-GCM)·`subscription.ts` : 결제 코어 / `src/app/subscribe/*`+`api/payments/*` : 빌링키 등록·결제 / `src/inngest/functions/subscription-renewal.ts`(286L) : 멱등 갱신+더닝 / `0017`/`0019`/`0022` : 구독 스키마. 동의는 `src/app/onboarding/page.tsx`+`0018_parent_consents.sql` : PIPA 동의 스텝·저장(**gacs_sensitive·overseas_transfer scope 증축은 02 커머스 델타 003x**) / `src/app/legal/*`+`src/content/legal/*.md` : 법정 페이지 | 그대로(결제)+개조(동의 scope) | S |
| E2-1~3 | **E2-1** 키오스크 QR 딥링크 ks=UUID→가입 귀속: 관별 전환 추적 E2E 검증 / **E2-2** §4.4 이벤트 10종 SDK 삽입: 전 이벤트 대시보드 도달 확인 / **E2-3** 퍼널 대시보드(Supabase view+간이 차트): 5단 전환율 일간 자동 (정본 §4.5 W1–2). 풀퍼널 E2E ①(v1.1 §7)의 실행 홈은 05 문서 W7 | **대부분 기구현**(정본 대조 2026-07-05 실사 확인): E2-1 = `src/app/start/page.tsx`+`AttributionTracker.tsx`+`src/lib/attribution.ts`+`api/attribution/claim` : QR ks 귀속 왕복 완성(E2E 검증만 잔여) + `0015_kiosk_funnel.sql` : kiosk_sessions·kiosk_events·parent_attribution / E2-2 = `api/events`·`api/game/events`·`api/kiosk/events`+`src/lib/game/events-client.ts` : 수집 파이프 3종 가동(§4.4 10종 중 미배출 타입 — report_viewed·checkout_started·subscription_canceled·episode_exhaustion_signal 등 — 삽입은 개조) / E2-3 = `api/dashboard/summary`+`/dashboard` : 대시보드 골격(퍼널 5단 view는 신규부). 피처 플래그 7종(HERO v1.1 §0)은 정본 §4.5에 별도 티켓 없음 — 기존 코드 부재, E13-8 홀드아웃 배선과 함께 신규(05 문서 배치) | 기구현+개조(이벤트 정렬·퍼널 view)+신규(플래그) | S–M |
| E11-1 | 승인 큐(대본 diff/키프레임 보드/시사 링크)+원클릭 승인·반려 사유 (정본 §4.5 — **R0 유지 티켓**, HERO v1.0 §6 "R0 유지: E11-1(HITL콘솔)"). **본 플랜의 `/studio` 운영 페이지(00 §3 W5–6·03 §4-3 HITL 화면)와 동일물 — 명칭 통일: 이후 "E11-1 승인 큐(/studio)"로 표기** | `src/lib/studio/qa-agent.ts` : QC 산출 표시 원형 / 03 문서 HITL 계약 : mori-studio가 산출(대본 diff·키프레임·시사 링크), kindy-web.v2 `/studio`가 표시·승인 / episodes.status(02 DDL) : 상태 소스. 종전 이 행에 있던 동의·파기 기준선은 E1-2(위)·E1-3(§2.2)으로 이관 | 신규(패턴 재활용) | M |
| E13-1 | 아바타 144조합(3×8×6) 에셋 발주 (v1.1 §3). 원문 규격(HERO v1.0 §3·§6 E13-1): 베이스 3종은 모리 외주사 파생 발주·단짝 6종은 Tripo 생성, 산출물 = **캐릭터 시트(8각도×표정4) QC 통과**, 발주 계약에 **IP 귀속 조항** 명기 | 프라이어 아트 제로(survey-addendum Q1-5 — 그린필드, §C.11). 발주 레퍼런스: `docs/BRAND_DNA.md` : KINDYTOY 룩 정본 / `src/content/studio/approved-frames/` : 승인 캐스트 6인 / `src/content/studio/lora/kindytoy-v1.json` : LoRA 포인터 | 신규 | M |
| E13-2 | 004 스키마(avatars/world_states/bookshelf/personal_renders/episodes 슬롯)+리듀서+005(product_defaults) — 전부 0024+ 번호로 재배치(§B.3). AC 원문: "이벤트 리플레이로 상태 재구성 유닛테스트 100%"(HERO v1.0 §6). **리듀서 매핑 원문(HERO v1.0 §2)**: story_choice(prosocial=help)→characters_met.append(relation:helped)+open_threads 생성 규칙표 / expression_saved(T7)→items_invented / episode_completed→places·version++ / 무응답 기본경로→상태 변경 없음(중립 처리 — 아이 불이익 금지). world_state v1 실물 스키마는 02 갱신본 참조 | `0023_c6_growth_map.sql` : parent_id text·RLS·service-role 쓰기 컨벤션 원형(§C.3) / `src/lib/c6/diagnosis-agent.ts`(66–68행) : `growth_processed_at` 멱등 프로젝터 → `world_processed_at` 리듀서로 복제(§C.1) / `0016` game_rounds : 이벤트 스트림(event_type='story_choice' 등 적재처). 주의: 기존 `world_region` 컬럼(0023, C6 지도 지역)과 world_state는 별개 개념(§C.1) | 신규 스키마+패턴 개조 | M |
| E13-10 | 안전 자동 게이트: 사진·카메라 코드 부재 테스트, 실사 유사 QC (v1.1 §3·§7) | `src/lib/studio/qa-agent.ts` : 기존 QC 에이전트 골격 / `/Users/jongwonlee/dev/kindy-app/pipeline/qa_gate.py` : 비전 5축 판정+재생성 큐 로직 포팅(§C.9) / 코드 부재 보증 테스트는 신규(00_HANDOFF §4의 금칙어 grep 가드레일 패턴 차용 — survey-web-docs §3) | 개조+신규 | S |
| E12-1' | W1 랜딩 개정: 헤드라인·리포트 실물 1장·신뢰 칩 3·ks 조건부 ₩19,000 배지 (기획서 W1, [결정 P-1]) + 정본 §4.5 E12-1 AC: **얼리버드 카운터("첫 200가구")+신뢰 블록(1탭 해지·D-3 알림 명시)** — 오너 CMO/CC | `src/app/page.tsx` : 크림/잉크 랜딩 원형 / `DESIGN.md` : 토큰 정본(각주: 기획서 §5와 충돌 델타 존재 — 모션·radius·아이 표면 토큰 부재·violet 잔재. E16-2 디자인 토큰 개정(§2.2, R1 W3)으로 해소, 그때까지 기획서 §5가 상위 정본) / `docs/04_LAUNCH_COPY.md` : 카피 가드레일 | 개조 | S |

### 2.2 R1 (W3–8)

| 티켓 | 요구사항 요약 | 재활용 기반 (경로 : 역할) | 등급 | 규모 |
|---|---|---|---|---|
| E1-3~6 | **E1-3** 1탭 해지+기간말 유지: 해지 후 재구독 왕복 테스트, 사유 입력은 선택 / **E1-4** 결제 D-3 알림(알림톡/메일)+발송 증적 컬럼 저장 / **E1-5** 얼리버드 가격 락(price_locked): M7 정가 전환 후에도 락인 가구 19,000 유지 검증 — **P-1 정책: 도서관 ks 경유 가입 한정·12개월 락·200가구 하드캡**(통합 마스터플랜 v1.1 개정판) / **E1-6** 현금영수증·전자세금계산서(B2G) 발행 연동 — 오너 CFO/CC (정본 §4.5 W2–3). **E2E③(해지→30일 삭제, v1.1 §7)의 실행 홈 = E1-3+D-4 PIPA 파기 파이프**(통합마스터플랜 v1.0 파운더 게이트 2번·§4.6 "삭제 요청 30일 내 파기" — 종전 E11-2 배정은 오류, §2.0 정정표) | `api/subscription/cancel` : 해지 훅(1탭 UX·기간말 유지 검증은 개조) / `src/inngest/functions/subscription-renewal.ts` : D-3 알림 삽입점(더닝 스케줄 기구현) / `0017` subscriptions : `price_locked`·`cancel_effective_at`·`next_billing_notice_sent_at` 컬럼 증축(02 커머스 델타 003x) / `supabase/manual/0008_demo_parent_cleanup.sql` : 30일 파기 SQL 패턴 / 현금영수증·세금계산서 연동은 신규 | 개조+신규(E1-6) | M |
| E1-2 확장 | W2 온보딩 5단계 개정: 인증→3동의+아동 쉬운 고지→프로필 2필드(이름·출생연월)→기기 페어링 6자리→완료 (기획서 v2.2 W2 — 정본 §4.5에 별도 티켓 없음: E1-2의 R1 확장분, §2.0 정정표). AC: 티어A 온보딩 고지 1줄(기획서 §7 [결정]) | `src/app/onboarding/page.tsx` : 4스텝 온보딩+동의 원형(5단계·필드 ≤5로 재구성) / `src/app/auth/*` : 인증 / `0018` : 동의 저장. 페어링 6자리는 신규 / UX 레퍼런스: `kindy-app/Kindy/Onboarding/OnboardingView.swift`(§3) | 개조+신규(페어링) | M |
| E4-1~4 | **부모 리포트(L2 — 최우선, R1)**: **E4-1** 주간 리포트 API(§4.3-②): placeholder 제거, 근거카드는 실 이벤트에서만 생성 / **E4-2** 금지카피 린터: C6 문서 §11 금지어 사전 0건 통과해야 발송(**리포트 발송 게이트**) / **E4-3** 리포트 열람→결제 훅: 열람 화면 하단 얼리버드 제안, report_viewed→checkout 전환율 측정 / **E4-4** 근거부족 축 카피("씨앗은 관찰 횟수가 적어요") 자동 분기 (정본 §4.5 W3–4 — 종전 "아이 앱 화면" 추정은 오류, §2.0 정정표) | `src/lib/c6/report-data.ts`(366L) : 리포트 로더+한국어 템플릿(E4-1 재사용 — placeholder 제거·실 이벤트 근거카드로 개조) / `growth-view.ts` : 숫자→씨앗 상태 경계(불변 조항 ③) / `src/app/dashboard/report/page.tsx`(803L) : 리포트 UI / `src/lib/game/sel-report.ts` : 개수-만 집계 / `api/agents/growth` : 진단 트리거 / E4-4는 report-data.ts의 evidence_count 분기 개조 / **E4-2 린터는 신규 — E16-1과 규칙 사전 공유·공용 모듈**(§2.2 E16-1 행 참조) | 개조+신규(E4-2) | M |
| (A1·A2 화면) | 아이 앱 화면: A1 내 책장(홈: 새 책 1권 유일 CTA·이야기 문 6=C6축)+A2 세션 플레이어 골격 (기획서 v2.2 §4 A1·A2 — **정본 §4.5에 대응 에픽 없음**: 실행은 E13-6 책장·E13-15 CP0·E8 플레이어+기존 SessionShell 개조로 커버, 배치는 05 문서 W7) | `src/components/game/SessionShell.tsx`(1062L) : 세션 오케스트레이션·TTS·보상 / `src/app/play/page.tsx` : 세션 플랜·성장축 정렬 라이브러리 픽 / `src/lib/useVoice.ts` : 사전 TTS 재생 / `src/components/MoriCharacter.tsx` : 모리 표면. A1 책장 메타포 홈 UI는 신규(현행 진입은 책장형 아님) | 개조+신규(A1) | L |
| E5-1 | 심플 에피소드 16→28: 야간 배치+qa_gate --approve 플로우, 주 3편 페이스 (정본 §4.5 W1–4; 체감 40+은 E5-2(→E5-2') 변형과 합산 — 기획서 §8) | `src/lib/episode-pipeline.ts` : 90s 에피소드 파이프 / `scripts/animate-episode.ts`·`library-matrix-90s.ts` : 배치 진입점+스펙 매트릭스 / `src/lib/limited-animation.ts` : 저비용 본편 렌더. 신규 10분 분기 에피소드 제작은 mori-studio 소관(§B.2, 마스터플랜 §12 주5–6) | 개조 | L |
| E5-3 | 소진 조기경보: 아이별 fresh_remaining<주간수요 시 `episode_exhaustion_signal` 발화 (정본 §4.5 W4; 이벤트 속성 child_id·fresh_remaining — 정본 §4.4, F5 콘텐츠 소진 대응. 02 이벤트 사전 보강 참조) | `0010`–`0013`·`0020`–`0021` library_videos+`scripts/list-library-videos.ts` : 재고 집계·조회 원형 / `api/game/events` : 이벤트 배출 경로(신규 타입 추가) | 신규(패턴 재활용) | S |
| E6 전체 | **Story Guild — 트랙B(mori-studio) 소관, 03 문서**(HERO v1.1 R1 유지 "E6 전체" — 정본 백로그 확인, 트랙A 부하 아님): **E6-1** 3에이전트(Motif/Smith/Guardian) 가동: 골든 브리프 10건 스키마 100%·금지어 검출 ≥98% / **E6-2** branching JSON 검증기: 도달성·길이분산±10%·axis 태깅 필수 통과 / **E6-3** "물방울이 사라진 날" 분기 대본 HITL#1 승인(C6 문서 8.1 브리프) / **E6-4** 오리지널리티 게이트: 시놉시스 임베딩 유사도 임계+대조 코퍼스 (정본 §4.5 W2–5 — 종전 "부모 리포트" 추정은 오류, §2.0 정정표) | mori-studio 구현물(03 문서 §2·§9 매핑) — v2 측 접점은 E11-1 승인 큐(/studio)와 episode_nodes 소비뿐. **트랙A 부하 산정 제외(05 §5)** | (트랙B) | — |
| E7 전체 | **Studio 파이프라인 — 트랙B(mori-studio) 소관, 03 문서**(HERO v1.1 R1 유지 "E7 전체"): **E7-1** 모리 3D 마스터 외주 발주·검수(→**D-6 LoRA-first 수정 결정 유지** — 00 문서 D-6, 드리프트 반복 시에만 승격) / **E7-2** 조연 4종 Tripo→Blender→캐릭터 시트 / **E7-3** 키프레임 어댑터(FLUX.2 멀티레퍼런스, fal) / **E7-4** I2V 어댑터(Kling 3.0 Elements 주력/Seedance 폴백) / **E7-5** 어셈블리(ffmpeg)+TTS 믹스(-16 LUFS) / **E7-6** QC VLM 게이트(일관성·공포·광과민) / **E7-7** 파일럿 완성·HITL#3 시사 — 원가 **≤₩50만(정본)** ≈ $357, 우리 $400 상한과 정합 (정본 §4.5 W1–8 — 종전 "결제·구독" 추정은 오류: 결제는 E1-1(§2.1), §2.0 정정표) | mori-studio 구현물(03 문서 §3·§5 매핑) — 이식 원천은 §1 표의 video-providers·episode-pipeline. **트랙A 부하 산정 제외(05 §5)** | (트랙B) | — |
| E11-2 | 12절 검수 체크리스트 폼 내장(승인 시 필수 체크) (정본 §4.5 W5, 원문 표기 그대로 — 종전 "해지·데이터 삭제" 추정은 오류: 해지=E1-3, 30일 삭제 E2E③=E1-3+D-4 파이프(§2.2 E1-3~6 행·§2.0 정정표). 데이터 다운로드(기획서 W5 신규부)는 R2 이월 별도 건 — 05 §디스코프) | E11-1 승인 큐(/studio)에 폼 내장(§2.1 E11-1 행) / `docs/06_LAUNCH_UX_C6_BENCHMARK_2026-06-30.md`(51개 점검 항목) : 체크리스트 폼 항목 원형 참조 | 신규(승인 큐 증축) | S |
| E12-2~3 | **E12-2** 맘카페 시딩 키트(도서관 체험 후기 프레임)·현장 이벤트 키트(주말 2회, W3–7) / **E12-3** paid IG 3세트 A/B(리포트 스크린샷 소재): CAC 실측 리포트(W5) — **오너 CMO(정본 §4.5) — 개발 부하 산정 제외(05 §5)**. 개발 접점: 리포트 스크린샷 소재(E4-1 산출물)·ks 귀속 링크(E2-1 기구현) | 개발 자산 소요 없음(마케팅 오퍼레이션). 관별 A/B 플래그(`src/lib/kioskTrack.ts`+`0015` kiosk_sessions.location_code)는 E13-7' 데모 v2 행 소관 | (CMO) | — |
| E13-3' | A0 탄생 의식: 아바타 3스텝+이름 3모드(추천 3택→음성→초성 밴드 게이팅), 총 <90s, 무입력 "단짝아". **각주(D-14)**: 원문 E13-3은 "A0 아바타 조립 화면(**iOS**)"(HERO v1.0 §6)이나, **D-14(CEO 승인 2026-07-05)로 웹 선행** — R1–R2 아이 화면은 웹(iPad 브라우저/PWA), iOS 이식은 R3 착수(00 문서 §2 D-14·리스크 R-14) | 아바타 UI 신규(그린필드, addendum Q1-5). 부품: `src/lib/josa.ts` : 받침·조사 처리 / `src/lib/useVoice.ts` : 모리 음성 1질문 재생 / UX 레퍼런스 `kindy-app/Kindy/Onboarding/OnboardingView.swift`(8스텝 음성 가이드)·`PlanRevealView.swift`(완료 연출) | 신규(패턴 재활용) | L |
| E13-4 | 호명 파이프: name_slot 갭리스 오디오 교체+로컬 TTS, 외부 미전송 검증 (§C.7). **구 E9-1·E9-2 승계**(HERO v1.0 §6 "구 E9 앞당김" — 정본 §4.5 E9-1 "name_slot 오디오 규격(문두 독립 발화)+갭리스 스왑"·E9-2 "로컬 TTS(Qwen3-TTS 셀프호스팅): **이름 단독 세그먼트만 합성**, 외부 API 미전송 검증" AC 흡수; E9-3 호명 코호트 실험만 잔존 개념 — §2.0). name_tts는 personal_renders 5-kind 중 하나 — 렌더 잡 **SLA: still<2m·moving<15m·recap<60m**(HERO v1.0 §5 ④, 02 DDL 정본) | `src/lib/gemini-tts.ts`(318L)·`scripts/gen-village-tts.ts` : 사전 TTS 생성·매니페스트 패턴 / `src/lib/useVoice.ts` : 클라이언트 재생(갭리스 세그먼트 교체 로직은 신규) / 이름 단독 세그먼트 로컬/셀프호스팅 합성(Qwen3-TTS 후보)은 신규(마스터플랜 §1.3 L2 개인정보 원칙) | 개조+신규 | M |
| E13-5 | 사전조합 스틸 배치: 144×slots, 실패 조합 폴백, 에피당 <2h. AC: 티어A 폴백 강제 무결 E2E ②(v1.1 §7) | `src/lib/video-providers/nano-banana.ts` : 레퍼런스 고정 이미지 생성(2군) / `tmp/studio/train-kindytoy-lora.ts`+`src/content/studio/lora/kindytoy-v1.json` : FLUX.2+LoRA 1군(§C.8) / `scripts/gen-ip.ts` : 변형 배치 스크립트 패턴 / Studio keyframe capability 재사용(§C.11) | 개조 | M |
| E13-6 | 책장 v1: A1/A5 path_taken 고정 회고 재생, "다르게 골라볼래" CP 재진입, replay_view 계측 + A4 클로저 화면 편입: 책 접힘 900ms→책장 슬라이드 인, 자동 다음 재생 없음+연속 시청 알림(기획서 A4·AAP 정합, 03 §5 W7–8 플레이어 계약) | `src/components/game/InteractiveVideoPlayer.tsx` : 분기 재생 엔진(path_taken 고정 모드는 신규 모드 추가) / `src/app/library/[id]` : 시청 표면 / `0011` view_events : replay 계측 기반. bookshelf 데이터는 E13-2 스키마 | 개조+신규 | M |
| E13-7' | 키오스크 데모 v2 = 2스텝(단짝+색), 호명 "친구야", 이름 수집 코드 부재 테스트, 관 A/B (기획서 K1, [결정 D6]) + K2 3분 체험 편입: 영상 90s(선택 무드)+성공 보장 미니게임 1+모리 칭찬, AC 완주 ≥70%·자막 기본 (기획서 K2 — 완주 계측 k2_completed는 02 §9 kiosk_events) | `src/app/demo/kiosk/page.tsx`(466L) : 현행 캐릭터→토픽→무드 데모를 2스텝으로 축약, K2는 현행 /demo/kiosk의 영상+미니게임 흐름 재사용 판정 / `src/lib/kioskTrack.ts`+`qrcode.react` : QR 핸드오프 / `키오스크_앱_개발플랜.md`(S0–S5·오프라인 내성) : 실행 플랜 / UX 레퍼런스 `kindy-app/Kindy/Kiosk/KioskFlowView.swift`·`KioskClosureView.swift`(§3) | 개조 | M |
| E13-8 | 티어A on/off 50:50 배선+W4 유지율 대시보드. 코호트 대시보드 후반부(차트 폴리시) →W8 이후 상시로 이월(05 §디스코프) | 홀드아웃 배정: `0023` recommendation_logs.personalization_inputs : 배정 기록 패턴(배정 로직은 신규) / `api/dashboard/summary`·`scripts/list-library-videos.ts` : 집계·운영 조회 패턴 | 신규+개조 | M |
| E13-15 | CP0 연습 선택: 오프닝 15s 내 양택 동일 반응, 5세 리드 2회(6s/11s), passive_first_cp 계측 (기획서 CP0) | `InteractiveVideoPlayer.tsx` : 선택 오버레이+타임아웃+TTS 리프롬프트 기구 완비(addendum Q4 — 226–303행) / `src/data/demo/mori-demo-graph.ts` : 연습용 그래프 원형. 리드 타이밍 6s/11s·동일 보상 연출만 개조 | 개조 | S |
| E13-16 | 연령 기본값 시스템: 005 스키마+`GET /api/children/[id]/session-config`+무언 적용+홀드아웃, 3밴드 E2E (§C.12) | product_defaults SQL은 v1.1 §4 원문을 0024+로 재배치(신규) / `src/app/api/children/[id]/route.ts` : Next.js 동적 route 골격 / `src/lib/game/engine.ts` : 밴드 파라미터 소비처(세션 길이·CP 옵션 수 주입) | 신규(골격 재활용) | M |
| E13-17 | 이름 추천 풀 100 큐레이션+금칙·발음 검사 파이프. R1은 큐레이션 20 하드코딩+금칙 검사로 축소, 풀 100 완성 →R2 이월(05 §디스코프) | `src/lib/josa.ts` : 받침 판정(발음 검사 기초) / 00_HANDOFF §4 금칙어 grep 가드레일 : 금칙 검사 패턴(survey-web-docs §3). 풀 큐레이션 자체는 신규 데이터 작업 | 신규+개조 | S |
| E13-18 | A3 별빛 작업실 탭 배치: 슬롯 펄스→후보 탭, 3슬롯, 드래그는 7세 실험군 (기획서 A3, [결정 D7]). R1은 탭 배치 기본만, 드래그 실험군 →R2 이월(05 §디스코프) | `src/components/game/DecorateGame.tsx`(275L) : 꾸미기 배치 게임 원형(탭 배치로 전환) / 결과물의 "오늘 책 마지막 장면 반영 4s"는 신규 연출 / 참고: `kindy-app/Kindy/Activities/CreativeCanvasView.swift`(정답 없는 창작 캔버스 패턴) | 개조 | M |
| E15-1 | 아동 관찰 계측 7종(cp_timeout·passive_first_cp·tap_miss·assist_needed·replay_view·naming_mode_used·session_fatigue_exit), 전부 비식별 | `0016`+`0023` game_rounds(response_payload jsonb) : 적재처 / `src/lib/game/events-client.ts`·`api/game/events` : 배출·수집 경로. 이벤트 타입 7종 정의·배출 지점 삽입은 신규 | 개조 | M |
| E15-2 | Phase B 키트(W6–7): 과업 6 스크립트·행동 코딩 시트·동의·합격선 ±10%p·재시뮬 러너 — Studio T5 키즈 파일럿과 통합(§E). **프로토콜 정본 = 플레이테스트 리포트 v2.1 §6(2026-07-05 수령 완료 — 종전 미수령 캐비앳 해제)**, 파라미터는 동 문서 §1·발견 8건은 §3 | 운영 산출물 위주 신규. 근거 재료: `docs/research/`(8편, 8초 룰 등 근거 라이브러리) / `docs/06_LAUNCH_UX_C6_BENCHMARK_2026-06-30.md` : 51개 점검 항목 / **재시뮬 러너 = `playtest_sim.py` 실물 확보(§5 시뮬 스크립트 — 재구축 불필요, 시드 고정)** | 신규+재사용(러너) | M |
| E5-2' | 신규 에피소드 주인공 포맷: avatar/companion_slots+cp_options_variants(2택 서브셋 필수)+재시청가치 태깅 (기획서 §8 콘텐츠 계약). AC: 주인공 문법 5 자동 게이트(E16-1 린터와 연동, 03 §9-1 Guardian 확장). 계보: 정본 §4.5 E5-2(Theme 변형 3종×에피소드, 경량 검수 트랙)를 HERO v1.1이 주인공 포맷으로 개정한 티켓 | 마스터플랜 부록 A 분기 스크립트 스키마 : 정본(§C.10) / `src/types/interactive-session.ts` : Scene/ChoiceOption/EndingRule 필드 매핑 대상 / `src/content/studio/animal-village-bible.ts`(267L+테스트) : 콘텐츠 계약 검증 패턴 / `scripts/library-matrix-90s.ts` : 에피소드 스펙 매트릭스 원형 | 개조+신규 필드 | M |
| E16-1 | 카피 린터 v2 (R1 W3): 기획서 §6 금칙→대체 사전+주인공 문법 5 규칙+CI 배선(아이 표면 문자열 대상) — 전 화면 공통 머지 게이트(기획서 §0 R5·§6). 04 Task 2.5의 임시 grep 검사를 정식화. **E4-2(리포트 금지카피 린터, 정본 §4.5)와의 관계**: 규칙 사전 공유(기획서 §6 금칙+주인공 문법 5 + C6 문서 §11 금지어), 적용 표면 상이 — E16-1 = **아이 표면 문자열 CI 머지 게이트** / E4-2 = **리포트 발송 런타임 게이트**. 중복 아님 — 사전·검사기를 공용 모듈로 구현하고 배선만 분리(§2.2 E4-1~4 행) | `docs/00_HANDOFF` §4 금칙어 grep 가드레일 : 검사 패턴 원형(확장) / 03 §9-1 Safety Guardian : 주인공 문법 5 규칙 공유 / `docs/04_LAUNCH_COPY.md` : 카피 가드레일 | 개조+신규 | M |
| E16-2 | 디자인 토큰 개정 (R1 W3): 기획서 §5를 상위 정본으로 선언, 아이 표면 토큰 증축(터치 ≥120pt·타이포 28/20·R20·모션 300–450/700–900ms·무드 4), violet 컴포넌트 잔재 제거 | `DESIGN.md` : 개정 대상(현행은 부모 웹 전용 토큰 — E12-1' 행 각주 참조) / `docs/BRAND_DNA.md` : 브랜드 정본 | 개조 | S |

### 2.3 R2 (W9–12)

| 티켓 | 요구사항 요약 | 재활용 기반 (경로 : 역할) | 등급 | 규모 |
|---|---|---|---|---|
| E3 전체 | **C6 데이터 레이어(HERO v1.1이 R2 유지)**: **E3-1** 001_c6 마이그레이션 적용+백서 §9.3 필드(story_seed_id·thinking_tool·world_region·elapsed_ms) 기존 JSON에 백필 / **E3-2** story_choice→game_rounds 적재 경로: 이벤트→행 매핑 유닛테스트 / **E3-3** growth updater 배치(공식 v0.1): 세션 종료 5분 내 child_growth_profiles 갱신, 멱등 (정본 §4.5 W2–4 — 종전 "분기 에피소드 배포" 추정은 오류: 분기 배포는 E8+E13-9, §2.0 정정표) | **대부분 기구현(0023+diagnosis-agent — 정본 대조 2026-07-05 실사 확인)**: E3-1 = `0023_c6_growth_map.sql` : c6_axes·story_seeds·child_growth_profiles·recommendation_logs 신설+game_rounds에 §9.3 4필드 기적용(마이그레이션분 완료 — **기존 JSON 백필만 잔여**) / E3-3 = `src/lib/c6/diagnosis-agent.ts` : `growth_processed_at` 멱등 프로젝터+`evidence.ts` 공식 v0.1 축자 구현·단위테스트(실질 완성 — 배치 5분 SLA 확인만) / E3-2 = `api/game/events`→game_rounds 적재 경로 가동 중(event_type='story_choice' 매핑+유닛테스트 추가 — E8-4와 연동) | 기구현+개조(백필·story_choice 매핑) | S |
| E8 전체 | **분기 플레이어(R2 유지)**: **E8-1** 매니페스트 파서+세그먼트 HLS 재생(웹): 노드 전환 끊김 <300ms / **E8-2** 선택 오버레이+대기루프+15s 타임아웃 기본경로: 무응답도 실패 경험 아님(모리 대사) / **E8-3** 분기 프리로드(CP 20s 전 후보 첫 청크): 3G 프로파일 테스트 / **E8-4** story_choice 로깅→E3-2 경로 연결, 재시청 카운트 / **E8-5** 광과민 검증 통과 영상만 게시 플래그(퍼블리시 조건) (정본 §4.5 W7–9; CP 응답률 ≥75%는 v1.1 §0 R2 Exit) | `InteractiveVideoPlayer.tsx`(446L) : 분기·탈리 엔딩·리프롬프트·선택 오버레이 기구(현행 30s 자동 선택→15s 개정) → episode_nodes 소비형 증축(§C.2·C.10) / `docs/superpowers/specs/2026-07-01-interactive-video-session-design.md` : 세션 구조 헌법 / HLS 재생·세그먼트 프리로드는 신규 재생 계층 / `0011` view_events : 재시청 카운트 기반 / 실분기 클립은 mori-studio 산출(현행 그래프는 15s 데모 mp4 슬라이스 placeholder — `src/data/worlds/animal-village.ts:589-666`, addendum Q4) / E8-5 게시 플래그는 library_videos published 게이트 재사용 | 개조+신규(HLS·프리로드) | L |
| E13-9 | world_state 주입+연속성: digest ≤500자 브리프 계약, Story Smith 3규칙·Guardian 5룰 자동 반려, 골든테스트 10 CI (v1.1 §2·부록 A) | E13-2 리듀서 산출(world_states) : 입력 / `src/lib/c6/diagnosis-agent.ts` : 폴드 패턴 재사용 / 브리프 주입·연속성 검수는 mori-studio Story Guild 소관(마스터플랜 §3) — v2 측은 스냅샷 제공 API만 | 신규(패턴 재활용) | L |
| E13-11 | 티어B 워커: 주1 무빙컷 온디맨드, 아이당 ₩4,800 하드캡 | `src/inngest/functions/video-generation.ts`(61L) : 워커 골격(재시도 2·동시성 5) / `src/lib/video-providers/seedance2.ts` : I2V 어댑터 / `0002` videos.cost_ledger : 비용 원장 패턴+마스터플랜 §6.3 예산 강등 규칙 | 개조 | M |
| E8-2' | 단짝 반응 컷 1.5s(감탄만, 분기 등가성) — CP 전환 <300ms 예산 내 (기획서 A2) | 반응 컷 에셋: E13-5 사전조합 capability 재사용 / 삽입 지점: `InteractiveVideoPlayer.tsx` 선택 직후 시퀀스 | 개조 | S |

### 2.4 R3 (W13–16)

| 티켓 | 요구사항 요약 | 재활용 기반 (경로 : 역할) | 등급 | 규모 |
|---|---|---|---|---|
| E10 전체 | **오케스트레이터 v1(R3 유지) — 트랙B(mori-studio) 소관, 03 문서**: **E10-1** model_registry·eval_runs 가동+골든셋 주간 자동 회귀 / **E10-2** Model Scout(릴리즈 감시→candidate 자동 등록, policy_notes) / **E10-3** 카나리 10%(필러샷)→자동 롤백 조건 구현, 실주행 1회 / **E10-4** 3채널 일일/주간 다이제스트(Slack)+승인 큐 링크 (정본 §4.5 W10–16; 베타 50 운영은 v1.1 §0 R3 Exit) | **mori-studio 레포 소관**(§B.2, 03 문서 매핑). 이식 기반: `src/inngest/functions/*` : 스텝 함수·재시도 패턴(§C.4 Inngest 채택) / `src/lib/video-providers/index.ts` : 어댑터 배럴 → GenAdapter 인터페이스로 승격 / model_registry·eval_runs 스키마는 마스터플랜 §6.1 SQL 기준 신규(0024+ 재배치) | 신규(이식 기반, 트랙B) | L |
| E12-4 | 도서관 성과 리포트 v1(관별 이용·전환): 분기 자동 발송(L4 연료) — 오너 CC/CSO (정본 §4.5 W10 → 우리 R3. 종전 "부모 웹 확장" 추정은 리포트 아카이브·성장 지도 탭 건 — 정본에 대응 에픽 없음, E4 연장선으로 05 문서 배치) | `api/dashboard/summary` : 집계 골격 / `0015` kiosk_sessions.location_code+parent_attribution : 관별 이용·전환 원천(기구현) / `src/app/dashboard/*`(680L)·`report-data.ts` : 리포트 표면·데이터 계층 재사용 | 개조 | M |
| E13-12 | 월간 리캡(티어C): 부모 전용·승인 후 공유·워터마크 (기획서 §7) | `src/lib/episode-pipeline.ts` : 컷 조립·ffmpeg concat / renders 테이블(E13-2/스튜디오 스키마) kind 확장 : 산출 기록 / 승인·워터마크 플로우는 신규 | 개조+신규 | M |
| E13-13 | 생일 단품 파일럿(L3 개인 장면 유료 단품) | 마스터플랜 §1.3 L3 : 키프레임 1장+I2V 1클립($0.3–2/아이) / personal_renders(E13-2 스키마) : 저장 / `0004` purchases+`api/purchases` : 단품 결제(bundle_type 확장) — 크레딧 UX는 폐기하되 purchases 테이블은 재사용(§4) | 개조 | M |
| E13-14 | 티어 판정 리포트: 티어A/B 실험 데이터 → 판정 자료 확정 | `0023` recommendation_logs·game_rounds : 원천 데이터 / `scripts/verify-migrations.ts`·`verify-rls.ts` : 운영 스크립트 작성 패턴. 분석 스크립트 자체는 신규 | 신규 | S |

### 2.5 R4 (W17–24)

| 티켓 | 요구사항 요약 | 재활용 기반 (경로 : 역할) | 등급 | 규모 |
|---|---|---|---|---|
| E14-1 | Kids 정식 심사 패키지(**iOS 심사**) — **선행 조건(D-14, CEO 승인 2026-07-05)**: R3에서 kindy-app에 비디오 플레이어(question_hold)·A0 이식 착수 완료가 전제. R1–R2 아이 표면은 웹 선행이므로 심사 대상 iOS 앱은 R3 이식 산출물. 이식 지연 시 심사 지연 = 리스크 R-14(00 문서 §7) | `kindy-app/Kindy/Parent/ParentGateView.swift`(208L) : Kids 카테고리 준수 부모 게이트(구구단·잠금) / `Kindy/Subscription/PaywallInfoView.swift`(505L) : 심사 보수적 페이월+App Review 리스크 문서화 / `Kindy/Subscription/DataTransparencyView.swift` : 데이터 투명성 화면 / `docs(kindy-app)/HUMAN_TODO.md` : 심사 제출 체크리스트 / 이식 원천: kindy-web.v2의 웹 플레이어·A0(R1–R2 산출물, D-14) | 개조(이식) | L |
| E14-2 | 형제 세계(두 번째 책-세계) | `docs/superpowers/specs/2026-07-01-worldview-anthology-design.md` : 우산 세계 "모리의 이야기 도서관"+후보 세계 3 / `kindy-app/Kindy/Content/ThemePack.swift` : 테마 오버레이·village 폴백 패턴. 콘텐츠 자체는 mori-studio 신규 제작 | 신규(설계 재사용) | L |
| E14-3 | POD 실물 책 | 신규. 재료: E13-5 개인 스틸(표지=오늘의 개인 스틸 — 기획서 A4) / bookshelf path_taken(E13-6) : 내지 스토리 데이터 / `0004` purchases : 단품 결제 재사용 | 신규 | M |
| E14-4 | 안정화·성능 예산 전항(세션 시작<3s·CP<300ms·아바타 저장<1s·사전조합<2h·이벤트 유실<0.1% — v1.1 §7) | `scripts/smoke-*.ts` 8종 : 단계별 스모크 하네스 / `scripts/verify-rls.ts`·`verify-migrations.ts` : 검증 스크립트 / E15-1 계측 : 예산 실측 원천 | 개조 | M |
| E14-5 | 데이터룸 10폴더 자동화 | 신규. 재료: `api/dashboard/summary`·purchases·kiosk_sessions 집계 : 지표 원천 / `런칭_마스터플랜.md`·`IR_보강안_2026-06.md` : 지표 정의·IR 논리(survey-web-docs §1-3·§2) | 신규 | M |

---

## 3. kindy-app에서 가져올 것 (레포: /Users/jongwonlee/dev/kindy-app)

kindy-app은 통째로 상속하지 않는다 — 아래 항목만 **로직 포팅/UX 패턴 이식**한다(§C.9 "신규 재작성 없이 로직 포팅"). Supabase 미접속(localhost 하드코딩, survey-app-ios §1)·테스트 부재이므로 코드 직수입이 아니라 로직 단위 이식이 원칙이다.

| 자산 | 경로 | v2/mori-studio 진입 방식 |
|---|---|---|
| **GACS-3 어휘·안전경계** | `Kindy/Personalization/GACS.swift`(225L)·`pipeline/gacs.py`(209L, Swift와 동일 어휘·경계의 Python 미러)·`pipeline/gacs_sim.py`(교차 검증 하네스) | 하드 안전 클리핑(tone≥0.35·valence≥0.4·arousal≤0.85·novelty≤0.7)과 좌표→형용사 앵커 사전을 **mori-studio 프롬프트 컨디셔닝 모듈(TS)로 포팅**(§C.9). v2 측은 무드 시스템(기획서 R9·§7 "무언 조정 6종 — 무드(GACS, 안전 클리핑 유지)")의 좌표 소스로 동일 사전 공유. ⚠️ 이름 충돌 주의: kindy-web `src/lib/gacs3.ts`(96L)는 좌표 엔진이 아니라 구 비스포크용 단어 가중치 모듈(파일 헤더 "per-child word weights for video generation prompts") — 별개 개념이므로 포팅 시 명명 분리 |
| **qa_gate.py 판정 로직** | `pipeline/qa_gate.py`(275L) | mori-studio **TS QC 에이전트로 포팅**(§C.9): ① GACS 재측정(생성 이미지에서 형용사 5개+tone 추출, 임베딩 코사인 ≥0.5, tone="dark" 즉시 탈락 — Kim/Kim/Park 2025 프로토콜) ② 비전 5축(스타일·캐릭터·연령안전·기술·감정, 평균 ≥7) ③ `regen_queue.json` 최대 2회 재생성 ④ **human `--approve` 없이는 published 불가**(불변 조항 ② 그대로). 기존 `kindy-web/src/lib/studio/qa-agent.ts`와 병합하고 마스터플랜 §4.4 QC 루브릭(부록 C 100점)을 채점표로 채택 |
| **키오스크 UX 패턴** | `Kindy/Kiosk/KioskFlowView.swift`(174L)·`KioskClosureView.swift`(166L) | 코드가 아닌 **패턴 이식**: 어트랙트 루프→탭→짧은 세션→어트랙트 복귀, 히든 44pt 종료 버튼+부모 게이트, **듀얼 오디언스 클로저(좌: 아이 축하 TTS / 우: 부모 가치 제안+온디바이스 QR)** → E13-7' 데모 v2와 `키오스크_앱_개발플랜.md`(S0–S5) 구현에 반영. 이름 미수집 원칙은 K1 [결정 D6]과 이미 정합 |
| **온보딩 패턴** | `Kindy/Onboarding/OnboardingView.swift`(606L)·`PlanRevealView.swift`(319L) | 패턴 이식: 음성 가이드(모리가 말함) 스텝 진행·아이 관심사 3탭 시딩·최종 CTA에서만 프로필 생성·2.6s 분석 로더→개인화 여정 리빌("aha") → **A0 탄생 의식(E13-3')과 W2→A0 전환 연출**의 레퍼런스. 단 v2 온보딩 필드는 기획서 W2(이름·출생연월 2필드)가 정본 |
| (보조) 8초 룰 인터랙션 | `Kindy/Story/StoryPlayerView.swift`(523L) | 재프롬프트 1회·무한 대기·오답 없는 재시도·이모지 큐 선택 카드 — CP 카드 UX(A2·CP0)의 검증된 선행 구현. 15s 타임아웃 정책 자체는 기획서 §3이 정본 |
| (보조) 오프라인 엔타이틀 | `Kindy/Subscription/EntitlementService.swift`(179L) | "웹 결제, 앱은 상태 반영"+7일 오프라인 grace 패턴 — R4 Kids 심사 대비 아이 앱 표면의 결제 문구 0 원칙(기획서 QA 체크 13번) 구현 레퍼런스 |

---

## 4. 명시적 폐기 목록

| 폐기 대상 | 경로 | 판정 근거 |
|---|---|---|
| 꼬꼬마을 세계관·시즌1 콘텐츠 | `kindy-app/Kindy/Resources/season1.json`(98KB, 8에피소드)·`kindy-app/pipeline/scripts/ep01_a.json`~`ep08_b.json`(16본)·`kindy-app/docs/WORLD_BIBLE.md`·`CHARACTER_PROMPTS.md` | §C.9 "꼬꼬마을 세계관·선형 스크립트 폐기 — 동물마을+모리 LOCK이 정본"(`kindy-web/docs/03_LAUNCH_FOUNDATION_LOCK.md`, 06-19 LOCK). 상세 근거는 §5 season1.json 항 참조. 어휘 규칙 등 계승분은 이미 `docs/superpowers/specs/2026-07-01-worldview-anthology-design.md`에 흡수됨(survey-web-docs §4) — 원본 추가 참조 불필요 |
| 미리(Miri) 브랜드 잔재 | `supabase/migrations/0010_library_videos.sql:14`(`character_name text not null default '미리'`)·`IR_DECK.md`(미리 캐릭터·하늘색 브랜드 v1.0) | 브랜드 정본은 모리+크림/세이지(`IP_북메이트_캐릭터바이블.md`+`docs/BRAND_DNA.md`, survey-web-docs §1-2). 0024+ 마이그레이션에서 default '모리'로 변경+기존 행 정리, IR_DECK은 이력 보관만(숫자 논리 참고용) |
| legacy /player 비스포크 표면 | `src/app/player/[videoId]/page.tsx`(아이별 비스포크 플레이어)·`src/lib/video-pipeline.ts`(585L, $4.94/15s 6단계 파이프)·`api/videos/bespoke` | survey-web-code §2.1 판정 "discard/legacy". HERO의 개인화는 아바타 스틸+분기(티어A/B/C)로 대체 — 에피소드별 비스포크 영상 경로는 v2 로드맵에 없음. 단 `docs/OFFER_MODEL_RECONCILE.md`(07-01)의 20가구 콘시어지 기록이 있으므로 즉시 삭제가 아닌 **동결(경로 비노출·신규 호출 금지)** 후 R1 유료 전환 시 제거 |
| 크레딧 번들 구매 UX | `api/credits/route.ts`·`api/purchases`의 번들 플로우·`0004_credits_purchases.sql`의 bundle_type(single/pack6/pack15) UX 경로·`0005_three_free_credits.sql`의 크레딧 무료분 | 구독(0017 `kindy_monthly`)+무료 3세션 게이트(`src/lib/subscription.ts` free-trial limit 3)로 대체(survey-web-code 결론부 "credits-bundle purchase UX superseded by subscription"). **purchases 테이블 자체는 존치** — 구독 결제 행(0017에서 체크 완화)·생일 단품(E13-13)·POD(E14-3)가 재사용 |
| deprecated 운영 스크립트 | `scripts/apply-migrations.sh` | 파일 스스로 DEPRECATED 명기, 정본은 `supabase db push`(survey-web-code §4, §C.3) |
| 레거시 멀티에이전트 하네스 | `AGENTS.ai-team-kit.md` | `.dev-team/` 하네스로 전환 완료(`.dev-team/memory/decisions.md` 07-02, survey-web-docs §2) |
| GACS 동명 레거시 모듈(개념) | `src/lib/gacs3.ts`(96L)+`word_profiles`(0001)의 형용사 가중치 루프 | 비스포크 프롬프트용 단어 가중치 엔진으로, C6(what)+GACS 좌표(how) 체계(c6-spec §추천 v0.1)와 무관. 신규 개발 참조 금지 — GACS 좌표 엔진 포팅(§3) 시 명명 충돌 해소 |
| 마스터플랜 초기값 중 폐기 확정분 | 마스터플랜 §4.3·§5 "tts_ko 1군 ElevenLabs" → 폐기(한국어 아동 보이스 정책 차단 3중 검증 — `docs/10_STUDIO_V2_AGENT_TEAM_2026-07-03.md` §3, §C.7) / §2 "아티팩트: GCS" → Supabase Storage(§C.5) / §2 "BullMQ/Celery" → Inngest(§C.4) / §4.2 "모리 3D 마스터 외주 ₩200–500만 우선" → 기존 LoRA+승인 프레임 우선, 드리프트 반복 시에만 승격(§C.6) | DECISIONS_CONTEXT §C의 의도적 수정 — 마스터플랜 원문을 인용할 때 이 4개 항은 폐기분임을 명시할 것 |

---

## 5. 콘텐츠·데이터 자산 인벤토리

| 자산 | 경로 | 상태·용도 |
|---|---|---|
| **KINDYTOY FLUX.2 LoRA v1** | 결과 포인터 `tmp/studio/lora-result.json` = 정본 사본 `src/content/studio/lora/kindytoy-v1.json`(동일 URL 확인: `https://v3b.fal.media/files/b/0aa0be1c/xncdjutxbiZTVdwW0IC89_pytorch_lora_weights.safetensors`, 332,548,896B) · 학습 리그 `tmp/studio/train-kindytoy-lora.ts` · 데이터셋 `tmp/studio/kindytoy-dataset.zip`+`tmp/studio/lora-dataset/`(캡션 PNG ~24장) | keyframe capability 1군(§C.8). ⚠️ **검증 필요**: fal 아티팩트 URL 생존 여부는 파일만으로 확인 불가(survey-addendum OPEN Q4) — **R0 체크 항목**(§C.6). 사망 시 데이터셋 zip으로 재학습 가능(리그 보존) |
| **승인 캐스트 6인 프레임** | `src/content/studio/approved-frames/` — `20260703-cast-mori.png`·`-kkumi`·`-bangul`·`-naong`·`-doto`·`-owl`(+README.md), 로더 `src/lib/studio/approved-frames.ts` | 캐릭터 레퍼런스 고정(불변 조항 ④ "재생성 금지, LoRA+승인 프레임"). 키프레임 생성·아바타 발주(E13-1)·QC 대조 기준. 정본 모리 단독 레퍼런스는 `public/ip/mori-reference-no-a.jpg`(머리 위 A 장식 금지 — survey-web-docs §1-2) |
| **22개 TTS mp3** | `public/audio/village/`(mp3 22개 실측, 936K) · 매니페스트 `src/data/worlds/animal-village-voice.json` · 생성기 `scripts/gen-village-tts.ts` · 재생 훅 `src/lib/useVoice.ts` | Gemini 2.5 Flash TTS 캐스팅 검증 완료분 — 현행 폴백 1군(§C.7). 세션 인트로·칭찬 라인. E13-4 호명 파이프의 "사전 생성+매니페스트" 패턴 원형 |
| **동물마을 세계 데이터** | `src/data/worlds/animal-village.ts`(728L) — 캐릭터 6인(꾸미/방울/나옹/도토/올빼미/모리)·활동 구성·보이스 ID·씬 그래프 · 캐릭터 바이블 `src/content/studio/animal-village-bible.ts`(267L+테스트) · 콘텐츠 정본 `docs/content/animal-village-season1.md` | 세계관 정본(docs/03 LOCK). 단 `ANIMAL_VILLAGE_SCENE_GRAPH`(589–666행)는 15s 데모 mp4를 시간 창으로 자른 **placeholder 분기**(warm/brave 분기가 동일 클립 — survey-addendum Q4) → E3에서 실클립 교체 전제로만 재사용 |
| **데모 그래프** | `src/data/demo/mori-demo-graph.ts` — 선택지→C6 축 매핑 데모 그래프 · 데모 여정 `/demo/mori`(MoriDemoJourney) | CP0(E13-15) 연습 그래프·영업 데모 원형. 동일 placeholder 클립 한계 공유 |
| **데모 영상·IP 렌더** | `public/demo-videos/mori-starlight-seed.mp4`(288K+vtt 자막) · `public/ip/generated/`(브랜드 PNG 10장) | 키오스크·랜딩 데모 소재. K1 데모 v2 15초 컷은 신규 제작 필요(현행 75초 설계는 `docs/06` 기준) |
| **시뮬레이션 스크립트 3종** (문서세트 2026-07-05) | `BASE/02_시뮬레이션_스크립트/playtest_sim.py`·`simulate.py`·`build_model.py`(BASE=`/Users/jongwonlee/Downloads/아이별_문서세트_2026-07-05`) → **`scripts/sim/`으로 이식 예정**(04 문서 신규 태스크) | `playtest_sim.py` = E15-2 Phase B **재시뮬 러너 실물**(플레이테스트 리포트 v2.1 정합 — 재구축 불필요) / `simulate.py`+`build_model.py` = 주간 그로스 루프 재실행 도구(통합마스터플랜 §6 방법론·00 문서 §6). 시드 고정 — 이식 시 python3 실행·재현성 검증 |
| **season1.json — 폐기 판정** | `kindy-app/Kindy/Resources/season1.json` | 폐기 근거 3중: ① 세계관 충돌 — 꼬꼬마을은 docs/03 LOCK(동물마을+모리)으로 대체(§C.9) ② 구조 부적합 — 씬 스키마에 분기/선택 필드 자체가 없음(선형 20씬, question_hold는 일시정지 샷일 뿐 — survey-addendum Q2), HERO의 다이아몬드 분기(마스터플랜 §1.1)와 비호환 ③ 룩 충돌 — 2D 치비(CHARACTER_PROMPTS.md)는 BRAND_DNA의 KINDYTOY 3D 소프트매트와 혼용 금지. 잔존 가치는 콘텐츠가 아닌 **스키마 교훈**(correctIndex nil=오답 없는 질문, interestTag 신호 — survey-app-ios §2 Content)뿐이며 이는 E5-2' 포맷 설계에 개념으로만 반영 |

---

**운영 메모**: E1~E12 행은 정본 §4.5 대조·갱신 완료(2026-07-05 — §2.0, ◪ 추정 표기 전량 해소). 잔여 재검 대상은 LoRA URL 생존 확인(R0 종료 전)과 Mori C6 명세서 원본 PDF 수령(증류판 `c6-spec-v1.md` 정본 유지)뿐이다. 등급 "그대로" 행도 v2 복제 직후 `npm run lint`+`scripts/verify-rls.ts`로 무결 확인 후 티켓에 착수한다(불변 조항 ⑧ 테스트 없는 PR 금지).
