# 04. R0 실행 플랜 (W1–2, 2026-07-06 ~ 2026-07-19)

**목적**: HERO v1.1 §0 R0 Exit(G0 전항[정본 = 통합 제품 마스터플랜 §3 W1–2 행, 2026-07-05 수령] + 아바타 발주 + world_state 스키마 머지 + 005 적용)와 Studio 12주 W1–2 산출물을, 내일 아침(7/6 월) 첫 명령부터 실행 가능한 태스크 단위(파일·명령·검증·커밋)로 확정한다.

**원천 문서**
- HERO 개발실행계획서 v1.1 (`/Users/jongwonlee/Downloads/files/HERO_개발실행계획서_v1.1_통합정본.md`) — §0 릴리즈 트레인, §3 아바타, §4 마이그레이션, §6 백로그, §8 CC 규칙
- 아이별 제품기획서 v2.2 (`/Users/jongwonlee/Downloads/files/아이별_제품기획서_v2.2_통합정본.md`) — §4 W1 랜딩·A0 카피 실문구
- **문서세트 2026-07-05** (`BASE = /Users/jongwonlee/Downloads/아이별_문서세트_2026-07-05`, 우선순위 규칙: HERO v1.1 > 기획서 v2.2 > 각 상세 — `BASE/00_README_문서지도.md`):
  - 통합 제품 마스터플랜 v1.0 (`BASE/01_현행정본/Kindy_통합_제품_마스터플랜_v1.0.md`) — **§3 G0 원문(Task 5 Exit #1a–1h의 정본)**·§4.5 정본 백로그·§6 시뮬 결과·§9 주간 그로스 루프
  - HERO 개발실행계획서 v1.0 (`BASE/03_이력보관/HERO_개발실행계획서_v1.0.md`) — §2 world_state 실물 스키마·리듀서 매핑 원문(Task 2.2), §3 아바타 시트 규격(Task 2.3)
  - 플레이테스트 리포트 v2.1 (`BASE/01_현행정본/아이별_플레이테스트_리포트_설계개정_v2.1.md`) — §6 Phase B 프로토콜 정본(Task 4.6)
  - 시뮬 스크립트 3종 (`BASE/02_시뮬레이션_스크립트/playtest_sim.py·simulate.py·build_model.py`) — Task 2.6 이식 원본
- `docs/plan/00_LAUNCH_MASTER_PLAN.md` — §3 R0 행 해석, §4 교차 의존성, §8 파운더 게이트
- `docs/plan/01_ASSET_REUSE_MAP.md` — §2 R0 티켓↔기존 코드 매핑(E13-1/E13-2/E13-10/E12-1' 행)
- `docs/plan/02_SCHEMA_RECONCILIATION.md` — **0024–0029 SQL 전문·§10 골든테스트 배선·§11 v1.0 대조 체크리스트(2026-07-05 대조 완료 — Task 4.5) (본 플랜은 이 문서의 SQL을 그대로 사용하며 재발명하지 않는다)**
- `docs/plan/03_MORI_STUDIO_PLAN.md` — §2 레포 구조, §3 이식 지도, §5 W1–2 행, §7 벤치
- 운영 실태: `/Users/jongwonlee/dev/kindy-web/docs/09_NEXT_PLAN_2026-07-02.md`(Inngest 미연결·콘텐츠 재고), `/Users/jongwonlee/dev/kindy-web/docs/RUNBOOK.md`(배포·Inngest §4·발행 §9), `(scratchpad)/survey-web-code.md` §7(kindy.kr DNS·사업자정보 플레이스홀더), `(scratchpad)/survey-web-infra.md` §3(env 전체 목록)
- 확정 결정: `(scratchpad)/DECISIONS_CONTEXT.md` §B/§C/§D/§E + **D-14(아이 표면 웹 선행, CEO 승인 2026-07-05 — 00 문서 §2)**

**이 문서가 SSOT인 범위**: R0(2026-07-06~07-19) 기간의 실행 순서·명령·검증·커밋 포인트·Exit 체크리스트. 스키마 내용은 02 문서가, 스튜디오 설계는 03 문서가, 티켓 AC는 HERO v1.1 §6이 상위다.

---

## 0. 실행 규칙 (전 태스크 공통)

- **워커**: 개발자 A + CC 에이전트(Claude Code). HERO §8 CC 규칙 그대로 — 티켓=작업지시, **사람 리뷰 머지, 테스트 없는 PR 금지, prod 시크릿·결제 코드 CC 접근 금지**(불변 ⑧, DECISIONS_CONTEXT §D).
- **브랜치**: trunk(main) + 피처 플래그(HERO §8·§0). main 직푸시 금지(불변 ⑥) — Task 1의 최초 부트스트랩 푸시(이어받은 기반 코드 + docs/plan)만 예외이고, 이후 모든 변경은 `feat/*` 브랜치 → PR → 사람 리뷰 머지.
- **프로드 DB 적용(`supabase db push`)과 Secret Manager·Inngest·Toss 조작은 개발자 A(사람)만 실행한다.** CC는 SQL·코드·테스트 작성까지.
- **R0 티켓 목록의 해석(2026-07-05 정본 확보로 확정)**: HERO v1.1 §6은 "R0 유지: E1-1~2, E2-1~3, E11-1 / 신규·개정: E13-1·E13-2·E13-10·005 적용(E13-2 포함)·E12-1'(랜딩)". 유지 티켓의 원문 AC는 **정본 백로그(통합 제품 마스터플랜 §4.5)와 HERO v1.0(문서세트 2026-07-05 수령)으로 확보 완료**, Task 4.5 대조도 **실행 완료**(결과 = 02 문서 §11): E1-1(Toss 결제+웹훅)·E2-1~3(QR 귀속·이벤트 SDK·퍼널 대시보드)은 kindy-web 기구현(0015·0017–0019·`api/kiosk/events`·`api/dashboard/*` — 01 문서 §2), **E11-1 승인 큐 = 우리 /studio 운영 페이지와 동일물(명칭 통일 — 정본 백로그 E11-1)**. G0 전항의 정본 정의는 통합 제품 마스터플랜 §3 W1–2 행(Task 5 Exit #1a–1h로 매핑). **상위 문서 3벌 전량 수령·대조 완료**(C6 원본 PDF 포함 — 00 문서 D-D, 02 §11).
- **아이 표면 플랫폼 = 웹(D-14, CEO 승인 2026-07-05 — 00 문서 §2)**: R1–R2 아이 화면(A0~A5·CP0·세션 플레이어)은 웹(iPad 브라우저/PWA, SessionShell·InteractiveVideoPlayer 재사용). 본 플랜의 R0 산출물은 이미 전부 웹 전제라 **변경 없음(확인)**. iOS(kindy-app) 이식은 R3 착수 게이트, E14-1 Kids 심사는 R4 iOS 통과(리스크 R-14: 이식 지연→심사 지연 — 00 문서 §7).

### 권장 일정 그리드

| 날짜 | 개발(개발자 A + CC) | 운영 게이트(사람 전용, Task 4) |
|---|---|---|
| 7/6 월 (D1) | Task 1.1–1.4 v2 부트스트랩·스모크 | 4.1 Inngest Cloud 가입 개시 · 4.2 LoRA 생존 확인·백업 · 4.6 Phase B 공문 발송 |
| 7/7 화 (D2) | Task 1.5 원격 생성·보호 → Task 2.1 착수(0024–0026 작성) | 4.3 Supertone 문의 발송 · 4.4 DNS(Cloudflare NS) 착수 · 4.8 연구소/전담부서 신고 서류 착수 |
| 7/8 수 (D3) | Task 2.1 완료(0027–0029)·PR | 4.1 Inngest 시크릿·sync 완료 |
| 7/9 목 (D4) | Task 2.1 머지 → **db push + verify**(사람) · Task 3.1–3.2 studio 스캐폴드 | 4.4 사업자등록·통신판매신고 진행 확인 |
| 7/10 금 (D5) | Task 2.2 리듀서+골든테스트 착수 · Task 3.3–3.4 studio 스모크 · Task 3.5 골든셋 태스크 파일 착수(CC 병렬, D5–D7) | — |
| 7/13 월 (D6) | Task 2.2 완료·CI 골든테스트 확장·PR · Task 3.5 골든셋 파일 계속 | 4.7 키오스크 발주 품목·견적 착수(D6–D8) |
| 7/14 화 (D7) | Task 2.4 E13-10 테스트 · Task 2.5 랜딩 착수 · Task 2.6 시뮬 스크립트 이식(CC 병렬) · Task 3.5 골든셋 파일 확정 | — |
| 7/15 수 (D8) | Task 2.5 완료·PR · Task 3.5 턴어라운드 시트 생성 + eval-harness·bench 러너 착수(D8–D9) | 4.5 종결 확인(상위 문서 3벌 전량 수령·대조 완료 — 원본 보관 스텝만 잔여) · 4.7 품목·견적 확정 · 4.8 연구소/전담부서 신고 접수 |
| 7/16 목 (D9) | Task 2.3 E13-1 스틸 스펙 + 샘플 생성 · Task 3.5 러너 완성 | 대표 룩 승인(E13-1 샘플) · 모리 턴어라운드 승인(Task 3.5) |
| 7/17 금 (D10) | Task 3.5 T3 초기 벤치 실행 · Inngest 더미 완주(미달 시 W3 이월 허용) | 벤치 예산 ≤$100/회 승인(03 §7-4) · 4.7 발주 실행(불가 시 서류 완성+W3 발주일 확정) |
| 7/18–19 주말 | Task 5 R0 Exit 체크리스트 전항 실행·미비 보완 | Exit 판정 |

크리티컬 패스 3건은 D1에 몰려 있다: **Inngest Cloud**(결제 갱신 cron이 정지 상태 — docs/09 트랙 C P0-5), **LoRA 생존 확인**(모든 키프레임·아바타 작업의 전제 — 00 §7 R-3), **Phase B 리크루팅 공문**(리드타임 3–4주, W6 마감 — 00 §4-3).

---

## Task 1. v2 부트스트랩 — kindy-web → kindy-web.v2 복제

### 1.1 git 복제 (비어 있지 않은 디렉터리 해법)

`/Users/jongwonlee/dev/kindy-web.v2/`에는 이미 `docs/plan/`(플랜 5본)과 `.claude/`가 있다. `git clone`은 비어 있지 않은 디렉터리를 거부하므로 **init + fetch + reset** 절차를 쓴다. 두 경로는 kindy-web에서 추적되지 않음을 확인했다(`git ls-files .claude docs/plan` → 공백)이므로 `reset --hard`가 이 파일들을 건드리지 않는다.

**Steps**
- [ ] ```bash
      cd /Users/jongwonlee/dev/kindy-web.v2
      git init -b main
      git remote add source /Users/jongwonlee/dev/kindy-web
      git fetch source codex/ai-diagnosis-demo
      git reset --hard FETCH_HEAD          # = 26a5f5f (기반: codex/ai-diagnosis-demo, DECISIONS_CONTEXT §B-1)
      ```

**Verify**
- [ ] `git rev-parse --short HEAD` → `26a5f5f`
- [ ] `git status --porcelain | grep '^??'` → `docs/plan/`·`.claude/`만 미추적으로 남음(소스 코드 전체 체크아웃 완료)
- [ ] `ls src/app src/lib supabase/migrations | head` → 파일 존재, `ls supabase/migrations | tail -1` → `0023_c6_growth_map.sql`

### 1.2 미추적·gitignore 자산 복사 (rsync)

kindy-web에서 git으로 넘어오지 않는 파일 목록(2026-07-05 `git status --porcelain` + `git check-ignore` 실측):

| 분류 | 파일 | 사유 |
|---|---|---|
| 미추적 | `키오스크_앱_개발플랜.md`, `KIOSK_하드웨어_제작계획.md` | 키오스크 W2–3 발주의 근거 문서(00 §4-4) — v2에서 커밋해 보존 |
| 미추적 | `.dev-team/MISSION`, `.dev-team/missions/first-content/tasks/script-duration-autofit.md` | 진행 중 미션 기록 |
| gitignore | `.env.local` | 전체 env 실값(survey-web-infra §3) |
| gitignore | `tmp/studio/` (32M) | **LoRA 학습 자산**: `lora-result.json`(fal 아티팩트 포인터)·`kindytoy-dataset.zip`(재학습 원본)·`train-kindytoy-lora.ts`·`test-lora-inference.ts` (survey-web-infra §5) |

**Steps**
- [ ] ```bash
      cd /Users/jongwonlee/dev/kindy-web.v2
      rsync -av /Users/jongwonlee/dev/kindy-web/키오스크_앱_개발플랜.md \
                /Users/jongwonlee/dev/kindy-web/KIOSK_하드웨어_제작계획.md ./
      rsync -av --relative /Users/jongwonlee/dev/kindy-web/./.dev-team/MISSION \
                /Users/jongwonlee/dev/kindy-web/./.dev-team/missions/first-content/tasks/script-duration-autofit.md ./
      cp /Users/jongwonlee/dev/kindy-web/.env.local .env.local
      rsync -av /Users/jongwonlee/dev/kindy-web/tmp/studio/ tmp/studio/
      ```

**Verify**
- [ ] `ls tmp/studio/lora-result.json tmp/studio/kindytoy-dataset.zip .env.local 키오스크_앱_개발플랜.md` → 전부 존재
- [ ] `git check-ignore .env.local tmp/studio/lora-result.json` → 둘 다 출력(= 커밋 대상 아님 유지)

### 1.3 의존성 설치 + env 검증

**Steps**
- [ ] `npm install` (Next 16 / React 19 / node 20 — survey-web-code §1, Dockerfile node:20-alpine)
- [ ] `.env.local`에 아래 키 존재 확인(정본 목록: survey-web-infra §3 = kindy-web `.env.local.example`):
  - Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - AI: `ANTHROPIC_API_KEY`, `FAL_KEY`, `GOOGLE_API_KEY`, `GEMINI_API_KEY`, `SEEDANCE_TIER` (+옵션 `CLAUDE_MODEL`, `FAL_IMAGE_ENDPOINT`, `FAL_BG_MODEL`, `LIPSYNC_TIER`)
  - Inngest: `INNGEST_SIGNING_KEY`, `INNGEST_EVENT_KEY`, `INNGEST_DEV`(로컬 전용 — RUNBOOK §2)
  - 결제: `NEXT_PUBLIC_TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`, `BILLING_KEY_SECRET`(테스트 키 단계 — survey-web-infra §7; **라이브 전환은 W3+ 파운더 게이트, 00 §8**)
  - 메일: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
  - 사이트·운영: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_KINDY_START_BASE`, `KINDY_OPERATOR_KEY`, `KINDY_LOCAL_PREVIEW`
  - 법정 표시(빌드타임): `NEXT_PUBLIC_BIZ_*` 6종 — 미기입이면 결제 CTA "결제 준비 중" 잠김(RUNBOOK §2). 실값 주입은 Task 4.4.

**Verify**
- [ ] `npm run lint` → 통과
- [ ] `npx tsc --noEmit` → 통과
- [ ] `npm run build` → 통과 (셋 다 kindy-web 2026-07-02 그린 상태의 재현 — docs/09 스코어보드)

### 1.4 dev 기동 + 스모크

**Steps**
- [ ] `npm run dev` → 브라우저 확인: `/`(랜딩), `/demo/kiosk`(키오스크 데모), `/sample/report`(샘플 리포트) 렌더
- [ ] 파이프라인 무비용 스모크(docs/09 트랙 A-1 검증 명령 그대로):
      ```bash
      DRY_RUN=1 ANIMATION_MODE=limited LIMIT_COUNT=3 npx tsx --env-file=.env.local scripts/generate-library-episode-90s.ts
      ```

**Verify**
- [ ] `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/` → `200`
- [ ] DRY_RUN 출력: 첫 3편이 꾸미·방울·나옹 동물마을 에피소드, 예상 비용 합계 `$3.31`(docs/09 Codex 실행노트의 재현값)

### 1.5 새 원격 생성·푸시 + main 보호

**Steps**
- [ ] 최소 CI 워크플로 작성 — `.github/workflows/ci.yml`(lint+tsc). main 보호의 `ci` 필수 체크가 **첫 PR부터 보고되도록 첫 커밋에 포함**한다(Task 2.2는 이 워크플로에 골든테스트 스텝을 확장하는 역할):
      ```yaml
      name: ci
      on: { pull_request: {}, push: { branches: [main] } }
      jobs:
        ci:
          runs-on: ubuntu-latest
          steps:
            - uses: actions/checkout@v4
            - uses: actions/setup-node@v4
              with: { node-version: 20, cache: npm }
            - run: npm ci
            - run: npm run lint
            - run: npx tsc --noEmit
      ```
- [ ] 플랜 문서·이관 문서·최소 CI 첫 커밋:
      ```bash
      git add docs/plan 키오스크_앱_개발플랜.md KIOSK_하드웨어_제작계획.md .dev-team .github
      git commit -m "chore: HERO×Studio 실행 플랜 5본 + kindy-web 미추적 기획문서 이관 + 최소 CI(lint+tsc)

      Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
      ```
- [ ] `gh repo create kindy-web-v2 --private --source=. --remote=origin --push`
- [ ] main 보호(사람 리뷰 머지 강제 — 불변 ⑧):
      ```bash
      gh api -X PUT "repos/{owner}/kindy-web-v2/branches/main/protection" \
        -H "Accept: application/vnd.github+json" --input - <<'JSON'
      {"required_status_checks":{"strict":true,"contexts":["ci"]},
       "enforce_admins":false,
       "required_pull_request_reviews":{"required_approving_review_count":1},
       "restrictions":null}
      JSON
      ```
      (`{owner}`는 `gh repo view --json owner` 결과. `ci` 컨텍스트는 위 첫 커밋에 포함된 `.github/workflows/ci.yml`의 잡 이름 — 보호 설정 시점부터 모든 PR에 체크가 보고된다. Task 2.2가 같은 워크플로에 `npm run test` 스텝을 확장)

**Verify**
- [ ] `git ls-remote origin main | head -1` → 커밋 해시 출력
- [ ] `gh api repos/{owner}/kindy-web-v2/branches/main/protection --jq .required_pull_request_reviews.required_approving_review_count` → `1`

**Commit point**: 위 첫 커밋 1개 + 푸시. 이후 모든 작업은 PR.

---

## Task 2. G0/R0 티켓 실행 (HERO v1.1 §6 R0 행)

### 2.1 마이그레이션 0024–0029 작성 · 적용 · 검증 (E13-2 스키마부 + 005→0026)

**Files**
- `supabase/migrations/0024_hero_world_state.sql` — SQL 전문 = 02 문서 §3 코드블록 **그대로 복사**
- `supabase/migrations/0025_hero_avatars.sql` — 02 §4 그대로
- `supabase/migrations/0026_product_defaults.sql` — 02 §5 그대로 (= HERO §4 `005_usability.sql`의 0026 재배치, DECISIONS_CONTEXT §B-3; 원문의 `alter table episodes add column cp_options_variants`는 0027로 이동 — 02 §5 델타 표)
- `supabase/migrations/0027_studio_episodes.sql` — 02 §6 그대로
- `supabase/migrations/0028_studio_model_registry.sql` — 02 §7 그대로
- `supabase/migrations/0029_hero_metrics.sql` — 02 §8 그대로
- `scripts/verify-migrations.ts`, `scripts/verify-rls.ts` — 신규 테이블 검사 확장

**Steps**
- [ ] 브랜치: `git checkout -b feat/0024-0029-hero-studio-schema`
- [ ] 02 문서 §3~§8의 SQL 코드블록 6개를 각 파일로 저장. **한 글자도 재발명하지 않는다** — 델타가 필요하면 02 문서를 먼저 고치고 그 사본을 커밋한다(02가 스키마 SSOT).
- [ ] `scripts/verify-migrations.ts`에 신규 테이블 존재 검사 추가: `world_states, bookshelf, avatars, personal_renders, name_pool, product_defaults, episodes, episode_nodes, shots, renders, model_registry, eval_runs, pipeline_runs, holdout_assignments` + 뷰 3본(`hero_metric_events, hero_metric_daily, hero_fallback_daily` — 02 §8)
- [ ] `scripts/verify-rls.ts`에 RLS 기대치 추가: owner-select 4(world_states/bookshelf/avatars/personal_renders), select-open 1(product_defaults), **정책 0 = service-role 전용 9**(name_pool/episodes/episode_nodes/shots/renders/model_registry/eval_runs/pipeline_runs/holdout_assignments — 02 §4~§8 RLS 절)
- [ ] PR 생성 → 사람 리뷰 → 머지 (PR 본문에 02 문서 §1 애덴덤 6제약 해결 표 링크)
- [ ] **[사람]** 머지된 main에서 적용:
      ```bash
      git checkout main && git pull
      supabase login                                  # 최초 1회
      supabase link --project-ref lzzaiqruxxfhhalgvejb   # 기존 프로젝트 계속 (DECISIONS_CONTEXT §B-3)
      supabase db push
      ```
      (`supabase/manual/`의 0008·0099는 push 대상 밖 — RUNBOOK §5)

**Verify** (02 §2 런북 쿼리 + 확장 — Supabase SQL Editor 또는 psql)
- [ ] `select count(*) from product_defaults;` → `3` — **이것이 "005 적용" Exit 항목의 판정이다**
- [ ] `select * from product_defaults order by age_band;` → `(5,14,2,2,0.9,'tap',6) / (6,17,2,1,1.0,'tap',5) / (7,20,3,0,1.0,'tap_drag_exp',5)` (HERO §4 시드 = 기획서 §3 표와 1:1, 02 §5)
- [ ] `select conname from pg_constraint where conname like 'game_rounds_%_check';` → `game_rounds_event_type_check`, `game_rounds_round_shape_check`, `game_rounds_metric_payload_check` 3건
- [ ] `select count(*) from c6_axes;` → `6` 유지(기존 무파괴)
- [ ] `npx tsx --env-file=.env.local scripts/verify-migrations.ts` → 전부 OK
- [x] `npx tsx --env-file=.env.local scripts/verify-rls.ts` → 전부 OK — **2026-07-06 실행 완료**: anon=0(전 테이블), service_role 읽기 가능, exit 0

**Commit point**: PR `feat/0024-0029-hero-studio-schema` 머지 = **"world_state 스키마 머지" Exit 항목 달성**(HERO v1.1 §0 R0 행).

### 2.2 E13-2 코드부: world_state 리듀서 골격 + 골든테스트 12본 CI

02 문서 §10이 배선 SSOT다. HERO §2가 요구하는 것은 "골든테스트 10(부록 A) CI 필수"이고, 02 §10은 여기에 신규 2건(연령 기본값 3밴드 #11, CP 2택 서브셋 #12 — HERO §7 신규 골든테스트)을 더해 12본으로 확정했다. #11·#12의 본 티켓(E13-16·E5-2')은 R1이지만, **순수 함수 단위 레이어는 CI 배선(02 §10)이 R0에 요구**하므로 여기서 함께 구현한다.

**Files**
- `src/lib/hero/world-state.ts` — `foldWorldState(events, prev): WorldState` 순수 리듀서. **state 실물 스키마 v1(HERO v1.0 §2 원문 — 02 갱신본 `world_states` 주석이 SQL측 정본)**: `{companion, characters_met[{id,relation,ep,choice_node}], items_invented[{id,name,ep,asset_ref}], places_visited[], open_threads[{id,desc,opened_ep,resolve_by_ep}], mood_pref{gacs[4]}, safety_flags[]}` + digest ≤500자. **리듀서 매핑 원문(HERO v1.0 §2)**: story_choice(prosocial=help)→characters_met.append(relation:helped)+open_threads 생성 / expression_saved(T7)→items_invented / episode_completed→places·version++ / 무응답 기본경로→상태 변경 없음(중립 처리 — 아이 불이익 금지)
- `src/lib/hero/continuity.ts` — `checkContinuity(script, worldState): Rejection[]` Guardian 연속성 5룰(관계·기한 스레드·아이템·지명·단짝 오기 — HERO 부록 A)
- `src/lib/hero/product-defaults.ts` — 0026 시드 3행의 하드코딩 상수(스키마-코드 드리프트 감지용 — 02 §10)
- `src/lib/hero/session-config.ts` — `resolveSessionConfig(birthYm, defaultsRows, holdoutArm, moodState?)` → **`{age_band, defaults, holdout_arm, mood_preset}` 4필드 응답 계약**(HERO §5 부트스트랩 1콜). `mood_preset`은 GACS 무드 사전에서 파생(저장 테이블 불필요, 콜드스타트 첫 주 `'gentle'` — 02 §10) (API route 자체는 R1 E13-16)
- `src/lib/hero/cp-variants.ts` — `validateCpVariants(branchingScript, cpOptionsVariants)`
- `src/lib/hero/world-reducer.ts` — DB 배치 골격: `world_processed_at is null` 클레임 → fold → `world_states(child_id, version+1)` insert → 클레임 마킹. 패턴 원형 = `src/lib/c6/diagnosis-agent.ts:63-73`의 `growth_processed_at` 멱등 프로젝터(02 §3)
- `src/lib/c6/diagnosis-agent.ts` — **수정**: 클레임 쿼리에 `event_type in ('game_round','story_choice')` 필터 추가(0029 계측 이벤트의 성장 프로필 오염 방지 — 02 §3 프로젝터 수정 지침)
- 테스트: `src/lib/hero/world-state.golden.test.ts`(케이스 1–10), `src/lib/hero/session-config.golden.test.ts`(#11), `src/lib/hero/cp-variants.golden.test.ts`(#12) — 케이스 정의는 02 §10 표
- `package.json` — 02 §10 배선 + E13-10 테스트(Task 2.4) 추가:
      ```json
      "test:golden": "tsx --test src/lib/hero/world-state.golden.test.ts src/lib/hero/session-config.golden.test.ts src/lib/hero/cp-variants.golden.test.ts",
      "test": "tsx --test src/lib/c6/evidence.test.ts src/lib/c6/recommendation.test.ts src/lib/hero/no-camera.test.ts && npm run test:golden"
      ```
- `.github/workflows/ci.yml` — **확장**(최소 lint+tsc 잡은 Task 1.5 첫 커밋에 이미 포함 — main 보호 `ci` 컨텍스트; kindy-web에는 CI가 없었음 — survey-web-infra §4 "no `.github/workflows/`"). 본 태스크에서 `npm run test` 스텝을 추가한 최종형:
      ```yaml
      name: ci
      on: { pull_request: {}, push: { branches: [main] } }
      jobs:
        ci:
          runs-on: ubuntu-latest
          steps:
            - uses: actions/checkout@v4
            - uses: actions/setup-node@v4
              with: { node-version: 20, cache: npm }
            - run: npm ci
            - run: npm run lint
            - run: npx tsc --noEmit
            - run: npm run test
      ```

**Steps**
- [ ] 브랜치 `feat/e13-2-world-state-reducer`
- [ ] TDD(superpowers 규율): 골든테스트 픽스처(JSON) 먼저 작성 → 실패 확인 → 리듀서·검사 함수 구현 → 통과. 픽스처는 DB 무접속 순수 입력 — `evidence.test.ts`(node:test + node:assert/strict) 구조 그대로(02 §10)
- [ ] 케이스 1–10의 시나리오 문구는 **HERO v1.0 부록 A 원문(2026-07-05 수령 완료)**을 픽스처에 인용(02 §10 갱신본 — 원문 교체 반영). 케이스 9·10(신규 가입 중립판·digest 폴백)의 중립 문안은 v1.0 §2 폴백 원문("연속성 중립판 — 재등장 요소 제거, 에피소드는 항상 나간다") 기준
- [ ] 케이스 11 기대값은 `product-defaults.ts` 상수와 0026 시드의 하드코딩 비교(02 §10)
- [ ] PR → CI 그린 → 사람 리뷰 머지

**Verify**
- [ ] `npm run test:golden` → 12/12 통과
- [ ] `npm run test` → 기존 c6 테스트 + 골든 전부 통과
- [ ] PR 페이지에서 `ci` 체크 그린(main 보호 필수 체크는 Task 1.5부터 작동 — 본 PR로 test 스텝 확장)

**Commit point**: PR 머지. E13-2 완료 = 스키마(2.1) + 리듀서 골격 + 골든 CI.

### 2.3 E13-1: 아바타 발주 = LoRA 기반 144조합 스틸 스펙 확정

"발주"의 실체는 외주 계약이 아니라 **기존 자산(FLUX.2 KINDYTOY LoRA v1 + 승인 캐스트 6인)으로 144조합 스틸을 생성하기 위한 스펙 프리즈**다(00 §3 R0 행 "아바타 발주(=LoRA 144조합 스틸 스펙)", DECISIONS_CONTEXT §C-6·§C-11). 배치 실행 자체는 R1 E13-5(에피소드당 144×slots, <2h — HERO §6)이며 Studio keyframe capability를 사용한다.

**Files**
- `docs/hero/E13-1_AVATAR_144_STILL_SPEC.md` — 신규 스펙 문서. 필수 수록 항목:
  1. 조합 공간: `base 1–3 × palette 1–8 × companion 1–6 = 144` (0025 CHECK와 동일 — 02 §4)
  2. 조합 키 = Storage 경로 키 `b{base}-p{palette}-c{companion}` (0025 `personal_renders` 코멘트의 규약)
  3. base 3종·palette 8색(HEX)·companion 6종의 시각 정의 — companion 1–6은 승인 캐스트 6인(`src/content/studio/approved-frames/20260703-cast-{mori,kkumi,bangul,naong,doto,owl}.png`)에 매핑(01 문서 §3 승인 캐스트 행: "아바타 발주(E13-1) 레퍼런스"), 0029 `kiosk_sessions.companion` 코드와 동일 번호 체계(02 §8)
  4. 생성 모델: `keyframe_image` 1군 `flux-2-kindytoy-lora-v1`(0028 시드 — 02 §7), 프롬프트 = look-preset(BRAND_DNA KINDYTOY 룩) + 조합 서술, 시드 고정, 2군 폴백 nano-banana(00 §4-2)
  5. 산출 저장: Supabase Storage `videos` 버킷 `avatars/base/b{}-p{}-c{}.png`(DECISIONS_CONTEXT §C-5)
  6. QC 계약: 실사 유사 QC(HERO §3) + K19–K20 골든 태스크(아바타 슬롯 합성 2종 — 03 §7-1)가 벤치에서 이 스펙을 검증
  7. 의존성 명시: **Studio 의존** — mori-studio `src/adapters/fal/flux2-lora.ts`(Task 3) + 프리셋 ID 계약이 W3 말 프리즈되어야 E13-5 배치 가동(00 §4-2), 지연 시 nano-banana 대체
  8. 캐릭터 시트 규격: **8각도 × 표정 4**(HERO v1.0 §3 원문 — "산출물 = 캐릭터 시트(8각도×표정 4), 스튜디오 파이프라인의 레퍼런스 규격과 동일"; Task 3.5 D8 모리 턴어라운드 시트와 같은 규격). 원문의 "베이스 3종은 모리 외주사에 파생 발주(IP 귀속 동일 조항)"는 **D-6 LoRA-first로 대체**(문서화된 수정 결정 — DECISIONS_CONTEXT §C-6; QC 드리프트 반복 검출 시에만 외주 승격)
- 발주 승인 기록: 같은 문서 하단에 대표 승인란(일자·검토 샘플 경로)

**Steps**
- [ ] 브랜치 `feat/e13-1-avatar-still-spec`
- [ ] 스펙 문서 작성(위 7항목)
- [ ] 샘플 스틸 3조합 생성(스펙 실검증 — Task 3.4의 스모크 러너 재사용, 비용 ~$0.12 = 3장 × $0.04, 03 §1-5 단가):
      ```bash
      cd /Users/jongwonlee/dev/mori-studio
      npx tsx --env-file=.env scripts/smoke-adapter.ts --capability keyframe_image \
        --model flux-2-kindytoy-lora-v1 --combo b1-p1-c1
      npx tsx --env-file=.env scripts/smoke-adapter.ts --capability keyframe_image \
        --model flux-2-kindytoy-lora-v1 --combo b2-p4-c3
      npx tsx --env-file=.env scripts/smoke-adapter.ts --capability keyframe_image \
        --model flux-2-kindytoy-lora-v1 --combo b3-p8-c6
      ```
- [ ] **[사람]** 대표가 샘플 3장 룩 승인 → 문서 승인란 기입
- [ ] PR → 리뷰 머지

**Verify**
- [ ] `test -f docs/hero/E13-1_AVATAR_144_STILL_SPEC.md && grep -c 'b{base}-p{palette}-c{companion}' docs/hero/E13-1_AVATAR_144_STILL_SPEC.md` → 1 이상
- [ ] 샘플 스틸 3장 파일 존재 + 승인 기록(일자) 문서에 존재

**Commit point**: PR 머지 = "아바타 발주" Exit 항목 달성. **선행 조건: Task 4.2 LoRA 생존 확인.**

### 2.4 E13-10: 사진·카메라 코드 부재 보증 테스트

HERO §3 "사진·카메라 코드 부재를 테스트로 보증(E13-10)". DB 레벨은 0025가 이미지 컬럼 자체를 두지 않아 보증(02 §4 델타 표), 코드 레벨은 정적 스캔 테스트로 보증한다(패턴 원형: kindy-web `docs/00_HANDOFF.md` §4 금칙어 grep 가드레일 — 01 문서 E13-10 행).

**Files**
- `src/lib/hero/no-camera.test.ts` — 신규: `src/` 전체(`node_modules`·테스트 자신 제외)를 재귀 스캔해 금지 토큰 0건을 단언:
  `getUserMedia`, `ImageCapture`, `facingMode`, `MediaStreamTrack`, `capture=`, `accept="image`, `type="file"`
  - 주석으로 명기: ① A0 이름 음성 모드(R1 E13-3')가 오디오 캡처를 도입할 때는 **파일 단위 allowlist를 PR 리뷰로 추가**(카메라 토큰은 계속 0건) ② DB측 보증은 0025 코멘트("사진·카메라·이미지 업로드 컬럼은 의도적으로 없음") ③ 키오스크 이름 수집 코드 부재 테스트는 R1 E13-7' AC에서 별도(02 §8)

**Steps**
- [ ] 브랜치 `feat/e13-10-no-camera-guard`
- [ ] 테스트 작성 → **의도적 위반 파일을 임시 생성해 실패를 확인**(테스트가 실제로 잡는지 검증) → 임시 파일 삭제 → 통과 확인
- [ ] `package.json` `test` 체인에 포함(2.2에서 예약된 자리)
- [ ] PR → 리뷰 머지

**Verify**
- [ ] `npx tsx --test src/lib/hero/no-camera.test.ts` → 통과
- [ ] 위반 주입 시 실패 재현 로그를 PR 본문에 첨부

**Commit point**: PR 머지.

### 2.5 E12-1': 랜딩 개정 — 기획서 W1 실문구 적용

카피 SSOT = 기획서 v2.2 §4 W1(실문구, 변경 시 린터 통과 원칙). 개조 대상 = `src/app/page.tsx`(크림/잉크 랜딩 원형 — 01 문서 E12-1' 행).

**Files**
- `src/app/page.tsx` — 개정:
  1. 헤드라인(정확히 이 문자열): **"모두에게 같은 영상이 아니라, 우리 아이에게만 맞춰 자라는 이야기."**
  2. 리포트 실물 1장: `public/landing/report-sample.png` (아래 Steps에서 `/sample/report` 화면 캡처로 제작)
  3. 신뢰 칩 3: `도서관과 함께` · `1탭 해지` · `결제 3일 전 알림`
  4. CTA 1개(단일 CTA 원칙 — 기획서 §4 W1)
- `src/app/KsPriceBadge.tsx` — 신규 클라이언트 컴포넌트: URL `?ks=` 파라미터 존재 시에만 `₩19,000` 도서관 한정 배지 렌더(**[결정 P-1]** "ks 있을 때만 ₩19,000 배지 노출" — 기획서 §4 W1; ks 토큰 계보는 `/start?ks=` 어트리뷰션 — survey-web-code §2.1 `/start`·`AttributionTracker.tsx`)

**Steps**
- [ ] 브랜치 `feat/e12-1-landing-w1-copy`
- [ ] `npm run dev` 상태에서 브라우저로 `/sample/report`를 375px 모바일 뷰포트로 캡처(기존 레이아웃이 `max-w-[375px]` 모바일 기준 — survey-web-code §7 TODOS) → `public/landing/report-sample.png` 저장·커밋
- [ ] 카피·배지·칩 구현. 금칙어 확인: `진단·평가·점수표·커리큘럼·C6·대시보드·분석` 등 어른/내부 용어 랜딩 노출 금지(RUNBOOK §9 QC 체크 + 불변 ③·⑤). 이 grep 검사는 임시 조치 — R1 W3 **E16-1 카피 린터 v2**로 정식화(금칙→대체 사전 + 주인공 문법 5 + CI 배선, 05 문서)
- [ ] PR → 리뷰 머지

**Verify**
- [ ] `grep -R "모두에게 같은 영상이 아니라" src/app/page.tsx` → 1건
- [ ] `/` 접속: 배지 없음 · `/?ks=smoke-test` 접속: `₩19,000` 배지 표시
- [ ] `grep -RE "진단|평가|점수" src/app/page.tsx src/app/KsPriceBadge.tsx` → 0건
- [ ] `npm run build` 그린

**Commit point**: PR 머지 = "랜딩 개정" Exit 항목 달성.

### 2.6 시뮬레이션 스크립트 이식 — `scripts/sim/` (주간 그로스 루프·E15-2 도구 확보)

원본 = 문서세트 `BASE/02_시뮬레이션_스크립트/` 3종. `playtest_sim.py`는 **E15-2 재시뮬 러너 실물**(가상 아동 코호트 1,000명 — 플레이테스트 리포트 v2.1의 생성 스크립트, "발달 파라미터 가정치 v1" 내장), `simulate.py`(재무 몬테카를로 10,000회×36개월, 7변수 삼각분포+계약지연)·`build_model.py`(재무모델 v1.0 xlsx 생성기, 파란 셀=입력값)는 **주간 그로스 루프의 재실행 도구**(통합마스터플랜 §9 "③ 시뮬 재실행(스크립트 보존)")다. 셋 다 **시드 고정**(`np.random.default_rng(2026)` / `default_rng(42)`)이라 결과가 결정적으로 재현된다.

**Files**
- `scripts/sim/playtest_sim.py` — Phase B 사전 시뮬(E15-2 재시뮬 러너). Phase B 실측치 대입 지점 = 스크립트 상단 "발달 파라미터 (가정치: 설계 가정 v1 — Phase B 실측으로 교체)" 블록
- `scripts/sim/simulate.py` — 마일스톤 확률 몬테카를로. stdout JSON(`P_M9_ge_1000` 등) + 차트 저장
- `scripts/sim/build_model.py` — 재무모델 xlsx 생성(주간 루프 ② "파란 셀 교체"의 대상 파일 생성기, deps: openpyxl)
- `scripts/sim/README.md` — 실행법·적응 패치 diff·주간 루프 절차 기록
- `scripts/sim/reference/` — 원본 차트 2장(`아이별_플레이테스트_시뮬.png`·`Kindy_시뮬레이션_결과.png`, 재현 대조용)

**Steps**
- [ ] 브랜치 `feat/sim-scripts-port`
- [ ] 복사(다운로드 폴더 유실 대비 레포 보존이 목적):
      ```bash
      BASE="/Users/jongwonlee/Downloads/아이별_문서세트_2026-07-05"
      mkdir -p scripts/sim/reference scripts/sim/out
      cp "$BASE/02_시뮬레이션_스크립트/playtest_sim.py" \
         "$BASE/02_시뮬레이션_스크립트/simulate.py" \
         "$BASE/02_시뮬레이션_스크립트/build_model.py" scripts/sim/
      cp "$BASE/02_시뮬레이션_스크립트/아이별_플레이테스트_시뮬.png" \
         "$BASE/02_시뮬레이션_스크립트/Kindy_시뮬레이션_결과.png" scripts/sim/reference/
      ```
- [ ] 실행 환경(1회): `python3 -m venv scripts/sim/.venv && scripts/sim/.venv/bin/pip install numpy matplotlib openpyxl` — `.gitignore`에 `scripts/sim/.venv/`·`scripts/sim/out/` 추가
- [ ] **macOS 적응 패치 2곳만 허용(수치 로직·시드·분포는 한 줄도 수정 금지 — "스크립트 보존", 통합마스터플랜 §9)**: ① 폰트 — 원본은 리눅스 나눔폰트 절대 경로(`/usr/share/fonts/truetype/nanum/NanumSquareRoundB.ttf`)를 `addfont`하므로 macOS에서 즉시 FileNotFoundError → 경로 존재 검사 후 미존재 시 `AppleGothic` 폴백 ② 산출 경로 — 하드코딩 `/home/claude/…` → `scripts/sim/out/`. 패치 내용은 README에 diff로 기록
- [ ] 시드 고정 재현 확인(2회 실행 stdout diff):
      ```bash
      cd scripts/sim
      ./.venv/bin/python simulate.py > out/run1.txt && ./.venv/bin/python simulate.py > out/run2.txt
      diff out/run1.txt out/run2.txt && echo REPRODUCIBLE
      ./.venv/bin/python playtest_sim.py > out/pt1.txt && ./.venv/bin/python playtest_sim.py > out/pt2.txt
      diff out/pt1.txt out/pt2.txt && echo PT_REPRODUCIBLE
      ./.venv/bin/python build_model.py    # → out/Kindy_재무모델_v1.0.xlsx + stdout 'saved'
      ```
- [ ] README.md 작성: 실행 명령·시드(2026/42)·**주간 그로스 루프 절차(금 60분 — 통합마스터플랜 §9)**: ① 실측 5변수 확인 → ② 재무모델 파란 셀(입력값) 교체 → ③ `simulate.py` 재실행 → ④ 확률 변화로 백로그 재우선 → ⑤ 리스크 트리거 점검. **R1 첫 금요일(W3, 7/24)부터 금요일 벨로시티 체크와 같은 캘린더 슬롯에서 실행**(00 문서 §6·05 문서 §4와 동일 캘린더)
- [ ] PR → 리뷰 머지

**Verify** (아래 기대값은 2026-07-05 macOS 로컬 venv 실측으로 사전 검증됨 — 이식 후 동일값 재현이 판정)
- [ ] `ls scripts/sim/playtest_sim.py scripts/sim/simulate.py scripts/sim/build_model.py` → 3종 존재
- [ ] `REPRODUCIBLE`·`PT_REPRODUCIBLE` 출력(시드 고정 재현)
- [ ] `simulate.py` stdout: `"P_M9_ge_1000": 0.028`(= 2.8%), M+9 P10/50/90 = 558/701/884 — **통합마스터플랜 §6 결과표와 일치 = 이식 무결성 판정**
- [ ] `playtest_sim.py` stdout 1–2행: 기본안 5세 완주율 20% → 개정안 59%(플레이테스트 리포트 v2.1 §2 결과 요약 재현)
- [ ] `out/Kindy_재무모델_v1.0.xlsx` 생성(`saved`)

**Commit point**: PR 머지 → Exit #17 판정 입력.

---

## Task 3. mori-studio 레포 부트스트랩

설계 SSOT = 03 문서 §2(레포 구조)·§3(이식 지도). R0 목표 = 스캐폴드 + 이식 1차 + **어댑터 1개로 keyframe 1장 스모크**(03 §5 W1–2 행 ①).

### 3.1 스캐폴드

**Steps**
- [ ] ```bash
      mkdir -p ~/dev/mori-studio && cd ~/dev/mori-studio
      git init -b main
      npm init -y
      npm i @anthropic-ai/sdk @fal-ai/client @google/genai @supabase/supabase-js inngest zod
      npm i -D typescript tsx vitest @types/node dotenv
      mkdir -p src/agents/prompts src/adapters/fal src/adapters/gemini src/adapters/supertone \
               src/adapters/anthropic src/orchestrator/inngest src/schemas src/qc src/render \
               src/db src/content/bible src/content/approved-frames src/content/lora scripts docs
      ```
      (의존성 목록 = 03 §2 package.json 주석 — kindy-web package.json 계보 승계)
- [ ] `tsconfig.json` 작성: `"strict": true, "module": "NodeNext", "moduleResolution": "NodeNext", "target": "ES2022", "outDir": "dist", "rootDir": "src"` (헤드리스 Node 파이프라인 — 03 §2 원칙 "웹 UI 없음")
- [ ] `vitest.config.ts` 기본 생성

**Verify**
- [ ] `npx tsc --noEmit` → 에러 0(빈 프로젝트)
- [ ] `find src -type d | wc -l` → 03 §2 트리와 일치(13개 이상)

### 3.2 이식 1차 (cp 목록 — 03 §3-1 지도의 W1 필요분)

**Steps** (원본 루트 `KW=/Users/jongwonlee/dev/kindy-web`)
- [ ] ```bash
      KW=/Users/jongwonlee/dev/kindy-web
      cp $KW/src/lib/video-providers/seedance2.ts        src/adapters/fal/seedance.ts        # §3-1 #3
      cp $KW/src/lib/video-providers/nano-banana.ts      src/adapters/gemini/nano-banana.ts  # #4
      cp $KW/src/lib/video-providers/gemini-tts.ts       src/adapters/gemini/gemini-tts.ts   # #5 (src/lib/gemini-tts.ts 병합은 W3)
      cp $KW/src/lib/video-providers/veed-fabric.ts      src/adapters/fal/veed-fabric.ts     # #6
      cp $KW/src/lib/video-providers/sync-lipsync.ts     src/adapters/fal/sync-lipsync.ts    # #6
      cp $KW/src/lib/whisper.ts                          src/adapters/fal/whisper.ts         # #7
      cp $KW/src/lib/limited-animation.ts                src/render/limited-animation.ts     # #8
      cp $KW/src/lib/supabase-storage.ts                 src/db/storage.ts                   # #10
      cp $KW/src/lib/video-providers/director.types.ts   src/schemas/shotlist.ts             # #2
      cp $KW/src/lib/video-providers/claude-director.ts  src/adapters/anthropic/claude.ts    # #1 (에이전트 분해는 W3–4)
      cp $KW/src/content/studio/animal-village-bible.ts       src/content/bible/
      cp $KW/src/content/studio/animal-village-bible.test.ts  src/content/bible/              # #11
      cp $KW/src/data/worlds/animal-village.ts                src/content/bible/animal-village-data.ts  # #11 의존(CHARACTERS — bible·테스트가 import)
      cp -R $KW/src/content/studio/approved-frames/           src/content/approved-frames/    # #12 (재생성 금지 — 불변 ④)
      cp $KW/src/content/studio/lora/kindytoy-v1.json         src/content/lora/               # #13
      cp $KW/tmp/studio/train-kindytoy-lora.ts                scripts/train-lora.ts           # #13
      cp $KW/tmp/studio/test-lora-inference.ts                scripts/_lora-inference-ref.ts  # flux2-lora.ts 원형
      ```
- [ ] import 경로 수정: Next/서버 전용 import(`server-only`, `next/*`) 제거, 상대 경로 재배선(`animal-village-bible.ts`·`.test.ts`의 `../../data/worlds/animal-village` import → `./animal-village-data`). `src/adapters/fal/flux2-lora.ts`를 `_lora-inference-ref.ts` 기반으로 작성(keyframe 1군 어댑터 — 03 §3-1 #13)
- [ ] 정본 이동 주석: `animal-village-bible.ts` 머리에 "이식 후 정본은 mori-studio, kindy-web.v2는 소비 사본"(03 §3-1 #11) 명기

**Verify**
- [ ] `npx tsc --noEmit` → 통과
- [ ] `npx tsx --test src/content/bible/animal-village-bible.test.ts` → 통과 — 이식 테스트는 node:test 스타일 유지(vitest가 수집하지 못함), 신규 테스트는 vitest로 작성(03 §2)
- [ ] `ls src/content/approved-frames/*.png | wc -l` → `6`

### 3.3 .env 구성

**Steps**
- [ ] `.env.example` 작성(03 §2 목록 그대로): `ANTHROPIC_API_KEY, FAL_KEY, GOOGLE_API_KEY, SUPERTONE_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, INNGEST_SIGNING_KEY, INNGEST_EVENT_KEY, SEEDANCE_TIER, EPISODE_BUDGET_USD=400`
- [ ] `.env` 실값은 kindy-web.v2 `.env.local`에서 복사(같은 Supabase·fal·Google 계정 — DECISIONS_CONTEXT §B-2·B-3). `SUPERTONE_API_KEY`는 Task 4.3 게이트 통과 후 발급되므로 그 전까지 빈 값 + 어댑터는 미설정 시 skip 처리(03 §1-4 폴백 사다리)
- [ ] `.gitignore`에 `.env`, `out/`, `dist/` 추가

**Verify**
- [ ] `git check-ignore .env` → 출력됨
- [ ] `grep -c '=' .env.example` → 10

### 3.4 첫 스모크: 어댑터 1개로 keyframe 1장

**Files**
- `scripts/smoke-adapter.ts` — 신규(kindy-web `scripts/smoke-*` 계보 — 03 §2): 인자 `--capability keyframe_image --model flux-2-kindytoy-lora-v1 [--combo bX-pY-cZ | --prompt "..."]` → `flux2-lora.ts` 호출(LoRA URL은 `src/content/lora/kindytoy-v1.json`에서 로드, 시드 고정) → `out/smoke/` PNG 저장 + 비용·지연 stdout

**Steps**
- [ ] 러너 작성
- [ ] 실행:
      ```bash
      npx tsx --env-file=.env scripts/smoke-adapter.ts \
        --capability keyframe_image --model flux-2-kindytoy-lora-v1 \
        --prompt "모리가 물방울 실험터에서 손을 흔드는 정면 스틸"
      ```
- [ ] 커밋 + 원격: `gh repo create mori-studio --private --source=. --remote=origin --push` (main 보호는 kindy-web-v2와 동일 gh api 명령)

**Verify**
- [ ] `ls out/smoke/*.png | wc -l` → 1 이상, 육안으로 KINDYTOY 룩(BRAND_DNA 정본) 일치
- [ ] stdout 비용 ≈ $0.04/장(LoRA 추론 단가 — 03 §1-5 표)
- [ ] LoRA URL 실패 시: 2군 nano-banana로 동일 스모크 통과(폴백 경로 실증 — 03 §1-5 keyframe 행) + Task 4.2 재학습 경로 발동

**Commit point**: 커밋 `feat: studio scaffold + adapter smoke (keyframe 1)` 푸시. **선행 조건: Task 4.2.**

### 3.5 W2 스튜디오 잔여 (03 §5 W1–2 성공 기준 충족분)

03 §5 W1–2 행의 나머지 산출물. 상세 설계는 03 문서가 SSOT이므로 여기서는 실행 항목·검증만 고정한다. **단일일 작업이 아니다** — 아래 분해대로 D5–D10에 걸쳐 실행한다(권장 일정 그리드와 1:1).

**Steps**
- [ ] **D5–D7 (CC 병렬)** 골든셋 태스크 파일 확정: `src/content/golden/video_i2v.json`(V01–V20)·`keyframe_image.json`(K01–K20)·`tts_ko.json`(T01–T20) — 태스크 정의 원문 = 03 §7-1 표 복사이므로 벤치 러너와 독립, CC 병렬 작성 가능
- [ ] **D8** 모리 턴어라운드 8각도·표정 시트 LoRA 생성 → **[사람]** HITL 승인은 D9 운영 게이트(대표 룩 승인과 함께) → 승인 프레임 세트 확장(03 §1-3 잔여 리스크 ②, 마스터플랜 §12 주1–2 "모리 턴어라운드 승인" 기준)
- [ ] **D8–D9** `scripts/golden-set.ts`·`scripts/bench.ts` 러너 작성 — eval-harness(VLM 저지 채점 → `eval_runs` INSERT → 순위표) 포함, 실행 계약 = 03 §7-4 코드블록
- [ ] **D10** T3 초기 벤치 1회 실행(**[사람]** 예산 승인 선행 — 1회 $55–70, 상한 $100 cost-guard 등록, 03 §7-4). 모델 ID는 0028 시드(02 §7)가 정본 — `wan-2.5`는 시드 benchmark 행, `sona-2`는 Task 4.3 게이트 통과 시 편입:
      ```bash
      npm run bench -- --capability keyframe_image --models flux-2-kindytoy-lora-v1,nano-banana-gemini-3-pro-image
      npm run bench -- --capability video_i2v \
        --models seedance-1.5-pro,seedance-2.0,seedance-2.0-fast,kling-3.0-elements,wan-2.5
      npm run bench -- --capability tts_ko --models gemini-2.5-flash-tts
      ```
- [ ] **D10** Inngest 함수 dev 완주(더미 스테이지): `episode-produce.ts` 골격 + `npx inngest-cli dev`로 로컬 완주(03 §5 W1–2 성공 기준 "Inngest 함수 dev 완주(더미)") — **미달 시 W3 이월 허용**(Exit #10b에 이월 표기)

**Verify**
- [ ] `select count(*) from eval_runs;` → 1 이상(벤치 기록 — 03 §5 "T3 실행 완료·registry에 eval_runs 기록")
- [ ] 벤치 순위표 markdown 출력 1부 보존(`docs/bench/T3-initial.md`)
- [ ] 턴어라운드 승인 프레임이 `src/content/approved-frames/`에 추가 커밋됨(신규 승인만 추가 — 불변 ④)

---

## Task 4. 운영 게이트 (사람만 가능 — 00 §8 파운더 게이트 W1–2 행)

### 4.1 Inngest Cloud 연결 (R0 최우선 운영 태스크 — 00 §7 R-6) — **부분 완료(2026-07-06)**

현재 프로덕션(`kindy` Cloud Run)은 `INNGEST_DEV=1` 상태로 갱신 cron·영상 생성이 조용히 정지해 있다(docs/09 트랙 C P0-5, RUNBOOK §4). 절차는 RUNBOOK §4의 5단계 그대로:

- [x] Inngest Cloud 가입 → 프로덕션 앱 생성 → `signkey-prod-...`·event key 발급 (2026-07-06)
- [x] ```bash
      printf %s "signkey-prod-..." | gcloud secrets create kindy-inngest-signing-key --project=kindy-493701 --data-file=-
      printf %s "<event-key>"      | gcloud secrets create kindy-inngest-event-key   --project=kindy-493701 --data-file=-
      gcloud secrets add-iam-policy-binding kindy-inngest-signing-key --project=kindy-493701 \
        --member="serviceAccount:582936546727-compute@developer.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
      gcloud secrets add-iam-policy-binding kindy-inngest-event-key --project=kindy-493701 \
        --member="serviceAccount:582936546727-compute@developer.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
      bash scripts/deploy-cloud-run.sh    # 시크릿 주입 + INNGEST_DEV 제거 (RUNBOOK §1-③)
      ```
      **주의**: gcloud 기본 프로젝트가 `gacs-490805`로 잡혀있으면 서비스가 안 보인다 — 실제 프로덕션은 `kindy-493701`(`gcloud config set project kindy-493701`). 신규 시크릿은 Cloud Run 서비스 계정(`582936546727-compute@developer.gserviceaccount.com`)에 `secretAccessor` 권한이 기본으로 안 붙어있어 `deploy-cloud-run.sh` 1차 실행이 권한 오류로 실패했음 — 위 `add-iam-policy-binding` 2줄 먼저 실행 후 재시도해서 성공(리비전 `kindy-00004-lcc` 배포 확인, `INNGEST_DEV` 제거·시크릿 2종 연결 확인됨).
- [ ] Inngest 대시보드에서 sync URL `https://kindy.kr/api/inngest` 등록(DNS 미해결 시 LB IP 경유 임시 URL — 4.4와 연동) — **대기 중**: LB의 Google 관리형 인증서가 `kindy.kr` 전용이라 IP 직접 접속은 인증서 불일치로 안 됨 + Cloud Run 직접 URL은 org policy로 비공개. 4.4 DNS 전파 완료 후 진행.

**Verify**
- [ ] 대시보드에 함수 2개(`subscription-renewal`, `video-generate`) 표시(RUNBOOK §4-4) — DNS 대기
- [ ] `subscription-renewal`(cron `TZ=Asia/Seoul 0 4 * * *`) 수동 트리거 1회 → 성공 로그(RUNBOOK §4-5) — DNS 대기

### 4.2 LoRA 아티팩트 생존 확인 + 이중 백업 (R0 체크 항목 — DECISIONS_CONTEXT §C-6) — **완료(2026-07-06)**

- [x] 생존 확인(URL은 `tmp/studio/lora-result.json` 실측값):
      ```bash
      cd /Users/jongwonlee/dev/kindy-web.v2
      LORA_URL=$(grep -o 'https://[^"]*pytorch_lora_weights.safetensors' tmp/studio/lora-result.json | head -1)
      curl -sSfI "$LORA_URL" | head -3     # HTTP/2 200 + content-length 332548896 (332MB) 기대
      ```
      결과: `HTTP/2 200`, `content-length: 332548896` — 기대값과 일치, 생존 확인됨.
- [x] 생존 시 즉시 이중 백업(03 §1-3 잔여 리스크 ①):
      ```bash
      curl -sSfL "$LORA_URL" -o tmp/studio/kindytoy-v1.safetensors
      shasum -a 256 tmp/studio/kindytoy-v1.safetensors   # 해시를 kindytoy-v1.json 옆 README에 기록
      ```
      + Supabase Storage `videos` 버킷 `studio/lora/kindytoy-v1.safetensors` 업로드(kindy-web.v2 `src/lib/supabase-storage.ts` 경유 1회성 스크립트, service-role)
      **완료**: 로컬 백업 `tmp/studio/kindytoy-v1.safetensors`(332,548,896 bytes), SHA-256 `76f4caeaaafb877f46cd6368c65116af3bf33637e9fc6e22ebde3667793ea841`(`tmp/studio/README.md`에 기록). Storage 업로드는 2번 막혔다가 해결: ① 버킷 `allowed_mime_types`에 `application/octet-stream`이 없어 실패 → `storage.updateBucket()`으로 추가. ② Supabase 프로젝트 전역 업로드 크기 제한(기본값, 버킷 `file_size_limit` 500MB와 별개 설정)이 332MB보다 작아 "exceeded the maximum allowed size" 에러 → 대시보드 Project Settings → Storage에서 1GB로 상향 후 성공.
- [ ] **실패 시**(404/만료): 재학습 발동 — `kindytoy-dataset.zip` 보존 확인됨(00 §7 R-3) → `mori-studio/scripts/train-lora.ts` 1000스텝 재학습(~$6.4 — 03 §8-1 LoRA 행) → 신규 URL로 `kindytoy-v1.json` 갱신 PR (해당 없음 — 생존 확인됨)

**Verify**
- [x] 로컬 safetensors 파일 332MB + Storage 사본 존재(2사본) — Task 2.3·3.4의 선행 조건 해제됨

### 4.3 Supertone Sona 2 아동 보이스 확인 (파운더 게이트 — DECISIONS_CONTEXT §C-7)

- [ ] Supertone에 한국어 아동 보이스 가용성·약관(아동 대상 서비스 사용 허용 여부) 공식 문의 발송 — docs/10 §4-2 대표 게이트(03 §1-4)
- [ ] 회신 결과를 `mori-studio` `model_registry` 운영 노트로 기록: 통과 시 `sona-2` status `candidate`→벤치 편입, 실패 시 현행 Gemini TTS 캐스팅 유지(+Qwen3-TTS 셀프호스팅 병행 검증 — 00 §7 R-4). ElevenLabs는 정책 차단으로 미등록 유지(02 §7 시드)

**Verify**
- [ ] 문의 발송 기록(일자) + 회신/미회신 상태가 W2 말 R0 Exit 표에 기입됨(회신 자체는 R0 Exit 조건 아님 — 외부 의존)

**2026-07-06 조사·결정**: Supertone 공개 문서(`docs.supertoneapi.com`) 확인 결과 — voice search가 age(연령) 필터를 지원해 아동/젊은 톤 보이스가 기술적으로 존재할 가능성은 있으나, **아동 음성 사용에 대한 명시적 약관 문구는 공개 문서에 없음**(FAQ엔 클론 보이스 계정 소유권 얘기만 존재). 대표 판단: **일단 기술적으로 진행(Supertone 문의 발송 + 평가 계속)**, 법적 리스크는 아래 별도 트랙으로 보류하고 문제 시 재검토.

**보류된 법률 자문 항목(변호사 확인 필요 — R0 게이트 아님, 별도 트랙)**:
1. 아동 목소리로 인식되는 음성을 AI TTS로 합성해 **상업적 아동 대상 서비스**에 쓰는 것이 한국법상(개인정보보호법·아동·청소년 보호 관련법·정보통신망법·딥페이크 관련 개정 법령 등) 별도 규제 대상인지.
2. "아동 캐릭터를 연기하는 성우 목소리"(캐릭터 연기)와 "실제 아동 음성의 학습/복제"(보이스 클로닝)가 법적으로 다르게 취급되는지 — 현재 프로덕션 Gemini 캐스팅(동물마을 캐릭터 22종)은 전자에 가까움.
3. 해외/국내 TTS 벤더(Supertone·Gemini·ElevenLabs 등) 이용약관 위반이 계약 위반을 넘어 별도의 법적 책임(개인정보보호법 등)으로 이어질 수 있는지.
4. 합성 음성 사용이 PIPA상 법정대리인(부모) 동의 고지 항목에 별도 명시가 필요한지.
5. Qwen3-TTS처럼 오픈소스 모델을 셀프호스팅해 벤더 ToS 자체가 적용 안 되는 경우, 리스크가 더 커지는지 작아지는지.
6. ElevenLabs가 업계 관행상 선제적으로 막은 것인지, 아니면 한국 규제기관(개인정보보호위원회·방통위 등)이 관련 가이드라인을 이미 냈거나 준비 중인지.

**Why:** 대표가 "일단 써보고 문제되면 바꾸자"로 결정(2026-07-06) — 기술 검증을 법률 검토 완료까지 막지 않기로 함.
**How to apply:** Supertone/Gemini TTS 관련 작업 계속 진행. 위 항목은 변호사 상담 시 그대로 질문지로 사용. 상담 결과가 나오면 이 섹션과 Exit 표를 갱신.

### 4.4 사업자정보·도메인 (결제 CTA·QR 퍼널의 전제) — DNS **진행 중(2026-07-06 착수, 전파 대기)**

- [x] **kindy.kr DNS**: Cafe24 락 상태(survey-web-code §7 STATUS) → Cloudflare NS 이전 개시(00 §7 R-5). QR 퍼널(W1 랜딩·키오스크)이 도메인에 의존
      **진행 상세(2026-07-06)**: WHOIS 등록대행자는 "메가존(주)"(카페24가 `.kr` 등록 백엔드로 사용하는 공인 등록기관)이지만 실제 도메인 관리 포털은 **`hosting.cafe24.com`**(쇼핑몰 관리자 `cafe24.com`과는 별도 서비스 — 도메인 목록이 쇼핑몰 관리자에서는 안 보임). Cloudflare에 사이트 추가 시 "`.kr` domains aren't supported yet(등록기관 이전 불가)" 경고가 뜨지만 **등록기관 이전이 아니라 DNS만 위임**하는 거라 "Add site anyway"로 진행. 자동 스캔된 기존 CNAME(`*`, `www` → `kindy.kr`, 쇼핑몰용) 대신 `A` 레코드 `@`/`www` → `34.8.67.108`(Proxy: DNS only/회색 구름)로 교체. Cloudflare 발급 네임서버 `hayes.ns.cloudflare.com`·`lovisa.ns.cloudflare.com`을 `hosting.cafe24.com` → 도메인관리 → 네임서버 변경 → "다른 네임서버"로 1차/2차에 입력, 변경 신청 완료(반영까지 24~48시간 안내됨). **2026-07-06 15:43 KST 기준 아직 `ns-*.cafe24.com` 응답 — 전파 대기 중.**
- [ ] **사업자등록·통신판매신고** 진행 확인 → 완료 시 `NEXT_PUBLIC_BIZ_*` 6종 실값을 cloudbuild substitution으로 주입(RUNBOOK §1-① `^;^` 이스케이프 명령 그대로). 미완이면 `src/lib/business-info.ts` 플레이스홀더(`[사업자등록번호 미설정]` 등)가 푸터에 노출되고 결제 CTA가 잠긴 상태 유지(survey-web-code §7 TODOS 런칭 블로커, 00 §7 R-11)
      **2026-07-06 상태**: `.env.local`의 `NEXT_PUBLIC_BIZ_*` 6종 중 `NEXT_PUBLIC_BIZ_EMAIL`만 채워짐, 나머지(대표자명·사업자등록번호·통신판매신고번호·주소·전화)는 전부 비어있음. 대표 확인: **사업자등록은 완료**(번호 미기입 상태), **통신판매신고는 정부24(gov24.go.kr) 진행 중**.

      **정정(2026-07-06): PG사는 카페24페이먼츠가 아니라 토스페이먼츠다.** STATUS.md(historical)의 "카페24 PG 연결" 메모는 구식 — 코드 확인 결과(`src/lib/toss.ts`, `/api/payments/toss/billing-key`, `/api/payments/webhook/toss`) 실제 연동은 **토스페이먼츠 billing-key 기반 정기결제**이며 카페24 결제 코드는 존재하지 않음(카페24는 도메인 등록·DNS 용도로만 사용, RUNBOOK §4.4 참조). 통신판매업 신고의 에스크로(구매안전서비스) 확인증도 카페24페이먼츠가 아니라 **토스페이먼츠**에서 발급받아야 함.

      정부24 신고서 작성값(2026-07-06 기입 완료): 홈페이지 구축 방법=**직접 구축**(카페24 쇼핑몰 빌더 아님, Next.js 커스텀 앱+GCP 호스팅) / 호스트서버 소재지=**서울특별시 강남구 테헤란로 152(강남파이낸스센터), 22층**(구글코리아 유한회사 등록주소 — 클라우드 호스팅 관행상 서버 물리주소 대신 제공사 한국 사무소 주소 기재) / 판매방식=**인터넷** / 인터넷도메인이름=**kindy.kr** / 취급품목=**교육/도서/취미/애완**.

      **토스페이먼츠 가맹 신청 완료(2026-07-06)**: 홈페이지 구축방법=직접 구축, 신청 서비스=**빌링(정기결제)**(구독형 자동결제 — billing-key 코드와 일치) 선택. 현재 **가맹심사 대기 중**(`.env.local`의 `TOSS_SECRET_KEY`/`NEXT_PUBLIC_TOSS_CLIENT_KEY`는 아직 `test_sk_`/`test_ck_` 테스트 키 — 00 §8 "Toss 라이브 키는 W3+ 게이트"와 일치). **순서 주의**: 에스크로 확인증은 가맹심사 통과 후에나 발급 가능 — 통신판매업 신고가 이를 요구하면 심사 결과 나올 때까지 대기 필요(구청에 따라 "신청 접수증"으로 임시 접수 가능한 경우도 있음, 확인 필요).
- [ ] Toss 라이브 키·`BILLING_KEY_SECRET`은 **W3+ 게이트**(00 §8) — R0에서는 착수하지 않음(테스트 키 유지)

**Verify**
- [x] `dig +short kindy.kr` → LB IP `34.8.67.108`(survey-web-infra §4) 응답 시 완료; R0 내 미완이면 Exit 표에 이월 사유 기록 — **2026-07-06 반영 확인**: NS `hayes.ns.cloudflare.com`/`lovisa.ns.cloudflare.com`, A `34.8.67.108`(apex+www 둘 다, `@8.8.8.8` 기준)
- [ ] BIZ 주입 후 재빌드 배포 시 `/legal/business`·푸터에 실값 표시, `/subscribe` CTA 활성

**추가 이슈(2026-07-06): LB SSL 인증서 재발급 필요.** DNS 미해결 상태로 오래 대기하던 Google 관리형 인증서(`kindy-cert`)가 `PROVISIONING_FAILED_PERMANENTLY`로 영구 실패 상태였음(관리형 인증서는 수정 불가 리소스라 재시도 안 됨). 조치: 새 인증서 `kindy-cert-2`(도메인 `kindy.kr,www.kindy.kr`) 생성 → `kindy-https-proxy`가 이를 참조하도록 교체(`gcloud compute target-https-proxies update kindy-https-proxy --ssl-certificates=kindy-cert-2`) → 구 인증서 `kindy-cert` 삭제. `kindy-cert-2`는 이후 `ACTIVE`로 전환 완료.

**추가 이슈 2(2026-07-06): GenTA 조직 정책이 공개 접근을 원천 차단하고 있었음.** 인증서가 `ACTIVE`가 된 후에도 `https://kindy.kr`이 `403 Forbidden`(Google Frontend 레벨) 응답. 원인: `kindy` Cloud Run 서비스의 IAM 정책이 완전히 비어있었음(누구에게도 invoker 권한 없음) + GenTA 조직 정책 `iam.allowedPolicyMemberDomains`(2024-11-04 조직 레벨 설정, genta.co.kr 고객 ID만 허용)가 `allUsers` IAM 바인딩 자체를 차단(`FAILED_PRECONDITION: One or more users named in the policy do not belong to a permitted customer`). STATUS.md(2026-04-28)의 "LB 우회로 해결됨(내부 인증)" 메모는 실제로는 미완성 상태였음(IAP도 검토했으나 IAP는 사내 전용 앱 패턴이라 공개 소비자 사이트엔 부적합 — 어차피 `iap.httpsResourceAccessor`도 같은 정책에 막힘).

조치(대표 승인 후 실행, 2026-07-06):
```bash
# 1. kindy-493701 프로젝트에 한해 조직 정책 예외 설정(다른 프로젝트엔 영향 없음 — 프로젝트 단위 재정의)
cat > /tmp/kindy-org-policy-override.yaml << 'EOF'
constraint: constraints/iam.allowedPolicyMemberDomains
listPolicy:
  allValues: ALLOW
EOF
gcloud resource-manager org-policies set-policy /tmp/kindy-org-policy-override.yaml --project=kindy-493701

# 2. Cloud Run에 공개 invoker 부여 (정책 전파에 수분 소요 — 실패 시 재시도)
gcloud run services add-iam-policy-binding kindy --project=kindy-493701 --region=asia-northeast3 \
  --member="allUsers" --role="roles/run.invoker"
```
확인: `https://kindy.kr`, `https://www.kindy.kr`, `https://kindy.kr/api/inngest` 전부 `200` 응답 확인됨(2026-07-06). **주의**: 이 정책 예외는 `kindy-493701` 프로젝트에만 적용되며, GenTA의 다른 GCP 프로젝트(예: `asanlibrary`)는 조직 기본 정책을 그대로 상속받아 영향 없음.

### 4.5 상위 문서 수령 → 대조 — **전량 완료(2026-07-05)** (R0 체크포인트 종결 — 00 문서 D-D)

- [x] **HERO v1.0·플레이테스트 리포트 v2.1 수령 완료**(문서세트 2026-07-05: `BASE/03_이력보관/HERO_개발실행계획서_v1.0.md`·`BASE/01_현행정본/아이별_플레이테스트_리포트_설계개정_v2.1.md`) → **02 문서 §11 대조 체크리스트 실행 완료**(각 항목: 원문 인용→우리 SQL→판정 — 결과는 02 §11 갱신본에 기록. 확정 델타: avatars `photoreal_check`·`version`, bookshelf `cover_url`·`personal_assets`, personal_renders 5-kind+SLA, `episodes.format`, `shots.personalizable`, 커머스 델타 003x — HERO v1.0 §2~§5)
- [x] 본 플랜 §0의 추가 항목 대조 완료: E1-1~2·E2-1~3·E11-1 원문 AC(정본 백로그 = 통합 제품 마스터플랜 §4.5) vs Task 1~2 산출물 — E1-1·E2-1~3은 kindy-web 기구현 확인, E11-1 = /studio 운영 페이지 동일물(명칭 통일). 미충족 신규분(E1-3~6 등)은 R1 티켓으로(05 문서 W3 행 — 릴리즈 트레인 불변, 00 §7 R-12)
- [x] **Mori C6 명세서 원본 PDF 수령·대조 완료**(`~/Documents/GenTA/연구자료/Mori_C6_창의성장지도_연구_및_서비스적용_명세서_v1.0.pdf`, 2026-07-05): §10.1=0023 일치·§7.2 공식=evidence.ts 일치·부록 C 브리프 15필드=03 §6 계약 반영·§8.1=파일럿 브리프 일치·§13 Phase C~F=00 §9 연구 트랙 신설 — 결과는 02 §11 C6 대조 표. 증류판 `c6-spec-v1.md`는 원문과 일치 확인, 계속 코드측 참조본으로 사용
- [ ] **원본 보관**: Task 1 완료 후 `docs/research/original/`에 원문 사본 보관 — `mkdir -p docs/research/original && cp "$HOME/Documents/GenTA/연구자료/Mori_C6_창의성장지도_연구_및_서비스적용_명세서_v1.0.pdf" docs/research/original/ && cp -r "$BASE/01_현행정본" docs/research/original/문서세트_2026-07-05_현행정본` (데이터룸 00_Corporate 대응·개발 참조용, git LFS 불필요 — PDF 1MB)

**Verify**
- [x] 대조 결과가 `docs/plan/02_SCHEMA_RECONCILIATION.md` §11 체크리스트에 "대조 완료" 상태로 기록됨(2026-07-05 개정, C6 포함)
- [ ] `ls docs/research/original/` → PDF 1본 + 현행정본 9본 확인(Task 1 이후)

### 4.6 Phase B 리크루팅 개시 (R0의 숨은 크리티컬 패스 — 00 §4-3) — 공문 **승인 완료(2026-07-06)**

- [x] 도서관 협조 공문 발송(00 §8 W1 행) — 대상: Phase B 아동 검증 15–20명, 실행 창 W6–7(8/10–8/23) = Studio T5 키즈 파일럿 통합(DECISIONS_CONTEXT §E). **2026-07-06: 승인 회신 받음** — 리크루팅 진행 가능.
- [ ] 모집 요건 정본 = **플레이테스트 리포트 v2.1 §6(2026-07-05 수령 완료)**: 15–20명·과업 6·합격선 표 — 과업 스크립트까지 즉시 확정 가능. 동의는 영상 미촬영 원칙(E15-2). **E15-2 재시뮬 러너는 `playtest_sim.py` 실물 확보(Task 2.6 이식) — 재구축 불필요**: Phase B 실측치를 스크립트 상단 "발달 파라미터(가정치 v1)" 블록에 대입해 재시뮬 → 발견 8(v2.1 §3)과 대조
- [ ] 참가 가정 파이프라인 시트 개설(모집→확정→일정 배정), 주 1회 상태 점검

**Verify**
- [ ] W1 내 공문 발송 기록, W2 말 후보 가정 ≥5 확보(리드타임 3–4주 역산 — 00 §4-3)

### 4.7 키오스크 하드웨어 발주 (W2–3 하드 데드라인 — 00 §8 파운더 게이트, 00 §7 R-7)

바우처 200만원이 8/31 소멸하고 8월 1주 1호점 설치를 역산하면 W2 내 발주 준비 완료가 필요하다(00 §4-4 "하드웨어 발주는 W2–3, 데모 v2 소프트웨어는 W4까지").

- [ ] **D6–D8**: `KIOSK_하드웨어_제작계획.md`(Task 1.2 이관본) 기준 품목·견적 확정 — 바우처 규정 검증 포함: **품목당 50만 미만 분해·분할결제 금지**(00 §7 R-7)
- [ ] **[사람]** W2 말(7/19)까지 발주 실행. 불가 시 최소한 발주 서류 완성 + W3 발주일 캘린더 확정
- [ ] 발주처·품목·금액·발주(예정)일을 Exit 표 #16에 기입

**Verify**
- [ ] 발주 완료 기록, 또는 발주 서류 완성 + W3 발주일 확정 기록(둘 다 없으면 Exit #16 실패)

### 4.8 기업부설연구소/전담부서 신고 [사람] W1–2 (G0 원문 항목 — 통합마스터플랜 §3 W1–2 행) — **R0 제외, 시드투자 이후로 연기(2026-07-06 대표 결정)**

> **2026-07-06 결정**: 이 항목은 R0 게이트에서 제외한다. TIPS 신청·R&D 세액공제 요건이라 언젠가는 필요하지만, 대표 판단으로 시드투자 이후 트랙으로 이관. 아래 원문 체크리스트는 참고용으로 남겨두되 R0 Exit 판정에는 반영하지 않는다(Exit 표 #1f 갱신 참조).

TIPS 신청·R&D 세액공제의 요건(통합마스터플랜 §3 G3 행 "TIPS 신청 준비"의 선행 조건). 연구 전담 인력은 **대표 포함 2인** 구성으로 신고한다(00 문서 §8 파운더 게이트 W1 행).

- [ ] **W1(D2~)**: 신고 서류 준비 — KOITA(한국산업기술진흥협회) 신고 요건 목록 확인: 연구 공간 구분, 조직도, 연구전담요원 명부(대표 포함 2인), 연구개발 활동 개요 — **보류(시드 이후)**
- [ ] **W2(D8 목표)**: KOITA 온라인 신고 접수 → 접수증 보관. W2 내 접수 불가 시 서류 완성 + 제출일 확정을 Exit #1f에 기록(이월 사유) — **보류(시드 이후)**

**Verify**
- [ ] 신고 접수증 또는 "서류 완성+제출일 확정" 기록 — Exit #1f 판정 입력 — **해당 없음(R0 제외)**

---

## Task 5. R0 Exit 체크리스트 (7/18–19 실행)

HERO v1.1 §0 R0 행("G0 전항 + 아바타 발주·world_state 스키마 머지 + 005 적용") 항목별 판정 명령. **G0 전항의 정본 = 통합 제품 마스터플랜 §3 W1–2 행(2026-07-05 수령)** — #1a–#1h가 원문 항목의 1:1 매핑이다. 전항 통과 = R0 Exit, R1(7/20~) 개시.

| # | Exit 항목 (근거) | 검증 명령 | 기대값 |
|---|---|---|---|
| 1 | 기반 그린 — v2 부트스트랩(G0 실행의 공통 전제, 우리 델타 — 00 §3 R0 행) | `cd /Users/jongwonlee/dev/kindy-web.v2 && npm run lint && npx tsc --noEmit && npm run build && npm run test` | 4개 전부 통과 |
| 1a | G0-①: D-1 교수 IP 계약 — **완료 확인만**(제품재조준 보고 v1.0: 계약 완료 명시; G0 통과 기준 "IP 계약 서명 ✓" — 통합마스터플랜 §3) | 계약 서명본·일자 보관 확인 | 완료 기재 |
| 1b | G0-②: D-4 PIPA **착수**(통합마스터플랜 §3; 데이터맵 = 마스터플랜 v1.1 §4) | PIPA 3동의(E1-2: 법정대리인·국외이전·GACS 민감정보 — 정본 백로그 §4.5)·데이터맵 착수 기록 | 착수 기록 존재 |
| 1c | G0-③: eduvid 배포 = kindy.kr DNS 해소(Task 4.4) | `dig +short kindy.kr` | `34.8.67.108`(미완 시 이월 사유 기록) |
| 1d | G0-④: Toss E2E — **코드 기구현**(0017–0019, 01 문서 §2 E1-1 행), 라이브 키는 W3+ 게이트(00 §8); G0 통과 기준 "테스트 결제·환불 왕복 ✓" | `ls src/app/api/payments/toss/billing-key/route.ts src/app/api/payments/webhook/toss/route.ts src/app/api/subscription/cancel/route.ts` + 테스트 키 결제·환불 왕복 1회 | route 3본 존재 / 왕복 성공 로그 |
| 1e | G0-⑤: 퍼널 계측 5종 — **기구현**(0015 + kiosk/events + dashboard — 01 문서 §2 E2 행); G0 통과 기준 "계측 이벤트 대시보드 라이브 ✓" | `ls supabase/migrations/0015_kiosk_funnel.sql src/app/api/kiosk/events/route.ts src/app/api/dashboard/summary/route.ts` + 대시보드 렌더 확인 | 3경로 존재 / 라이브 |
| 1f | G0-⑥: 기업부설연구소(전담부서) 신고 **[사람]**(Task 4.8 — 대표 포함 2인, TIPS·R&D 공제 요건) — **2026-07-06: R0 제외, 시드투자 이후로 연기(대표 결정)** | (해당 없음 — R0 게이트 아님) | R0 판정에서 제외 |
| 1g | G0-⑦: 가격표 반영 — 정가 ₩25,000 · 얼리버드 ₩19,000(P-1: 도서관 ks 경유 한정·12개월 락·200가구 하드캡 — 마스터플랜 v1.1) | `grep -n "SUBSCRIPTION_PRICE_KRW" src/lib/subscription.ts` + `/?ks=smoke-test` 배지(Task 2.5) | `25000` / 배지 조건부 표시 |
| 1h | G0-⑧: Track P 4항 — 모리 3D 마스터 발주→**D-6 LoRA-first 대체**(Task 2.3·4.2) · 조연 = 승인 캐스트 6인 기확보(불변 ④; E7-2 잔여는 트랙B R1) · 골든셋 확정(Task 3.5) · fal 어댑터 스켈레톤(Task 3.2·3.4) | Task 2.3·3.2·3.4·3.5 Verify 통과 확인 | 전항 통과(골든셋 파일 3본 존재) |
| 2 | G0 — 새 원격·리뷰 강제 (불변 ⑥·⑧) | `git ls-remote origin main \| head -1` + `gh api repos/{owner}/kindy-web-v2/branches/main/protection --jq .required_pull_request_reviews.required_approving_review_count` | 해시 출력 / `1` |
| 3 | world_state 스키마 머지 (HERO §0, Task 2.1) | `git log origin/main --oneline -- supabase/migrations \| head` + SQL: `select count(*) from world_states where false; select conname from pg_constraint where conname like 'game_rounds_%_check';` | 0024–0029 커밋 존재 / 쿼리 에러 없음(테이블 존재) + CHECK 3건 |
| 4 | 005 적용 = 0026 (HERO §4, DECISIONS_CONTEXT §B-3) | `select * from product_defaults order by age_band;` | 3행, 값 = HERO §4 시드(14/17/20분·2/2/3·2/1/0·0.9/1.0/1.0·tap/tap/tap_drag_exp·6/5/5) |
| 5 | 스키마 검증 스크립트 (Task 2.1) | `npx tsx --env-file=.env.local scripts/verify-migrations.ts && npx tsx --env-file=.env.local scripts/verify-rls.ts` | 전부 OK — **verify-rls 2026-07-06 실행 완료(통과)** |
| 6 | E13-2 리듀서+골든테스트 CI (HERO §2, 02 §10) | `npm run test:golden` + PR CI 이력 | 12/12 통과, `ci` 체크 그린 |
| 7 | 아바타 발주 = E13-1 스틸 스펙 (HERO §0·§3, 00 §3) | `test -f docs/hero/E13-1_AVATAR_144_STILL_SPEC.md && echo OK` + 샘플 3장·대표 승인 기록 | OK / 승인 일자 기재 |
| 8 | E13-10 코드 부재 보증 (HERO §3) | `npx tsx --test src/lib/hero/no-camera.test.ts` | 통과 |
| 9 | E12-1' 랜딩 개정 (HERO §6 R0 행) | `grep -c "모두에게 같은 영상이 아니라" src/app/page.tsx` + `/?ks=smoke-test` 육안 | `1` / ₩19,000 배지 조건부 표시 |
| 10 | Studio W1–2: 스캐폴드+스모크 (03 §5) | `cd ~/dev/mori-studio && npx tsc --noEmit && ls out/smoke/*.png` | 통과 / PNG ≥1 |
| 10a | Studio W1–2: 모리 턴어라운드 승인 (Task 3.5, 마스터플랜 §12) | `src/content/approved-frames/` 턴어라운드 승인 프레임 커밋 이력 + 승인 일자 | 승인 프레임 커밋 존재 |
| 10b | Studio W1–2: Inngest dev 더미 완주 (Task 3.5, 03 §5) | `npx inngest-cli dev` 완주 로그 | 로그 확인 — **미달 시 W3 이월 허용**(이월 사유 기록) |
| 11 | Studio W1–2: T3 초기 벤치 (03 §5·§7-4) | `select count(*) from eval_runs;` + `docs/bench/T3-initial.md` | ≥1 / 순위표 존재 |
| 12 | 운영: Inngest Cloud (RUNBOOK §4) | Inngest 대시보드 함수 2개 + cron 수동 발화 1회 성공 로그 | 확인 — **2026-07-06: 시크릿·배포·DNS·인증서·공개접근(org policy 예외) 전부 완료, sync 등록만 남음** |
| 13 | 운영: LoRA 이중 백업 (DECISIONS_CONTEXT §C-6) | `ls -l tmp/studio/kindytoy-v1.safetensors`(≈332MB) + Storage `studio/lora/` 사본 | 2사본 존재 — **2026-07-06 완료** |
| 14 | 운영: Phase B 리크루팅 (00 §4-3) | 공문 발송 기록 + 후보 가정 시트 | 발송 완료·후보 ≥5 — **공문 승인 완료(2026-07-06), 후보 가정 확보는 진행 중** |
| 15 | 운영: Supertone 문의·DNS·BIZ 진행 + 원본 문서 보관(Task 4.3·4.4·4.5 — 문서 수령·대조는 종결) | 발송/진행 기록 + `docs/research/original/` 확인 | 상태 기입(완료 또는 이월 사유) — **2026-07-06: DNS(Cloudflare NS 이전) 신청 완료·전파 대기, Supertone 문의·BIZ 등록은 미착수** |
| 16 | 운영: 키오스크 발주 상태 (Task 4.7, 00 §7 R-7) | 발주 기록 또는 발주 서류+W3 발주일 확정 기록 | 발주 완료 또는 W3 발주일 확정 |
| 17 | 시뮬 스크립트 이식 — `scripts/sim/` 3종·시드 재현 (Task 2.6, 통합마스터플랜 §9) | `ls scripts/sim/playtest_sim.py scripts/sim/simulate.py scripts/sim/build_model.py` + 재현 diff(Task 2.6 명령) | 3종 존재 / `REPRODUCIBLE`·P(M9≥1,000)=2.8% 재현 |

**판정 규칙**: #1–#9는 하드 게이트(하나라도 실패 시 R1 개시 보류 — HERO §9 "게이트 재심 전 다음 릴리즈 배포 보류" 준용). G0 세부(#1a–#1h) 중 **통합마스터플랜 §3 G0 Exit Criteria 3항(#1a IP 계약 서명 · #1d 테스트 결제·환불 왕복 · #1e 계측 대시보드 라이브)은 하드 게이트**, 나머지(#1b·#1c·#1g·#1h)는 미완 시 이월 사유 기록+캘린더 재박기(운영 게이트 준용 — 00 §8; 단 #1h의 골든셋·어댑터는 Studio 트랙 게이트 준용). **#1f(기업부설연구소)는 2026-07-06 대표 결정으로 R0 게이트에서 완전히 제외**(이월도 아니고 판정 대상 자체가 아님 — 시드투자 이후 트랙, Task 4.8 참조). #10·#10a·#10b·#11은 Studio 트랙 게이트(미달 시 03 §5 W3–4로 이월하되 E13-5 의존성 경보 — 00 §4-2; #10b는 W3 이월 허용). #12–#16은 운영 게이트(외부 의존 항목은 이월 사유를 기록하고 캘린더 재박기 — 00 §8; #16 키오스크 발주는 바우처 8/31 하드 데드라인 — 이월 시 W3 발주일 확정 필수). #17은 CC 실행 태스크 — 미달 시 늦어도 W3 첫 금요일(7/24) 주간 그로스 루프 가동 전 완료.

**Exit 후 첫 R1 티켓**(참고): E13-16 연령 기본값 session-config API(0026·session-config.ts가 이미 준비됨 — Task 2.1·2.2 산출), E13-3' A0 탄생 의식(E13-1 스펙 소비 — **웹 구현이 정본, D-14**: HERO v1.1 §1의 아이 iOS 전제는 웹 선행으로 문서화된 수정, iOS 이식은 R3·E14-1 Kids 심사는 R4 — 00 문서 §2·§7 R-14). 백로그 정본은 HERO v1.1 §6 + 통합 제품 마스터플랜 §4.5(E1~E12).
