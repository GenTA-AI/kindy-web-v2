# Review: studio-director-qc-runner

## decision
approve

## critical
- (none)

## should_fix
- 러너 `insertLibraryVideo`(scripts/animate-episode.ts:341)는 레거시 `generate-library-episode-90s.ts`가 가진 (a) 멱등성 조회(title/topic/age_band/episode_unit_sec로 기존 행 확인)와 (b) 마이그레이션 0021 `video_path` 컬럼 프리플라이트가 빠져 있다. INSERT_DB=1은 HUMAN 게이트라 검증 블로커는 아니지만, 재실행 시 같은 에피소드가 중복 insert되고, 0021 미적용 DB에서는 $1 상당 유료 생성이 끝난 뒤 insert 단계에서만 실패한다. 스펙의 명시 계약(동일 컬럼·published=false·buildSceneRows 동등)은 충족하나, 다음 사이클 batch 흡수 시 이 두 가드를 함께 러너로 이관 권고.

## nice_to_have
- QC를 `runStage`로 감싸므로 `runEpisodeQc`가 던지는 유일한 예외(키 부재)는 스테이지를 'failed'로 만들고 re-throw되어 insert 이전에 런을 중단시킨다. 실전에서는 nano-banana가 먼저 GOOGLE_API_KEY를 요구해 이 경로가 도달 불가라 무해하나, "QC는 어떤 경우에도 파이프라인을 중단하지 않는다"를 완전히 보장하려면 키 부재도 warn 스테이지로 흡수 고려.
- stepCharacterRef가 이제 `referenceImagePaths.slice(0, 4)`로 캡하고 누락 검사도 캡된 목록에 적용한다. 현재 정본 레퍼런스는 1장(MORI_REFERENCE_IMAGE)이라 무영향이나, P2 대비 미세 동작 변화.
- `styleReferenceFrom`이 animal_village style_tags(story_forest/direct_mobile 등 라벨맵 미등록)를 원문 그대로 "Scene mood:"에 넣는다 — 레거시 스크립트와 동등한 동작이라 스코프 밖이지만 의미상 잡음.

## validation_notes
- **감독 배선(§1)**: episode-pipeline diff 정독 — 변경은 import 2줄(wrapWithPromptRules, listApprovedFrames), stepCharacterRef, stepKeyframe, runEpisodePipeline 키프레임 루프뿐. TTS/편집/VEED 함수 무침범(P2 결과 보존). stepKeyframe refs = `[refPath, ...listApprovedFrames(2), prevKeyframe?].slice(0,4)` → 캡 4 확인. "previously APPROVED production frames. Match them EXACTLY." 문장 추가 확인. 두 스텝 모두 promptCore를 wrapWithPromptRules(prefix+suffix+styleTags+NEGATIVE)로 감쌈. listApprovedFrames는 디렉토리 부재/limit<=0 시 [] 반환, 파일명 내림차순(b.localeCompare(a)), 이미지 확장자+isFile 필터, 순수 fs·키 불필요.
- **QC 논블로킹(§2)**: overall='fail'/'warn'은 예외를 던지지 않고 QcReport 반환 → runStage가 status만 기록하고 값 반환, insert_db로 진행 → published 게이트(항상 false) 불변. 루브릭에 FORBIDDEN_CANON(머리 위 A·떠 있는 글자·텍스트·워터마크·공포·빌런·photorealistic) + captions/logos/UI/sharp teeth/violence/predators/realistic humans 포함. parseJsonObject 관대(펜스 제거→substring 폴백→실패 시 fallbackReport, raw 보존, overall='warn'). 키 부재 시에만 throw(스펙 명시와 일치). REST가 v1beta generateContent?key= + inline_data(mime_type/data) + responseModalities:['TEXT']로 nano-banana 패턴 정합.
- **러너 keyless(§3)**: DRY_RUN 분기가 파이프라인/QC/insert 호출 전 조기 return. 유일한 Supabase 접점은 insertLibraryVideo 내부 `await import('../src/lib/supabase')` 동적 import(라인 342/353) — 모듈 스코프 클라이언트 0. qa-agent/approved-frames/animate-episode 전부 module-scope에서 외부 클라이언트·env 접근 없음(grep 확인). 스테이지 리포트 {name,status,elapsedMs,costUsd,artifacts} 완비. INSERT_DB 미지정 시 insert_db 'skipped', DB 무접촉. insert 컬럼이 레거시와 1:1 동일(scenes=buildSceneRows, episode_unit_sec=90, c6_focus, *_path, published=false, featured=false). buildSceneRows·toVideoBrief·styleReferenceFrom 레거시와 동일 구현.
- **레거시 주석(§4)**: generate-library-episode-90s.ts diff는 상단 주석 2줄만 — 동작 diff 0.
- **비용 추정(§5)**: estimatedDryRunCost가 레거시와 동일(limited: 0.8+0.039+6×0.039+0.03+veed(3×0.05)=1.253). validation.log·report.json 모두 estimated_total=$1.25 확인.
- **게이트/스코프**: validation_exit=0(lint+tsc+keyless DRY_RUN, report.json 생성). out-of-scope.txt는 사전 존재 키오스크 문서 2건뿐 — 실 스코프 클린. package.json 무변경(새 deps 0), 새 마이그레이션 0, approved-frames/ 디렉토리에 README.md만(커밋된 바이너리·시크릿 0). Invariants: published HITL·보이지 않는 AI·머니코드/인증 무침범·RLS 무변경·playsInline 무관 — 위반 없음.
</content>
</invoke>
