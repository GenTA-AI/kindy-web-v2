# KINDY 7–10세 통합 인문 교육 제품·AI 제작 로드맵

작성: 2026-07-12  
상태: 리서치 권고안 — 대표 결정 전, 구현 정본 아님  
범위: 인문·예술·정서·창의·독서를 연결하는 7–10세용 수업 제품, 학습 증거, 영상 제작 스택

---

## 0. 결론

KINDY의 핵심 방향은 맞다.

- 명화·고전·음악을 **목적이 아니라 생각을 여는 자극물**로 쓰는 포지셔닝은 차별화된다.
- 원화·승인 키프레임을 먼저 잠그고 짧은 I2V 샷을 만드는 `mori-studio`의 다단계 제작 방식도 최신 연구·현업 흐름과 맞다.
- 사실 근거, 저작권 출처, 원화 충실도, 결정론 게이트를 먼저 두는 방식은 유지해야 한다.

그러나 현재 제품 단위가 잘못되어 있다. `3–5분 선형 영상`은 좋은 문화 경험이 될 수 있지만, 인문·정서·창의·독서 역량의 향상을 입증할 수는 없다. 제품 단위를 다음 순환으로 바꿔야 한다.

> **관찰 → 질문 → 근거 찾기 → 읽기 → 표현·실행 → 피드백·수정 → 지연 회상·전이**

따라서 다음 병목은 더 화려한 영상 모델이 아니다. 우선순위는 다음 네 가지다.

1. 영역별 학습 목표와 증거가 들어간 `LearningSessionSpec v2`
2. 실제 글 읽기·이유 말하기·그림/글/말 산출물을 받는 수업 플레이어
3. 완주·선택과 실제 학습 증거를 분리하는 evidence ledger
4. 모델 버전·입력 역할·QC·후보 선택을 실제로 운영하는 제작 control plane

트랙 B 영상은 폐기하지 않는다. 완성된 영상을 **15–25분 수업 안의 6–10분 자극물**로 재사용한다.

---

## 1. 현재 상태 진단

### 1-1. 잘된 부분

| 영역 | 현재 자산 | 판단 |
|---|---|---|
| 인문·예술 자극물 | 쇠라 파일럿, 원화 CC0 기록, 사실 `fact_refs`, 원화 충실도 검사 | 강함 |
| 제작 방식 | 대본 → 콘티 → 승인 키프레임 → I2V → 결정론 QC → 인간 선택 | 방향 맞음 |
| 정서·창의 커리큘럼 | CASEL-5 + 창의 6단계 척추 | 좋은 출발점 |
| 아동 UX 기반 | 씬 그래프, 음성 프롬프트, 큰 선택 UI, 다이아몬드 분기 | 재사용 가치 높음 |
| 실험 자산 | append-only 실험 원장, 기각·오판 기록 | 증거 생산 기반으로 적합 |

### 1-2. 교육 제품으로 부족한 부분

| 영역 | 현재 문제 | 필요한 전환 |
|---|---|---|
| 인문 트랙 | 계획상 초등 트랙이 `인터랙션 없는 3–5분 선형 영상` | 선형 영상을 관찰·대화·읽기·창작 세션 안으로 이동 |
| 통합 목표 | 교육 척추가 실제로는 정서+창의 두 축 | 인문·예술·독서를 별도 outcome contract로 추가 |
| 독서 | 연결된 실제 텍스트, 읽기 수준, 요지·추론·근거 과제가 없음 | 아이가 실제로 읽는 passage와 처음 보는 전이 지문 추가 |
| 응답 | `emotion/clue/creative` 선택지만 있고 자유 말·글·그림·수정 계약이 없음 | response mode, artifact, rubric, assistance 계약 추가 |
| 측정 | 선택/완료를 역량 증거로 환산 | 노출·참여·근접과제·전이·지연 검사를 분리 |
| 제작 자동화 | 라우터는 하드코딩, 레지스트리·샷 팬아웃·본 파이프라인은 stub | 실제 registry, canary, failover, provenance 구현 |

근거가 되는 현행 파일:

- 트랙 B는 [08_HUMANITIES_TRACK.md](../plan/08_HUMANITIES_TRACK.md#L153)에서 `인터랙션 없음`, `3–5분 선형`으로 정의돼 있다.
- 교육 척추는 [teaching-spine.md](../curriculum/teaching-spine.md#L10)에서 모든 세션을 정서 1 + 창의 1로만 정의한다.
- 현행 타입은 [interactive-session.ts](../../src/types/interactive-session.ts#L16)에서 선택형 포맷 세 종류만 지원한다.

### 1-3. 현재 측정값은 효능 증거로 쓸 수 없음

현행 구현에는 즉시 분리해야 할 오염이 있다.

- [InteractiveVideoPlayer.tsx](../../src/components/game/InteractiveVideoPlayer.tsx#L47)는 `clue`와 `creative` 선택을 정답 여부와 무관하게 모두 `1/1점`으로 기록한다.
- 같은 파일의 30초 자동선택도 [학습 결과로 전송](../../src/components/game/InteractiveVideoPlayer.tsx#L226)된다.
- [evidence.ts](../../src/lib/c6/evidence.ts#L102)는 정오 판단이 없어도 완료만 하면 performance `0.6`, transfer 자료가 없어도 `0.5`를 부여한다.
- 그 값을 다시 [C6 level과 confidence](../../src/lib/c6/evidence.ts#L220)에 누적한다.

따라서 현재 C6는 `능력 측정`이 아니라 제품 내 활동 신호의 휴리스틱이다. 검증 전 부모 화면에는 점수·수준·향상으로 노출하지 말고 관찰 문장만 써야 한다.

---

## 2. 연구가 지지하는 수업 구조

### 2-1. 영상은 짧은 의미 단위로, 아이가 조절하게 함

세분화 메타분석은 학습자 조절 세그먼트가 전이 수행에 유리함을 보고했다. 이는 “아이의 집중력은 정확히 몇 분”이라는 뜻이 아니라, 긴 연속 재생보다 **의미 단위 정지와 능동 응답**이 낫다는 뜻이다. 핵심 부분을 시각적으로 신호 주는 효과도 별도로 확인된다.  
출처: [Rey et al., 2019](https://eric.ed.gov/?id=EJ1217373), [Alpizar et al., 2020](https://rex.libraries.wsu.edu/esploro/outputs/journalArticle/A-meta-analysis-of-signaling-principle-in/99900601052901842)

### 2-2. 영상은 독서를 대체하지 못함

IES는 초등 읽기에서 실제 연결 텍스트, 이해 전략, 텍스트 구조, 질 높은 토론, 목적 있는 텍스트 선택을 권고한다. 4–9학년 지침에서도 영상은 배경지식 제공용 짧은 보조물이고, 핵심 학습은 텍스트에서 어휘·질문·요지·이해 점검을 수행하는 것이다.  
출처: [K–3 읽기 이해 지침](https://ies.ed.gov/ncee/WWC/PracticeGuide/14/Published), [K–3 기초 읽기 지침](https://ies.ed.gov/ncee/wwc/PracticeGuide/21/Published), [4–9학년 지침](https://ies.ed.gov/ncee/wwc/Docs/practiceguide/WWC-SummaryReadingInterven4-9.pdf)

2026년 대화식 읽기 메타분석은 64개 연구·10,463명에서 전체 `g=.76`, 이해 `g=.74`를 보고했지만 이질성이 크고 표준화 검사에서는 효과가 작았다. 이 수치는 KINDY가 같은 효과를 낸다는 근거가 아니며, **읽은 뒤 대화·추론·재진술을 설계할 근거**다.  
출처: [Zhang et al., 2026](https://doi.org/10.1016/j.ijer.2026.102963)

### 2-3. 선택 뒤에는 반드시 “왜?”와 근거가 필요함

자기설명 유도 메타분석은 평균 `g=.55`를 보고했다. 객관식 탭만 받지 말고 “무엇을 보고 그렇게 생각했어?”를 말·글·그림 중 하나로 받는다.  
출처: [Bisra et al., 2018](https://eric.ed.gov/?id=EJ1186664)

### 2-4. 정서·창의의 넓은 전이 주장은 보수적으로 해야 함

- 대규모 SEL 메타분석에서 효과는 영역별로 대체로 작거나 중간 이하였고, 순차적·능동적·집중적·명시적인 SAFE 설계가 중요했다. 한국 연구 종합 효과도 `g=.27` 수준이었다.  
  출처: [Cipriano et al., 2023](https://doi.org/10.1111/cdev.13968), [Kim et al., 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9231796/)
- 창의성 훈련 169개 연구의 미조정 효과 `.53`은 출판편향 보정 뒤 `.29–.32`로 낮아졌다.  
  출처: [Sio & Lortie-Forgues, 2024](https://pubmed.ncbi.nlm.nih.gov/38635185/)
- 철학 대화 메타분석은 비판적 사고 `.89`를 보고했지만, 대규모 재현에서 읽기 추가 효과는 없었다. 사고 활동이 독서능력으로 자동 전이된다고 말하면 안 된다.  
  출처: [Kilby, 2025](https://doi.org/10.52380/ijcer.2025.12.1.703), [EEF P4C 재현](https://educationendowmentfoundation.org.uk/projects-and-evaluation/projects/philosophy-for-children-effectiveness-trial)
- 교육 개입 효과는 사후 검사 뒤 소멸하는 경우가 많다. 즉시 퀴즈만 보지 말고 지연 회상과 처음 보는 과제를 측정해야 한다.  
  출처: [Hart et al., 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11905918/)

효과크기는 대상·비교군·검사가 달라 서로 순위를 매길 수 없다.

---

## 3. KINDY 수업 기본형

다음 길이는 과학적으로 확정된 정답이 아니라 7–10세 사용자 테스트로 검증할 첫 제품 가설이다.

| 단계 | 시간 가설 | 아이가 하는 일 |
|---|---:|---|
| 지난 회차 회상 | 30–60초 | 화면을 보기 전 기억을 꺼냄 |
| 자극물 관찰 | 2–4분 | 원화·사료·갈등 장면을 의미 단위로 봄 |
| 예측·근거 | 1–2분 | 선택하고 “왜?”에 답함 |
| 맥락·반대 관점 | 2–4분 | 역사·작가·인물의 다른 관점을 만남 |
| 실제 읽기 | 3–7분 | 연결 텍스트를 읽고 핵심어·요지·근거를 찾음 |
| 표현·실행 | 5–10분 | 말하기·그리기·쓰기·역할연습 |
| 피드백·수정 | 2–3분 | 한 가지 구체적 피드백 뒤 산출물을 고침 |
| 종료·다음 회차 | 30–60초 | 즉시 회상 1개, 다음 회차 지연 회상 예약 |

권장 첫 기본값은 **순수 영상 6–10분, 전체 수업 15–25분**이다. 20분 수업 포지셔닝과도 맞는다.

### 연령·읽기 밴드

나이만으로 난이도를 고정하지 않는다. 같은 7세와 10세 안에서도 읽기 차이가 크므로 짧은 초기 캘리브레이션과 보호자 정보로 밴드를 정한다.

| 7–8세 기본 | 9–10세 기본 |
|---|---|
| 영상 2덩어리, 문장 단위 읽기, 동시 하이라이트, 말·그림 응답 | 영상 3덩어리, 문단 읽기, 주장+근거 말/글, 관점·자료 비교 |
| 음성 지원은 읽기의 대체가 아니라 발판 | 스스로 읽기 우선, 필요 시 음성 지원 |
| 선택지 뒤 짧은 이유 | 열린 이유·반례·수정 요구 |

---

## 4. 다섯 영역의 outcome contract

한 회차가 다섯 역량을 모두 키운다고 하지 않는다. **주 목표 1개, 보조 목표 최대 2개**만 선언하고 시즌 전체에서 균형을 맞춘다.

| 영역 | 회차에서 가르칠 행동 | 유효한 증거 | 금지할 과장 |
|---|---|---|---|
| 인문 | 관찰/추론 구분, 맥락·관점 비교, 주장+근거 | 처음 보는 자료에 대한 주장+근거 루브릭 | 문화자본·교양이 자동 향상 |
| 예술 | 특징 관찰, 시각 근거로 해석, 기법 적용·수정 | 처음 보는 원화 설명 + 전/후 작품 | 예술 노출이 전 교과 능력을 향상 |
| 정서 | 감정 식별, 관점 취하기, 관계·책임 선택, 다른 상황 적용 | 구조화 시나리오와 역할연습, 도움 수준 포함 | 성격·정신건강·공감능력 진단 |
| 창의 | 3개 이상 발산, 범주 전환, 적절성 비교, 선택·개선 | 아이디어 목록 + 초안 + 수정본의 블라인드 루브릭 | 한 번의 자유그리기로 창의성 점수 산출 |
| 독서 | 실제 글 해독·유창성 지원, 어휘·요지·추론·근거·모니터링 | 처음 보는 동형 지문, 읽기 밴드별 독립 과제 | 영상 시청을 독서능력 향상으로 해석 |

### 쇠라 파일럿을 바꾸는 예

1. **원화 정지 관찰:** AI 영상 전에 실제 원화를 충분히 보여 준다.
2. **VTS 질문:** “무슨 일이 일어나고 있나?”, “무엇을 보고 그렇게 생각했나?”, “더 찾을 수 있는 것은?”
3. **AI 생동 장면:** `상상 재구성`임을 표시하고, 원화와 무엇이 같고 달라졌는지 찾는다.
4. **짧은 맥락 영상:** 화가·시대·기법의 검증된 사실만 설명한다.
5. **실제 읽기:** 연령 밴드에 맞춘 연결 텍스트에서 핵심어·요지·근거 문장을 찾는다.
6. **창작:** 점·색·구도를 이용해 시선이 가는 곳을 바꾸고, 이유를 설명한다.
7. **수정:** “시선이 어디로 가는지 더 분명하게 해 보자” 같은 피드백 하나 뒤 작품을 고친다.
8. **전이:** 다음 회차에 처음 보는 다른 작품에서 시각 근거를 다시 찾는다.

VTS 질문과 시각 예술 대화의 근거: [Bowen et al., 2014](https://edpolicyinca.org/sites/default/files/2023-11/bowen-et-al-2014-learning-to-think-critically-a-visual-art-experiment.pdf)

---

## 5. 개발해야 할 제품 계층

### 5-1. `LearningSessionSpec v2`

```ts
interface LearningSessionSpec {
  version: string;
  ageBand: '7-8' | '9-10';
  readingBand: string;
  primaryObjective: ObjectiveRef;
  secondaryObjectives: ObjectiveRef[]; // 최대 2개
  curriculumRefs: string[];
  essentialQuestion: string;
  sources: SourceRef[];
  factInferenceImaginationLabels: ContentLabel[];
  misconceptions: string[];
  vocabulary: VocabularyItem[];
  segments: SegmentSpec[];
  readingText: ReadingTextSpec;
  responses: ResponseTaskSpec[];
  creationOrRoleplay: ArtifactTaskSpec;
  feedbackAndRevision: RevisionSpec;
  retrievalNow: EvidenceTaskSpec;
  retrievalNextSession: EvidenceTaskSpec;
  transferTask: EvidenceTaskSpec;
  rubric: RubricSpec;
  safetyNotes: string[];
  parentPrompt: string[];
}
```

2022 개정 교육과정 ID, 선행지식, 오개념, 출처, 전이 과제를 필수로 만든다.  
출처: [교육부 2022 개정 교육과정](https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=141&boardSeq=93458&lev=0&searchType=null&status=)

### 5-2. 수업 플레이어 v2

현행 다이아몬드 분기와 음성 UI는 재사용하되 다음을 추가한다.

- 세그먼트별 정지·되감기·속도·자막·대본
- `tap`, `speak`, `write`, `draw`, `arrange`, `roleplay` 응답 모드
- 선택 뒤 이유와 시각/텍스트 근거 요구
- 실제 읽기 화면과 핵심어·근거 표시
- 힌트·재시도·건너뛰기를 점수와 분리
- 초안과 수정본을 함께 저장하는 artifact portfolio
- 다음 회차에 지연 회상 과제를 삽입하는 scheduler
- 7–8세/9–10세 표현 수단 차등 지원

분기는 역사적 사실을 바꾸지 않는다. 예측·관점·행동 결과를 탐색한 뒤 같은 학습 목표로 합류한다.

### 5-3. evidence ledger

최소 이벤트 스키마:

```ts
interface LearningEvidenceEvent {
  eventId: string;
  childPseudonym: string;
  sessionId: string;
  contentVersion: string;
  objectiveId: string;
  constructId: string;
  curriculumStandardId?: string;
  itemId: string;
  evidenceKind: 'exposure' | 'engagement' | 'near_task' | 'transfer' | 'delayed';
  responseMode: 'tap' | 'voice' | 'text' | 'drawing' | 'arrangement';
  assistance: { hints: number; retries: number; autoSelected: boolean };
  artifactRef?: string;
  rubricVersion?: string;
  scorer: { type: 'human' | 'rule' | 'ai'; version: string };
  score?: Record<string, number>;
  uncertainty?: number;
  createdAt: string;
}
```

원칙:

- `play`, `completion`, `latency`는 노출·사용성이지 학습효과가 아니다.
- 자동선택은 `autoSelected=true`로만 기록하고 역량 업데이트에서 제외한다.
- 감정 선택은 정답으로 채점하지 않는다.
- AI 채점은 인간 이중채점 표본과 보정하기 전 부모 리포트에 쓰지 않는다.
- 부모 리포트의 모든 문장은 원 응답·작품·event ID·rubric version으로 역추적 가능해야 한다.

표준 참고: [Caliper 1.2](https://www.imsglobal.org/spec/caliper/v1p2/), [xAPI 2.0](https://github.com/adlnet/xAPI-Spec)

### 5-4. 부모 리포트

금지:

- “공감 능력 82점”, “창의성이 낮음”, “상위 10%”
- 얼굴·목소리에서 감정·성격·읽기장애 추론
- 1–2회 활동으로 고정적 강점·약점 선언

허용할 형태:

> 이번 두 과제에서 서로 다른 인물의 이유를 1회 언급했습니다. 첫 답변 뒤 “그림에서 근거 찾기” 힌트를 한 번 사용했습니다. 다음에는 다른 작품에서도 같은 질문을 연습합니다.

리포트 구조는 `한 일 / 관찰 근거 / 받은 도움 / 불확실성 / 다음 활동`으로 제한한다.

---

## 6. `mori-studio` 제작 스택 판단

### 6-1. 유지할 것

- 한 번에 긴 영상을 생성하지 않고 대본·샷·키프레임·짧은 클립으로 분해
- 승인 캐릭터 시트와 KINDYTOY LoRA를 시각 anchor로 사용
- 트랙 B에서 원화를 기본 프레임으로 유지하고 필요한 장면만 I2V
- 사실·저작권·출처 패킷을 먼저 잠금
- 결정론 게이트 → 자동 품질 평가 → 인간 검토 순서
- 후보·기각·override·모델·프롬프트·비용을 append-only로 보존

### 6-2. 현재 즉시 고쳐야 할 구현 문제

1. **Gemini 이미지 모델이 종료된 preview ID를 사용한다.**  
   `mori-studio/src/adapters/gemini/nano-banana.ts:18`의 `gemini-3-pro-image-preview`는 2026-06-25 종료됐다. GA ID는 `gemini-3-pro-image`, 비용 우선 후보는 `gemini-3.1-flash-image`다.  
   출처: [Gemini API changelog](https://ai.google.dev/gemini-api/docs/changelog)

2. **Seedance Standard와 Fast가 같은 endpoint로 간다.**  
   현행 adapter는 둘 다 `bytedance/seedance-2.0/reference-to-video`를 사용한다. 시작 프레임을 고정하려면 Standard는 `bytedance/seedance-2.0/image-to-video`, Fast는 `bytedance/seedance-2.0/fast/image-to-video`를 써야 한다. 참조 기반 생성이 필요할 때만 각각 `reference-to-video`와 `fast/reference-to-video`를 사용한다.  
   출처: [fal Seedance 2 I2V](https://fal.ai/models/bytedance/seedance-2.0/image-to-video/api), [Fast I2V](https://fal.ai/models/bytedance/seedance-2.0/fast/image-to-video/api), [reference-to-video](https://fal.ai/models/bytedance/seedance-2.0/reference-to-video)

3. **시작 프레임과 참조 이미지의 의미가 섞여 있다.**  
   현행 `video-live.ts`는 `image_url`을 `image_urls`에 합쳐 reference-to-video로 보낸다. fal 문서상 `image-to-video`의 `image_url`은 시작 프레임이지만 `reference-to-video`의 `image_urls`는 캐릭터·스타일 참조다. 쇠라 S3 사고와 같은 의미 혼동이 타입 단계에서 재발할 수 있다.  
   출처: [fal Seedance 2 endpoint 역할](https://fal.ai/models/bytedance/seedance-2.0/text-to-video)

4. **비용 모델이 현재 가격을 크게 과소추정한다.**  
   현행 가격은 Standard `$0.052/s`, Fast `$0.022/s`지만 fal의 현재 720p 가격은 각각 약 `$0.3024/s`, `$0.2419/s`다. 약 `5.8배`, `11배` 차이다. 예산·라우팅 판단은 `생성 1초 비용`이 아니라 재시도까지 포함한 `합격 영상 1초 비용`으로 다시 계산해야 한다.  
   출처: [fal Seedance 2 현재 가격](https://fal.ai/models/bytedance/seedance-2.0/image-to-video)

5. **control plane이 아직 실행체가 아니다.**  
   `model-registry.ts`와 `shot-generate.ts`는 비어 있고, `episode-produce.ts`는 dummy output만 기록한다. 더 위험한 점은 이 dummy DAG도 마지막에 `published`를 반환하고, `SUPABASE_LIVE=1`이면 dummy episode를 실제 publish할 수 있다는 것이다. live publish를 즉시 fail-closed로 막아야 한다. 라우팅도 코드에 하드코딩돼 자동 승격·롤백·failover가 없다.

6. **평균 QC는 치명 결함을 가릴 수 있다.**  
   공통 vision gate는 평균 7점 이상이면 pass라서 아동 안전·원화 충실도·캐릭터 정확도 한 축의 심각한 실패가 다른 점수에 묻힐 수 있다. critical axis별 최저선과 결정론 gate를 별도로 둬야 한다.

### 6-3. adapter 계약을 먼저 바꿈

```ts
type ConditioningAsset =
  | { role: 'start_frame'; url: string }
  | { role: 'end_frame'; url: string }
  | { role: 'character_reference'; characterId: string; url: string }
  | { role: 'style_reference'; url: string }
  | { role: 'motion_reference'; url: string }
  | { role: 'audio_reference'; url: string };
```

각 adapter가 지원하지 않는 역할을 받으면 조용히 변환하지 말고 실패시킨다. endpoint schema snapshot test와 소액 live canary를 별도로 둔다.

### 6-4. 최신 후보는 교체가 아니라 golden-set benchmark 대상

| 후보 | 현재 강점 | KINDY 권고 |
|---|---|---|
| Gemini 3 Pro Image GA | 현 Pro 이미지 경로의 직접 후속 | P0 마이그레이션 후 동일 seed 불가를 감안해 회귀 검수 |
| Gemini 3.1 Flash Image GA | 속도·비용 균형, 최대 14개 이미지 입력 | 다중 캐릭터 keyframe 후보로 Pro와 A/B |
| Seedream 5 Pro | 최대 10개 참조, multi-image fusion | 최신 keyframe candidate로만 추가 |
| Seedance 2 / Fast / Mini | keyframe·reference·video 입력, 4–15초 | 입력 역할을 분리한 뒤 Track A/B별 재벤치 |
| Gemini Omni Flash | first-frame/video 조건, 동시 audio | 2026-07 신모델이므로 canary, 즉시 prod 금지 |
| Kling 3 | 시작 프레임 충실도 실측 강점 | 트랙 B 회화와 hero fallback 유지 |
| LTX-2.3 | open weights, keyframe interpolation, retake, IC-LoRA | 로컬 R&D·수정/보간 benchmark; 라이선스 검토 필수 |
| Wan2.2 TI2V-5B | Apache-2.0, 24GB에서 720p I2V/T2V | 저비용 fallback benchmark, 품질 승격은 실측 뒤 |
| ComfyUI | JSON workflow, seed, 부분 재실행, 폭넓은 모델 지원 | R&D/저작 워크벤치; 제품 control plane의 진실원천으로 쓰지 않음 |

최신 공식 자료:

- [Runway API changelog — Seedream 5, Gemini Omni Flash, Seedance 2 계열](https://docs.dev.runwayml.com/api-details/api_changelog/)
- [LTX-2.3 공식 GitHub](https://github.com/Lightricks/LTX-2)
- [Wan2.2 공식 GitHub](https://github.com/Wan-Video/Wan2.2)
- [ComfyUI 공식 GitHub](https://github.com/Comfy-Org/ComfyUI)

LTX-2는 순수 오픈소스 라이선스가 아니라 Community License다. 연 매출 1천만 달러 이상 사업자는 별도 상업 라이선스가 필요하고 경쟁 서비스 제한 등이 있으므로 법무 검토 후 사용한다.  
출처: [LTX-2 License](https://github.com/Lightricks/LTX-2/blob/main/LICENSE)

### 6-5. 품질 평가는 범용 점수 + KINDY 도메인 gate

범용 도구:

- [VBench](https://github.com/Vchitect/VBench): subject/background consistency, flicker, motion, 미학·영상 품질
- [DOVER](https://github.com/VQAssessment/DOVER): 기술·미학 영상 품질
- [VMAF](https://github.com/Netflix/vmaf): 인코딩·지각 화질
- PySceneDetect/ffmpeg: 컷·프레임·오디오·길이 결정론 검사

KINDY 전용 필수 gate:

- 캐릭터 ID·의상·소품·색·구도
- 트랙 B 원화 t=0·저해상 연속성·새 인물/새 사물 금지
- 사실·출처·사실/추론/상상 라벨
- 아동 안전·번쩍임·과자극·텍스트 누출
- 교육 목표와 장면/질문/읽기/전이 과제 정렬
- 음성 발음·화자·자막·음악 loudness

범용 지표는 도메인 gate를 대체하지 않는다.

### 6-6. 교육 대사와 립싱크

영상 모델의 native dialogue를 교육 대사의 진실원천으로 쓰지 않는다. 고유명사·인용·핵심 문장은 다음 순서로 고정한다.

> 승인 대본 → TTS → ASR/CER 검증 → 립싱크 → 자막 대조 → 인간 청취 승인

현재 Gemini TTS를 유지하면서 최신 Gemini 3.1 Flash TTS Preview와 Eleven v3/Multilingual v2를 한국어 고유명사·조사·감정 문장 40–60개로 블라인드 비교한다. 립싱크는 VEED/Sync v2와 Sync 3를 같은 샷에서 비교하되, 모델 교체보다 승인 대사 일치율을 우선 지표로 둔다.  
출처: [Gemini TTS](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-tts-preview), [ElevenLabs 모델](https://elevenlabs.io/docs/overview/models), [Sync 3](https://sync.so/docs/models/sync-3)

---

## 7. 아동 안전·개인정보·접근성

### 7-1. 제품 원칙

- GenAI는 제작·QA 뒤에 둔다. 7–10세에게 자유형 LLM 채팅이나 AI 친구를 직접 열지 않는다.
- 아이 화면은 인간 승인된 이야기, 제한된 선택, 구조화된 말·글·그림 창작으로 구성한다.
- 공개 UGC·DM·광고·감정인식·얼굴/목소리 기반 성격 추론은 초기 범위에서 제외한다.
- 아이 원 음성·그림을 외부 기초모델 학습에 사용하지 않는다.
- 음성은 가능하면 일시 처리 후 삭제하고, 저장이 필요하면 별도 보호자 동의와 짧은 보존기간을 둔다.
- identity vault와 학습 이벤트를 분리하고 삭제·내보내기·벤더 삭제 전파를 시험한다.

UNESCO는 독립적 GenAI 대화의 최소 연령을 13세로 권고하며, UNICEF 3.0은 안전·프라이버시·공정성·투명성·아동 최선의 이익을 요구한다. 이는 법정 연령 자체가 아니라 KINDY의 보수적 제품 경계 근거다.  
출처: [UNESCO GenAI 교육 지침](https://www.unesco.org/en/articles/guidance-generative-ai-education-and-research), [UNICEF Guidance on AI and Children 3.0](https://www.unicef.org/innocenti/reports/policy-guidance-ai-children)

### 7-2. 한국 출시 전 법률 체크

- 개인정보보호법 제22조의2는 만 14세 미만 개인정보 처리 동의가 필요한 경우 법정대리인 동의와 확인, 아동에게 쉬운 고지를 요구한다.  
  출처: [국가법령정보센터 제22조의2](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=02&joNo=0022&lsiSeq=270351&urlMode=lsScJoRltInfoR)
- AI기본법 제31조는 생성형 AI 기반 서비스의 사전 고지와 생성 결과 표시를 규정한다. 사실적으로 보이는 음성·이미지·영상은 명확히 인식 가능해야 하며, 예술·창의 표현물은 감상을 방해하지 않는 방식이 허용된다.  
  출처: [국가법령정보센터 제31조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0031&lsiSeq=282791&urlMode=lsScJoRltInfoR)
- 시행령은 화면·약관·제품 등에 고지할 수 있게 하되 주 이용자의 나이와 조건을 고려하도록 한다. 학교에서 KINDY의 AI 점수를 학생 평가에 사용하게 되면 고영향 AI 해당성 확인, 인간 감독·설명·문서화 의무를 별도로 검토한다. DTC 연습 피드백이 곧바로 학생 평가에 해당한다고 단정하지 않는다.  
  출처: [AI기본법 시행령 관련 조문](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lspttninfSeq=198075), [AI기본법 제34조](https://www.law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1031809457)
- 그러므로 현행 `아이 화면 AI 표기 0, 부모 화면만` 원칙은 그대로 잠그지 말고 법률 검토한다. 회차 시작/정보/크레딧 중 아동도 이해할 수 있는 비방해 고지안을 설계한다.
- 효능 연구가 일반화 가능한 지식 생산·출판 목적이면 제품 동의와 별도로 IRB 판단, 보호자 동의, 연령 적합한 아동 assent를 준비한다.  
  출처: [생명윤리법 제15조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0015&lsiSeq=276665&urlMode=lsScJoRltInfoR)
- 표시광고법은 거짓·과장 광고를 금지하고 사실 관련 광고를 실증할 수 있어야 한다고 규정한다. 법이 특정 표본수를 정하는 것은 아니므로, 통제 연구 전에는 `향상시킨다`보다 `질문·읽기·수정을 연습하도록 설계했다`로 제한하고 claims registry에 근거를 연결한다.  
  출처: [표시광고법 제3조](https://www.law.go.kr/LSW/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=900554254), [제5조](https://www.law.go.kr/LSW/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=900553865)

법률 적용범위와 예외의 최종 판단은 변호사 검토 대상이다.

### 7-3. 접근성 gate

- 자막은 화자·중요 비언어음까지 포함
- 대본·동등 설명 제공
- 키보드·초점·색상 외 단서·충분한 대비·reflow
- 자동재생 정지, reduced motion, 번쩍임 금지
- 아동용 주요 터치 목표는 44×44px 이상을 제품 기준으로 사용
- 말·글·그림·터치 등 복수 표현 수단 제공

출처: [KWCAG 2.2](https://www.rra.go.kr/ko/reference/kcsList_view.do?nb_seq=5247&nb_type=6), [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [CAST UDL 3.0](https://udlguidelines.cast.org/more/about-guidelines-3-0/)

---

## 8. 실제 증거 자산을 만드는 계획

### 증거 계단

| 단계 | 표본·방법 | 만들 수 있는 주장 | 증거 자산 |
|---|---|---|---|
| 0. 구현 전 | 전문가 검토 | “교육과정 연계”, “연습하도록 설계” | 목표 맵, 출처 패킷, 루브릭, 검수 서명 |
| 1. 사용성 | 15–20명 | 사용 가능성·이해도·안전 | 세션 녹화, 오류·이탈·이해 리포트 |
| 2. 측정 파일럿 | 별도 파워/인지면담, 블라인드 인간 채점 | 탐색적 학습 신호 | 동형과제, 평가자간 신뢰도, 작품 전/후 |
| 3. 통제 연구 | 사전등록, active/waitlist control, 파워분석 | 시험한 대상·기간·결과에 한정한 효과 | 95% CI, 탈락률, null 포함 결과, 4–8주 유지검사 |
| 4. 독립 재현 | 한국 7–10세 외부 파트너 | 조건에 맞는 넓은 향상 주장 검토 | 논문/보고서, claims registry |

15–20명 파일럿은 사용성·안전 증거일 뿐 효능 증거가 아니다. 사후 즉시 점수만 보지 않고 처음 보는 과제, 블라인드 루브릭, 4–8주 지연 검사를 둔다. 연구 표본은 기대효과를 정한 뒤 파워분석으로 결정한다.

### 마케팅에서 바로 쓸 수 있는 증거 자산

통제 연구 전에도 다음은 정직하게 구현할 수 있다.

1. 회차별 교육 목표·교육과정·출처 카드
2. 원화와 AI 상상 재구성의 구분 화면
3. 실제 수업 20분 전체 데모
4. 아이 작품의 초안 → 피드백 → 수정본
5. “무엇을 보고 그렇게 생각했는지” 익명 응답 예시
6. 부모에게 전달되는 근거 연결 리포트
7. 교육·아동발달·사실·안전·접근성 검수자 기록
8. 사용성 파일럿의 이해도·완주·오류와 개선 이력

효능을 말하려면 별도 controlled evidence가 필요하다. 그 전 랜딩 문구는 `향상시킵니다`가 아니라 `관찰하고, 근거를 말하고, 읽고, 만들어 다시 고치도록 설계했습니다`가 맞다.

---

## 9. 실행 순서

### P0 — 0–2주: 진실 계층과 운영 중단 위험 제거

- Gemini 종료 preview → GA migration, live smoke test
- Seedance Standard/Fast endpoint와 시작/끝/참조 역할 타입 분리
- Seedance 현재 가격 반영, `합격 영상 1초 비용` 기준 예산·라우팅 재계산
- dummy DAG의 live publish를 fail-closed로 차단
- 기존 모델 benchmark를 의미별로 무효화/재실행 범위 결정
- 자동선택과 선택 완료를 C6 역량 업데이트에서 제외
- C6를 `관찰 휴리스틱`으로 표시하고 검증 없는 성장 표현 중단
- `LearningSessionSpec v2`, evidence kind, claims registry 초안
- AI 표시·보호자 동의·아동 고지·데이터/벤더/국외이전 지도

### P1 — 3–6주: 수업 플레이어 v2

- 영상 세그먼트와 VTS/자기설명 질문
- 실제 읽기 passage, 핵심어·요지·근거 찾기
- 말·글·그림 artifact capture
- 피드백 뒤 수정, 즉시·다음 회차 회상
- 7–8/9–10 밴드, 자막·대본·속도·reduced motion
- event → artifact → rubric → parent sentence 추적

### P2 — 7–10주: 제작 control plane

- 실제 model registry, schema watcher, deprecation alert, live canary
- Kindy golden set에 Track A/B·원화·다중 캐릭터 failure mode 추가
- 후보 N개 생성 → 결정론 gate → VBench/DOVER 보조 → VLM → 인간 선택
- 모델 자동 reroute/fallback, 비용·시간·license·provenance 저장
- pedagogical QA: 목표 정렬, 실제 독서량, 질문 품질, 전이, 사실/추론/상상
- ComfyUI는 R&D 작업대로만 연결하고 typed registry가 진실원천 유지

### P3 — 11–16주: 세 개의 증거 가능한 대표 수업

- 쇠라: 예술 관찰·인문 주장+근거
- 고전 이야기: 독서 이해·관점 비교
- KINDY 오리지널: 정서 기술·창의 발산→선택→수정
- 회차마다 주 목표 1개, 보조 최대 2개
- 15–20명 사용성·안전 파일럿 후 측정 도구 인지면담

### P4 — 4–9개월: 효능 증거

- 도메인별 동형 전이 과제와 전문가 루브릭 타당화
- IRB 판단과 보호자 동의·아동 assent
- 사전등록한 통제 연구, 독립 블라인드 채점, null/negative 포함 공개
- 결과가 나온 주장만 claims registry에서 승격

---

## 10. 지금 하지 말 것

- 새 모델을 붙이기 전에 더 긴 영상을 자동 생성
- 긴 수동 영상 뒤 객관식 3개로 교육효과 주장
- 한 편이 인문·예술·정서·창의·독서를 모두 향상한다고 보고
- 완주율·시청시간·빠른 탭을 역량으로 해석
- 아이 답을 즉시 고정적 능력 점수로 환산
- 7–10세에게 공개형 LLM 상담·AI 친구 제공
- 원화 대신 AI 애니메이션만 보여 주거나 재구성을 사실처럼 제시
- 평균 QC만으로 아동 안전·원화 훼손·캐릭터 오류를 통과
- 모델명·endpoint·가격을 코드에 고정하고 deprecation 감시 없이 운영

---

## 11. 최종 판단

KINDY는 “AI 교육 영상 회사”보다 **검증된 문화 자극물을 이용해 아이가 관찰하고, 근거를 말하고, 실제로 읽고, 만들고, 다시 고치는 수업 시스템**이 되어야 한다.

영상 제작 방향은 살린다. 다만 영상은 제품의 전부가 아니라 학습 루프의 첫 재료다. 다음 개발 순서는 `새 영상 모델`이 아니라 **adapter P0 수정 → 교육 계약 → 수업 플레이어 → evidence ledger → 제작 control plane → 실제 아동 검증**이다.
