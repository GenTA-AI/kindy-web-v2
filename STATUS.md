# Kindy — 현재 진행 상태 (2026-04-28)

세션 재개 시 이 문서 + `UX_AUDIT.md` + memory 폴더 먼저 확인.

## ✅ 완료

### 인프라
- **Supabase Seoul** — `lzzaiqruxxfhhalgvejb.supabase.co` (ap-northeast-2)
  - Migrations 0001~0005 모두 적용됨 (단, `0005_three_free_credits.sql` 적용 여부 unverified)
  - Storage bucket `videos` (private, 500MB) ✓
- **GCP 프로젝트** — `kindy-493701` (별도, vidsaas 분리)
  - Billing 연결됨
  - APIs 활성화: Cloud Build, Container Registry, Cloud Run, Secret Manager, Compute Engine, Org Policy
- **Cloud Run 서비스** `kindy` (asia-northeast3 / Seoul)
  - 이미지: `gcr.io/kindy-493701/kindy:latest` (Cloud Build 1분 33초)
  - Internal URL: `https://kindy-582936546727.asia-northeast3.run.app` (인증 필요)
  - Memory 1Gi / CPU 1 / min=0 / max=10 / timeout 900s
  - INNGEST_DEV=1 (미연결, 영상 생성 불가 — Inngest Cloud 가입 필요)
- **Secret Manager** (4개)
  - `kindy-supabase-service-role-key`
  - `kindy-anthropic-key`
  - `kindy-fal-key`
  - `kindy-google-key`
- **Load Balancer** (HTTPS + HTTP)
  - **Static IP**: `34.8.67.108`
  - SSL cert (Google-managed): `kindy-cert` for `kindy.kr` + `www.kindy.kr` (PROVISIONING — DNS 미해결)
  - Resources: `kindy-ip` `kindy-neg` `kindy-backend` `kindy-url-map` `kindy-cert` `kindy-https-proxy` `kindy-http-proxy` `kindy-https` `kindy-http`

### 도메인 / 결제
- `kindy.kr` 카페24 구매 완료
- 카페24 PG 연결: 카드 + 무통장입금만 (간편결제 미지원, MVP 의도)
- API 통합 미완료 (카페24 자격증명/문서 받은 뒤 PaymentDrawer 연결 필요)

### 코드
- **자막**: `src/lib/subtitles.ts` + Player 하단 오버레이 + ON/OFF 토글
- **3-탭 네비게이션**: 홈/영상/설정 (`src/app/dashboard/layout.tsx`, `BottomNav.tsx`)
- **ChildSwitcher**: 헤더 드롭다운 + 추가/스위치
- **Settings** 페이지: 아이 편집/삭제, 크레딧, 결제 내역, 계정
- **Videos** 페이지: 필터 4종 (전체/완성/만드는중/실패)
- **Onboarding 4-step**: 이름/나이 → 스타일 → 학습경로 → PIPA SMS (stub)
- **Onboarding `?add=1` 모드**: 기존 부모가 아이 추가 시 PIPA 스킵
- **PostVideoFlow** (퀴즈 모달): gate → emoji → 커리큘럼 퀴즈 → Claude 집중도 퀴즈 → 리뷰 (descriptive, 퍼센트 제거) → 선제 퀴즈 → 업셀
- **Player**: 뒤로가기 버튼, 자막, 풀스크린 퀴즈 모달
- **API**: `/api/credits`, `/api/purchases`, `/api/children/[id]` (PATCH/DELETE), `/api/attention-quiz` (Claude 기반)
- **Migration 0005**: `grant_initial_credit_trigger` 1→3 (랜딩 약속 일치)
- **랜딩**: 미리 캐릭터 소개 카드 추가 (`public/miri.png` Supabase Storage 에서 추출)
- Inngest production wiring 적용 (signing/event key, deploy script)

### 메모리 (자동 로드)
- `MEMORY.md` 인덱스 + 8개 메모리:
  - user_role / project_state / video_pipeline / feedback_character_design
  - payment_stack (Cafe24 PG, 토스 supersede 됨)
  - hosting_stack (kindy.kr 등록 확정)
  - platform_decision / quiz_credit_loop / adhd_wellness_angle
  - feedback_language / feedback_stripe (deprecated)

## 🚧 진행 중 / 차단

### 도메인 → Cloud Run 연결 (DNS 작업 차단)
**문제**: 카페24 DNS 관리 UI 가 apex / www 모두 "A레코드에 등록할 수 없는 도메인" 에러 — 도메인이 카페24 쇼핑몰 시스템에 묶여 있어서 외부 IP 못 향함.

**현재 옵션**:
1. **Cloudflare NS 이관** ⭐ 추천 — 20분 + 전파 30분~24h
   - https://dash.cloudflare.com/sign-up → 사이트 추가 → NS 받음
   - 카페24 → 도메인 → 네임서버 변경 → Cloudflare NS 입력
   - Cloudflare DNS Records 에서 A 레코드 2개 추가:
     - `@` → `34.8.67.108` (Proxy: **DNS only / 회색 구름**)
     - `www` → `34.8.67.108` (Proxy: **DNS only**)
2. 카페24 고객센터 1588-3284 호출 — 쇼핑몰 연동 해제 요청
3. `.kr` 포기 + 다른 TLD 새 구매

**다음 액션**: 사용자 결정 필요. 결정 후 Cloudflare 가입부터 진행.

### Cloud Run 공개 접근 차단
GenTA org policy `iam.allowedPolicyMemberDomains` 가 `allUsers` 차단 → Cloud Run 직접 URL 공개 불가. **LB 우회로 해결됨**(LB→Cloud Run 은 내부 인증), 그러나 LB 도메인 미연결로 외부 접근 아직 0.

### Inngest 프로덕션
- 로컬 dev 모드만 작동 (`INNGEST_DEV=1`)
- Cloud Run 에 INNGEST_DEV=1 박혀 있어서 영상 생성 트리거 시 fail
- Inngest Cloud 가입 + signing key 발급 → Cloud Run 환경변수 교체 필요

## 🛑 외부 승인 대기 (UX_AUDIT.md 참조)

- **Auth**: 승인 대기 — `parent_id` 'demo-parent' 하드코딩 그대로
- **본인인증 (SMS/PASS)**: 승인 대기 — Onboarding step 4 OTP 는 stub
- **개인정보 처리방침 / 이용약관**: 승인 대기 — placeholder 링크
- **사업자 등록**: 진행 중 — Footer placeholder
- **카페24 PG API 통합**: 자격증명/문서 받은 뒤 PaymentDrawer 연결

## 📋 세션 재개 시 첫 액션 후보

1. **Cloudflare NS 이관 진행** — DNS 작업 결정난 경우
2. **Inngest Cloud 가입** + Cloud Run 환경변수 교체 → 영상 생성 복구
3. **Migration 0005 적용 확인** — 신규 가입 테스트해서 3 크레딧 받는지
4. **UX 감사 #12-19 코드만 가능한 것**: 한글 조사 helper, "4편" 동적 바인딩, phase 라벨 친화어 등
5. **PaymentDrawer 카페24 연결** — 자격증명 도착 시

## ⚙️ 로컬 dev 재시작 절차

```bash
cd /Users/jongwonlee/Documents/GenTA/dev/eduvid
# Terminal A
npx next dev --port 3333
# Terminal B
npx inngest-cli@latest dev -u http://localhost:3333/api/inngest
```

테스트 데이터:
- demo-parent 의 child_id: `e3de64d8-1083-4a80-a5f4-909613b7dc03` (서연 5세)
- 완료된 video_id: `2a2e8d6b-dba0-478f-a8f6-326ebdf429d4` ("비는 왜 올까?", 15s)

`.env.local` 위치: 프로젝트 루트. `INNGEST_DEV=1` 포함.

## 📊 누적 비용 (참고)

- 영상 1편 (15s) 실측 약 $4.94 (Claude $0.32 + nano-banana $0.08 + Seedance $4.54)
- Claude 집중도 퀴즈 $0.047/건
- Cloud Build 1회 ~$0
- Cloud Run idle ~$0/월 (min=0)
- LB static IP ~$2/월 (사용 시) / ~$7/월 (idle)
- Secret Manager ~$0.06/월 (4 secrets)

---

문서 갱신 책임: 큰 인프라 변경 시 즉시 반영. 매주 한 번 가벼운 리뷰.
