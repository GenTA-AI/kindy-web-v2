# Codex 실행 플랜 — 런칭 퀄리티 마무리 (2026-07-02, Claude 작성)

> 대상: Codex (다음 작업자). 이 문서는 Claude가 usage 한도로 넘기는 **상세 실행 지시서**다.
> 전제: `docs/00_HANDOFF.md`(규칙) → `docs/07_LAUNCH_GAP_...md`(갭 감사·엔진 조사) → 이 문서 순으로 읽을 것.
> 규칙 리마인드: base=`main` 푸시 금지, **DRAFT PR만**, 코드 전 `docs/LESSONS.md` + `node_modules/next/dist/docs/` 확인,
> 고객 화면 용어 가드레일(00_HANDOFF §4) — `진단/평가/점수/C6/커리큘럼/씨앗` 금지, 검사 grep은 §4에 있음.

---

## 0. 오늘(2026-07-02) 완료된 것 — 다시 하지 말 것

- **코드 P0 4건 전부 해소** (07 문서 ✅ 마커): 0099 이동(`70a859e`) · 결제 인라인+빌드 ARG(`8ee83cd`) · 서명 URL path 재서명(`47d31d4`, migration 0021) · privacy §5 국외이전(`980a7c6`) + 적대검증 후속(`80230d0`).
- **P1 결제 3종 + 관측성** (이 플랜과 같은 날 커밋): 갱신 cron이 active를 만료 24h 전 선청구(암전 제거), past_due 7일 dunning 재시도 후 expired 종결, 실패 시 런 throw(Inngest 빨간불); billing-key 라우트가 동의 증적 서버 강제(P1-15) + 유료기간 잔존 시 **무청구 카드교체/재시작** + 결정적 first orderId(이중청구 창 제거); SubscribeClient past_due '카드 다시 등록하기' CTA + 재시작 무청구 카피; success 페이지 charged=false 분기.
- **P1 병렬 수정** (에이전트, 같은 날 커밋): 미리 스텁 8편 제거(P1-4) · c6_focus 매트릭스→insert 배선(P1-5) · attention-quiz null-script 폴백(P1-6) · bespoke 가드 'generating'(P1-7) · LibraryPlayer playsInline+onError 폴백+AI 라벨(P1-11/18) · error/global-error/not-found/loading 페이지(P1-10) · terms §8 생성형 AI 정정 · 랜딩 '커리큘럼'→'교육 과정' · privacy §1 점수·반응속도 항목+§2 프로파일링(P1-17) · 온보딩 동의 카드 동기화 · docs/RUNBOOK.md(P1-13/14) · STATUS.md historical 배너.
- 검증: 각 단계 lint·tsc·build 그린. 커밋 로그와 git diff를 먼저 보고 시작할 것.

---

## 1. 최우선: 인터랙티브 영상 플레이어 (승인 스펙의 최소 구현)

정본 스펙: `docs/superpowers/specs/2026-07-01-interactive-video-session-design.md` (승인됨 — 구조 임의 변경 금지).
목표: 현재 `SessionShell`의 "영상 전체 → 별도 게임 화면들" 스테이지 머신을 **"영상이 주인공 + 장면 사이 큰 선택 오버레이"**로 바꾸는 최소 버전.

### 1-1. 타입 (신규 `src/types/interactive-session.ts`)
스펙 §3의 인터페이스를 그대로 옮긴다: `Scene`(id, videoClip, next?, choice?), `ChoicePoint`(id, prompt_ko, format:'emotion'|'clue'|'creative', options, rejoin), `ChoiceOption`(id, label_ko, icon?, branchScenes?, tally?, objective_code?), `EndingRule`(threshold, sceneId).
- `videoClip`은 최소 버전에서 `{ videoUrl: string; posterUrl?: string; startSec?: number; endSec?: number }` — **한 개 mp4의 구간 재생**도 허용하도록(현재 씬별 클립이 없으므로 15초 클립/단일 에피소드를 timestamp로 쪼개는 fallback). 엔진이 씬별 클립을 내면 URL 교체만 하면 되게.

### 1-2. 씬 그래프 데이터 (기존 `src/data/worlds/animal-village.ts`에 추가)
- `ANIMAL_VILLAGE_SCENE_GRAPH: { scenes: Scene[]; endings: EndingRule[] }` export 추가.
- 최소: 씬 3-5개 + 중간 선택(diamond, `rejoin` 필수) 1개 + 최종 선택 1개 + 결말 2벌.
- 선택 포맷: 중간 = `emotion`(큰 얼굴 — 기존 `EmotionExpressionGame`의 감정 세트 재사용), 최종 = `clue`(큰 그림 카드).
- 영상 소스: 현재 유일한 실자산 `/demo-videos/mori-starlight-seed.mp4`(15초)와 `VILLAGE_FIRST_VIDEO_FALLBACK` 기준으로 startSec/endSec 구간 분할. **새 영상 제작은 이 작업의 범위 밖** (운영자가 3편 생성 후 URL 교체).
- `tally` 예: 따뜻한 선택 `{warm:1}`, 씩씩한 선택 `{brave:1}` → EndingRule `{threshold:{warm:2}, sceneId:'ending-warm'}` / fallback ending.

### 1-3. `InteractiveVideoPlayer` (신규 `src/components/game/InteractiveVideoPlayer.tsx`)
- props: `{ graph, childName?, onRoundResult(result: GameRoundResult), onComplete(tally) }`.
- 동작: 씬 재생(§1-1 구간 재생: `timeupdate`에서 endSec 도달 시 pause) → `choice` 있으면 **큰 선택 오버레이** 표시 → 탭 → 짧은 칭찬 음성 → `branchScenes` 있으면 가지 재생 후 `rejoin`, 없으면 바로 rejoin/next → 최종 선택 후 choiceTally로 EndingRule 평가 → 결말 씬 재생 → `onComplete`.
- **음성**: `useVoice`(src/lib/voice/useVoice.ts — 정확한 경로 확인)로 prompt_ko 읽어주기. **iOS 오디오 unlock**: 첫 화면 "문 열래?" 탭에서 무음 오디오 1개를 play()해 이후 useEffect 발화 음성이 iOS Safari에서 재생되게 한다 (P1-9 후속 — 감사 P1-9 증거 참조).
- **선택 UI 재사용**: `EmotionExpressionGame`의 큰 얼굴 카드(min-h-[150px], scale 1.6, helper 없음) 패턴과 `HiddenFriendGame`의 큰 그림 카드 패턴을 그대로. 새 디자인 언어를 만들지 말 것.
- **무응답 타임아웃**(스펙 §7): 15초 무응답 시 부드러운 음성 재프롬프트 1회 → 다시 15초 후 기본 경로(첫 옵션) 자동 진행. 진행 차단 금지.
- **오답 개념 없음**: emotion은 부드럽게 인정, clue는 "같이 다시 보자" 톤.
- video 태그: `playsInline preload="metadata"` 필수(P1-11 참조), `LibraryPlayer`의 onError 폴백 카드 패턴 재사용.

### 1-4. 기록 (스펙 §5 — 계약 불변)
- 각 선택 = `GameRoundResult` 1건: `game_type`은 포맷 매핑(emotion→'emotion_expression', clue→'Q_quiz', creative→'decorate'), `objective_code`는 ChoiceOption.objective_code, latency_ms는 오버레이 표시→탭 시간, score/max_score는 emotion이면 null(정답 없음), clue면 1/1.
- 기존 `/api/game/events` POST 계약과 `SessionShell`의 저장 큐 로직을 재사용 — **새 API를 만들지 말 것**. `game_rounds` 스키마(0016) 변경 금지.

### 1-5. SessionShell 통합 (스펙 §6)
- `SessionShell`에 `interactive` 모드 추가: `/play`가 씬 그래프가 있는 세션이면 stage machine(intro→video→round→gate→complete) 대신 intro→`InteractiveVideoPlayer`→complete 로 흐른다. 기존 모드는 폴백으로 유지(그래프 없는 세션·라이브러리 영상).
- 부모 대시보드·리포트·구독·선별 개인화 코드는 **수정 금지**(기록 계약이 같으므로 그대로 동작해야 함).
- 완료 화면의 "오늘 놀이는 여기까지 / 보호자에게 보여주기"는 기존 그대로.

### 1-6. 검증
- `npm run lint && npx tsc --noEmit && npm run build`.
- Playwright/browse로 `/play` 흐름 클릭 스루(선택 2회 + 결말 도달 + game_rounds 저장 네트워크 콜 확인).
- 용어 grep(00_HANDOFF §4). 아이 화면 한 행동 원칙: 오버레이에 선택지 외 다른 버튼 금지.

## 2. 랜딩·5-7세 정비 (작게, 카피 위주)

- 랜딩 `src/app/page.tsx`: (a) hero 카피가 5-7세 부모에게 말하는지 점검 — "영상 한 편 → 질문·놀이 → 보호자 기록" 구조 유지, 나이 명시("5-7세")를 hero 근처 1곳에. (b) '짧은 체험 보기' CTA가 `/demo/kiosk`로 가는 문제(감사 P2) → `/demo/ai-diagnosis`로 변경. (c) P0-4 카피 리스크: 재고 3편 발행 전까지 "매주 새 모리 이야기" 문구를 "모리의 새 이야기가 계속 늘어나요" 수준으로 완화(subscribe/page.tsx:10, SubscribeClient.tsx:26, 랜딩 동일 문구 grep). 재고 확보 후 되돌릴 것.
- 아이 화면: 감사 A-4에서 터치 타깃·용어는 이미 견고 판정 — 재작업 금지. 인터랙티브 플레이어(§1)가 5-7세 정합의 본체다.
- 세션 만료 401 분기(P2): dashboard/page.tsx:203-291, library/page.tsx:142-165에 401→재로그인 안내(onboarding/page.tsx:140-143 패턴).

## 3. P1 잔여 (코드)

- **P1-16 이메일**: `src/lib/mailer.ts` 신규 — Resend(`RESEND_API_KEY`) 기반, 키 없으면 console.warn 후 no-op(빌드·로컬 안전). 발송 3종: ① 첫 결제 성공(내역+해지 방법 — §13(2) 전자문서 교부), ② 갱신 성공, ③ 갱신 실패(past_due 안내+카드 재등록 링크 `/subscribe`). 배선: billing-key 라우트 성공 후, subscription-renewal renewOne 성공/실패 후. **메일 실패가 결제 흐름을 막으면 안 됨**(fire-and-forget + console.error). parent 이메일은 auth user에서(getSubscriptionState에 없음 — supabase.auth.admin.getUserById 사용, RUNBOOK에 env 문서화).
- **P1-9 음성 mp3**: `.gitignore`에서 `/public/audio/village/` 제거 → 운영자에게 `GOOGLE_API_KEY` 채운 뒤 `npx tsx --env-file=.env.local scripts/gen-village-tts.ts` 실행 요청 → 생성된 mp3 20개 커밋. (키가 없으면 이 단계는 코드 밖 게이트로 넘기고 RUNBOOK에 이미 문서화된 절차 참조.)
- **P2 싼 것들**(감사 4-B): 로그인 open-redirect 백슬래시 2줄(callback/route.ts:4-9, login/page.tsx safeNextPath에 `value.includes('\\')` 거부) · 웹훅 pending→no-op(webhook/toss/route.ts:92-107) · 프로드 test 키 throw(toss.ts:58-64, billing-crypto.ts:44-51 패턴) · anon EXECUTE REVOKE migration 1개(sync_entitlement, grant_credits_on_purchase) · Opus 단가 상수 정정(episode-pipeline.ts:83-88, claude-director.ts:19-24 — $15/$75→$5/$25).

## 4. 코드 밖 게이트 (대표와 함께 — docs/07 Part D 최신판)

콘텐츠 3편(P0-4: `ANIMATION_MODE=limited LIMIT_COUNT=3` → QC → publish — RUNBOOK 절차) · Inngest Cloud(P0-5) · Toss live 키+웹훅 등록 · Supabase prod(`db push`, 0099는 manual로 이동됨) · BILLING_KEY_SECRET · 변호사 검토 · 벤더 no-training 확인.

## 5. 엔진 로드맵 (여유 시 — docs/07 Part C 순서 준수)

C-6 순서: ~~P0-3~~✅ → 동물마을 매트릭스(`LIBRARY_MATRIX_ANIMAL_VILLage` 작성, 미리 매트릭스 deprecated) → 실배치 3편 → 씬별 클립+매니페스트 출력(episode-pipeline.ts:913-941 — §1의 플레이어와 접점) → KlingProvider A/B → bespoke 전달 표면(/play '맞춤 이야기' 섹션).

## 6. 완료 정의

lint·tsc·build 그린 + 용어 grep 클린 + `/play` 인터랙티브 흐름 실클릭 검증 + docs/07 해당 항목 ✅ 갱신 + DRAFT PR. 끝나면 docs/00_HANDOFF.md 헤더에 한 줄 추가.
