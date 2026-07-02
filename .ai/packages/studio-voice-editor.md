# Package: studio-voice-editor

## Objective
배우(음성)·편집 스테이지를 스튜디오 바이블에 연결한다: ① 90초 파이프라인 TTS가 대사별 캐릭터 캐스팅 + 씬별 감정 스타일 오버라이드를 소비(음성 어색함의 직접 해결) ② 대사씬 립싱크를 VEED Fabric(키프레임 이미지 + 우리 TTS wav)으로 승격 ③ ocean-edu 편집 레시피 적용(내레이션 오디오 0.5s 딜레이, 모든 컷 페이드, 하드컷 금지, concat 전 1920x1080 정규화) ④ 아이 UI 음성 스크립트(gen-village-tts)도 같은 캐스팅·스타일 체계로 재작성 ⑤ 비용 원장에 veed 스테이지 추가.

## Scope
- `src/lib/gemini-tts.ts` (synthesizeKorean에 voiceName/style 오버라이드 파라미터 — 하위호환)
- `src/lib/video-providers/veed-fabric.ts` (로컬 파일 입력 메서드 추가 — 기존 generateScene 유지)
- `src/lib/episode-pipeline.ts` (stepSceneAudio 캐스팅·감정, 대사씬 VEED 경로, 편집 레시피, 정규화 1080p, perStageCostUsd.veed — 키프레임/캐릭터ref/디렉터 프롬프트 함수는 수정 금지, P3 담당)
- `src/lib/limited-animation.ts` (내레이션 audioDelaySec + 페이드 길이 옵션 — 기본값은 기존 동작 보존)
- `scripts/gen-village-tts.ts` (바이블 캐스팅·스타일 체계로 재작성)
- `scripts/generate-library-episode-90s.ts` (CostBreakdown에 veed + estimatedDryRunCost 갱신만)
- `scripts/smoke-limited-animation.ts` (내레이션 딜레이 렌더 검증 추가)
- `src/content/studio/animal-village-bible.ts` (읽기 전용 — resolveVoiceCasting/resolveVoiceStyle 소비)
- `src/lib/video-providers/sync-lipsync.ts` (읽기 전용 — fal.storage 업로드 패턴 참고, 수정 금지)
- `src/lib/video-providers/fal-lipsync.ts` (읽기 전용 — 폴백 경로로 유지, 수정 금지)

## Constraints
- **VEED Fabric = 최종 결정.** Kling/Seedance 립싱크 대안 탐색·재실험 금지(탈락 이력 있음). sync-lipsync는 삭제하지 말고 `EPISODE_LIPSYNC=sync` 옵션 폴백으로 유지.
- **키리스 회귀 필수**: `npm run smoke:limited-animation`이 키 없이 계속 통과해야 한다. renderLimitedAnimationScene의 기존 시그니처·기본 동작(스피킹 씬 입 동기화 포함) 보존 — 신규 옵션은 전부 optional + 기본값 = 현재 동작.
- **기존 경로 보존**: SKIP_LIPSYNC=1 은 기존 의미 유지(대사씬도 오버레이/뻐끔). `EPISODE_LIPSYNC` env: 'veed'(기본) | 'sync'(기존 sync-lipsync) | 'off'(승격 전 동작). animationMode 'premium'|'limited' enum 변경 금지.
- 새 npm 의존성 금지(@fal-ai/client는 기존 의존성). 시크릿/.env 접근 금지 — Validation은 키리스 명령만. veed/gemini 실호출 검증은 HUMAN 게이트(Handoff에 명시).
- 머니코드·인증·/api·아이 UI 컴포넌트 범위 밖(gen-village-tts 스크립트만 예외 허용됨).
- 비용 상수: veed-fabric.ts의 COST_PER_SEC($0.08/s 480p 등)은 provider 실측 원장용으로 유지·수정 금지. DRY_RUN 추정만 대사씬당 $0.05(레퍼런스 실측) 사용 — 주석으로 출처 명시.
- EpisodeScript 검증 룰(85-95초 등) 변경 금지. game_rounds/DB 계약 안 건드림(이 패키지는 DB 무관).

### 구현 정본

**1) TTS 캐스팅 (src/lib/gemini-tts.ts + stepSceneAudio)**
- GeminiTtsInput 확장: `voiceName?: string`(Gemini prebuilt voice id), `styleOverride?: string` 추가. 지정 시 VOICE_MAP 대신 이 값으로 prompt/speechConfig 구성. 기존 `voice: GeminiVoiceTone` 경로는 그대로(다른 호출자 보호).
- episode-pipeline stepSceneAudio:
  - narration 씬 → 바이블 narrator: voiceName='Kore', styleOverride=narrator.style, speedWpm 130 (기존 Sulafat 'narrator-warm' 대체 — 바이블이 정본).
  - character_speaking 씬 → `resolveVoiceCasting(scene.speakerId)` + `resolveVoiceStyle(scene.speakerId, scene.voiceEmotion)` 로 voiceName/styleOverride 구성. speakerId 없으면 P1의 soft-fill('toto')이 이미 보장.
  - SceneAudio에 `rawTtsPath`(waitBeat 무음·duration 정규화 **전** 원본 wav) 추가 — VEED 입력용. 기존 normalized path는 유지(폴백·내레이션용).

**2) VEED 승격 (veed-fabric.ts + 편집 스테이지)**
- VeedFabricProvider에 `generateSceneFromFiles(input: { imageFilePath: string; audioFilePath: string; resolution: '480p'|'720p' }): Promise<{ videoUrl: string; costUsd: number; elapsedMs: number }>` 추가 — sync-lipsync.ts의 uploadLocalFile 패턴대로 @fal-ai/client `fal.storage.upload` + `fal.subscribe('veed/fabric-1.0')` 사용(긴 작업 큐 안전). costUsd는 오디오 길이(초) × COST_PER_SEC[resolution] 실측 계산.
- 대사씬 합성 (EPISODE_LIPSYNC=veed 기본, limited·premium 공통): 키프레임 PNG + rawTtsPath wav → VEED → mp4 다운로드 → durationSec에 맞춰 정규화(짧으면 tpad=stop_mode=clone 프리즈로 패딩 — waitBeat 침묵 구간 포함, 길면 -t 트리밍) + 페이드 인/아웃 ≥0.3s. premium 모드에서 대사씬은 Seedance 무성영상 호출을 **생략**(비용 격감); 씬 연속성용 last-frame은 VEED 클립에서 추출(기존 extractLastFrame 재사용).
- EPISODE_LIPSYNC=sync → 기존 premium 경로(seedance+syncLipSync) 유지. 'off'/SKIP_LIPSYNC=1 → 기존 오버레이·뻐끔 경로.

**3) 편집 레시피 (ocean-edu 정본)**
- 내레이션씬 오디오: 0.5초 딜레이 후 시작(호흡감) — stepSceneAudio에서 내레이션 normalized wav 생성 시 `adelay=500` 적용 후 apad/-t(대사씬 rawTtsPath에는 절대 딜레이 금지 — 립싱크 어긋남).
- limited-animation.ts: `fadeInSec?`/`fadeOutSec?` 옵션 추가(기본 0.15/0.25 = 현 동작). episode-pipeline이 내레이션씬에 0.4/0.5 전달. 모든 씬 클립(내레이션·대사·VEED)은 concat 전에 페이드 인+아웃 보유 — 하드컷 금지.
- 정규화 승격: normalizeVideo/overlayAudio의 scale/pad 타깃 1280:720 → **1920:1080**(scale=force_original_aspect_ratio=decrease + pad 센터), yuv420p·libx264 crf18·r 24·aac 192k·44100Hz·stereo 유지. concat demuxer 방식 유지. limited-animation 내부 렌더 해상도는 유지 가능(concat 정규화에서 업스케일) — 최종 final.mp4가 1920x1080이면 됨.

**4) 비용 원장**
- EpisodeOutput.perStageCostUsd에 `veed: number` 키 추가(총합 포함). lipsync 키는 sync 폴백용 유지. generate-library-episode-90s.ts의 CostBreakdown 인터페이스에 veed 추가 + estimatedDryRunCost: limited/premium 공통 veed = 3씬 × $0.05 추정, premium의 videoSilent는 내레이션 씬만(≈60초) 기준으로, EPISODE_LIPSYNC=sync일 때만 기존 lipsync 추정 유지. 이 스크립트의 다른 로직(멱등 lookup·insert·리포트) 수정 금지.

**5) 아이 UI 음성 (scripts/gen-village-tts.ts 재작성)**
- collectVoiceLines()의 characterId로 바이블 캐스트 lookup → voiceName=cast.voice, style=`resolveVoiceStyle(characterId, kind)` — kind 매핑: `act.*.intro`→'bright', `act.*.praise`→'excited', `sess.*`(내레이션 라인)→'storytelling'. GeminiTtsProvider 직접 사용 대신 style을 명시 전달(현재 DEFAULT_STYLES 폴백 의존 제거).
- FORCE/ONLY/mp3 변환/manifest 포맷·경로는 그대로. 키 없으면 현재처럼 명확한 한국어 에러로 즉시 종료(메시지에 GOOGLE_API_KEY/GEMINI_API_KEY 둘 다 안내).

**6) 스모크 확장 (scripts/smoke-limited-animation.ts)**
- 기존 스피킹 씬 검증 유지 + 내레이션 씬 1개 렌더 추가(audioDelay 반영된 wav 입력, fadeInSec=0.4/fadeOutSec=0.5) → 산출 mp4 존재 + ffprobe 길이 ≈ 지정 duration(±0.3s) 확인.

## Deliverables
- 대사씬 TTS가 캐릭터별 고정 보이스 + 감정 스타일 문장으로 생성되는 코드 경로(캐스팅 미지정 시 내레이터 폴백).
- VEED 파일 기반 립싱크 경로(기본) + sync/off 폴백 스위치, premium 대사씬 Seedance 생략.
- 내레이션 0.5s 딜레이·전 씬 페이드·1920x1080 concat 정규화.
- veed 비용 원장 + DRY_RUN 추정치 갱신.
- gen-village-tts가 바이블 체계로 재작성(산출 포맷 불변).
- 키리스 스모크(내레이션 케이스 포함) 통과.

## Validation
```bash
npm run lint && npx tsc --noEmit && npm run smoke:limited-animation
```

## Handoff requirements
Return:
- summary
- changed files
- validation result
- known risks
- HUMAN 게이트 명시: ① FAL_KEY/GOOGLE_API_KEY 채운 뒤 ONLY_INDEX=0 ANIMATION_MODE=limited 1편 실생성 → 대사씬 립싱크·캐릭터별 음색·감정 오버라이드 청취 검수 ② veed 실측 비용을 리포트에서 확인해 $0.05/씬 추정과 대조 ③ 아이 UI: gen-village-tts 실행 후 /play 음성 청취(P1-9 키 게이트와 동일).
