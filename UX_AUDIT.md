# Kindy UX Audit — 처음 써보는 사람 시선

2026-04-20 초안. 매주 업데이트. 완료 시 ✅ + 날짜, 진행 중 🚧, 차단 🛑.

## 상태 (2026-04-21)

- **도메인**: `kindy.kr` 카페24 구매 완료 ✓
- **결제**: 카페24 PG (카드 + 무통장입금) 연결 — 🚧 API 통합 필요
- **Auth**: 승인 대기
- **본인인증 (SMS/PASS)**: 승인 대기
- **개인정보 처리방침 · 이용약관**: 승인 대기
- **사업자 등록**: 카페24 가입 단계에서 필요 (있다면 footer 반영 가능)

---

## 🔴 Launch-blocker (첫 화면부터 신뢰 깨짐)

| # | 화면 | 문제 | 조치 | 상태 |
|---|---|---|---|---|
| 1 | `/` 랜딩 | "맞춤 영상 3개 무료 체험" 광고 ↔ `grant_initial_credit_trigger` 가 1개만 grant | trigger 3개로 수정 (마케팅 톤 유지) | 🚧 |
| 2 | `/` 랜딩 | 가격 정보 0 — 무료 체험 후 얼마인지 모름 | 카페24 PG 통합 완료 후 단품 1,500원 / 6팩 7,500원 섹션 추가 | 🚧 카페24 API |
| 3 | `/` 랜딩 | 실제 영상 스크린샷/프리뷰 0개 — 뭘 받는지 모름 | 완성된 15초 샘플을 hero 에 autoplay muted loop | |
| 4 | `/` 랜딩 | Footer 사업자 정보 `[대표자 성명]` 등 placeholder 그대로 노출 | 사업자 등록 후 실값 입력 | 🛑 사업자 등록 |
| 5 | Onboarding step 4 | SMS 실제 전송 안 됨, 아무 6자리 통과 — 14세 미만 법적 요구 | Aligo/PASS 연동 완료 전까지 "베타 기간 인증 생략" 표기 or 출시 보류 | 🛑 본인인증 승인 |
| 6 | Onboarding 약관 | "개인정보 처리방침" / "이용약관" `href="#"` | 실 문서 연결 | 🛑 개인정보보호 승인 |
| 7 | Settings | "부모 계정: demo-parent" 그대로 노출 | auth 도입 전 섹션 숨김 or "베타 계정" 표기 | 🛑 Auth 승인 |
| 8 | PaymentDrawer | 번들 선택 시 `alert()` stub | 카페24 PG API 통합 (카드 + 무통장). 간편결제 UI 숨김 | 🚧 카페24 API |
| 9 | 법적 고지 | AI 생성 고지 ✓ / COPPA + PIPA 민감정보 (시선·퀴즈 응답) 수집 고지 없음 | privacy 문서 + onboarding 에 명시 | 🛑 개인정보보호 승인 |

## 🟡 Major UX Gap

| # | 화면 | 문제 | 조치 | 상태 |
|---|---|---|---|---|
| 10 | Onboarding 첫 영상 생성 | 5분 대기 = 죽은 시간 | "미리 소개" pre-roll 15s or 브랜드 스토리 카드 | |
| 11 | 전체 | 캐릭터 "미리" 소개 전무. 사용자는 첫 영상에서 처음 만남 | 랜딩 + onboarding 에 소개 카드 추가 | 🚧 |
| 12 | Dashboard | "4편의 영상에서 학습한 선호도" 하드코딩 copy — 실제 N편과 불일치 | 동적 바인딩 | |
| 13 | Dashboard | 취향 프로파일 점수 92/87/85 하드코딩 | GACS-3 실데이터 연결 (`view_events + reactions + quiz_results → word_profiles`) | |
| 14 | Dashboard | "평균 완주율 95%" placeholder — 영상 1편일 때 의미 없음 | view_events 기반 실계산 + 표본 < 3 일 때 "계산 중" 문구 | |
| 15 | Dashboard | "크레딧 N" 버튼 = 잔고 표시인지 결제인지 모호 | 아이콘 추가 ("+ 크레딧 구매") 또는 pill 우측에 화살표 | |
| 16 | Player 로딩 | `progress_pct` + phase 라벨 ("캐릭터 디자인", "장면 구성") 엔지니어 용어 | 부모 친화어로 ("미리가 옷을 고르고 있어요", "장면을 꾸미고 있어요") | |
| 17 | Player | Video ended 후 모달, 배경 video 일시정지 — 다시 볼 일 없다면 `preload="none"` | 리소스 절약 | |
| 18 | 퀴즈 분량 | 15초 영상 후 7문제 (커리큘럼 2 + 집중 3 + 선제 2) → 영상보다 5배 김 | 30초 기준으로 재설계 or 퀴즈 수 축소 (커리큘럼 1 + 집중 2 + 선제 2) | |
| 19 | 한글 조사 | `${name}이의`, `${name}가` 받침 규칙 무시 — "서연이" OK, "민수이" 어색 | phonetic helper (받침 유무 판별) 도입 | |
| 20 | Upsell | "영상으로 배울래? (크레딧 1개)" 아이 톤 ↔ 크레딧은 부모 개념 | "부모님께 물어봐" or 부모 모드 분리 | |
| 21 | 공유 | 카카오 공유 없음 (한국 필수) | 영상 완성 시 "카톡으로 공유" 버튼 | |
| 22 | 알림 | 영상 5분 대기인데 완료 알림 없음 | 이메일/웹푸시/SMS 옵션 | |
| 23 | 추천 | 친구 초대 크레딧 없음 (바이럴 레버 missing) | 카페24 PG 통합 후 "초대 시 +1 크레딧" | 🚧 카페24 API |
| 24 | 실패 복구 | Seedance/Claude 실패 시 `videos.status='failed'` + refund ✓. UI 에 "다시 만들기" 버튼 없음 | 영상 카드에 재시도 CTA | |

## 🟢 Polish

- 아이 1명일 때 Child Switcher 드롭다운 리던던트 — 1명이면 단순 이름 표기
- Settings 아이 편집: 이름·나이만 수정 가능 (스타일·주제 불가)
- Loading skeleton 전무 — fetch 전 빈 화면 깜빡임
- Player 자막 `bottom-12` 고정 → `<video controls>` bar 에 가려질 수 있음. controls 위로 올리거나 전체화면 모드에서만 표시
- Bottom nav 활성 감각 약함 — 라벨 크기 동일
- Gate 카드 "퀴즈 풀러 갈래" — 존댓말 / 반말 Kindy 톤 재정의
- PostVideoFlow 모달: 안드로이드 back button 누르면 URL 만 이동, 모달은 stuck
- FocusBar: 0 events 에서도 노출 — events > 0 일 때만

## ⚪ Nice-to-have

- PWA manifest (홈 화면 설치)
- 영상 다운로드 / 오프라인 재생
- 야간 모드
- 영상 속도 조절 (0.75x / 1x / 1.25x)
- 공유 시 OG 이미지 프리뷰

---

## 승인/통합 대기 항목

- **Auth 승인**: 7
- **본인인증 승인**: 5
- **개인정보보호 승인**: 6, 9
- **사업자 등록**: 4
- **카페24 PG API 통합** (🚧): 2, 8, 23 — 카페24에서 받은 API 키/엔드포인트/통합 문서 필요

각 승인 완료되면 해당 항목 일괄 진행.

## 다음 블록 (도메인 + 배포)

- **kindy.kr → Cloud Run 연결**: Cloud Run 배포 후 custom domain 매핑
  - 카페24 DNS 에서 `kindy.kr`, `www.kindy.kr` → Cloud Run 도메인으로 CNAME / A
  - Google-managed SSL 자동 발급
- **Cloud Run 배포**: 이미지 `gcr.io/kindy-493701/kindy:latest` 빌드 완료. Secret Manager 값 세팅 + `gcloud run deploy` 1회
