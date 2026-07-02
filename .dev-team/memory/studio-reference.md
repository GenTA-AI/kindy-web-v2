# 모리 애니메이터 스튜디오 — 레퍼런스 정수 (ocean-edu-imagen 해부)

> 출처: /Users/jongwonlee/Documents/GenTA/bm/art&science/ocean-edu-imagen (대표가 "그나마 고퀄" 인정한 유일 산출물).
> 원문 사본: `.ai/memory/reference/ocean-edu-PIPELINE_GUIDE.md`, `ocean-edu-style_guide.json`.
> 대표 지시: "감독·기획·작가·배우·편집·음성이 한 번에 돌아가는 애니메이터 팀"을 kindy 엔진으로 구성.

## 1. 음성이 자연스러웠던 3가지 비법 (대표 불만 "음성 어색" 해소 핵심)

1. **캐릭터별 보이스 캐스팅 고정**: Puck(7세女 밝음)/Leda(8세男 여림)/Aoede(9세女 또박)/Fenrir(8세男 슬픔)/Kore(내레이션, EBS톤)/Charon/Despina/Enceladus. 캐릭터당 1보이스 불변.
2. **대사 앞 스타일 지시문 삽입**: "7살 여자아이가 말하는 것처럼 아주 높고 맑은 목소리로... **절대 어른 목소리가 아닌**" — 부정 지시가 특히 효과적. (kindy `gemini-tts.ts` DEFAULT_STYLES에 이미 포팅됨)
3. **씬별 감정 오버라이드**: 메인 캐릭터는 씬마다 bright/serious/excited/storytelling/whisper 스타일을 덮어씀. ← **kindy에 없는 부분.** 현재 episode-pipeline은 캐스팅 없이 단일 톤 → 어색함의 주원인.

추가: kindy /play의 어색함은 별개 원인 — 사전 생성 mp3 부재로 Web Speech(로봇) 폴백 (P1-9). gen-village-tts를 같은 캐스팅 체계로 업그레이드 + 키 확보 후 생성 필요.

## 2. 립싱크 최종 결정 (모델 탐색 이력 포함 — 재실험 금지)

- Kling 립싱크: 한국어 품질 낮음+캐릭터 변형 → 탈락
- Seedance 프롬프트 립싱크: 입모양 랜덤 → 탈락
- **VEED Fabric 1.0 (fal.ai) = 최종**: 키이미지 + **우리 TTS wav** → 립싱크 영상. 음성 일관성 100%, 2D 일러스트 자연스러움, **~$0.05/씬** (현 kindy sync-lipsync $3/min 대비 격감). kindy에 `veed-fabric.ts` provider 이미 존재 — 대사씬 기본 경로로 승격 필요.

## 3. 씬 타입 3종 + 편집 레시피 (아동용 리듬)

- **대사씬(lipsync)**: 키이미지+TTS.wav → VEED. 영상 길이는 TTS에 자동 맞춰짐(트리밍 불필요).
- **내레이션씬**: 키이미지 정지영상 + 페이드 인/아웃, **오디오 0.5초 딜레이 후 시작**(호흡감), 길이=오디오+0.5+0.5. 짧은 영상 재사용 시 setpts 슬로모션(최소 0.5배속).
- **전환씬**: 무음 3초, 페이드 인 0.5s + 아웃 1.0s. **하드컷 금지 — 어린이용 부적합.**
- 정규화 후 concat: scale 1920:1080 패딩, yuv420p, libx264 crf18, aac 192k 44.1kHz stereo → concat demuxer.

## 4. 이미지 일관성 비법

- 나노바나나(Gemini 3 Pro Image)에 **캐릭터 레퍼런스 시트 + 완성된 이전 에피소드 실제 씬 이미지를 동시 참조** + "MUST match the attached reference images EXACTLY".
- 레퍼런스 시트만 넣으면 매번 다르게 나옴 → **승인된 과거 프레임을 두 번째 참조로 축적**하는 피드백 루프가 핵심.

## 5. 스타일 바이블 구조 (style_guide.json — 모리 월드로 포팅할 골격)

project(타겟/내비게이터 캐릭터) · visual_style(overall_tone, color_palette{primary/secondary/mood}, art_direction "NOT photorealistic", character_style, background_style, lighting) · 캐릭터별 {description, visual_prompt_base, **emotions{bright/serious/excited/mysterious→시각 표현}**} · prompt_rules(**mandatory_prefix/suffix, negative_prompt**, aspect_ratio, style_consistency_tags).
모리 월드 값: 크림+세이지 팔레트, 동물마을 캐스트(모리·꾸미·방울·나옹·도토·올빼미), 정본 이미지 public/ip/mori-reference-no-a.jpg, 머리 위 A 금지, 빌런/공포 금지(세계관 캐논).

## 6. 팀 역할 매핑 (대표 지시 → 파이프라인 스테이지)

| 역할 | 스테이지 | kindy 현재 | 필요 작업 |
|---|---|---|---|
| 기획(PD) | 씨앗→에피소드 브리프 | brief-builder·매트릭스 ✅ | 바이블 참조 연결 |
| 작가 | 대본(씬·대사) | claude-director ✅ | **대사별 캐릭터 캐스팅+감정 지정** 스키마 |
| 감독 | 키프레임·스타일 통제 | nano-banana+모리 ref | **바이블 prefix/suffix/negative + 이전 승인 프레임 참조** |
| 배우·음성 | TTS | gemini-tts(스타일 있음) | **캐스팅 소비 + 씬별 감정 오버라이드** |
| 편집 | 립싱크·합성 | sync-lipsync($3/min)·limited | **VEED 승격 + 0.5s 딜레이·페이드·정규화 레시피** |
| QC | 검수 | 없음(published=false만) | **비전 QA 에이전트 리포트**(스타일·일관성·금지어) → HITL 보조 |

## 7. 비용 기준 (레퍼런스 실측)

TTS 무료(preview) · 이미지 무료티어/유료 · VEED ~$0.05/대사씬 · ffmpeg 로컬. 1편(대사 5씬) ≈ $0.25. → 90초 에피소드도 이미지+VEED 기준 ~$1 미만 가능(현 limited 추정 $1.1과 유사하나 대사씬이 진짜 립싱크).

## 8. 키 게이트 (현 상태)

.env.local의 FAL/GOOGLE/ANTHROPIC/GEMINI 키 전부 비어 있음 — 실생성·청취 검증은 대표가 키를 채운 뒤에만 가능. 코드 검증은 DRY_RUN·프롬프트 조립 스모크·기존 smoke:limited-animation으로 keyless 수행.
