# Kindy 운영 런북 (RUNBOOK)

> 운영자 = 대표 1인 기준. 배포·결제·콘텐츠·장애 대응의 실행 정본.
> 코드 기준 설명은 `docs/SERVICE_OVERVIEW.md`, 런칭 갭 전수는 `docs/07_LAUNCH_GAP_AND_VIDEO_ENGINE_RESEARCH_2026-07-02.md` 참조.
> GCP 프로젝트 `kindy-493701` · 리전 `asia-northeast3`(Seoul) · Cloud Run 서비스명 `kindy`.

---

## 1. 배포 시퀀스

세 단계다. NEXT_PUBLIC_* 값은 **빌드 타임에 클라이언트 번들로 박히므로**, ①의 substitution에 실값을 넘기지 않으면 결제 CTA가 "결제 준비 중"으로 잠긴다(런타임 env로는 못 연다 — `docs/07` P0-2).

### ① 이미지 빌드 — `gcloud builds submit`

주소·상호에 콤마가 들어갈 수 있어 gcloud 구분자 이스케이프 `^;^`를 쓴다(`cloudbuild.yaml` 헤더 참조). 첫 구분자 `^;^`가 "이후로는 `;`로 필드를 나눈다"는 선언이다.

```bash
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions='^;^_SUPABASE_URL=https://xxx.supabase.co;_SUPABASE_ANON_KEY=eyJ...;_TOSS_CLIENT_KEY=live_ck_...;_SITE_URL=https://kindy.kr;_BIZ_REPRESENTATIVE_NAME=대표명;_BIZ_REGISTRATION_NUMBER=000-00-00000;_BIZ_MAIL_ORDER_NUMBER=제0000-서울강남-0000호;_BIZ_ADDRESS=서울 강남구 ..., 3층;_BIZ_PHONE=02-0000-0000;_BIZ_EMAIL=support@kindy.kr;_KINDY_START_BASE=;_TAG=latest'
```

결과: `gcr.io/kindy-493701/kindy:latest` 푸시. service_role·secret 류는 절대 여기에 넣지 않는다(런타임 Secret Manager 전용).

### ② 배포 — `gcloud run deploy`

```bash
gcloud run deploy kindy \
  --image=gcr.io/kindy-493701/kindy:latest \
  --region=asia-northeast3 \
  --allow-unauthenticated
```

주: GenTA org policy(`iam.allowedPolicyMemberDomains`)가 `allUsers`를 막아 직접 URL 공개는 안 되고 외부 접근은 로드밸런서 경유다(내부 인증 — `STATUS.md` 참조). 신규 이미지 배포마다 ②를 반복하면 된다.

### ③ Inngest 시크릿 주입 — `scripts/deploy-cloud-run.sh`

Inngest Secret Manager 2종을 Cloud Run에 연결하고 `INNGEST_DEV` env를 제거한다(이것이 없으면 갱신 cron·영상 생성이 프로덕션에서 안 돈다). 최초 1회 + Inngest 키 회전 시 실행.

```bash
bash scripts/deploy-cloud-run.sh
```

---

## 2. 빌드타임 vs 런타임 env 매트릭스

**빌드타임(NEXT_PUBLIC_*)** — `Dockerfile` ARG + `cloudbuild.yaml` substitution으로만 주입. 클라이언트 번들에 인라인되므로 공개값만. 빠지면 결제·사업자표시가 브라우저에서 안 열린다.

| Cloud Build substitution | 번들 env | 용도 |
|---|---|---|
| `_SUPABASE_URL` | `NEXT_PUBLIC_SUPABASE_URL` | Supabase 클라이언트 |
| `_SUPABASE_ANON_KEY` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon |
| `_TOSS_CLIENT_KEY` | `NEXT_PUBLIC_TOSS_CLIENT_KEY` | 결제 CTA 활성 조건 |
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
| `INNGEST_SIGNING_KEY` | `kindy-inngest-signing-key` | **미등록 — §4** |
| `INNGEST_EVENT_KEY` | `kindy-inngest-event-key` | **미등록 — §4** |
| `TOSS_SECRET_KEY` (live_sk_) | `kindy-toss-secret-key` | **런칭 전 생성·등록 필요** |
| `BILLING_KEY_SECRET` | `kindy-billing-key-secret` | **런칭 전 생성·등록 필요 — §6** |
| `KINDY_OPERATOR_KEY` | `kindy-operator-key` | 비스포크 생성 게이트(대표만 보유) |

`INNGEST_DEV`는 로컬 전용 env다 — 프로덕션에는 존재하면 안 되며 `scripts/deploy-cloud-run.sh`가 제거한다. 전체 목록·설명은 `.env.local.example` 참조.

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
3. **`bash scripts/deploy-cloud-run.sh`** — 두 시크릿 주입 + `INNGEST_DEV` 제거(§1-③).
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

## 7. 일일 5분 체크 (SQL 3개)

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

## 8. 콘텐츠 발행 절차 (published=false → QC → 발행)

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
