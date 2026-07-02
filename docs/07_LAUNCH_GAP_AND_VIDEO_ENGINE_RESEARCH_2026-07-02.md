# 런칭 갭 감사 + AI 영상 엔진 경쟁·기술 조사 — 2026-07-02

> 방법: (A) 코드베이스 8차원 감사 — 44개 에이전트, P0/P1 전건 적대적 재검증(승격 1·강등 7·병합 4).
> (B) 웹 딥리서치 — 104개 에이전트, 5개 검색 각도, 주장별 3표 적대적 검증(전 항목 3-0 생존).
> 기준: HEAD `9b85771`, `lint`·`tsc --noEmit`·`build` 그린 재확인(exit 0).
> 핵심 주장 5건(0099·business-info·서명URL·미리스텁·playsInline)은 메인 세션에서 파일 직접 재확인.
> 이 문서가 `docs/00_HANDOFF.md` §8의 상세 확장판이다. 코드 P0 수정 시 이 문서의 해당 항목을 갱신할 것.

---

## Part A. 당장 런칭까지 부족한 것 (검증된 갭)

**총계: 런칭 차단 P0 6건 · 첫 주 리스크 P1 18건 · 개선 P2 34건**

### A-1. 런칭 차단 (P0) — 6건

#### P0-1. ✅ 해소(`70a859e`) — `supabase db push`가 긴급 RLS 해제 스크립트(0099)를 마지막에 자동 적용 → 프로덕션 아동 데이터 전면 노출
> 0099·0008을 `supabase/manual/`로 이동(+README), `apply-migrations.sh` deprecated. 이제 `supabase db push`가 안전.
- **증거**: `supabase/migrations/0099_rls_disable_rollback.sql:1-16` ('평상시 적용 금지' 주석이지만 CLI는 무시. children·videos·credits·purchases·view_events·emoji_reactions·quiz_results·word_profiles·waitlist·invite_codes·invite_redemptions RLS 해제); `supabase/config.toml:53-58` `[db.migrations] enabled=true` — 0099가 버전 순 최후 적용; 동류 함정 `supabase/migrations/0008_demo_parent_cleanup.sql:1-2`. REVOKE가 어떤 마이그레이션에도 없어 RLS off 시 anon 키로 전 테이블 읽기/쓰기 가능.
- **검증 노트**: 0099는 billing_keys는 건드리지 않음(빌링키는 보호 유지) — 나머지 전부 노출, 앱은 정상 동작해 QA로 발견 불가. `scripts/apply-migrations.sh`가 0008/0099를 제외하긴 하나 0010-0020이 빠진 stale 스크립트라 프로비저닝 경로가 아님.
- **수정**: 0099·0008을 `supabase/manual/`로 `git mv`(또는 `.sql.disabled`) + 핸드오프 1줄. **프로드 DB 프로비저닝 전에 반드시 선행.**

#### P0-2. ✅ 해소(`8ee83cd`) — 현 빌드 파이프라인·코드로는 어떤 배포 구성으로도 결제 활성화 불가 (이중 결함, 매출 0)
> business-info.ts 리터럴 env 접근으로 재작성 + Dockerfile/cloudbuild에 TOSS·BIZ 6종·SITE_URL·START_BASE ARG.
> 테스트 값 빌드로 클라이언트 청크 인라인 실증. **남은 조건**: 실배포 빌드 시 substitution에 실값 전달(코드 밖 게이트 ①②).
- **증거 ① (파이프라인)**: `Dockerfile:40-44`·`cloudbuild.yaml:13-27`은 Supabase 2종만 빌드타임 주입 — `NEXT_PUBLIC_TOSS_CLIENT_KEY`(`SubscribeClient.tsx:59,77` 클라이언트 인라인 참조)의 ARG 부재로 실이미지에서 빈 값 인라인. `checkoutReady = hasTossClientKey && businessComplete`(`SubscribeClient.tsx:65-66`)가 결제 CTA를 '결제 준비 중'으로 영구 비활성.
- **증거 ② (코드 — 더 치명적)**: `src/lib/business-info.ts:11-14`가 `process.env[key]` **동적 조회** — Next 16은 동적 조회를 클라이언트 번들에 절대 인라인하지 않음(실빌드 실증: 서버 HTML엔 값이 있으나 클라이언트 청크 0개). 즉 빌드타임 env를 넣어도 브라우저에서 `isBusinessInfoComplete()`는 항상 false → **env 설정만으로는 결제 버튼이 안 열림**. `SiteFooter.tsx:24-32`의 전자상거래법 §13 사업자 표시도 브라우저 렌더 불가. `docs/00_HANDOFF.md` §3.7의 'env만 채우면 됨' 안내는 이 지점에서 틀림.
- **수정**: business-info.ts를 리터럴 `process.env.NEXT_PUBLIC_BIZ_*` 접근으로 재작성(또는 subscribe 서버 컴포넌트에서 읽어 props 전달 — 더 안전) + Dockerfile/cloudbuild에 TOSS 클라이언트 키·BIZ 6종·SITE_URL ARG 추가.

#### P0-3. ✅ 해소(`47d31d4`) — 생성 콘텐츠 전부가 30일 서명 URL로 DB에 박제 — 생성 후 ~30일에 전 구독자 동시 암전
> migration 0021(`*_path` 3컬럼 + 기존 signed URL 백필) + `getSignedUrls` 일괄 헬퍼 + `withFreshLibraryMediaUrls`(6h, 폴백 유지)를
> `/api/library`·`/api/library/[id]`·`/play`에 배선. 생성 스크립트 3종이 path 저장. 이제 배치 생성 가능.
- **증거**: `src/lib/supabase-storage.ts:21,59-67`(30일 만료 기본값, 비공개 버킷, 만료 시 폴백 없음); `scripts/generate-library-episode-90s.ts:242-258`·`scripts/generate-library-batch.ts:543-582`가 서명 URL을 `library_videos.video_url/thumbnail_url/subtitles_url`에 insert 시점 고정 저장(0010엔 storage path 컬럼 자체가 없음); 서빙 경로 전부 원문 반환(`/api/library`, `/api/library/[id]`, `/play`, `SessionShell.tsx:777` 등); 재서명 cron·serve-time 재서명 코드 없음(전수 grep). bespoke는 `video_path`가 저장돼 있어 수정 용이.
- **수정**: DB엔 storage path 저장 + 로더에서 요청당 재서명(또는 published 콘텐츠용 공개 버킷). **라이브러리 배치 생성 전에 선행해야** 전 행 수동 마이그레이션을 피함.

#### P0-4. 콘텐츠 재고: 실 재생 가능 콘텐츠가 15초 클립 1편 + 고정 세션 1개 — '매주 새 모리 이야기' 약속과 정면 충돌
- **증거**: `scripts/seed-library.ts:13-27`(진짜 재생 가능 엔트리 1개, 15초); `src/data/worlds/animal-village.ts:550-579`(세션 시나리오 1개·6개 고정 활동); `/play`의 villageSeed가 child당 상수 → 매 방문 동일 플랜; `FREE_TRIAL_SESSION_LIMIT=3` vs '무료 모험 3편' 카피; 유료 페이지가 '매주 새 모리 이야기' 명시(`subscribe/page.tsx:10`, `SubscribeClient.tsx:26`) — 배후 메커니즘·재고 0.
- **부수**: 15초 폴백은 published 영상이 전 토픽 0개일 때만 발화하며 발화 로그가 전혀 없음(`play/page.tsx:176-182,326-335`).
- **수정**: 런칭 전 모리 동물마을 에피소드 최소 3편 제작·발행 + VillageSession 시나리오 2개 이상 + seed를 일자/완료수 기반으로 변화. 불가하면 '3편'·'매주 새' 카피 완화. 폴백 발화 시 서버 로그 추가.

#### P0-5. Inngest Cloud 미연결 — 갱신 cron·영상 생성이 프로덕션에서 영원히 미작동 (조용한 open-fail)
- **증거**: `STATUS.md:18`('INNGEST_DEV=1 미연결'); Secret Manager 목록에 Inngest 키 없음 vs `scripts/deploy-cloud-run.sh:10-13`은 전제; `src/inngest/client.ts:11-18`(dev 모드 → Cloud 미등록). 첫 결제는 동기 처리라 D1은 정상 — 그러나 `hasPremiumEntitlement`가 `premium_until` 기준이므로 **~30일 후 전 구독자가 청구 없음·고지 없음·알림 없음으로 잠김, 반복 매출 0**.
- **수정**: Inngest Cloud 가입 → Secret Manager 2종 → deploy 스크립트(INNGest_DEV 제거) → 앱 sync → cron 1회 발화 검증. ~1시간 ops 작업. (코드 밖 게이트 ③)

#### P0-6. ✅ 해소(`980a7c6`) — PIPA §28-8 국외이전 고지 누락 — 아동 이름·나이가 미국(Anthropic·fal.ai)·ByteDance 계열(Seedance) 처리자로 전송
> privacy.md §5를 국내 위탁 + 국외이전(사업자별 이전 항목·방법시기·목적·보유기간·거부권)으로 개정, PRIVACY_VERSION 2026-07-02 bump.
> **남은 것**: 변호사 최종 검토(코드 밖 게이트 ⑦), 벤더 no-training 실계약 확인(게이트 ⑧), C-4 실명 마스킹은 별도 작업.
- **증거**: `src/content/legal/privacy.md:48-58` §5 위탁 목록에 국외 사실·국가·이전 항목·방법·시기·보유기간 전부 미기재; privacy.md:19가 'AI 콘텐츠 제작 시 자녀 이름·나이 사용' 자인; 실데이터 흐름 `src/lib/brief-builder.ts:87,93-114`(childName·age → VideoBrief) → `claude-director.ts`(Anthropic)·`episode-pipeline.ts`(fal.ai/Seedance); 온보딩 동의에 국외이전 별도 동의 없음 → §28-8(1)3 위탁 예외 요건도 불충족.
- **수정**: privacy.md §5를 국외이전 표(이전받는 자·국가/항목/방법·시기/목적/보유기간)로 개정 — 텍스트 수정만으로 해결 가능. Part C-4의 실명 마스킹과 병행 권장.

### A-2. 첫 주 리스크 (P1) — 18건

#### 결제·구독 (3건)
- **P1-1. 갱신 1회 실패 = 구독 영구 사망** — cron이 `status='active'`만 선별(`subscription-renewal.ts:169-175`) → `markPastDue` 후 영원히 제외. 모든 실패 경로(일시 네트워크 오류·키 회전·예기치 못한 status)가 past_due行. past_due 패널엔 복구 CTA 0(`SubscribeClient.tsx:254-257`). 수정: due 쿼리에 past_due 포함 + 7일 재시도 윈도 + '카드 다시 등록하기' CTA + 실패 운영자 가시화.
- **P1-2. 매월 전 구독자가 최대 24시간 유료 접근 상실** — 만료 후 다음날 04:00 KST에야 청구(`subscription-renewal.ts:166,174-175`), 엔타이틀은 즉시 차단 → '결제했는데 결제벽'이 매달 전원에게 결정론적으로 발생. 수정: due를 `current_period_end <= now() + interval '1 day'`로 또는 24h 유예.
- **P1-3. 빌링키 엔드포인트가 상태 확인 없이 무조건 ₩25,000 청구** — 해지 후 재구독 시 잔여 유료일 소멸 + 청구 성공 후 활성화 실패 창(`billing-key/route.ts:93-183`). 수정: 청구 전 상태 조회 — 현재 premium이면 무청구 un-cancel, 첫 청구 orderId를 parent+period 결정적으로.

#### 콘텐츠 (3건)
- **P1-4. seed-library.ts가 죽은 옛 브랜드 '미리' 스텁 8편을 published:true로 삽입** — stub-*.mp4 전부 HTTP 404 확인, featured 우선이라 상단 노출, `LibraryPlayer.tsx` onError 없음 → 아이가 검은 화면. **프로드에 시드 돌리기 전 스텁 삭제 또는 published:false 필수.**
- **P1-5. c6_focus가 영상 1편에만 존재, 생성 스크립트는 기록 안 함 → '선별 기반 초개인화'가 실데이터에서 no-op** — 두 생성 스크립트 insert에 c6_focus 없음, spec 타입에 필드 자체가 없음(0020 주석과 직접 모순); 태그 0개면 항등 정렬. 3대 불변 핵심 중 하나가 무증상 사망. 수정: spec 타입 + insert payload에 필드 추가.
- **P1-6. 유일한 진짜 영상이 script=null → /library/[id] 단서 질문 플로우가 매 시청 후 오류** — `attention-quiz/route.ts:102-103`이 404 → '단서 질문을 준비하지 못했어요'. 수정: seed에 최소 VideoScript 또는 null-script 시 로컬 질문 폴백.

#### 비디오 엔진 (2건)
- **P1-7. bespoke 중복 생성 가드가 'generating'을 안 봄** — `bespoke/route.ts:85`가 `['queued','processing']`인데 'processing'은 죽은 값, 실제 파이프라인은 'generating' 설정 → 가드는 큐 직후 수 초만 유효, 재클릭당 ~$8 중복 지출. **수정 한 줄**: `['queued','generating']`.
- **P1-8. 엔진이 실 프로덕션 배치를 한 번도 완주한 적 없음** — 유일 기록이 dryRun=true·successCount=0(`tmp/library-90s/report.json`); publish 스크립트 부재; 서명 URL·vtt·모바일 재생·실 비용 전부 미검증. 수정: `LIMIT_COUNT=3` 실배치 → 휴먼 QC → 소형 publish 스크립트.

#### UX·모바일 (3건)
- **P1-9. 부분 해소(2026-07-02 Codex)** — `/public/audio/village/` gitignore 제거 + 인터랙티브 플레이어 첫 탭에서 iOS 오디오 unlock best-effort 추가. **남은 것**: 운영자가 `GOOGLE_API_KEY` 채운 뒤 `npx tsx --env-file=.env.local scripts/gen-village-tts.ts` 실행 → 생성 mp3 커밋.
- **P1-10. error.tsx / not-found.tsx / loading.tsx 전무** — 일시적 Supabase 오류가 영어 'Application error' 백지 화면. 수정: 루트 error/not-found 2파일(모리 카드 스타일).
- **P1-11. LibraryPlayer(실고객 플레이어)만 playsInline 누락** — iPhone Safari가 매 영상 강제 전체화면, 자막 토글·'단서 놀이 할래' 버튼 소실. 데모 플레이어 둘은 설정돼 있음 → 유료 경로만 누락. **수정 한 줄.**

#### 운영 (3건)
- **P1-12. 오류 추적·알림 제로 — 갱신 전원 실패해도 Inngest는 초록불** — renewal이 실패를 삼키고 success 반환(`subscription-renewal.ts:107-121,189-196`); 관측성 의존성 0. 수정: `summary.failed > 0` 시 throw 또는 알림 + Sentry/GCP Error Reporting.
- **P1-13. 백업/키 관리 무방비** — BILLING_KEY_SECRET 단일 장애점(버전/회전 없음, 유실 = 전 가구 카드 재등록); Supabase 백업/복구 절차 전무. 수정: Secret Manager + 오프라인 에스크로, 백업 티어 확인 + 복원 1회 테스트.
- **P1-14. 운영 런북·일일 체크 부재 + STATUS.md 낡아 오도** — **Toss 웹훅 URL 대시보드 등록 절차가 어디에도 없음**(미등록 시 환불 고객이 프리미엄 유지). 수정: docs/RUNBOOK.md 1페이지(배포·env 매트릭스·웹훅 등록·일일 SQL 3개) + STATUS.md historical 배너.

#### 법무 (4건)
- **P1-15. 정기결제 동의 증적이 fire-and-forget** — `SubscribeClient.tsx:88` `.catch(()=>{})`, 청구 서버가 증적 존재를 강제 안 함 → 분쟁 시 건별 증적 부재 가능. 수정: 빌링키 발급 전 서버 insert-or-verify, 실패 시 중단.
- **P1-16. ✅ 해소(2026-07-02 Codex)** — `src/lib/mailer.ts` 추가(Resend REST, `RESEND_API_KEY` 없으면 no-op), 첫 결제 성공·갱신 성공·갱신 실패 메일 배선. 메일 실패는 결제 흐름을 막지 않고 로그만 남긴다. 운영 남은 것: `RESEND_API_KEY`/`RESEND_FROM_EMAIL` Secret Manager 주입.
- **P1-17. game_rounds의 점수·반응속도·난이도 수집이 privacy 고지 항목에 없음**(PIPA §30 열거 누락) — learning-profile이 정확도·지연 백분위로 프로파일링하는데 privacy.md:17은 완료/재도전/꾸미기만 열거. 수정: 항목 추가 + 프로파일링 1줄 + 동의 버전 bump.
- **P1-18. AI 생성물 표시 부재**(AI기본법 §31, 2026-01-22 시행) — 고객 표면 전체 AI 표시 grep 0; terms.md:56 'AI 보조'는 축소 기술(실제는 영상 자체가 생성형). 수정: '모리 이야기는 AI로 만들어요' 상시 라벨 + terms §8 개정. → Part B-3, C-5 참조(라벨을 신뢰 자산으로).

### A-3. 개선 (P2) — 34건 요약

검증 후 하향 7건: ~~로그인 open redirect 백슬래시 우회(수정 2줄)~~ ✅ 2026-07-02 Codex · 생성 매트릭스가 전부 옛 '미리' 브랜드(동물마을 매트릭스 작성 필요) · **bespoke 영상 전달 표면 부재**(생성·과금은 되나 어떤 UI도 videos 테이블을 안 읽음 — 20가구는 대외 공유로 우회 가능) · Inngest 재시도가 파이프라인 전체 재과금(~$15/실패건) · 입 오버레이 전 씬 고정 좌표 · preview TTS 단일 의존 · TTS 초과분 무음 잘림.

미검증 27건 중 런칭 관련 주요: 갱신 부분 실패 시 duplicate-orderId를 청구 실패로 오판(결제된 고객 past_due) · ~~웹훅이 pending을 'canceled'로 매핑~~ ✅ 2026-07-02 Codex · ~~프로드 test 키 무경고~~ ✅ 2026-07-02 Codex · ~~public 함수 EXECUTE가 anon에 열림(REVOKE 1개)~~ ✅ migration 0022 · kiosk 익명 ingest 무제한 · proxy 매처가 bespoke curl을 401로 차단(런칭 전 쿠키 없는 curl 테스트 필수) · **모리 정본 레퍼런스 미사용 — 캐릭터 시트를 빈 ref로 생성**(`episode-pipeline.ts:437`, `public/ip/mori-reference*.jpg` 미주입) · 인터랙티브 스펙과 산출 포맷 불일치(씬별 클립 미출력은 남음, 단일 mp4 timestamp 최소 플레이어는 2026-07-02 구현) · ~~Opus 단가 3배 과대(원가 왜곡)~~ ✅ 2026-07-02 Codex · fal.ai 총액 캡 없음 · ~~랜딩 '커리큘럼' 용어 가드레일 히트 1건~~ ✅ 2026-07-02 이전 반영 + hero CTA 보정 · 법정대리인 확인이 자가선언뿐.

전체 상세는 감사 원본(세션 스크래치패드) 참조. 코드 수정 시 이 문서 갱신.

### A-4. 견고 확인된 것 (재점검 불요 — 86건 중 요지)

- **결제**: 빌링키 AES-256-GCM 암호화 + 프로드 키 부재 시 hard-fail; 클라이언트 billing_keys 접근 전면 차단(deny-by-default); 웹훅은 payload 불신·Toss 재조회·멱등; 갱신 이중청구 방어(결정적 orderId + unique + step 캐시); customerKey=parentId 바인딩; 기간말 해지 정상; 트라이얼 게이트 서버측 402.
- **보안**: 전 20개 마이그레이션 RLS 커버리지 완전(0099 제외); 31개 API route 전수 — 전부 parent_id 스코프; service-role 키 클라이언트 미유출(grep 검증); Inngest 서명 fail-closed; 아동 동의 서버 강제 + 실패 시 롤백.
- **콘텐츠/엔진**: /play는 시드 0에서도 동작(번들 폴백); 생성 스크립트 멱등 + published:false 안전; 로컬 스모크 무과금 검증 가능; 오디오 구동 mouth-sync 실구현; 스크립트 검증 엄격(fail-fast); 비용 원장(cost_ledger) 실재.
- **UX**: 가입→온보딩→첫 영상→기록장 dead-end 없음; 터치 타깃 48-64px+; 고객 UI 용어 가드레일 사실상 클린(커리큘럼 1건 제외); 데모 퍼널 로그아웃 상태 동작.
- **법무**: 자녀 음성 수집 안 함 검증(마이크 코드 0); parent_consents 데이터 최소화 + 증적 보존 설계 정합; 약관 §8 진단 보증 부인.

---

## Part B. AI 영상 엔진 — 경쟁·기술 조사 (전 항목 3-0 적대적 검증 생존)

### B-1. 엔진 시장 2026: 비용·기술 지형

| 모델 (fal.ai) | 오디오 | $/초 | 90초 환산 | 용도 판단 |
|---|---|---|---|---|
| Wan 2.5 | ✕ | $0.05 | $4.5 | 무대사 모션 컷 |
| Kling 2.5 Turbo Pro | ✕ | $0.07 | $6.3 | 저가 모션 |
| **Kling 3.0 Pro** | **○** | **$0.168** | **$15.1** | **premium 가성비 기본값 후보** |
| Seedance 2.0 (720p) | ○ (네이티브 립싱크+효과음+음악 단일 패스) | $0.24–0.30 | $21.8–27.3 | 오디오 품질 우선 시 (현 파이프라인) |
| Veo 3 | ○ | $0.40 | $36 | 히어로/랜딩 대표 전용 |

- 단서: Seedance 1080p는 $0.682/초(2.25배); Veo 3.1 무음은 $0.20/초. element 참조(캐릭터 일관성) 시 Kling 3.0은 2배($0.336/초).
- **립싱크는 프리미엄 모델의 기본 사양이 됐다** — Seedance 2.0은 통합 오디오-비디오 단일 패스에서 프롬프트 구동 립싱크 + 효과음까지 생성(8개+ 언어). 별도 lipsync 호출($3/min) 필요성이 줄어드는 추세.
- **limited animation 경로는 동료심사 논문으로 실증됨**: MIT Fedorenko 그룹(Developmental Cognitive Neuroscience, 2026-01, doi 10.1016/j.dcn.2026.101674) — TTS + 오디오 구동 자동 입모양 파이프라인으로 아동 친화 말하는 캐릭터 영상을 **편당 평균 1분 25초**에 생성, 오류/재생성률 **8.86%**, 880편을 이틀에 완성. 단서: 4초 단일 문장 자극물 기준, 수동 QA 필수 단계로 기술 — Kindy의 휴먼 QC 게이트와 동형.
- **시장 준거가격**(LongStories.ai, 라이브 확인): 정지화면(limited 유사) ~$1.76/분 vs 풀 애니메이션 ~$7/분 — **약 4배 스프레드**. Kindy의 limited/premium 이중 모드 배분이 시장 구조와 일치.

### B-2. 경쟁 지형: 핵심 발견 = 비스포크는 화이트스페이스

- **정상급은 풀 생성을 안 쓴다**: Moonbug/CoComelon은 시리즈 내 AI 'zero'(CCO 인터뷰, 2024 중반 자가 진술). 완전 생성형 시도는 실패가 문서화됨 — Kartoon Studios의 AI 생성 교육 시리즈(~20편)는 유튜브 총 조회수 4만 미만으로 자사 채널 최하위권.
- **성공 패턴 = 'AI 가속 파이프라인 + 인간 창작·검수'**: Toonstar(자칭 80% 단축·24시간 아이디어→실행), Animaj(연 220억+ 유튜브 뷰, $85M Series C, Google AI Futures Fund가 첫 아동 미디어 투자로 $1M + Veo/Gemini 조기 접근 제공). 단, Animaj 규모는 기존 IP(Pocoyo) 위에 구축된 것.
- **핑크퐁(국내 최강 IP)**: AI는 자체 음성 솔루션 'OneVoice'(캐릭터 음성 학습 → 다국어 자동 더빙)와 오프라인 AI 몰입 전시(DDP, 2026-06)에 집중. AI 영상 생성·아이별 초개인화 구독 영상의 증거는 국·영문 적대적 검색에서도 미발견.
- **아이별 약점 기반 bespoke 영상을 하는 사업자는 검증 범위 내 전무** — Kindy의 포지션(진단 → 약점 겨냥 생성 → 성장 증명)은 글로벌·국내 모두 화이트스페이스. 20가구 콘시어지(운영자 검수)는 위의 '성공 패턴'과도 구조적으로 동형.
- **인터랙티브 선택형 영상의 기관급 선례**: PBS Kids 'Lyla in the Loop' — AI 대화형 에피소드(ASR+NLP로 아이 음성 답변 해석 → 적응적 피드백), 2024 가을 ~200명 필드 트라이얼 후 실제 출시. 승인된 scene graph 플레이어 방향의 교육적·상업적 타당성을 지지.

### B-3. 규제·신뢰 (설계에 직접 영향)

- **2025 COPPA 개정(완전 시행 중)**: ① 아동 개인정보를 **제3자 AI 학습·개발용으로 제공하는 것은 별도 검증된 부모 동의(VPC) 필요**(서비스 필수 벤더 전송은 예외) → AI 벤더 계약에 no-training 조항. ② '개인정보' 정의에 **성문(voiceprint)·얼굴 템플릿 신설** → 아이 목소리/얼굴을 생성 영상에 넣는 기능은 전면적 의무 발동. ③ 콘텐츠 개인화의 무동의 예외는 지속 식별자만 쓸 때의 좁은 차선 — **약점 프로파일 기반 초개인화는 VPC 전제 설계**(Kindy의 부모 동의 온보딩과 정합; 미국 진출 전 기준선으로 채택 권장).
- **플랫폼 역풍 = Kindy에 유리한 구도**: 237개 단체·전문가(Fairplay 주도, 2026-04)가 YouTube Kids 내 AI 콘텐츠 전면 금지 요구; YouTube는 Kids 앱 AI 콘텐츠를 '소수 고품질 채널'로 제한 중 + AI 라벨 개발 중. → YouTube 의존 배급은 규제 리스크 증가. **Kindy의 웹 구독 자체 배급 + 자발적 AI 투명성 라벨 + 휴먼 QC는 신뢰 자산**이 된다.
- **국내**: PIPA §28-8 국외이전 고지(P0-6) + AI기본법 §31 생성물 표시(P1-18, 2026-01-22 시행, 첫해는 시정명령 우선) — 둘 다 텍스트/라벨 수준으로 즉시 해소 가능.

---

## Part C. AI 영상 엔진 디벨롭 로드맵 (조사 반영 결정)

### C-1. 모드 배분 — 현 전략 유지, 수치로 확정
- **limited = 본편 기본** (반복 학습·라이브러리 대량·비스포크): MIT 논문 실증 + 시장 4배 스프레드가 뒷받침. 한계비용은 TTS+이미지 컷 수만.
- **premium = 히어로 전용** (랜딩 대표·투자자 데모·각 세계 첫 인상 컷): 90초 기준 $15–36.
- **신규 — 하이브리드 컷 전략**: 에피소드당 '움직여야 사는' 1–2컷(등장·클라이맥스)만 premium 클립을 섞고 나머지는 limited — 시장 스프레드상 편당 +$2–4로 체감 품질 상승. 인터랙티브 씬 그래프의 씬 단위 생성과 자연스럽게 결합.

### C-2. 프리미엄 프로바이더 재평가 (현 Seedance 단일 → 2종 비교)
- 현 파이프라인은 Seedance 2.0($0.30/초 720p) + 별도 sync-lipsync($3/min). 조사 결과 **Kling 3.0 Pro가 오디오 포함 $0.168/초로 우위** — 프로바이더 인터페이스(`src/lib/video-providers/*`)가 이미 타입드이므로 KlingProvider 추가 후 동일 브리프 A/B가 저비용. 무대사 모션 컷은 Wan 2.5($0.05/초).
- 단, Seedance의 단일 패스 오디오 통합(대사+효과음+환경음)은 한국어 유아 톤에서 품질 우위 가능성 — **A/B 청취 평가 후 기본값 결정**(음성 일관성은 P2-⑥ 이슈와 함께 판단).
- Veo 3는 히어로 전용 유지. Google AI Futures Fund 사례(Animaj)처럼 **프론티어 벤더의 스타트업 프로그램/조기 접근 신청 가치 있음**.

### C-3. 인터랙티브 scene graph 플레이어 — 진행 확정, 엔진 정렬 선행
- PBS Kids 선례로 방향 타당성 확보. 승인 스펙(`docs/superpowers/specs/2026-07-01-interactive-video-session-design.md`)대로 진행.
- **2026-07-02 Codex 최소 구현 완료**: `src/types/interactive-session.ts`, `src/components/game/InteractiveVideoPlayer.tsx`, `ANIMAL_VILLAGE_SCENE_GRAPH`, `/play` 통합. 현재는 단일 `/demo-videos/mori-starlight-seed.mp4`를 timestamp로 나눠 쓰는 fallback이며, 선택 결과는 기존 `game_rounds` 계약으로 저장한다.
- **엔진 측 선행 작업**: episode-pipeline이 현재 단일 mp4만 출력 — **씬별 클립(s0N.mp4) + scenes 매니페스트 출력**으로 변경(P2 지적). 가지 씬은 limited로 생성(스펙 §2 비용 경계 그대로: diamond 합류 = 선형 증가, 결말만 ×2).
- 선택 오버레이는 기존 큰 얼굴/그림 UI 재사용, `game_rounds` 기록 계약 불변.

### C-4. 비스포크 = 검증된 화이트스페이스 — 유지·확장하되 규제 설계 내장
- 경쟁사 전무 확인 → 20가구 콘시어지 확장이 옳은 베팅. '자동 대량 생성'이 아니라 'AI 가속 + 운영자 검수'가 업계 성공 패턴과 동형임을 대외 서사로 사용.
- **규제 설계 4종**: ① 외부 생성 API에 아이 **실명 전송 최소화** — brief-builder에서 childName을 역할명/가명으로 치환(생성물엔 아이 이름이 들어가야 하면 TTS 단계에서만 주입 검토). ② 벤더(fal.ai·Anthropic·Google) **no-training 조항/약관 확인**을 벤더 채택 체크리스트에. ③ 약점 프로파일 개인화는 온보딩 부모 동의에 **명시 문구 보강**(P1-17과 동시). ④ 아이 목소리/얼굴 활용 기능은 **당분간 금지**(COPPA 생체정보 + PIPA 리스크 — 도입 시 별도 동의 체계 선행).
- 전달 표면(P2-③: /play '맞춤 이야기' 섹션)이 없으면 비스포크 가치가 고객에게 안 보임 — 20가구 시작 전 최소 구현.

### C-5. 신뢰 자산화 — 라벨과 검수를 마케팅으로
- P1-18 해소를 의무가 아니라 자산으로: '모리 이야기는 AI로 만들고, 사람이 한 편씩 검수해요' 상시 라벨 — YouTube Kids AI 역풍 구도에서 차별화 포인트.
- **휴먼 QC 게이트(published:false → 검수 → 발행)를 공식 제작 원칙으로 문서화** — MIT 논문도 수동 QA를 필수 단계로 기술. 발행 체크: 캐릭터 일관성(모리 정본 ref 주입 — P2 수정), 음성 자연스러움, 씬당 한 행동, 용어 가드레일.

### C-6. 엔진 작업 순서 (이 순서를 지키지 않으면 재작업)
1. **P0-3** 서명 URL → storage path + 요청당 재서명 (생성 전 선행 필수)
2. **P1-7** bespoke 가드 한 줄 수정 + **P2** 모리 정본 레퍼런스 주입 + Opus 단가 상수 정정
3. 동물마을 매트릭스 작성(미리 매트릭스 deprecated) + **P1-5** c6_focus 필드 배선
4. **P1-8** `LIMIT_COUNT=3` 실배치 완주 → 휴먼 QC → publish 스크립트 → **P0-4** 재고 3편 확보
5. ~~InteractiveVideoPlayer 최소 구현~~ ✅ 2026-07-02 Codex → 다음은 씬별 클립 + 매니페스트 출력으로 fallback timestamp 제거
6. KlingProvider 추가 → Seedance A/B → 하이브리드 컷 전략(C-1) 적용
7. bespoke 전달 표면(C-4) → 20가구 콘시어지 개시

---

## Part D. 코드 밖 게이트 (파운더 전용 — 갱신판)

> ⚠️ ①②④는 **코드 수정 선행 없이는 게이트를 열어도 효과 없음.**

1. **사업자 정보** — 통신판매업 신고 + NEXT_PUBLIC_BIZ_* 6종 실값. *선행: P0-2 (현재는 env를 어디에 넣어도 결제 버튼이 안 열림).*
2. **Toss live 키** — 전환 + **대시보드 웹훅 URL 등록·발화 테스트**(절차 미문서, P1-14 — 미등록 시 환불이 엔타이틀 미반영). *선행: P0-2.*
3. **Inngest Cloud** — 가입 → Secret Manager 2종 → 배포 → 앱 sync → cron 발화 확인 (P0-5).
4. **Supabase 프로덕션** — 프로비저닝 + 마이그레이션. *선행: P0-1 (0099/0008 이동 전 `db push` 금지).* + 백업/PITR 확인 + 복원 1회 테스트 (P1-13).
5. **BILLING_KEY_SECRET** — 생성 → Secret Manager + 오프라인 에스크로 1부 (P1-13).
6. **75초 정식 모리 영상 + 초기 재고 3편** — 제작·QC·발행 (P0-4, P1-8). *선행: P0-3.*
7. **법무** — 청약철회·환불 문구 변호사 검토, privacy.md 국외이전 표(P0-6), CPO 자연인 지정, 이철재 교수 서면 실존 확인(docs/05_LEGAL_RISK.md §3).
8. **(신규) AI 벤더 no-training 확인** — fal.ai·Anthropic·Google 약관/DPA에서 입력 데이터 학습 사용 여부 확인, 필요 시 opt-out (C-4-②).

**최단 경로 한 줄**: ~~코드 P0 4건(0099 이동 · 결제 인라인/빌드 · 서명 URL · 국외이전 표)~~ ✅ 2026-07-02 랜딩 완료(`70a859e`·`8ee83cd`·`47d31d4`·`980a7c6`) → 이제 코드 밖 게이트(Inngest·Toss live·Supabase prod·콘텐츠 3편) → P1 갱신 3종(P1-1·2·3)과 시드 스텁(P1-4)·음성 mp3(P1-9)를 첫 결제 주기(D+30) 전에.

---

## 출처 (딥리서치 주요 1차 소스)

- fal.ai 가격·모델 페이지 (2026-07-02 라이브 확인): https://fal.ai/pricing , seedance-2-0-vs-kling-3-0 비교
- MIT limited animation 실증: Developmental Cognitive Neuroscience, doi 10.1016/j.dcn.2026.101674
- LongStories.ai pricing (시장 준거가격, 라이브 확인)
- 2025 COPPA 최종 규칙: Federal Register 2025-05904 (16 CFR 312)
- Moonbug 'AI zero': New Yorker 2024-06-10; Kartoon 실패·Toonstar: Hollywood Reporter 2024-08-16
- Animaj×Google: Bloomberg 2026-03-11
- 핑크퐁 OneVoice: Seoul Economic Daily 2026-02
- PBS Kids Lyla in the Loop: Hollywood Reporter
- YouTube Kids AI 역풍: Fortune 2026-04-01, Fairplay 공개서한
