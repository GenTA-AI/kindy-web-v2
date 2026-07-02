# Package: studio-bible-casting

## Objective
ocean-edu-imagen의 style_guide.json 골격을 "모리 동물마을 스튜디오 바이블"로 포팅한다: 시각 스타일(크림+세이지 실팔레트), 캐스트 6인(캐릭터별 고정 보이스 + 어린이 음색 지시문 + 씬별 감정 어휘 5종), 내레이터(Kore), 프롬프트 규칙(prefix/suffix/negative). 그리고 작가(대본) 단계가 이 바이블을 쓰도록 EpisodeScene 스키마에 대사별 화자·감정 필드를 (하위호환으로) 추가하고 EPISODE_SYSTEM_PROMPT를 갱신한다. 음성 어색함의 원인 = "캐스팅 없는 단일 톤 TTS"이며, 이 패키지가 그 캐스팅 정본을 만든다(소비는 다음 패키지).

## Scope
- NEW: src/content/studio/animal-village-bible.ts
- NEW: src/content/studio/animal-village-bible.test.ts
- `src/lib/video-providers/director.types.ts` (EpisodeScene에 옵션 필드 + EpisodeVoiceEmotion 타입 추가만)
- `src/lib/episode-pipeline.ts` (EPISODE_SYSTEM_PROMPT/buildEpisodeUserPrompt + normalizeEpisodeScene/validateEpisodeScript의 신규 필드 파싱만 — TTS/편집/키프레임 스테이지 함수는 이 패키지에서 수정 금지)
- `src/lib/video-providers/claude-director.ts` (SYSTEM_PROMPT에 동물마을 캐스팅 표+감정 어휘 추가만)
- `src/data/worlds/animal-village.ts` (읽기 전용 — CHARACTERS 캐스팅 정합 참조)
- `src/lib/video-providers/types.ts` (읽기 전용 — CharacterVoice import)
- `src/lib/video-providers/gemini-tts.ts` (읽기 전용 — DEFAULT_STYLES 문체 참고)

## Constraints
- **대표 3기준**: 애플급 미니멀 / 보이지 않는 AI / 초개인화. 이 패키지는 전부 내부 파이프라인 코드 — 고객 표면 문구 없음. 유지할 것.
- **세계관 캐논(위반 금지)**: 빌런·포식자·공포·위협적 어둠 금지. 갈등은 감정·관계·자연뿐. 5세 어휘. 모리 정본 이미지는 `public/ip/mori-reference-no-a.jpg`이며 **머리 위 글자 A·떠 있는 문자·로고·워터마크 절대 금지**.
- **캐스팅은 `src/data/worlds/animal-village.ts`의 CHARACTERS와 완전 일치**(id·이름·보이스): toto/모리=Puck, kkumi/꾸미=Fenrir, bangul/방울=Aoede, naong/나옹=Despina, doto/도토=Leda, owl/올빼미 할아버지=Enceladus. 내레이터=Kore(EBS 어린이 톤). 이 매핑을 바꾸지 말 것 — 이미 배포된 아이 UI 음성 체계와 같은 축이다. (실파일과 다르면 실파일이 정본 — 정찰 후 표를 실값으로 맞춰라.)
- **하위호환**: EpisodeScene 신규 필드는 전부 옵션. 기존 EpisodeScript(신규 필드 없는 JSON)가 validateEpisodeScript를 계속 통과해야 한다. 기존 구조 룰(4-7씬, 85-95초, cuts/min 3-6, speaking 2-3, waitBeat 질문 1개)은 변경 금지.
- 머니코드·인증·/api·아이 UI 컴포넌트 수정 금지. 새 npm 의존성 금지. 시크릿/.env 접근 금지. main 푸시 금지.
- 팔레트는 실제 디자인 토큰(`src/app/globals.css`)에서 가져온 아래 값 사용 — 임의 색 발명 금지.

### 바이블 정본 내용 (이대로 구현)
`src/content/studio/animal-village-bible.ts` — 타입 + 상수 + 순수 헬퍼만(외부 API 호출 없음):

```ts
// director.types.ts에 추가할 타입 (바이블이 import)
export type EpisodeVoiceEmotion = 'bright' | 'serious' | 'excited' | 'storytelling' | 'whisper';
```

- `StudioEmotionSpec { visual: string; voiceStyle: string }`
- `StudioCastMember { id; nameKo; description; visualPromptBase(영어); voice: Exclude<CharacterVoice,'auto'>; voiceStyle(한국어 지시문); emotions: Record<EpisodeVoiceEmotion, StudioEmotionSpec> }`
- `StudioBible { project; visualStyle; cast: StudioCastMember[]; narrator: { voice: 'Kore'; style: string }; promptRules }`
- `export const ANIMAL_VILLAGE_BIBLE: StudioBible`

visualStyle (globals.css 실토큰):
- colorPalette.primary(세이지 계열): sage #5F735F, saged #3F5140, sages #AFC4AE, sagebg #DDE8DE, mist #F0F3EE
- colorPalette.secondary(웜 베이스): cream #FBF7EF, deep #EEE5D4, line #E3D8C8, gold #D19A43, surface #FFFFFF
- artDirection: "2D stylized illustration with soft gradients and rounded shapes. Children's picture book meets modern animation concept art. NOT photorealistic, NOT 3D render."
- characterStyle: "cute round animal friends with expressive large eyes, simple facial features, soft fluffy bodies, clearly drawn mouths" / backgroundStyle: "warm storybook forest village — rolling hills, heart-tree, story library, starlight festival lanterns, layered soft depth" / lighting: "warm sunlight and gentle lantern glow, soft shadows, no harsh contrast"

캐스트 6인 (성격은 세계관 스펙 캐논):
| id | nameKo | voice | description 요지 | voiceStyle 요지 |
|---|---|---|---|---|
| toto | 모리 | Puck | 책정령 호스트. 유일하게 화면 밖 아이를 보는 다정한 안내자. 크림색 보송한 몸, 세이지 스카프, 큰 잎/책장 귀, 작고 자신감 있는 미소 | "7살 아이처럼 아주 높고 맑은 목소리로, 밝고 다정하게. 아이에게 말 걸듯 또박또박. 절대 어른 목소리가 아닌." |
| kkumi | 꾸미 | Fenrir | 아기 곰 주인공. 수줍고 마음 여린(여림↔씩씩), 슬픔·위로 담당 | "8살 남자아이가 힘없이 천천히 말하듯, 높지만 살짝 가라앉은 목소리. 수줍고 여린 느낌. 절대 어른 목소리가 아닌." |
| bangul | 방울 | Aoede | 활발한 강아지. 질문 던지는 친구, 너무 신나면 앞서 달림. 기쁨·자기조절 | "9살 여자아이가 신나서 조잘대듯 높고 맑은 목소리. 질문 많고 활기찬 톤, 또박또박. 절대 어른 목소리가 아닌." |
| naong | 나옹 | Despina | 새침하지만 속정 깊은 고양이. 닮은점 찾는 친구. 부끄러움·우정 | "8살 여자아이가 조심스럽게 말하듯 높고 가는 목소리. 새침한데 다정함이 배어나는 톤. 절대 어른 목소리가 아닌." |
| doto | 도토 | Leda | 겁 많고 잘 숨는 다람쥐. 두려움·용기 | "8살 남자아이가 걱정하며 말하듯 높고 여린 목소리. 조금 떨리듯 조심스러운 톤. 절대 어른 목소리가 아닌." |
| owl | 올빼미 할아버지 | Enceladus | 밤의 지혜, 도입·마무리 이야기꾼 | "10살 남자아이가 차분하고 깊게 이야기하듯, 살짝 낮지만 어린이 음색. 천천히 또박또박. 절대 어른 목소리가 아닌." |

narrator: Kore — "어린이 교육 방송 여자 내레이터처럼 따뜻하고 차분하며 신뢰감 있게. EBS 어린이 프로그램 내레이션 느낌으로 또박또박." (문체는 video-providers/gemini-tts.ts DEFAULT_STYLES 참고 — 부정 지시 "절대 어른 목소리가 아닌"이 핵심 비법)

emotions 5종 — 캐스트 전원에 채움. 기준값(캐릭터 성격에 맞게 미세 변형 허용): bright={visual:"sparkling eyes, wide warm smile, light bounce", voiceStyle:"밝고 신나게, 웃음기를 담아"} · serious={"focused eyes, small closed mouth, leaning in","차분하고 진지하게, 조금 느리게"} · excited={"wide open eyes, ears up, big open smile","들뜬 목소리로 빠르고 높게, 감탄하듯"} · storytelling={"gentle gesture toward the listener, soft eyes","옛날이야기 들려주듯 부드럽고 리듬감 있게"} · whisper={"paw near mouth, hushed pose","비밀을 말하듯 아주 작게 조심스럽게 속삭이며"}

promptRules:
- mandatoryPrefix: "Children's picture-book animation concept art, 2D stylized illustration, warm cream and sage green palette,"
- mandatorySuffix: "soft warm lighting, rounded gentle shapes, cozy storybook forest village, safe and warm mood, high quality, detailed"
- negativePrompt: "photorealistic, 3D render, scary, horror, dark shadows, villain, predator, sharp teeth, violence, letter A above head, floating letters, any text, captions, subtitles, logo, watermark, UI elements, realistic human"
- aspectRatio: '16:9', styleConsistencyTags: ["children's picture book style","soft gradient shading","cream and sage color harmony","cute round animal friends","warm storybook forest village"]

순수 헬퍼 export (P2/P3가 소비):
- `getCastMember(id: string): StudioCastMember | null`
- `resolveVoiceCasting(speakerId?: string): { voice: Exclude<CharacterVoice,'auto'>; style: string }` — 미지정/미매칭이면 narrator(Kore) 반환
- `resolveVoiceStyle(speakerId: string | undefined, emotion?: EpisodeVoiceEmotion): string` — 캐스트 기본 voiceStyle + (emotion 있으면) 해당 emotions[e].voiceStyle 문장 결합
- `wrapWithPromptRules(core: string): string` — prefix + core + suffix + styleConsistencyTags + "NEGATIVE (must NOT appear): " + negativePrompt

### 작가 캐스팅 스키마 + 프롬프트 갱신
- `director.types.ts`: `EpisodeVoiceEmotion` export + EpisodeScene에 `speakerId?: string`(캐스트 id), `voiceEmotion?: EpisodeVoiceEmotion` 옵션 추가. 다른 타입 변경 금지.
- `episode-pipeline.ts` EPISODE_SYSTEM_PROMPT: 바이블 캐스트 표(id·이름·성격·고정 voice)를 프롬프트에 주입(바이블 상수에서 조립, 모듈 로드 시 1회 — cache_control 유지). 룰 추가: ① characters[0]은 반드시 모리(toto) ② 모든 character_speaking 씬은 `speakerId`(캐스트 id 중 하나)와 `voiceEmotion`(bright|serious|excited|storytelling|whisper 중 하나)을 반드시 지정 ③ 대사는 그 캐릭터 성격대로 ④ 5-7세 몰입 훅 유지: direct question 씬 + waitBeatSec 2-3, 내레이션 130wpm, 현실 연결. 기존 구조 룰·JSON 스키마 서술에 두 필드 추가. buildEpisodeUserPrompt에도 캐스트 사용 지시 1줄.
- normalizeEpisodeScene: speakerId(string, 캐스트 id 아니면 undefined로 관대 처리)·voiceEmotion(5종 아니면 undefined) 파싱. validateEpisodeScript: character_speaking인데 speakerId 없으면 'toto', voiceEmotion 없으면 'bright'로 **soft-fill**(에러 금지 — Opus variance 흡수 컨벤션 유지).
- `claude-director.ts` SYSTEM_PROMPT: "동물 마을(모리) 세계관 브리프일 때 캐스팅 고정" 표 + 씬 emotion 어휘 5종 권장 문단 추가. 기존 일반 voice pool 서술은 유지(비-동물마을 브리프용).

## Deliverables
- 바이블 모듈 + 정합 테스트: 캐스트 id/voice가 animal-village.ts CHARACTERS와 일치, 전원 voiceStyle에 "절대 어른" 포함, 전원 emotions 5키 완비, negativePrompt에 letter A·text·watermark·photorealistic·horror 포함, wrapWithPromptRules가 prefix/suffix/negative를 모두 포함, resolveVoiceCasting(undefined)=Kore.
- EpisodeScene 옵션 필드 + 파서 soft-fill. 신규 필드 없는 기존 스크립트도 통과.
- EPISODE_SYSTEM_PROMPT·claude-director SYSTEM_PROMPT가 바이블 캐스트·감정 어휘를 강제/안내.
- lint/typecheck/테스트 통과.

## Validation
```bash
npm run lint && npx tsc --noEmit && npx tsx --test src/content/studio/animal-village-bible.test.ts
```

## Handoff requirements
Return:
- summary
- changed files
- validation result
- known risks
- 명시할 것: 실제 대본 생성 품질 확인(ANTHROPIC_API_KEY 필요)은 HUMAN 단계 — P3 러너의 DRY_RUN 이후 키 게이트에서 수행.
