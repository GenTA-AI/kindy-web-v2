# Package: studio-director-qc-runner

## Objective
감독·QC·러너로 스튜디오를 완성한다: ① 키프레임/캐릭터ref 프롬프트에 바이블 prefix/suffix/negative를 강제하고, **사람이 승인한 과거 프레임을 참조로 축적**하는 피드백 루프(이미지 일관성 비법)를 배선 ② 생성된 키프레임+대본을 Gemini 비전으로 검수하는 QC 에이전트(스타일·캐릭터 일관성·금지 요소·5-7세 적합성 → qc-report.json, HITL 보조) ③ 기획→작가→감독→배우→편집→QC 전 스테이지를 한 명령으로 돌리는 러너 `scripts/animate-episode.ts`(스테이지별 로그·비용·산출 경로, DRY_RUN 키리스).

## Scope
- `src/lib/episode-pipeline.ts` (stepCharacterRef/stepKeyframe 프롬프트에 wrapWithPromptRules 적용 + 승인 프레임 참조 추가만 — TTS/편집 로직 수정 금지, P2 결과 보존)
- NEW: src/lib/studio/approved-frames.ts
- NEW: src/lib/studio/qa-agent.ts
- NEW: src/content/studio/approved-frames/README.md
- NEW: scripts/animate-episode.ts
- `scripts/generate-library-episode-90s.ts` (파일 상단 주석에 "신규 배치는 scripts/animate-episode.ts 사용, 이 스크립트는 리포트 호환용 레거시" 안내 1-3줄 추가만 — 동작 변경 금지)
- `src/content/studio/animal-village-bible.ts` (읽기 전용 — promptRules/wrapWithPromptRules 소비)
- `scripts/library-matrix-90s.ts` (읽기 전용 — LIBRARY_MATRIX_ANIMAL_VILLAGE 소비)
- `src/lib/video-providers/nano-banana.ts` (읽기 전용 — REST 패턴 참고, 수정 금지)

## Constraints
- **published 게이트는 기존 HITL 유지** — QC는 보조 리포트일 뿐, published=false 기본과 사람 승인 절차를 바꾸지 말 것. QC 결과가 fail이어도 파이프라인을 중단시키지 않는다(리포트에 기록).
- DRY_RUN은 **키·.env.local 없이** exit 0 — DRY_RUN 경로에서 Anthropic/Google/fal/Supabase 클라이언트를 생성하지 말 것(dotenv/config는 파일 없어도 무해). Validation 게이트가 이 조건 그대로 실행한다.
- 시크릿/.env 접근 금지, db push 금지. INSERT_DB=1(키 필요)은 HUMAN 단계 — Validation에 넣지 말 것.
- 새 npm 의존성 금지. 새 마이그레이션 금지 — insert는 기존 library_videos 컬럼만 사용(0013/0020/0021 계약: scenes, episode_unit_sec=90, c6_focus, video_path/thumbnail_path/subtitles_path, published=false, featured=false).
- 세계관 캐논: QC 금지 요소 체크리스트에 머리 위 A·떠 있는 글자·워터마크·공포/빌런·photorealistic 포함(바이블 negativePrompt에서 도출).
- nano-banana 참조 이미지는 요청당 최대 4장(캐릭터ref 1 + 승인 프레임 최대 2 + 직전 씬 키프레임 1)으로 캡 — 페이로드 폭주 방지.
- 머니코드·인증·/api·아이 UI 범위 밖.

### 구현 정본

**1) 감독 — 바이블 프롬프트 + 승인 프레임 축적**
- NEW `src/lib/studio/approved-frames.ts`: `listApprovedFrames(limit = 2): string[]` — `src/content/studio/approved-frames/` 의 png/jpg를 파일명 내림차순(최신 우선)으로 절대경로 반환, 디렉토리 없음/빈 경우 `[]`. 순수 fs, 키 불필요.
- NEW `src/content/studio/approved-frames/README.md`: 운영 규칙 문서 — "대표/검수자가 승인한 최고 품질 프레임을 `YYYYMMDD-<slug>-sNN.png` 이름으로 복사해 커밋. 최신 2장이 다음 생성의 스타일 앵커로 자동 첨부됨."
- episode-pipeline stepCharacterRef: 프롬프트 코어를 `wrapWithPromptRules(...)`로 감싸기(기존 시트 요구사항 유지). stepKeyframe: 프롬프트 코어를 wrapWithPromptRules로 감싸고, refs 배열을 `[characterRef, ...listApprovedFrames(2), 직전 씬 keyframe(있으면)]`(캡 4)으로 확장 + "The attached references are the canonical character sheet and previously APPROVED production frames. Match them EXACTLY." 문장 추가(nano-banana의 CONSISTENCY_SUFFIX와 중복돼도 무해).

**2) QC 에이전트 — NEW src/lib/studio/qa-agent.ts**
- `runEpisodeQc(input: { script: EpisodeScript; keyframePaths: string[]; workDir: string }): Promise<QcReport>` — GOOGLE_API_KEY(또는 GEMINI_API_KEY)로 Gemini `gemini-2.5-flash` generateContent REST 1회 호출(nano-banana의 REST 패턴, responseModalities TEXT): 키프레임 전체 inline_data + 대본 텍스트 + 루브릭.
- 루브릭(바이블에서 조립): ① visual_style 준수(크림+세이지, picture-book, NOT photorealistic) ② 모리·캐릭터 일관성(씬 간 동일 외형) ③ 금지 요소(머리 위 A/떠 있는 글자/텍스트/워터마크/공포·빌런 표현) ④ 5-7세 적합성 — 대본에 위협·재촉·평가 어휘("틀렸어","빨리 해" 류) 없음, 질문·기다림 박자 존재.
- `QcReport { overall: 'pass'|'warn'|'fail'; scenes: Array<{ index; verdict: 'pass'|'warn'|'fail'; notes: string[] }>; forbidden: string[]; summaryKo: string; model: string; costUsd: number; checkedAt: string }` — 관대한 JSON 파싱(실패 시 overall='warn' + raw 보존), `<workDir>/qc-report.json` 저장. 검수 실패는 예외를 던지지 않는다(키 부재 시에만 명확한 에러).

**3) 러너 — NEW scripts/animate-episode.ts**
- 실행: `npx tsx --env-file=.env.local scripts/animate-episode.ts` (스크립트 자체는 `import 'dotenv/config'` — env-file 없이도 동작). 옵션(env): `ONLY_INDEX`(기본 0, LIBRARY_MATRIX_ANIMAL_VILLAGE 인덱스), `DRY_RUN=1`, `EPISODE_ANIMATION_MODE`(기본 limited), `EPISODE_LIPSYNC`, `SKIP_QC=1`, `INSERT_DB=1`.
- 스테이지: ① 기획 — 매트릭스 spec → VideoBrief(기존 generate-library-episode-90s의 toVideoBrief와 동일 매핑을 러너 안에 구현: topic_subject/age_band/learning_goals/styleReference/protagonist_hint/reference_image_paths) ② 작가→감독→배우→편집 = `runEpisodePipeline` 1회 호출(내부 스테이지) ③ QC = runEpisodeQc(SKIP_QC=1이면 생략) ④ 리포트 — 스테이지별 {name, status, elapsedMs, costUsd, artifacts[]} 콘솔 표 + `tmp/studio/<slug>/report.json` 저장(workDir도 tmp/studio/<slug>) ⑤ INSERT_DB=1일 때만 library_videos insert(기존 스크립트와 동일 컬럼·published=false·buildSceneRows 동등 로직 러너 내 구현) — 미지정 시 DB 무접촉.
- DRY_RUN=1: 선택된 spec, 스테이지 계획, 모드별 추정 비용(P2의 추정 로직과 동일 가정: 대사씬 veed $0.05/씬 등), 산출 예정 경로만 출력하고 종료 — 어떤 외부 클라이언트도 생성 금지, exit 0.
- 정리 방향(중복 유지보수 방지): 러너가 유일한 신규 진입점이며, generate-library-episode-90s.ts는 상단 레거시 주석만 추가하고 그대로 둔다(기존 리포트/멱등 소비자 보호). 다음 사이클에서 batch 모드(LIMIT_COUNT 루프)를 러너로 흡수하는 것을 Handoff에 권고로 남길 것.

## Deliverables
- 키프레임·캐릭터ref 프롬프트가 바이블 prefix/suffix/negative + 승인 프레임 참조(최신 2장, 캡 4)로 생성되는 코드 경로.
- qa-agent + qc-report.json 산출(HITL 보조, 논블로킹).
- animate-episode 러너: 한 명령 전 스테이지 + 스테이지별 로그·비용·경로 리포트 + DRY_RUN 키리스 + 옵션 INSERT_DB.
- approved-frames 디렉토리 규약(README) + 로더.
- generate-library-episode-90s 레거시 안내 주석.

## Validation
```bash
npm run lint && npx tsc --noEmit && DRY_RUN=1 npx tsx scripts/animate-episode.ts
```

## Handoff requirements
Return:
- summary
- changed files
- validation result
- known risks
- HUMAN 게이트 명시: ① 키 채운 뒤 `ONLY_INDEX=0 npx tsx --env-file=.env.local scripts/animate-episode.ts` 풀 생성 → 영상·음성·qc-report 사람 검수 ② 잘 나온 프레임을 approved-frames/에 커밋(축적 루프 시작) ③ INSERT_DB=1 재실행으로 published=false 등록 → 기존 HITL 승인 절차 ④ 권고: 다음 사이클에서 batch 루프를 러너로 흡수.
