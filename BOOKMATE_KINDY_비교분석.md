# 북메이트(Smart-DID) ↔ Kindy(eduvid) 비교 분석

> 작성일 2026-06-02 · 목적: Kindy를 메인 사업으로 전환하기 위한 두 코드베이스/사업 현황 정리 및 통합 사전 분석
> 분석 대상 폴더:
> - 북메이트 — `…/GenTA/bm/library/꿈샘/lib0319/Smart-DID`
> - Kindy — `…/GenTA/dev/eduvid`

---

## 1. 한눈에 보기

| 구분 | 북메이트 (Smart-DID) | Kindy (eduvid) |
|---|---|---|
| 현황 | **운영 중** (아산 꿈샘 도서관) | 신규, MVP 단계 (메인 전환 대상) |
| 사업 모델 | B2B / 공공 (도서관 키오스크) | B2C (부모 구독·크레딧) |
| 타깃 | 도서관 이용 아동 + 사서 | 한국 3~9세 아동의 부모 |
| 콘텐츠 | 도서 소개 트레일러 (책별) | 아이별 개인화 교육 영상 (주인공 "미리") |
| 화면 | 9:16 키오스크 (세로) | 모바일 웹 (max-w 375px) |
| 최종 업데이트 | 2026-03-04 | 2026-04-28 (STATUS.md) |

두 사업의 **공통 코어는 GenTA의 AI 영상 생성 엔진**이다. 북메이트는 "책"을 입력으로, Kindy는 "아이의 흥미·학습주제"를 입력으로 받아 영상을 만든다는 점만 다르다.

---

## 2. 아키텍처 비교

### 북메이트 (Smart-DID)

전형적인 **모노레포 + 워커 큐** 구조. 키오스크가 무인으로 돌아가야 하므로 백엔드/워커가 분리되어 있다.

```
library-did-main/packages/
├── frontend/   React 18 + Vite + Zustand   (DID 키오스크 + 관리자 대시보드)
├── backend/    Fastify 5 + Prisma + PostgreSQL (Cloud SQL)
├── worker/     BullMQ Worker + Pipeline V7
└── shared/     공유 타입
큐: BullMQ + Redis (Cloud Memorystore)
배포: GCP Cloud Run ×3 (backend/frontend/worker) + Cloud SQL + Memorystore + Cloud Storage
```

- **Frontend**: `pages/did/`(DidV2Home·BookGrid·BookDetail·NewArrivals·Recommend·Search·Location) + `pages/admin/`(Dashboard·VideoManagement·AdminRecommendBook·Settings·Login)
- **Backend routes**: `book / did / video / recommendation / admin / auth / internal / health`
- **외부 연동 서비스**: `alpas`(도서관 시스템), `data4library`, `naver-book`(표지·소개), `bestseller-seed`, `scheduler`, `cache-manager`
- **DB 모델**(Prisma/Postgres): `AdminUser · VideoRecord · ShelfMap · Notification · Recommendation · SiteSetting` — 책 단위로 영상 레코드/책장 위치/추천을 관리

### Kindy (eduvid)

**단일 Next.js 앱**(모놀리식). 비동기 영상 생성만 Inngest로 분리.

```
eduvid/
├── src/app/          Next.js 16 App Router (web + /api)
├── src/lib/          영상 파이프라인 + Supabase + 비즈로직
├── src/inngest/      비동기 영상 생성 함수
├── supabase/         migrations 0001~0005
인증·DB·스토리지: Supabase (Seoul, ap-northeast-2)
배포: GCP Cloud Run 단일 서비스 `kindy` (Seoul) + HTTPS LB
```

- **페이지**: `onboarding`(4-step) · `dashboard`(아이별 홈/영상/설정) · `player` · `library` · `legal` · **`demo/kiosk`(꿈샘 도서관 키오스크 데모)**
- **API**: `children · credits · purchases · quiz · attention-quiz · syllabus · library · videos · reactions · waitlist · invite · events · inngest`
- **결제**: 카페24 PG (카드 + 무통장입금)
- **DB**: Supabase Postgres (RLS), `videos · children · credits · purchases · syllabus · library_videos · waitlist` 등

> **핵심 관찰**: Kindy 코드베이스에는 **이미 도서관 자산의 흔적이 들어와 있다.** `src/types/library.ts`, `src/app/api/library/*`, `src/app/library/page.tsx`, 그리고 `src/app/demo/kiosk`(아산시립도서관·꿈샘 어린이실 키오스크 데모)가 그것. 즉 "북메이트 → Kindy 흡수"는 일부 시작된 상태다. 단, 이는 **Kindy 스택으로 새로 쓴 라이브러리 모듈**이지 Smart-DID 코드를 가져온 것은 아니다.

---

## 3. 영상 생성 엔진 비교 (가장 중요한 분기점)

두 엔진은 **목적이 다르고 부품도 일부 다르지만, 공유 가능한 부품이 분명히 있다.**

| 단계 | 북메이트 Pipeline V7 | Kindy episode-pipeline |
|---|---|---|
| 입력 | 책 (제목/저자) | VideoBrief (아이 흥미·학습주제) |
| 1. Grounding | 책 사실 수집·랭킹 (네이버/data4library) | Claude director (브리프→스크립트) |
| 2. 기획 | Style Bible → V4 Scene Planner (3장면) | Claude 장면 분할 |
| 3. 키프레임 | **NanoBanana** (이미지) | **NanoBanana** (이미지) ✅ 공통 |
| 4. 영상 | **Veo 3.1** (4초×3 = 12s/20s 트레일러) | **Seedance2** (장면별, 90초 에피소드) |
| 5. 음성 | 자막 오버레이 중심 | **Gemini TTS** + **fal lipsync** |
| 6. 합성 | **FFmpeg** 크로스페이드 + 자막 | **FFmpeg** concat + 자막(VTT) |
| 7. 저장 | GCS / S3 / local (provider factory) | Supabase Storage |
| QC | **Safety Gate · consistency · typography · score** | (퀴즈·집중도 Claude 검증은 시청 후 단계) |
| 길이 | 11~20초 트레일러 | ~90초 에피소드 |
| 실측 비용 | (트레일러) | 15초 1편 ≈ $4.94 |

**공유 가능 부품**: NanoBanana 키프레임 클라이언트, FFmpeg 합성·자막 로직, Gemini TTS, 스토리지 provider 추상화.
**갈라지는 부품**: 비디오 모델(북메이트=Veo 3.1 / Kindy=Seedance2), 입력 grounding(책 vs 아이 프로필), QC 게이트(북메이트가 훨씬 성숙).

> ⚠️ **문서 불일치 메모**: Smart-DID README는 영상 모델을 "Sora"로 적었으나, 실제 코드(`orchestrator-v7.ts`)는 **NanoBanana + Veo 3.1**을 사용한다. 코드를 정본으로 본다. 통합 검토 시 README 갱신 필요.

---

## 4. 인프라·운영 비교

| 항목 | 북메이트 | Kindy |
|---|---|---|
| 클라우드 | GCP Cloud Run ×3 + Cloud SQL + Memorystore + GCS | GCP Cloud Run ×1 (`kindy-493701`, Seoul) + HTTPS LB |
| DB | PostgreSQL (Cloud SQL) + Prisma | Supabase Postgres (RLS) |
| 큐/비동기 | BullMQ + Redis | Inngest (**프로덕션 미연결 — 영상 생성 차단**) |
| 인증 | 자체 AdminUser + 도서관 ALPAS | Supabase Auth (Kakao 예정), 현재 `parent_id` 하드코딩 |
| 도메인 | (도서관 내부 운영) | `kindy.kr` 구매했으나 **카페24 DNS 묶임 → 미연결 차단** |
| 결제 | 없음 (공공) | 카페24 PG (API 통합 대기) |

**Kindy 현재 차단 이슈**(STATUS.md / TODOS.md):
1. **DNS**: kindy.kr이 카페24 쇼핑몰 시스템에 묶여 외부 IP(34.8.67.108)로 못 향함 → Cloudflare NS 이관 추천
2. **Inngest Cloud 미연결**: Cloud Run에 `INNGEST_DEV=1` 박혀 있어 영상 생성 트리거 시 실패
3. **법적/승인 대기**: 사업자등록·본인인증(SMS/PASS)·약관·개인정보처리방침 placeholder, Footer에 `[미설정]` 노출
4. **Migration 0005**(3 크레딧) 적용 여부 미검증

---

## 5. 재사용 가능 자산 매핑 (Kindy로 가져올 후보)

| 북메이트 자산 | Kindy로의 가치 | 비고 |
|---|---|---|
| **QC 게이트** (safetyGate, checkConsistency, checkTypography, scoreVideo) | ★★★ 높음 | Kindy 영상 품질·안전성 보강. 아동 대상이라 안전 게이트는 그대로 가치 |
| **도서 grounding** (네이버/data4library/ALPAS) | ★★ 중간 | Kindy가 "책 기반 학습 영상"으로 확장 시 직접 재사용 |
| **DID 키오스크 UI** (9:16) | ★★ 중간 | Kindy `demo/kiosk`로 이미 부분 재현. B2B 도서관 채널 유지 시 가치 |
| **관리자 대시보드** (큐/캐시/추천 관리) | ★★ 중간 | 영상 운영 관제. Kindy엔 아직 없음 |
| **스토리지 provider factory** (GCS/S3/local) | ★ 낮음 | Kindy는 Supabase Storage로 일원화됨 |
| **NanoBanana / FFmpeg / Gemini TTS** | — | 양쪽 이미 공유. 공통 패키지화 후보 |

---

## 6. "Kindy 메인 전환" 통합 옵션 (다음 단계 의사결정용)

이번 분석은 **비교까지**가 범위다. 통합 실행 방식은 아래 3안 중 선택이 필요하다.

1. **Kindy 안으로 흡수** — 도서관 키오스크/관리자/QC를 Next.js(eduvid) 모듈로 이식. 단일 코드베이스 유지보수 ↑, 초기 작업량 ↑(스택 변환: Fastify/Prisma → Next API/Supabase).
2. **엔진만 공유** — Smart-DID는 도서관용으로 그대로 운영, 영상 엔진·QC·타입만 공통 패키지로 분리. 가장 점진적·저위험.
3. **Smart-DID 동결** — 도서관 서비스 현행 유지, Kindy 독립 발전. 통합은 나중.

> 권장 사고 흐름: **공통 부품(엔진·QC)부터 패키지 분리(2안) → Kindy 안정화 후 키오스크/관리자 흡수(1안)** 순서가 위험이 낮다. 단, 사업 우선순위·인력에 따라 달라지므로 결정 필요.

---

## 부록: 확인된 사실 출처
- 북메이트: `Smart-DID/README.md`, `library-did-main/README.md`, `packages/worker/src/pipeline/orchestrator-v7.ts`, `packages/backend/prisma/schema.prisma`, 디렉터리 구조
- Kindy: `eduvid/STATUS.md`, `TODOS.md`, `IR_DECK.md`, `package.json`, `src/lib/episode-pipeline.ts`, `src/lib/video-providers/index.ts`, `src/types/library.ts`, `src/app/demo/kiosk/page.tsx`
