# Kindy 운영 런북 (RUNBOOK)

> 운영자 = 대표 1인 기준. 배포·결제·콘텐츠·장애 대응의 실행 정본.
> 코드 기준 설명은 `docs/SERVICE_OVERVIEW.md`, 런칭 갭 전수는 `docs/07_LAUNCH_GAP_AND_VIDEO_ENGINE_RESEARCH_2026-07-02.md` 참조.
> GCP 프로젝트 `kindy-493701` · 리전 `asia-northeast3`(Seoul) · Artifact Registry `kindy-containers` · Cloud Run 프리뷰 `kindy-landing-preview` · 프로덕션 `kindy`.

---

## 1. 배포 시퀀스 (불변 다이제스트 승격)

`latest` 태그나 `gcr.io`를 직접 배포하지 않는다. `scripts/gcp-release.sh`만 정본이다. 이 하네스는 프로젝트·리전·서비스를 고정하고, dirty worktree를 거부하며, `git-<40자 SHA>-pay<0|1>` 불변 태그를 서울 Artifact Registry에 한 번 빌드한다. 프리뷰와 프로덕션은 **같은 `sha256` 다이제스트**를 쓴다.

최초 1회(필수 API, immutable-tag 저장소, 전용 runtime service account, Secret Manager IAM):

```bash
gcloud auth login
bash scripts/gcp-release.sh bootstrap
```

일반 릴리스:

```bash
# 0. 반드시 커밋된 clean worktree에서 실행
git status --short

# 1-a. 결제 OFF 프리뷰: PortOne/Toss/BIZ 공개값을 강제로 빈 값으로 번들링
KINDY_PAYMENTS_ENABLED=0 bash scripts/gcp-release.sh build

# 1-b. 결제 가능한 릴리스: PortOne + BIZ 전체값이 있어야만 빌드
# KINDY_PAYMENTS_ENABLED=1 bash scripts/gcp-release.sh build
# 마지막 세 줄의 KINDY_RELEASE_SHA, KINDY_PAYMENTS_ENABLED,
# KINDY_IMAGE_DIGEST_URI를 복사한다.

# 2. 프리뷰 배포 + /api/health/live, /api/health/ready 스모크
bash scripts/gcp-release.sh deploy-preview \
  'asia-northeast3-docker.pkg.dev/kindy-493701/kindy-containers/kindy-web@sha256:<64-hex>' \
  '<40-char-git-sha>'

# 3. 프리뷰가 현재도 같은 digest이고 ready인지 재검증한 뒤 운영 후보 생성
#    후보는 0%에서 Ready 확인 후 5% → 25% → 50% → 100% canary로 전환된다.
#    pay0 이미지는 여기서 fail-closed되며 pay1 이미지만 운영 승격할 수 있다.
bash scripts/gcp-release.sh promote \
  'asia-northeast3-docker.pkg.dev/kindy-493701/kindy-containers/kindy-web@sha256:<64-hex>' \
  '<40-char-git-sha>'
```

결제 ON 이미지는 `NEXT_PUBLIC_SITE_URL=https://kindy.kr`가 아니면 Cloud Build가
거부한다. 공개 Supabase URL/anon과 다른 `NEXT_PUBLIC_*` 공개값은 client bundle과
standalone server가 서로 달라지지 않도록 같은 immutable image에 함께 고정된다.

운영 공개 스모크가 실패하면 하네스가 직전 100% revision으로 자동 복귀한다. 성공 시 출력되는 정확한 rollback 명령을 사고 기록에 함께 남긴다. 수동 확인/롤백:

```bash
bash scripts/gcp-release.sh status
bash scripts/gcp-release.sh smoke production '<40-char-git-sha>'
bash scripts/gcp-release.sh rollback 'kindy-00000-abc'
```

`scripts/deploy-cloud-run.sh`, `gcloud run deploy kindy`, mutable tag 배포는 금지한다. GenTA org policy 때문에 직접 Cloud Run URL 공개 IAM을 변경하지 않으며, `kindy.kr` 공개 경로는 기존 외부 로드밸런서를 유지한다.

---

## 2. 빌드타임 vs 런타임 env 매트릭스

**빌드타임(NEXT_PUBLIC_*)** — `Dockerfile` ARG + `cloudbuild.yaml` substitution으로만 주입. 클라이언트 번들에 인라인되므로 공개값만. 빠지면 결제·사업자표시가 브라우저에서 안 열린다.

| Cloud Build substitution | 번들 env | 용도 |
|---|---|---|
| `_SUPABASE_URL` | `NEXT_PUBLIC_SUPABASE_URL` | Supabase 클라이언트 |
| `_SUPABASE_ANON_KEY` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon |
| `_PORTONE_STORE_ID` | `NEXT_PUBLIC_PORTONE_STORE_ID` | 포트원 V2 상점 ID; 결제 CTA 필수 |
| `_PORTONE_CHANNEL_KEY` | `NEXT_PUBLIC_PORTONE_CHANNEL_KEY` | 포트원 V2 채널 키; 결제 CTA 필수 |
| `_TOSS_CLIENT_KEY` | `NEXT_PUBLIC_TOSS_CLIENT_KEY` | 기존 Toss 결제 호환(옵션) |
| `_SITE_URL` | `NEXT_PUBLIC_SITE_URL` | OAuth 콜백·리다이렉트 기준 |
| `_BIZ_REPRESENTATIVE_NAME` | `NEXT_PUBLIC_BIZ_REPRESENTATIVE_NAME` | 전자상거래법 §13 표시 |
| `_BIZ_REGISTRATION_NUMBER` | `NEXT_PUBLIC_BIZ_REGISTRATION_NUMBER` | 〃 (사업자번호) |
| `_BIZ_MAIL_ORDER_NUMBER` | `NEXT_PUBLIC_BIZ_MAIL_ORDER_NUMBER` | 〃 (통신판매신고번호) |
| `_BIZ_ADDRESS` | `NEXT_PUBLIC_BIZ_ADDRESS` | 〃 (사업장 주소) |
| `_BIZ_PHONE` | `NEXT_PUBLIC_BIZ_PHONE` | 〃 (연락처) |
| `_BIZ_EMAIL` | `NEXT_PUBLIC_BIZ_EMAIL` | 〃 (이메일) |
| `_KINDY_START_BASE` | `NEXT_PUBLIC_KINDY_START_BASE` | 키오스크 QR 목적지 베이스(옵션) |

BIZ 6종 중 하나라도 비면 결제 CTA가 잠긴다.

**런타임(Secret Manager → Cloud Run)** — 절대 번들에 넣지 않는다. `--update-secrets`로 주입.

| Cloud Run env | Secret Manager 이름 | 상태 |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | `kindy-supabase-service-role-key` | 등록됨 |
| `ANTHROPIC_API_KEY` | `kindy-anthropic-key` | 등록됨 |
| `FAL_KEY` | `kindy-fal-key` | 등록됨 |
| `GOOGLE_API_KEY` / `GEMINI_API_KEY` | `kindy-google-key` | 등록됨 |
| `INNGEST_SIGNING_KEY` | `kindy-inngest-signing-key` | 등록됨 |
| `INNGEST_EVENT_KEY` | `kindy-inngest-event-key` | 등록됨 |
| `PORTONE_API_SECRET` | `kindy-portone-api-secret` | **필수 — 서버 결제 조회/청구** |
| `PORTONE_WEBHOOK_SECRET` | `kindy-portone-webhook-secret` | **필수 — 웹훅 HMAC fail-closed** |
| `TOSS_SECRET_KEY` (live_sk_) | `kindy-toss-secret-key` | **런칭 전 생성·등록 필요** |
| `BILLING_KEY_SECRET` | `kindy-billing-key-secret` | **런칭 전 생성·등록 필요 — §6** |
| `RESEND_API_KEY` | `kindy-resend-api-key` | **결제 이메일 발송용 — §7** |
| `RESEND_FROM_EMAIL` | `kindy-resend-from-email` | 옵션. 미설정 시 `Kindy <support@kindy.kr>` |
| `KINDY_OPERATOR_KEY` | `kindy-operator-key` | 비스포크 생성 게이트(대표만 보유) |

`INNGEST_DEV`는 로컬 전용 env다 — 프로덕션에는 존재하면 안 되며 `scripts/deploy-cloud-run.sh`가 제거한다. 전체 목록·설명은 `.env.local.example` 참조.

**배포 환경 잠금(Cloud Run 런타임 env)** — `KINDY_DEPLOY_ENV`는 같은 이미지를 어느 서비스가 실행하는지 서버 시작 때 판별한다. `KINDY_RELEASE_SHA`는 헬스 응답과 배포 증적에 쓰인다. 둘 다 `gcp-release.sh`가 주입하며 Cloud Build substitution이 아니다. 미설정·빈 값·오타는 readiness 실패로 처리한다. 로컬 `npm run dev`(`NODE_ENV !== 'production'`)는 이 값과 무관하게 열린다.

| Cloud Run 런타임 env | 프리뷰 서비스 (`kindy-landing-preview`) | 프로덕션 서비스 (`kindy`) |
|---|---|---|
| `KINDY_DEPLOY_ENV` | `preview` (필수) | `production` (명시 권장, 미설정이어도 잠김) |
| `KINDY_RELEASE_SHA` | 배포한 40자 git SHA | 프리뷰와 동일한 40자 git SHA |
| `KINDY_LOCAL_PREVIEW` | `0` | `0` |
| `LESSON_GUEST_MODE` | `0` | `0` |
| `BILLING_KEY_SECRET` | 주입하지 않음 | `kindy-billing-key-secret:latest`를 Secret Manager로 반드시 주입 |

시크릿 값은 하네스가 읽지 않는다. `ENV_NAME=secret-name:latest` 참조만 Cloud Run revision에 연결하며, 필수 시크릿이 없거나 disabled면 배포 전에 실패한다. `INNGEST_DEV`와 `VERCEL_ENV`는 매 revision에서 제거된다. 프리뷰에는 별도 `kindy-preview-supabase-service-role`과 선택적 제작 AI만 연결하고 결제·빌링·운영자 Secret은 연결하지 않는다. 프리뷰 공개 IAM은 릴리스 하네스 밖의 별도 운영 정책으로 관리한다.

---

## 3. Toss 웹훅 URL 등록 (미등록 시 환불이 엔타이틀에 반영 안 됨)

`POST /api/payments/webhook/toss`가 **환불·외부 해지를 entitlements에 동기화하는 유일 경로**다. Toss 대시보드에 등록하지 않으면 환불받은 고객이 프리미엄을 계속 유지한다.

1. Toss 개발자센터(대시보드) → 내 상점 → **웹훅** → URL 등록: `https://kindy.kr/api/payments/webhook/toss`
2. 구독할 이벤트: 결제 상태 변경(승인/취소/환불).
3. **등록 후 발화 테스트**:
   - 대시보드의 웹훅 테스트 전송 기능으로 발화 → Cloud Run 로그에서 `/api/payments/webhook/toss` 200 수신 확인.
   - 또는 실 소액 결제 1건 → Toss 콘솔에서 즉시 환불 → 수 초 내 해당 parent의 `entitlements.is_premium`이 `false`로 바뀌는지 SQL로 확인:
     ```sql
     select parent_id, is_premium, premium_until, updated_at
     from entitlements where parent_id = '<parent_id>';
     ```

---

## 4. Inngest Cloud 연결 (5단계)

미연결 상태(`INNGEST_DEV=1`)에서는 갱신 cron·영상 생성이 조용히 안 돈다. 첫 결제는 동기 처리라 정상이지만 ~30일 뒤 갱신이 안 돌아 전 구독자가 잠긴다(`docs/07` P0-5). ~1시간 ops 작업.

1. **Inngest Cloud 가입** → 프로덕션 앱 생성 → signing key(`signkey-prod-...`)와 event key 발급.
2. **Secret Manager 2종 생성**:
   ```bash
   printf %s "signkey-prod-..." | gcloud secrets create kindy-inngest-signing-key --data-file=-
   printf %s "<event-key>"      | gcloud secrets create kindy-inngest-event-key   --data-file=-
   ```
3. **다음 정식 릴리스 실행** — `gcp-release.sh deploy-preview`와 `promote`가 두 시크릿을 연결하고 `INNGEST_DEV`를 제거한다(§1).
4. **앱 sync**: Inngest 대시보드에서 sync URL `https://kindy.kr/api/inngest` 등록 → 함수 2개(`subscription-renewal`, `video-generate`)가 잡히는지 확인.
5. **cron 1회 발화 검증**: `subscription-renewal`(cron `TZ=Asia/Seoul 0 4 * * *`)을 대시보드에서 수동 트리거하거나 다음 04:00 발화 후 실행·성공 로그 확인.

---

## 5. Supabase (마이그레이션 · 백업)

- **마이그레이션 정본**: `supabase db push`. `db push`는 `supabase/migrations/`의 SQL을 **주석 무관 버전 순으로 전부** 적용하므로, 파괴적/긴급용 스크립트(`0008`, `0099`)는 `supabase/manual/`에 격리돼 있다. 실행 전 `supabase/manual/README.md`를 반드시 확인한다. `0099`(전 테이블 RLS 해제)는 사고 시에만 대표 승인 후 psql로 수동 실행.
- **백업/PITR 확인(P1-13)**: Supabase 대시보드 → Database → Backups. 유료 개시 전 Pro 이상 티어에서 일일 백업 + PITR 활성 여부 확인. `parent_consents`(PIPA)·`purchases`(전상법 보존)는 법정 보존 기록이므로 복원 경로가 필수.
- **복원 1회 테스트(P1-13)**: 런칭 전 백업에서 스테이징/신규 프로젝트로 복원 1회를 실제로 수행해 복원 가능성을 검증한다(문서상 백업 ≠ 복원 검증).

---

## 6. BILLING_KEY_SECRET (단일 장애점 — 유실 = 전 가구 카드 재등록)

빌링키 AES-256-GCM 암호화 키. 매 갱신 청구가 이 키로 복호화하므로 유실되면 전 구독자가 카드를 다시 등록해야 한다.

1. **생성**: `openssl rand -base64 32`
2. **Secret Manager 등록 + Cloud Run 주입**:
   ```bash
   printf %s "<생성한 키>" | gcloud secrets create kindy-billing-key-secret --data-file=-
   gcloud run services update kindy --region=asia-northeast3 \
     --update-secrets=BILLING_KEY_SECRET=kindy-billing-key-secret:latest
   ```
3. **오프라인 에스크로 1부**: 암호화 USB나 문서 금고 등 오프라인 안전 위치에 사본 1부 별도 보관.
4. **회전 주의**: 이 키를 회전하면 기존 `billing_keys`의 암호문을 **복호화할 수 없다** → 전 가구 카드 재등록 필요. 회전은 유출 등 최후 수단이며, 전 구독자 재등록 플로우를 준비한 뒤에만 수행한다.

---

## 7. 결제 이메일(Resend)

코드 경로: `src/lib/mailer.ts`.

발송되는 이메일:

- 첫 결제 성공: 결제 금액, 주문번호, 이용 기간, 구독 확인/해지 링크.
- 갱신 성공: 결제 금액, 주문번호, 다음 이용 기간, 구독 확인/해지 링크.
- 갱신 실패: 결제 확인 안내와 `/subscribe` 카드 재등록 링크.

메일은 결제 흐름을 막지 않는다. `RESEND_API_KEY`가 없으면 `console.warn` 후 no-op이며, Resend 장애나 발송 실패는 `console.error`만 남긴다.

운영 설정:

```bash
printf %s "re_..." | gcloud secrets create kindy-resend-api-key --data-file=-
printf %s "Kindy <support@kindy.kr>" | gcloud secrets create kindy-resend-from-email --data-file=-
gcloud run services update kindy --region=asia-northeast3 \
  --update-secrets=RESEND_API_KEY=kindy-resend-api-key:latest,RESEND_FROM_EMAIL=kindy-resend-from-email:latest
```

발신 도메인은 Resend에서 별도로 인증해야 한다. 인증 전에는 테스트 도메인/제한 발송만 가능하다.

---

## 8. 일일 5분 체크 (SQL 3개)

Supabase SQL Editor에서 매일 1회.

**① 최근 24시간 실패 결제** (크레딧 번들 + 구독 갱신 실패 모두 `purchases.status='failed'`로 기록됨):
```sql
select id, parent_id, bundle_type, amount_krw, failed_reason, created_at
from purchases
where status = 'failed'
  and created_at > now() - interval '24 hours'
order by created_at desc;
```

**② past_due(갱신 실패) 구독 수와 대상**:
```sql
select count(*) as past_due_count from subscriptions where status = 'past_due';

select parent_id, current_period_end, updated_at
from subscriptions
where status = 'past_due'
order by current_period_end desc;
```

**③ 실패한 영상 생성**:
```sql
select id, child_id, title, phase, error_reason, last_attempt_at
from videos
where status = 'failed'
order by last_attempt_at desc nulls last
limit 50;
```

②가 늘어나는데 정상 카드라면 갱신 로직·Inngest 상태를, ①·③에 반복 실패가 보이면 fal.ai/Toss 응답과 Cloud Run 로그를 확인한다.

---

## 9. 콘텐츠 발행 절차 (published=false → QC → 발행)

생성물은 `published=false`로 저장되어 고객에게 노출되지 않는다. 사람이 한 편씩 검수한 뒤에만 발행한다.

1. **생성**(저비용 limited 모드, 첫 3편):
   ```bash
   ANIMATION_MODE=limited LIMIT_COUNT=3 npx tsx --env-file=.env.local scripts/generate-library-episode-90s.ts
   ```
   (`DRY_RUN=1`을 붙이면 실 API 호출 없이 매트릭스·예상 비용만 출력.)
2. **휴먼 QC 체크** — 한 편씩 재생하며 확인:
   - 캐릭터 일관성(모리 정본 레퍼런스대로 나오는가)
   - 음성 자연스러움(한국어 유아 톤, 끊김/무음 없음)
   - 씬당 한 행동(5-7세가 한 장면에서 한 가지만 보게)
   - 용어 가드레일(`진단`·`평가`·`점수표`·`커리큘럼`·`C6`·`대시보드`·`분석` 등 어른/내부 용어 노출 금지 — `docs/00_HANDOFF.md` §0)
3. **발행** — QC 통과분만 SQL로 노출:
   ```sql
   update library_videos set published = true where id = '<video_id>';
   ```
   발행 전 published 재고 확인: `select count(*) from library_videos where published = true;`

### 동물 마을 음성 mp3 생성

`/public/audio/village/`는 더 이상 `.gitignore`에 막혀 있지 않다. 운영자가 Google 키를 채운 뒤 생성한 mp3는 커밋 대상이다.

```bash
npx tsx --env-file=.env.local scripts/gen-village-tts.ts
```

생성 후 확인:

```bash
find public/audio/village -type f | wc -l
git status --short public/audio/village src/data/worlds/animal-village-voice.json
```

키가 없으면 현재 앱은 `useVoice`의 Web Speech 폴백으로 동작하지만, 5-7세 타겟에서는 실제 mp3를 런칭 전에 넣는 것을 권장한다.
