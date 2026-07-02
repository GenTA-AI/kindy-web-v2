# Kindy Web Handoff — Codex ↔ Claude 공유 문서

> Last updated: 2026-07-01 KST (Codex) · 2026-07-02 검토·최신화 (Claude) · 2026-07-02 Codex 실행노트 추가
> Claude 확인(2026-07-02): 문서 정확 — 참조 커밋 SHA 전부 실재, git 로그와 일치.
> 최신 코드 커밋 `aac6924`(감정 게임 5-7세 교정) 기준 `lint`·`tsc --noEmit`·`build` 그린 검증 완료.
> 따라서 §8-1 "현재 HEAD build 재실행"은 이미 충족(그린). 이후 dc78042/3e98ec1은 docs-only.
> Claude 2차(2026-07-02): HEAD `9b85771`에서 lint·tsc·build 그린 재확인. 런칭 갭 전수 감사(P0 6·P1 18) +
> AI 영상 엔진 경쟁 조사 완료 — **`docs/07_LAUNCH_GAP_AND_VIDEO_ENGINE_RESEARCH_2026-07-02.md`가 §8의 상세 확장판.**
> 코드 P0 4건 해소 완료(2026-07-02): P0-1 0099/0008→supabase/manual(`70a859e`) · P0-2 결제 인라인+빌드 ARG(`8ee83cd`)
> · P0-3 서명 URL→path 재서명, migration 0021(`47d31d4`) · P0-6 privacy §5 국외이전 고지(`980a7c6`).
> Codex 개발노트(2026-07-02): `docs/08_CODEX_EXECUTION_PLAN_2026-07-02.md` 실행. 인터랙티브 영상 최소 구현(`InteractiveVideoPlayer` + scene graph + `/play` 통합), 결제 이메일 no-op/Resend 배선, 랜딩/구독 카피 완화, 401 재로그인 분기, Toss pending no-op, production test key 차단, function EXECUTE revoke migration 0022, Opus 단가 정정. 검증: `tsc` 그린, `lint` 그린, `build` 그린. 브라우저: `/`와 `/demo/ai-diagnosis` 클릭 QA 완료, `/play`는 로그인 보호로 `/auth/login?next=%2Fplay` redirect 확인(로그인 세션에서 저장 네트워크 QA 필요).
> Claude 3차(2026-07-02): Codex 실행분 리뷰 완료 — 플레이어 결함 3건 수정(iOS 자동재생 탭 폴백·자동선택
> 타이머 경합 ref 가드·미존재 씬 시 완료 보장) 후 `afaff38` 커밋. **다음 단계 정본: `docs/09_NEXT_PLAN_2026-07-02.md`**
> (트랙 A 콘텐츠 생산 사이클이 최우선 — 코드가 더는 병목이 아님).
> ⚠️ 결제용 NEXT_PUBLIC_*(TOSS·BIZ 6종)는 **빌드 타임** 주입이다 — cloudbuild substitution에 실값을 넘겨야 결제가 열린다(런타임 env로는 불가).
> Repo: `/Users/jongwonlee/dev/kindy-web`
> Current branch at handoff check: `codex/ai-diagnosis-demo`
> Current HEAD at handoff check: `afaff38` (Codex 실행분 + Claude 리뷰 수정 커밋됨). 이전: `726b399 fix(payments): P1-1/2/3/12/15 — dunning·선청구·무청구 재시작·실패 알림·동의 서버 강제`
> Main Codex implementation commit: `4f15848 Polish Mori web launch experience`
> Rule: base is `main`, open **DRAFT PR only**, never push to base. Read `docs/LESSONS.md` before implementation. For code changes, also read the relevant Next.js 16 guide in `node_modules/next/dist/docs/`.

---

## 0. TL;DR

`kindy-web`는 더 이상 문서 전용 폴더가 아니다. 현재 이 레포가 실제 Next.js 웹앱이며, 랜딩, 로그인, 온보딩, 아이 플레이, 이야기 숲, 보호자 기록장, 구독, 데모 미리보기, Supabase/Toss/Inngest/fal.ai 기반 생성 파이프라인을 포함한다.

이번 긴 작업의 핵심은 "앱이 아니라 웹으로, 바로 출시 가능한 수준까지" 끌어올리는 것이었다. 고객 화면은 내부 설명서처럼 보이지 않게 정리했고, 아이 화면은 5-7세가 한 행동만 보고 누를 수 있도록 단순화했으며, 보호자는 점수/등급/또래비교 없이 놀이 기록과 다음에 해볼 활동을 이해하도록 바꿨다.

가장 중요한 제품 원칙:

- 고객 화면에는 "도서관 데모와 모바일 본 서비스는 분리되어 작동합니다" 같은 내부 구조 설명을 쓰지 않는다.
- 아이 화면에는 `진단`, `평가`, `C6`, `커리큘럼`, `대시보드`, `분석` 같은 내부/어른 용어를 노출하지 않는다.
- 부모 화면도 "점수 대신"처럼 방어적인 말보다 `오늘 한 일`, `놀이 기록`, `대화 힌트`, `다음에 해볼 놀이`로 말한다.
- 모리는 서비스의 얼굴이다. 머리 위 `A` 장식은 옵션 이미지 오류였으므로 사용하지 않는다.
- 결제와 실제 배포 URL, Supabase 운영 설정처럼 대표가 해야 하는 외부 일은 코드에 박지 않는다. 앱은 env와 운영 설정만 채우면 이어갈 수 있게 둔다.
- fal.ai 키는 절대 커밋하지 않는다. `.env.local`의 `FAL_KEY`만 사용한다.

---

## 1. 현재 Git 상태와 주의점

핸드오프 직전 확인:

```bash
git status --short --branch
# ## codex/ai-diagnosis-demo
```

즉, 확인 시점의 worktree는 clean이었다.

중요한 커밋 흐름:

```text
4f15848 Polish Mori web launch experience
d337b98 fix(launch): quick wins — landing price/CTA, C6 report skew, lazy thumbnails, drop 19MB orphans
2225317 fix(security): hard-fail auth in production when Supabase env is unset (P0)
d5e5f59 fix(security): encrypt Toss billing keys at rest + lock billing_keys from clients (P0)
2a2e611 feat(payments): implement monthly recurring billing cron (P0)
ae6263f feat(payments): explicit recurring-billing consent + 청약철회·환불 고지 (P0 법무)
f81b8b4 feat(content): wire real Mori video into default session + honest AI-diagnosis label
3a36b49 feat(content): seed a real published Mori animal-village video (publish path)
d5556d1 feat(landing): restore verified trust anchors (교수 감수 · 공공도서관 운영)
51c0987 feat(diagnosis): learning-condition profile — 빈도 넘어 "어떻게/어떤 조건에서 잘 배우는지"
50d12b1 feat(bespoke): weak-area → per-child video generation (초개인화 핵심, 운영자 콘시어지)
1296282 feat(engine): audio-driven mouth sync for limited animation ("음성에 맞춰서")
09796a1 feat(personalization): 선별 기반 초개인화 — 공유 라이브러리를 아이 약점(C6)으로 재정렬
3e98ec1 docs(worldview): 모리의 이야기 도서관 앤솔로지 설계 스펙 (승인됨)
aac6924 style(design): FINDING-001 — 감정 게임을 5-7세 기준으로(마음지도 제거·큰 얼굴)
dc78042 docs(session): 인터랙티브 영상 세션 설계 스펙 (승인됨)
```

`4f15848`은 Codex가 사용자 요청으로 커밋한 대규모 구현 커밋이고, 그 뒤로 보안/결제/개인화/세계관/인터랙티브 영상 설계 커밋이 추가됐다. 다음 작업자는 반드시 현재 HEAD 기준으로 보고, `4f15848`만 기준으로 되돌리면 안 된다.

Codex goal 기능은 사용자 요청에 따라 종료했다. 종료 시점 도구 보고 기준 `status=complete`, `tokensUsed=1342091`, `timeUsedSeconds=3898`.

---

## 2. 제품 의도

Kindy는 5-7세 아이가 모리와 이야기 영상을 보고, 장면 사이 짧은 선택/놀이를 하며, 부모가 그 흔적을 쉬운 기록으로 보는 웹 서비스다.

아이에게는 "공부 앱"이 아니라 "모리랑 이야기 한 편 보고 톡 누르는 경험"이어야 한다. 부모에게는 "우리 아이가 뭘 좋아하고 어디서 막히는지"가 점수 없이 보여야 한다.

현재 확정 방향:

- Web-first. 앱 출시 전 웹으로 검증/런칭한다.
- 모리 중심 IP. 크림+세이지 톤, 부드러운 책 정령, 머리 위 A 없음.
- 도서관/현장 데모와 집 모바일 본 서비스는 내부적으로 분리될 수 있지만, 고객에게 구조 설명으로 노출하지 않는다.
- 자체 유입 부모도 어색하지 않아야 한다. "도서관에서 이어집니다" 같은 단선 퍼널 카피 금지.
- 아이 UI는 Apple식 단순함: 한 화면 한 행동, 큰 터치 영역, 글보다 이미지/음성 우선.
- 부모 UI는 차분한 기록장: 과장된 교육 마케팅보다 진행, 관찰, 다음 대화 힌트.
- AI 생성 이미지/영상은 저렴해 보이는 이모지 대신 실제 생성 asset을 쓰되, 키는 env로만 관리한다.

---

## 3. 구현된 주요 영역

### 3.1 랜딩과 첫 전환

주요 파일:

- `src/app/page.tsx`
- `src/app/start/page.tsx`
- `src/app/start/AttributionTracker.tsx`
- `src/app/auth/login/page.tsx`
- `src/components/InviteCodeForm.tsx`
- `src/components/WaitlistForm.tsx`

반영 내용:

- 랜딩을 "서비스 소개서/IR 문서" 느낌에서 고객용 첫 화면으로 낮췄다.
- 첫 방문자가 바로 이해하도록 `영상 한 편 → 질문·놀이 → 보호자 기록` 구조를 앞에 배치했다.
- `처음이라면` 설명 카드로 `모리`, `이야기 숲`, `보호자 기록`을 한 문장씩 설명한다.
- `/start?from=ai-diagnosis`는 `kindy_source=ai-diagnosis` 쿠키를 저장하고, "방금 본 영상 다음" 흐름으로 이어준다.
- 고객에게 도서관 데모/모바일 본서비스 분리 설명을 노출하지 않는다.
- 가격/CTA quick win은 후속 커밋 `d337b98`에서 추가 보정됐다.

### 3.2 모리 영상 미리보기 데모

주요 파일:

- `src/app/demo/ai-diagnosis/page.tsx`
- `src/app/demo/ai-diagnosis/AiDiagnosisDemo.tsx`
- `public/demo-videos/mori-starlight-seed.mp4`
- `public/demo-videos/mori-starlight-seed.vtt`

반영 내용:

- 가입 전 부모와 아이가 "영상 보고 무엇을 확인하는 서비스인지" 체감할 수 있는 미리보기 페이지를 만들었다.
- 영상 1편 → 큰 선택지 3개 → 오늘 잘 맞은 놀이/다음에 해볼 놀이 → `/start?from=ai-diagnosis` CTA 흐름.
- `AI 영상 반응 데모`, `진단`, `평가`, `부족` 같은 말은 고객 화면에서 제거했다.
- 후속 커밋 `f81b8b4`에서 실제 모리 영상 연결과 더 솔직한 미리보기 라벨이 반영됐다.

### 3.3 아이 플레이 경험

주요 파일:

- `src/app/play/page.tsx`
- `src/components/game/SessionShell.tsx`
- `src/components/game/PuzzleGame.tsx`
- `src/components/game/EmotionExpressionGame.tsx`
- `src/components/game/HiddenFriendGame.tsx`
- `src/components/game/DecorateGame.tsx`
- `src/components/game/GameTokenVisual.tsx`
- `src/components/game/Mascot.tsx`
- `src/components/game/RewardMeta.tsx`
- `src/data/worlds/animal-village.ts`
- `src/lib/game/village-session.ts`
- `src/lib/game/engine.ts`

반영 내용:

- 아이 화면에서 진행 표시와 보상 신호를 단순화했다.
- `씨앗`, `C6`, `진단`, `점수`처럼 아이가 이해하기 어려운 단어를 줄였다.
- 시스템 이모지 중심 UI를 생성 이미지/CSS 일러스트 중심으로 교체했다.
- 감정 게임은 5-7세 기준으로 큰 얼굴 선택 UI에 가깝게 단순화했다. 후속 커밋 `aac6924`에서 마음지도/복잡한 설명을 더 제거했다.
- `Q_quiz` 타입도 큰 그림 버튼, 즉시 피드백, 재시도, latency 기록이 가능하게 붙였다.
- 첫 세션은 모리와 동물 마을 세계관을 중심으로 구성된다.
- 후속 커밋 `09796a1` 이후 `/play`는 아이의 약점 C6 도구에 맞춰 공유 라이브러리를 재정렬하는 선별 개인화 흐름을 가진다.

### 3.4 이야기 숲 / 샘플 화면

주요 파일:

- `src/app/library/page.tsx`
- `src/app/library/[id]/page.tsx`
- `src/app/sample/library/page.tsx`
- `src/app/sample/library/[id]/page.tsx`
- `src/app/sample/library/[id]/SampleLibraryVideoClient.tsx`
- `src/app/sample/report/page.tsx`
- `src/components/LibraryCard.tsx`
- `src/components/LibraryFilters.tsx`
- `src/components/LibraryPlayer.tsx`
- `src/components/LibraryPostFlow.tsx`
- `src/lib/library-preview.ts`
- `src/types/library.ts`

반영 내용:

- 고객 화면에서는 라이브러리를 `이야기 숲` 톤으로 노출한다.
- 영상 상세에서 시청 이벤트와 영상 후 질문/놀이 흐름을 연결한다.
- 샘플 리포트와 샘플 라이브러리 진입을 만들어 공유 링크/외부 프리뷰에 대응했다.
- free trial gate와 membership gate를 라이브러리 목록/상세/view 저장 API까지 맞췄다.
- 후속 커밋 `3a36b49`에서 실제 published Mori animal-village 영상 seed 경로가 추가됐다.

### 3.5 보호자 기록장 / C6 관찰 지도

주요 파일:

- `src/app/dashboard/page.tsx`
- `src/app/dashboard/report/page.tsx`
- `src/app/api/dashboard/summary/route.ts`
- `src/app/api/dashboard/profile/route.ts`
- `src/app/api/dashboard/completion/route.ts`
- `src/components/C6ToolMark.tsx`
- `src/lib/game/c6-profile.ts`
- `src/lib/game/sel-report.ts`
- `src/lib/game/learning-profile.ts`
- `src/lib/game/library-selection.ts`

반영 내용:

- 부모 홈과 리포트를 점수표가 아니라 `보호자 기록장`으로 정리했다.
- 내부 C6는 유지하되 화면 라벨은 `보기 놀이`, `잇기 놀이`, `규칙 놀이`, `나눔 놀이`, `꾸밈 놀이`, `만들기 놀이`로 낮췄다.
- `C6ToolMark`로 보호자 화면 시각 언어를 통일했다. C1-C6 코드는 내부 기준이지 고객에게 앞세우지 않는다.
- `game_rounds` 기반으로 실제 완료한 놀이, 강하게 보인 놀이, 다음에 해볼 놀이, 3일 보완 제안을 만든다.
- `collection_progress`는 학습 라운드 row로 저장하지 않고 accepted만 반환하게 해 리포트 집계 오염을 줄였다.
- 후속 커밋 `51c0987`에서 단순 빈도보다 "어떤 조건에서 잘 배우는지"를 보는 `learning-profile`이 추가됐다.
- 후속 커밋 `09796a1`에서 `library_videos.c6_focus`와 `orderLibraryByWeakTool` 기반 선별 개인화가 추가됐다.

### 3.6 온보딩, 동의, 아이 관리

주요 파일:

- `src/app/onboarding/page.tsx`
- `src/app/api/children/route.ts`
- `src/app/api/children/[id]/route.ts`
- `src/app/dashboard/settings/page.tsx`
- `supabase/migrations/0018_parent_consents.sql`
- `src/content/legal/privacy.md`
- `src/content/legal/terms.md`
- `src/content/legal/business.md`

반영 내용:

- 온보딩에서 아이 이름, 나이, 선호, 보호자 동의를 받는다.
- `/api/children`은 `parent_consent=true` 없이는 생성하지 않는다.
- 동의 기록은 `parent_consents`에 남기고, 아이 삭제 시 동의 증적은 보호자 계정 기준으로 분리 보존되도록 설계했다.
- 아이 삭제 UX에서 삭제되는 것과 남는 것을 고객용 언어로 설명한다.
- 법무 페이지와 실제 데이터 모델의 정합성을 맞췄다.

### 3.7 구독, 결제, 보안

주요 파일:

- `src/app/subscribe/page.tsx`
- `src/app/subscribe/SubscribeClient.tsx`
- `src/app/subscribe/success/page.tsx`
- `src/app/subscribe/fail/page.tsx`
- `src/app/api/subscription/route.ts`
- `src/app/api/subscription/cancel/route.ts`
- `src/app/api/subscription/consent/route.ts`
- `src/app/api/payments/toss/billing-key/route.ts`
- `src/app/api/payments/webhook/toss/route.ts`
- `src/inngest/functions/subscription-renewal.ts`
- `src/lib/subscription.ts`
- `src/lib/subscription-types.ts`
- `src/lib/toss.ts`
- `src/lib/billing-crypto.ts`
- `supabase/migrations/0017_subscriptions.sql`
- `supabase/migrations/0019_billing_keys_lock.sql`

반영 내용:

- 기본 결제 모델은 월 구독 `₩25,000` 방향으로 정리됐다. 자세한 드리프트 해소는 `docs/OFFER_MODEL_RECONCILE.md`.
- 무료 체험은 3편 기준 gate가 들어갔다.
- Toss billing key 저장, 구독 상태, 해지, 결제 실패 UX가 정리됐다.
- 후속 커밋 `d5e5f59`에서 Toss billing key 앱 레벨 암호화와 client 접근 차단 migration이 추가됐다.
- 후속 커밋 `2a2e611`에서 월 반복 결제 Inngest cron이 추가됐다.
- 후속 커밋 `ae6263f`에서 정기결제 명시 동의와 청약철회/환불 고지가 추가됐다.
- 후속 커밋 `2225317`에서 production Supabase env가 없을 때 auth를 hard-fail하도록 바뀌었다.

운영 전 반드시 확인할 env:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_TOSS_CLIENT_KEY`
- `TOSS_CLIENT_KEY`
- `TOSS_SECRET_KEY`
- `BILLING_KEY_SECRET`
- `INNGEST_SIGNING_KEY`
- `INNGEST_EVENT_KEY`
- `NEXT_PUBLIC_BIZ_*`

### 3.8 AI 이미지/영상 생성과 Limited Animation

주요 파일:

- `docs/VIDEO_LIMITED_ANIMATION_PIPELINE.md`
- `src/lib/limited-animation.ts`
- `scripts/smoke-limited-animation.ts`
- `scripts/generate-library-episode-90s.ts`
- `scripts/generate-library-batch.ts`
- `scripts/generate-web-art.ts`
- `scripts/cutout.ts`
- `src/lib/video-pipeline.ts`
- `src/lib/episode-pipeline.ts`
- `src/lib/video-providers/*`
- `src/lib/brief-builder.ts`
- `src/lib/art-assets.ts`

반영 내용:

- 비싼 full video/lipsync 호출 대신 기본 제작은 limited animation 모드를 사용한다.
- 구조: 키 이미지 + TTS + slow zoom/pan + 입뻐끔 2프레임 레이어 + ffmpeg 합성.
- `premium`은 랜딩 대표 영상/투자자 데모용, `limited`는 반복 학습 본편용.
- 후속 커밋 `1296282`에서 audio-driven mouth sync가 추가됐다.
- `scripts/smoke-limited-animation.ts`로 네트워크/유료 키 없이 로컬 렌더러를 검증할 수 있다.

로컬 스모크:

```bash
npm run smoke:limited-animation
```

대표 생성 명령:

```bash
ANIMATION_MODE=limited npx tsx --env-file=.env.local scripts/generate-library-episode-90s.ts
```

fal.ai:

- `.env.local.example`에는 `FAL_KEY=`만 있다.
- 사용자가 채팅에 제공했던 실제 키 문자열은 repo 검색에서 발견되지 않았다.
- 다음 작업자도 키를 문서/코드/커밋에 쓰면 안 된다.

### 3.9 비스포크 초개인화

주요 파일:

- `docs/OFFER_MODEL_RECONCILE.md`
- `src/app/api/videos/bespoke/route.ts`
- `src/lib/game/bespoke-brief.ts`
- `src/lib/game/learning-profile.ts`
- `src/lib/game/library-selection.ts`
- `supabase/migrations/0020_library_c6_focus.sql`

반영 내용:

- 오퍼 드리프트 해소: 결제는 월 구독 유지, 콘텐츠는 아이 약점 기반 비스포크로 간다.
- `learning-profile.struggleTool` → `bespoke-brief` → 운영자 게이트 `/api/videos/bespoke` 흐름.
- `KINDY_OPERATOR_KEY`가 없으면 비용 폭발 방지를 위해 비스포크 엔드포인트가 닫힌다.
- 진행중 영상이 있으면 중복 queue를 막는다.
- 공유 라이브러리는 콜드스타트/기본값이고, 비스포크는 20가구 콘시어지 운영으로 검증하는 방향이다.

### 3.10 세계관과 인터랙티브 영상 설계

주요 문서:

- `docs/superpowers/specs/2026-07-01-worldview-anthology-design.md`
- `docs/superpowers/specs/2026-07-01-interactive-video-session-design.md`
- `docs/content/animal-village-season1.md`

현재 승인된 방향:

- 우산 세계는 `모리의 이야기 도서관`.
- 각 책이 하나의 세계다. 현재 책1은 동물 마을, 추가 후보는 바다속 물빛 마을, 별밤 하늘 세계, 색의 정원.
- 관통 미스터리는 `빈 마지막 페이지`.
- 모리는 모든 책에 공통 등장하는 호스트이며, 화면 밖 아이를 볼 수 있는 유일한 캐릭터다.
- 인터랙티브 영상은 "유튜브처럼 보다가 장면 사이 큰 선택지"가 핵심이다.
- 현재 구조인 `영상 전체 → 별도 게임 화면`은 후속 구현에서 `Scene graph + choice overlay`로 흡수하는 설계가 승인됐다.
- 중간 선택은 diamond 구조로 짧게 갈라졌다 합류하고, 마지막만 2결말로 나눈다. 비용 폭발을 막기 위한 구조다.

다음 구현 후보:

1. `Scene`, `ChoicePoint`, `EndingRule` 타입 추가.
2. `animal-village` 첫 세션을 씬 그래프로 재표현.
3. `InteractiveVideoPlayer` 구현.
4. 큰 얼굴/그림 선택 오버레이와 음성 프롬프트 연결.
5. 선택 결과를 기존 `/api/game/events`와 `game_rounds` 계약으로 저장.

---

## 4. 고객 노출 용어 가드레일

고객 화면에서 피해야 할 말:

- `도서관 데모와 모바일 본 서비스는 분리되어 작동합니다`
- `진단`, `평가표`, `점수표`, `점수 대신`
- `AI 영상 반응`, `AI 이야기`, `아이 반응`, `반응 기록`
- `C6 생각`, `C6 창의`, `C1 관찰`, `C6 통합`
- `커리큘럼`, `차시`, `진도표`
- `대시보드`, `리포트`, `분석어`
- `생각 씨앗`, `창의 씨앗`, `반짝 씨앗`, `다음 씨앗`

권장 표현:

- `모리`
- `이야기 숲`
- `영상 한 편`
- `질문·놀이`
- `오늘 기록`
- `보호자 기록장`
- `놀이 기록`
- `대화 힌트`
- `다음에 해볼 놀이`
- `보기 놀이`, `잇기 놀이`, `규칙 놀이`, `나눔 놀이`, `꾸밈 놀이`, `만들기 놀이`
- `학습 과정`, `활동`, `학습표`

검사용 grep:

```bash
rg -n "생각 ?씨앗|창의 씨앗|반짝 씨앗|다음 씨앗|오늘의 씨앗|첫 씨앗|C6 생각|C6 창의|C1 관찰|C2 상상|C3 패턴|C4 변형|C5 색|C6 통합|커리큘럼|차시|진도표|진단|평가표|점수 대신|점수표|AI 영상 반응|AI 이야기|아이 반응|반응 기록|데모 목록|대시보드에서|대시보드로|분석어" src/app src/components src/lib src/data
```

마지막 확인에서는 고객 UI 문구로는 제거됐고, 내부 주석/문서 성격의 잔여만 있었다.

---

## 5. 생성/시각 asset 상태

주요 asset:

- `public/ip/mori-reference.jpg`
- `public/ip/mori-reference-no-a.jpg`
- `public/ip/generated/mori-hero.png`
- `public/ip/generated/mori-village-hero.png`
- `public/ip/generated/mori-cutout.png`
- `public/ip/generated/starlight-seed.png`
- `public/ip/generated/hidden-forest.png`
- `public/ip/generated/squirrel-friend.png`
- `public/ip/generated/teddy.png`
- `public/ip/generated/balloon.png`
- `public/ip/generated/festival-bell.png`
- `public/ip/generated/gift-box.png`
- `public/demo-videos/mori-starlight-seed.mp4`
- `public/demo-videos/mori-starlight-seed.vtt`

후속 커밋 `d337b98`에서 19MB 규모의 오래된 princess/bookmate/miri orphan asset이 삭제됐다.

디자인 주의:

- 시스템 이모지로 핵심 캐릭터/게임 토큰을 때우지 않는다.
- 모리 머리 위 `A` 없는 reference를 우선 사용한다.
- 산리오/팝마트/라부부처럼 아이가 좋아할 만한 촉감 있는 캐릭터 감성은 참고하되, 상표권 캐릭터를 직접 복제하지 않는다.
- 이미지 생성은 fal.ai/Gemini 등 env 기반으로만 호출한다.

---

## 6. API / 데이터 모델 지도

주요 API:

- `src/app/api/children/route.ts`
- `src/app/api/children/[id]/route.ts`
- `src/app/api/game/events/route.ts`
- `src/app/api/kiosk/events/route.ts`
- `src/app/api/library/route.ts`
- `src/app/api/library/[id]/route.ts`
- `src/app/api/library/[id]/view/route.ts`
- `src/app/api/dashboard/summary/route.ts`
- `src/app/api/dashboard/profile/route.ts`
- `src/app/api/dashboard/completion/route.ts`
- `src/app/api/subscription/route.ts`
- `src/app/api/subscription/cancel/route.ts`
- `src/app/api/subscription/consent/route.ts`
- `src/app/api/payments/toss/billing-key/route.ts`
- `src/app/api/payments/webhook/toss/route.ts`
- `src/app/api/videos/bespoke/route.ts`
- `src/app/api/videos/route.ts`
- `src/app/api/inngest/route.ts`

Migration files:

- `0001_init.sql`
- `0010_library_videos.sql`
- `0011_view_events_library.sql`
- `0013_library_episode_scenes.sql`
- `0015_kiosk_funnel.sql`
- `0016_game_events.sql`
- `0017_subscriptions.sql`
- `0018_parent_consents.sql`
- `0019_billing_keys_lock.sql`
- `0020_library_c6_focus.sql`

중요 데이터 원칙:

- 최신 기준은 `supabase/migrations/*.sql`이다. 오래된 schema snapshot을 절대 단독 기준으로 보지 않는다.
- 아이 삭제와 보호자 동의 기록 보존은 분리한다.
- `library_videos.published`가 공개 여부를 결정한다.
- `library_videos.c6_focus`는 선별 개인화의 핵심 태그다.
- `game_rounds`는 부모 기록/C6/learning profile의 근거다.
- `collection_progress`는 라운드 row를 만들지 않는다.

---

## 7. 검증 내역

Codex 구현 중 확인한 것:

- `npx tsc --noEmit` 성공(2026-07-02 Codex 실행 플랜 변경분 기준).
- `npm run lint` 성공(2026-07-02 Codex 실행 플랜 변경분 기준).
- `npm run build` 성공(Next.js 16.2.3, 48 pages 생성. 로컬 sandbox 제약 때문에 escalated로 실행).
- `git diff --check` 성공.
- 브라우저 QA는 `http://localhost:3020`에서 다음 경로를 확인했다:
  - `/`
  - `/demo/ai-diagnosis`
  - `/auth/login`
- `/` 랜딩: `5-7세` hero 문구, `/demo/ai-diagnosis` CTA, 고객 화면 금칙어/내부 분리 설명 없음 확인.
- `/demo/ai-diagnosis`: 영상 1개, 금칙어/내부 분리 설명 없음 확인. `영상 봤어요` → 선택 3개 → 결과 → `무료 3편 이어보기`(`/start?from=ai-diagnosis`)·`보호자 기록 예시 보기` CTA까지 클릭 확인.
- `/play`: 로그인 보호로 `/auth/login?next=%2Fplay` redirect 확인. 로그인 세션이 없어서 인터랙티브 선택 2회와 `game_round_completed` 네트워크 저장 QA는 아직 필요하다.
- secret scan에서 사용자가 채팅에 준 fal.ai key literal은 repo에 없었다.

다음 작업 전 권장 재검증:

```bash
npm run lint
npx tsc --noEmit
npm run build
npm run smoke:limited-animation
```

secret scan:

```bash
rg -n "87a1281a|33d09aac18c30e577d1ecc2fa52f3a35|FAL|fal\\.ai|fal-ai|FAL_KEY|FAL_API" .
```

실제 키 문자열이 나오면 즉시 제거하고 history 노출 여부를 별도로 판단한다.

---

## 8. 아직 부족하거나 다음에 봐야 할 것

> **2026-07-02 갱신**: 아래 목록의 전수 감사 결과가 `docs/07_LAUNCH_GAP_AND_VIDEO_ENGINE_RESEARCH_2026-07-02.md`에
> 있다(P0 6건·P1 18건·P2 34건, 전 건 file:line 증거 + 적대적 검증). 코드로 풀 수 있는 P0 4건(0099 RLS 함정 ·
> 결제 버튼 이중 결함 · 서명 URL 30일 박제 · PIPA 국외이전 고지)은 같은 날 해소 완료 — 07 문서 각 항목의 ✅ 참조.
> 남은 P0는 코드 밖: 콘텐츠 재고 3편(P0-4)과 Inngest Cloud 연결(P0-5). 아래 1번(build)도 해소 완료.

출시 전 P0/P1:

1. ~~현재 HEAD 기준 `npm run build` 재실행.~~ ✅ 2026-07-02 `9b85771`에서 lint·tsc·build 그린.
2. Supabase production env, RLS, migration 적용 상태 확인.
3. Toss live key 전환 전 `BILLING_KEY_SECRET` 설정 필수.
4. Inngest signing/event key와 subscription renewal cron 실제 동작 확인.
5. `/api/videos/bespoke`는 `KINDY_OPERATOR_KEY` 없이 닫혀야 한다.
6. 모바일 viewport에서 아이 플레이 UI와 랜딩 텍스트 overflow 재검증.
7. 데모/본서비스 분리 설명이 고객 화면에 다시 생기지 않았는지 grep.
8. ~~`docs/superpowers`의 인터랙티브 영상 설계를 실제 플레이어로 구현할지 결정.~~ ✅ 2026-07-02 Codex 최소 구현: 단일 mp4 timestamp scene graph + 큰 선택 오버레이 + 기존 `game_rounds` 기록 계약 연결. 남은 일은 정식 75초/씬별 클립 제작과 Playwright 실클릭 QA.
9. 세계관 4권 확장 전, 동물 마을 첫 세션 품질과 retention을 먼저 본다.
10. `docs/06_LAUNCH_UX_C6_BENCHMARK_2026-06-30.md`의 51개 점검 항목 중 코드와 어긋나는 항목이 생기면 즉시 업데이트한다.

기획/콘텐츠:

- 첫 영상 세계관은 "모리의 이야기 도서관 → 동물 마을 책 → 빈 마지막 페이지/이야기 빛"으로 정렬한다.
- 5-7세에게는 긴 설명보다 20-40초마다 큰 선택지가 먹힌다.
- 퀴즈는 정답 검사보다 단서 보기/마음 고르기/같이 다시 보기 톤으로 간다.
- 부족 영역은 `부족`이라고 말하지 말고 `다음에 해볼 놀이`로 제안한다.
- 부모에게는 "성장 증명"이 필요하다. 주간 기록에서 "처음 해낸 것"과 "다음 한마디"를 보여줘야 한다.

디자인:

- 아이 화면은 더 줄여도 된다. Apple처럼 한 행동만 남기는 쪽이 맞다.
- generated asset은 좋지만, 장면/캐릭터 간 스타일 일관성은 계속 관리해야 한다.
- hero와 public sample은 고급스러워야 한다. `이모티콘으로 때운 서비스`처럼 보이면 안 된다.

---

## 9. 주요 문서

반드시 먼저 볼 문서:

- `docs/00_HANDOFF.md` — 이 문서.
- `docs/07_LAUNCH_GAP_AND_VIDEO_ENGINE_RESEARCH_2026-07-02.md` — 런칭 갭 전수 감사(P0/P1/P2) + AI 영상 엔진 경쟁 조사·로드맵. §8의 상세 확장판.
- `docs/LESSONS.md` — 구현 전 필수 확인.
- `docs/SERVICE_OVERVIEW.md` — 실제 코드 기준 서비스 이해 문서.
- `docs/06_LAUNCH_UX_C6_BENCHMARK_2026-06-30.md` — 리서치/벤치마크/UX 점검 로그.
- `docs/VIDEO_LIMITED_ANIMATION_PIPELINE.md` — 저비용 영상 생성 방식.
- `docs/OFFER_MODEL_RECONCILE.md` — 월 구독과 비스포크 초개인화 방향 정리.
- `docs/superpowers/specs/2026-07-01-worldview-anthology-design.md` — 모리의 이야기 도서관 세계관.
- `docs/superpowers/specs/2026-07-01-interactive-video-session-design.md` — 인터랙티브 영상 세션 설계.
- `docs/content/animal-village-season1.md` — 동물 마을 시즌 콘텐츠.
- `docs/content/authoring-guide.md` — 콘텐츠 작성 기준.
- `docs/05_LEGAL_RISK.md` — 법무 리스크 가드레일.

과거 문서 주의:

- `01_WEB_GTM_PLAN.md` 등 초기 문서는 배경으로는 유용하지만, 현재 코드와 충돌할 수 있다.
- 이 파일의 이전 버전은 `kindy-web`을 문서 폴더라고 썼으나 지금은 틀렸다.

---

## 10. 다음 작업자가 지켜야 할 Do / Don’t

Do:

- 고객 관점으로 본다. 화면이 서비스 소개서처럼 보이면 고친다.
- 아이 화면은 말보다 이미지, 큰 버튼, 한 행동.
- 부모 화면은 기록장처럼 차분하게.
- 내부 C6/SEL/AI 용어는 데이터와 문서에 두고, UI는 쉬운 말로 번역한다.
- fal.ai/Toss/Supabase/Inngest key는 env로만 둔다.
- 새 코드 작업 전 `docs/LESSONS.md`와 Next.js 16 docs를 읽는다.
- PR은 DRAFT로만 연다.

Don’t:

- `main`에 push하지 않는다.
- 고객 화면에 "데모와 본서비스는 분리" 같은 내부 설명을 쓰지 않는다.
- 아이에게 `진단`, `평가`, `점수`, `C6`, `커리큘럼`을 보여주지 않는다.
- 라부부/산리오/팝마트 같은 실제 IP를 직접 복제하지 않는다.
- 사용자가 제공한 API key를 코드/문서/커밋에 남기지 않는다.
- 기존 HEAD의 보안/결제/개인화 커밋을 모르고 `4f15848` 상태로 되돌리지 않는다.

---

## 11. 바로 이어서 할 만한 작업

가장 자연스러운 다음 작업 순서:

1. 현재 HEAD에서 `npm run lint`, `npx tsc --noEmit`, `npm run build`.
2. 모바일/데스크톱 Playwright screenshot으로 `/`, `/demo/ai-diagnosis`, `/start?from=ai-diagnosis`, `/onboarding`, `/play`, `/dashboard`, `/dashboard/report`, `/subscribe` QA.
3. `/play` 인터랙티브 흐름을 Playwright로 실클릭 검증하고 `game_round_completed` 네트워크 콜을 확인.
4. 첫 주 운영용 library matrix를 `c6_focus` 태그로 seed.
5. 부모 기록장에서 "성장 증명" 섹션을 강화: 처음 해낸 것, 지난번보다 나아진 것, 오늘 해볼 한마디.
6. Supabase/Toss/Inngest/Resend production 환경변수와 migration 적용 체크리스트 최종 확인.

현재 상태는 "데모 가능한 웹 제품"에 가까워졌지만, 완전 런칭 직전에는 build, 결제 live 전환, Supabase production, mobile visual QA, 첫 콘텐츠 품질 검수가 남아 있다.
