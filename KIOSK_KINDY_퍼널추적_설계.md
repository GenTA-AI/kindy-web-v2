# 키오스크 → Kindy 퍼널 추적 설계

> 작성일 2026-06-02 · 목적: 도서관 키오스크의 Kindy 데모부터 집에서의 가입·구독·재결제까지 전 구간을 측정하기 위한 데이터 설계
> 결정 사항(합의됨): ① 이번 산출물 = **설계 문서** ② Kindy 데모 키오스크는 **eduvid(Next.js)에 구축** ③ 분석 저장소 = **Supabase + 자체 대시보드**

---

## 1. 측정 목표 (퍼널)

키오스크에서 시작해 가정 내 결제까지 이어지는 단일 퍼널을 측정한다.

| # | 단계 | 측정 질문 | 위치 |
|---|---|---|---|
| 1 | 데모 시작 | 아이가 키오스크 Kindy 데모를 시작했나 | 키오스크(익명) |
| 2 | 영상 시청 | 얼마나 오래 보나 / **끝까지 보나(완주율)** | 키오스크(익명) |
| 3 | 퀴즈·게임 | 영상 후 퀴즈/게임을 **완료**했나 | 키오스크(익명) |
| 4 | QR 전환 | 부모가 QR을 찍어 Kindy로 들어왔나 | 키오스크→웹 |
| 5 | 집에서 진행 | 집에서 이어서 활동했나(재방문·영상 생성) | Kindy 웹 |
| 6 | 회원가입 | 가입했나 | Kindy 웹 |
| 7 | 유료 구독 | 첫 유료 결제를 했나 | Kindy 웹 |
| 8 | 재결제·리텐션 | 추가 결제·재구독을 했나 | Kindy 웹 |

**핵심 산출 지표**: 각 단계 간 전환율, 영상 완주율 분포, 퀴즈 완료율, QR 스캔율(스캔/데모완료), 가입 전환율(가입/스캔), 결제 전환율(결제/가입), 재결제율.

---

## 2. 설계 원칙

1. **단일 저장소** — 키오스크 익명 이벤트와 가정 내 인증 이벤트를 **같은 Supabase**에 적재해야 퍼널 조인이 한 곳에서 끝난다. (그래서 키오스크 데모를 eduvid에 둔다.)
2. **연결 키는 `kiosk_session`** — 키오스크 1회 사용 = 세션 1개. 이 세션 ID를 QR에 심고, 가입 시 부모 계정에 attribution으로 묶고, 이후 결제까지 조인한다. 이것이 익명→실명 다리.
3. **익명 단계는 개인정보 최소 수집** — 키오스크 단계에선 아이 이름·연락처 등 식별정보를 받지 않는다(PIPA). 세션은 무작위 토큰 + 선택값(캐릭터/주제/기분)·행동 이벤트만.
4. **기존 자산 재사용** — 가정 내 영상 시청은 이미 있는 `view_events`/`quiz_results`/`emoji_reactions`/`purchases`를 그대로 쓰고, **신규는 키오스크 익명 구간만** 추가한다.

---

## 3. 식별자 & 연결 모델

```
[키오스크]                         [QR]                    [Kindy 웹/집]
 kiosk_session.id  ───────►  /start?ks=<token> ──►  쿠키/스토리지 보관
   (token=무작위 UUID)                                      │
   익명 이벤트들                                            ▼ (가입 시)
   demo_started                              parent_attribution.kiosk_session_id
   video_progress                                          │
   video_completed                                         ▼ (결제 시)
   quiz_completed                            purchases.parent_id 로 조인
   qr_shown
```

- **`ks` 토큰**: 키오스크가 결과 화면에서 실제 QR(`https://kindy.kr/start?ks=<token>`)을 생성. 토큰은 `kiosk_sessions.qr_token`(무작위, 추측 불가, 만료 있음).
- **스캔 시점**: `/start?ks=` 도착을 `qr_scanned` 이벤트로 적재하고 토큰을 쿠키(`kindy_attr`, 30~90일)에 저장.
- **가입 시점**: 회원가입 완료 시 쿠키의 토큰을 읽어 `parent_attribution(parent_id, kiosk_session_id, …)`에 1행 기록. 이 순간 익명 세션과 실명 계정이 연결된다.
- **결제 시점**: 별도 작업 불필요. `purchases.parent_id` → `parent_attribution.parent_id` → `kiosk_sessions` 로 자연 조인.

> 한 키오스크 세션이 여러 부모로 이어지는 경우는 드물지만, 모델은 **세션:부모 = 1:N**을 허용(같은 QR을 여러 명이 찍을 수 있음). 분석은 보통 first-touch attribution으로 처리.

---

## 4. 데이터 모델

### 신규 테이블 (키오스크 익명 구간)

**`kiosk_sessions`** — 키오스크 1회 사용
```
id              uuid pk
qr_token        text unique           -- QR에 들어가는 무작위 토큰
location_code   text                  -- 'asan-kkumsaem' 등 키오스크 설치처
character       text                  -- 선택값 (princess/space/dino/forest)
topic           text                  -- science/english/hangul/music
mood            text                  -- gentle/lively/mystery/warm
started_at      timestamptz default now()
last_event_at   timestamptz
qr_token_expires_at timestamptz       -- 예: 발급 +90일
```

**`kiosk_events`** — 익명 행동 이벤트 (인증 없음)
```
id              uuid pk
session_id      uuid fk → kiosk_sessions(id)
event_type      text   -- demo_started | step_select | video_started
                       --  video_progress | video_completed
                       --  quiz_started | quiz_completed | quiz_skipped
                       --  game_completed | qr_shown
demo_video_id   text   -- 키오스크에서 재생한 데모 영상 식별자(있으면)
position_sec    numeric -- video_progress 시 현재 재생 위치
duration_sec    numeric -- 영상 총 길이 (완주율 = position/duration)
quiz_score      int
payload         jsonb   -- 단계별 부가값
created_at      timestamptz default now()
```
- `video_completed`는 종료(ended) 또는 position/duration ≥ 0.95 기준으로 적재.
- `kiosk_events`는 **로그인 없이** 쓰므로 RLS는 익명 insert만 제한적으로 허용(아래 6장).

**`parent_attribution`** — 익명 세션 ↔ 부모 계정 연결 (가입 시 1행)
```
parent_id           text   -- = auth.uid()
kiosk_session_id    uuid fk → kiosk_sessions(id)
attributed_at       timestamptz default now()
first_touch         boolean default true
pk (parent_id)      -- 부모당 first-touch 1행 (추가 터치는 별 테이블 또는 무시)
```

### 기존 테이블 (가정 내 구간, 재사용)

- **`view_events`** (0002·0011) — 영상 시청 이벤트. 단계 5 "집에서 영상 시청"에 그대로 사용. **인증+소유권 필수**라 키오스크 익명엔 못 씀(그래서 `kiosk_events` 분리).
- **`quiz_results` / `emoji_reactions`** — 가정 내 퀴즈/반응.
- **`children`** — 가입·아이 등록. 첫 아이 등록 시 트리거로 +1 크레딧(0004).
- **`purchases`** (0004) — 결제. ⚠️ 아래 갭 참조.

---

## 5. ⚠️ 결제/구독 모델 갭 (반드시 결정 필요)

현재 `purchases`는 **일회성 크레딧 팩**(`bundle_type ∈ single/pack6/pack15`)이다. 사용자가 원하는 **"구독"·"재결제"** 개념이 스키마에 없다. 또한 `payment_provider` 기본값이 `'toss'`인데 STATUS.md상 실제 결제는 **카페24 PG**로 전환됨 — 드리프트 존재.

퍼널 7·8단계(구독·재결제)를 측정하려면 둘 중 하나가 필요:

- **A안 (구독 모델 추가)**: `subscriptions` 테이블(plan, status active/canceled, started_at, renewed_at, current_period_end) 신설. "재결제"=갱신(renewal) 이벤트로 측정.
- **B안 (현 모델 유지)**: 구독 없이 "유료결제=첫 paid purchase", "재결제=2번째 이후 paid purchase"로 정의하고 `purchases`만으로 측정.

> 측정만 빠르게 시작하려면 **B안**으로 정의 가능(추가 스키마 0). 진짜 구독 비즈니스로 가면 **A안** 필요. 이 문서의 지표는 B안 기준으로 우선 정의하고, A안 전환 시 매핑을 부록에 둔다.

---

## 6. 수집 경로 (이벤트 인제스트)

**키오스크(익명)** — 신규 엔드포인트 `POST /api/kiosk/events`
- 인증 없음. `kiosk_sessions` 생성 → `kiosk_events` 적재.
- 남용 방지: 토큰 발급 rate limit, IP throttle, 화이트리스트 `location_code`, 페이로드 검증.
- 쓰기는 **service-role 서버 클라이언트**로 수행(RLS 우회), 클라이언트엔 anon key만 노출.
- 버퍼링: 영상 `video_progress`는 5~10초 간격 배치 전송(기존 `/api/events` PUT 배치 패턴 차용).

**QR 스캔** — `GET /start?ks=<token>`
- `qr_scanned` 이벤트 적재 + 쿠키 `kindy_attr` 세팅 후 온보딩/랜딩으로 라우팅.

**가정 내(인증)** — 기존 엔드포인트 유지
- 영상 시청 `POST/PUT /api/events`(view_events), 결제 `purchases`. 가입 직후 쿠키 토큰을 `parent_attribution`에 1회 기록(가입 콜백 또는 온보딩 첫 진입).

---

## 7. QR 연결 흐름 (상세)

1. 키오스크 결과 화면 진입 → 서버에서 `kiosk_sessions` 생성, `qr_token` 발급.
2. 화면에 **실제 QR** 렌더(현재 `FakeQR`을 교체). 인코딩 URL: `https://kindy.kr/start?ks=<qr_token>`.
   - 구현: `qrcode` npm 패키지 추가(현재 미설치) 또는 서버에서 SVG 생성.
3. 부모 스캔 → `/start?ks=` → `qr_scanned` 적재 + 쿠키 저장 → 랜딩/온보딩.
4. 가입 완료 → 쿠키 토큰으로 `parent_attribution` 기록.
5. 이후 모든 결제/시청은 `parent_id` 조인으로 키오스크 세션까지 추적.

> 토큰 미스캔·쿠키 만료·시크릿 브라우징 등으로 attribution 누락 가능 → 그 경우 가입은 "organic"으로 분류. 누락률 자체도 지표로 본다.

---

## 8. 퍼널 지표 정의 (B안 기준)

- **완주율** = `video_completed` / `video_started` (키오스크) · 분포는 `position_sec/duration_sec`.
- **퀴즈 완료율** = `quiz_completed` / `video_completed`.
- **QR 스캔율** = distinct `qr_scanned` 세션 / `qr_shown` 세션.
- **가입 전환율** = `parent_attribution` 행 수 / `qr_scanned` 세션.
- **유료 전환율** = (attribution 있는 parent 중 첫 `purchases.status='paid'` 보유) / 가입.
- **재결제율** = paid 2건 이상 parent / paid 1건 이상 parent.
- **리텐션(집에서 진행)** = 가입 후 N일 내 `view_events` 또는 영상 생성 발생 비율.

---

## 9. 대시보드 (Supabase + 자체)

- **분석 뷰**: `funnel_daily`(일자별 단계별 카운트), `kiosk_session_outcomes`(세션→스캔→가입→결제 플래그), `attribution_revenue`(키오스크 location_code별 매출 귀속).
- **구현**: Supabase SQL 뷰/머티리얼라이즈드 뷰 + Kindy 관리자 라우트(`/dashboard` 또는 `/admin`)에 차트(Recharts). 단계별 막대 + 전환율 + location 필터.
- **권한**: 관리자 전용. service-role 또는 별도 admin RLS.

---

## 10. 구현 계획 (다음 단계, 문서 합의 후)

순서는 위험·의존성 기준.

1. **마이그레이션** `00xx_kiosk_funnel.sql` — `kiosk_sessions`, `kiosk_events`, `parent_attribution` + 익명 insert RLS.
2. **익명 인제스트 API** `POST /api/kiosk/events` (+ 세션 생성, rate limit).
3. **키오스크 데모 실동화** — `demo/kiosk`에 ① 데모 영상 재생 + 진행/완주 이벤트 ② 퀴즈/게임 + 완료 이벤트 ③ **실제 QR**(qrcode 패키지) 생성.
4. **`/start?ks=` 라우트** — `qr_scanned` 적재 + 쿠키.
5. **가입 attribution 훅** — auth 콜백/온보딩 첫 진입에서 `parent_attribution` 기록.
6. **결제 단계 정의 확정** — B안 즉시 / A안(구독 테이블) 결정.
7. **분석 뷰 + 대시보드**.

> 선행 차단요소(STATUS.md): Inngest 프로덕션 미연결(실영상 생성), kindy.kr DNS 미연결. **단, 키오스크 데모는 사전 생성된 데모 영상으로 동작 가능**하므로 영상 생성 파이프라인 없이도 퍼널 측정은 착수 가능.

---

## 11. 개인정보 (PIPA) 고려

- 키오스크 익명 구간은 **식별정보 미수집**(무작위 토큰 + 행동·선택값만). 아동 직접 식별 안 함.
- QR·쿠키는 기기 단위 attribution이며 개인 식별 아님. 가입 시점부터 기존 PIPA 동의 절차(온보딩 step 4) 적용.
- `location_code` 외 키오스크 위치/촬영정보 수집 안 함.

---

## 부록: 코드 근거 (현 상태)
- `src/app/demo/kiosk/page.tsx` — 현재 데모는 목업, `FakeQR`(실 QR 아님), 영상 재생·추적 없음.
- `src/app/api/events/route.ts` — view_events는 `getCurrentParentId()` + 소유권 검증 필수(익명 불가). 배치 PUT 패턴 존재.
- `supabase/migrations/0002_videos_pipeline.sql`, `0011_view_events_library.sql` — view_events: child_id+video_id/library_video_id, RLS는 부모 소유 child만 insert.
- `supabase/migrations/0004_credits_purchases.sql` — purchases는 일회성 크레딧 팩(single/pack6/pack15), 구독 없음, provider 기본 'toss'(실제 카페24로 드리프트).
- `src/lib/auth.ts` — parent_id = Supabase `auth.uid()`.
