# Review: studio-bible-casting

## decision
approve

## critical
- (none)

## should_fix
- (none)

## nice_to_have
- `episode-pipeline.ts` `buildSubtitlesVtt` 는 아직 `mainCharacter(script).displayName ?? '미리'` 폴백을 씀(구 해양월드 잔재). 이제 EPISODE_SYSTEM_PROMPT 가 characters[0]=모리(toto)로 하드코딩되어 displayName 은 항상 존재하므로 무해하나, 폴백 문자열을 '모리'로 바꾸면 세계관 일관성이 더 깔끔. (이 패키지 편집 스테이지 수정 금지 범위라 손대지 않은 것은 옳음.)
- 아키텍처 관찰(비블로킹): EPISODE_SYSTEM_PROMPT 가 이제 모든 episode 실행을 동물마을 캐스트로 고정하고, soft-fill 도 'toto'/'bright'로 채운다. 스펙 의도대로(episode-pipeline = 동물마을 정본)지만, 향후 비-동물마을 episode 가 필요해지면 이 결합을 재검토해야 함. 현재는 speakerId/voiceEmotion 을 소비하는 코드가 없어(TTS 는 여전히 고정 'narrator-warm'/'character-bright') 순수 메타로 무해.

## validation_notes
- **캐스팅 정합 (실파일 대조)**: `src/data/worlds/animal-village.ts` CHARACTERS 실값과 바이블 cast 를 id·voice 순서까지 1:1 대조 — toto=Puck, kkumi=Fenrir, bangul=Aoede, naong=Despina, doto=Leda, owl=Enceladus 전부 일치. 테스트가 `deepEqual`(순서 포함)로 강제하며 `Object.values(CHARACTERS)` 삽입순서 == 바이블 배열순서로 통과. voice 는 전부 `Exclude<CharacterVoice,'auto'>` 유효 리터럴. 내레이터 = 'Kore'.
- 전원 voiceStyle 에 "절대 어른 목소리가 아닌" 포함(6/6). emotions 는 `emotions()` 헬퍼가 BASE 5키를 항상 조립하고 override 는 Partial 이라 키 삭제 불가 → 전원 5키(bright/serious/excited/storytelling/whisper) 완비, 각 visual+voiceStyle 존재. 테스트 검증됨.
- **하위호환**: EpisodeScene 신규 필드 speakerId?/voiceEmotion? 모두 옵션(diff 확인). normalizeEpisodeScene 은 비-캐스트 id → undefined, 비-5종 emotion → undefined 로 관대 파싱하고 spread 로만 주입(누락 시 필드 부재). validateEpisodeScript 는 character_speaking 씬에 한해 speakerId ?? 'toto', voiceEmotion ?? 'bright' soft-fill(에러 없음). 기존 구조 룰(4-7씬·85-95초·cuts 3-6·speaking 2-3·narration 4-5·waitBeat 2-3 정확히 1개)은 diff 상 무변경 → 신규 필드 없는 기존 스크립트 계속 통과.
- **프롬프트 주입**: ANIMAL_VILLAGE_CASTING_TABLE/EMOTION_WORDS 는 모듈 로드 시 1회 조립되는 const 이고 EPISODE_SYSTEM_PROMPT(모듈 상수 템플릿)에 1회 interpolate — 요청마다 재조립 아님. directEpisodeScript 는 이 상수를 cache_control:ephemeral 로 캐싱(불변 prefix 유지). claude-director SYSTEM_PROMPT(모듈 const, line 46 / cache_control line 195-196)에 동물마을 캐스팅 문단을 조건부("동물 마을 세계관 브리프일 때")로 추가하고 기존 일반 voice pool 서술 유지 → 비-동물마을 브리프 경로 무해.
- **바이블 충실도**: 팔레트 9색 전부 `src/app/globals.css` 실토큰과 정확 일치(sage/saged/sages/sagebg/mist/cream/deep/line/gold), surface=#FFFFFF. negativePrompt 에 photorealistic·letter A above head·any text·watermark·horror·villain·predator·sharp teeth 포함(테스트 5어휘 검증). wrapWithPromptRules 는 prefix+core+suffix / Style consistency: tags / NEGATIVE (must NOT appear): negativePrompt 3줄 전부 조립. 순수 모듈(외부 API/부수효과 0, 타입+상수+순수 헬퍼만). resolveVoiceCasting(undefined)→{voice:'Kore', narrator.style}.
- **P2/P3 무침범**: episode-pipeline.ts diff 는 imports·모듈 const·EPISODE_SYSTEM_PROMPT·buildEpisodeUserPrompt·validateEpisodeScript(씬 매핑)·normalizeEpisodeScene(+2 헬퍼)만. stepSceneAudio/stepCompositeScene/stepKeyframe/stepSilentVideo/stepCharacterRef/normalize·overlay·concat 등 TTS·편집·키프레임 스테이지 함수 무수정 확인.
- **게이트 독립 재현**: `npx tsx --test src/content/studio/animal-village-bible.test.ts` → 5/5 pass. `npx tsc --noEmit` → exit 0. `npx eslint` (5개 변경파일) → exit 0. 신규 npm 의존성 0, 시크릿/.env 접근 0.
- **스코프**: 선언 스코프 내 실변경만(bible.ts/test 신규, director.types.ts/episode-pipeline.ts/claude-director.ts). scope_ok flagged 2건은 리포 루트 사용자 키오스크 .md 문서(워커 무관 pre-existing) — 실 스코프 클린 확인. 실제 대본 생성 품질(ANTHROPIC_API_KEY)은 스펙대로 HUMAN 게이트.
