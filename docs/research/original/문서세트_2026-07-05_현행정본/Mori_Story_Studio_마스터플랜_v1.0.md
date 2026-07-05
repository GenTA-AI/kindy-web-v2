# Mori Story Studio — AI 멀티에이전트 인터랙티브 동화 제작 파이프라인

**Master Plan & Implementation Specification v1.0**

대상: 만 5–7세 | 산출물: 10분 인터랙티브 개인화 3D 동화 영상 | 기반 문서: Mori C6 창의 성장지도 v1.0
작성일: 2026-07-04 | 내부 적용안: Kindy/Mori Story Forest MVP | 모델 스택 기준일: 2026년 7월

---

## 0. 경영 요약

본 문서는 "동화작가 에이전트팀(Story Guild)"과 "영상제작 에이전트팀(Studio Guild)"으로 구성된 자동화 제작 파이프라인의 마스터플랜이다. 목표는 **핑크퐁급 3D 룩의 10분 분기형 동화 에피소드를 에피소드당 $110–350의 생성 비용, 2–4일의 리드타임으로 자동 생산**하고, 아이의 선택 행동을 C6 성장지도의 행동 증거로 환류하는 것이다.

핵심 설계 결정 5가지:

1. **다이아몬드 분기 구조.** 완전 트리(2^n 폭발)가 아니라 "공통 트렁크 → 분기 → 재합류"를 반복한다. 시청 경로 10분을 만들기 위해 제작하는 총 분량은 약 14.5분(870초)이며, 선택 조합으로 **12가지 서로 다른 여정**이 생긴다.
2. **개인화 3레벨.** L1 경로(선택에 따른 결말 조립, 전 구독자 공유 에셋), L2 호명(TTS로 아이 이름 삽입, 아이당 몇 센트), L3 나만의 장면(아이의 창작 선택을 반영한 10–15초 컷 1개를 아이별 생성, 아이당 $0.3–2). "아이 한 명만을 위한 동화"는 L1+L2로 런칭하고 L3는 프리미엄 훅으로 쓴다.
3. **하이브리드 3D 파이프라인.** 풀 3D 렌더링(Blender/Unity)이 아니라, 주연 캐릭터만 3D 마스터 에셋으로 만들어 캐릭터 시트를 뽑고 → 레퍼런스 조건부 이미지 모델로 키프레임 생성 → image-to-video로 샷을 만든다. 일관성과 비용·속도의 최적 균형점이다. 풀 3D는 Phase 2 옵션.
4. **모델 애그리게이터 기반 오케스트레이터.** fal.ai 등 단일 API 뒤에 모델 레지스트리·골든셋 자동 벤치마크·카나리 승격·자동 롤백을 둔다. 신모델이 나오면 사람 개입 없이 벤치가 돌고, 비용/품질 기준으로 교체된다. (Sora 2가 2026년 9월 API 종료를 발표한 것이 이 설계가 필수인 이유의 실례다.)
5. **CEO 인터페이스는 3채널.** 스토리팀장·스튜디오팀장·오케스트레이터의 일일 다이제스트와 승인 대기 큐만 CEO에게 온다. 나머지는 전부 자동.

---

## 1. 제품 정의: 10분 인터랙티브 개인화 동화

### 1.1 에피소드 구조 (다이아몬드 분기)

```
S0 인트로(90s) ─ S1 관찰씬(60s) ─◆CP1◆─ S2a(75s) ─┐
                                  └──── S2b(75s) ─┴─ S3 개념씬(90s) ─◆CP2◆─ S4a(75s) ─┐
                                                                      └──── S4b(75s) ─┴─ S5(60s) ─◆CP3◆─ E1(90s)
                                                                                                    ├──── E2(90s)
                                                                                                    └──── E3(90s)
```

| 항목 | 값 | 비고 |
|---|---|---|
| 시청 경로 길이 | 540초(9분) + 선택 인터랙션 ≈ **10분** | CP당 15초 타임아웃 |
| 총 제작 분량 | **870초 (14.5분)** | 공통 300s + 분기 300s + 엔딩 270s |
| 선택 포인트 | 3개 (CP1–CP3) | 각각 C6 축 1개의 행동 증거 수집 지점 |
| 고유 여정 수 | 2×2×3 = **12가지** | 부모 리포트 카피: "OO이만의 12가지 여정 중 하나" |
| 샷 수 | 약 145샷 (평균 6초/샷) | 리트라이 포함 약 200회 생성 |
| 해상도 | 1080p 16:9 | TV/태블릿 우선, 4K 업스케일은 후순위 |

**분기 설계 원칙**: 분기는 "정답/오답"이 아니라 **탐험 방식의 차이**다(C6 문서 2절 선언과 동일). 어느 경로든 이야기 목표는 달성되고, 차이는 "어떤 생각도구로 도달했는가"이다. 선택하지 않으면 15초 후 모리가 대신 골라주는 기본 경로로 진행한다(이탈 방지, 좌절 금지).

### 1.2 선택 포인트 = C6 행동 증거 수집 지점

CP는 C6 문서의 과제 템플릿(8절 T1–T7)을 영상 안으로 옮긴 것이다. 예: "물방울이 사라진 날" 에피소드 기준.

| CP | 화면 질문(모리 대사) | C6 축 | thinking_tool | 수집 변수 |
|---|---|---|---|---|
| CP1 | "어디부터 살펴볼까? 반짝이는 웅덩이? 젖은 발자국?" | C2 관찰·탐구 | observation | choice, elapsed_ms, replay |
| CP2 | "물방울이 사라진 순서를 맞춰볼까, 아니면 하늘에 물어볼까?" | C3 패턴·문제해결 | pattern_recognition | choice, elapsed_ms |
| CP3 | "목마른 친구들 중 누구에게 먼저 물을 줄까?" | C6 마음·사회성 | empathizing | prosocial_choice, elapsed_ms |

각 선택은 기존 이벤트 스키마(C6 문서 10.2)의 `round_completed`로 그대로 적재된다 — **신규 이벤트 타입이 아니라 `event_type=story_choice`인 round**로 취급하여 `child_growth_profiles` 갱신 로직을 재사용한다.

### 1.3 개인화 3레벨

| 레벨 | 내용 | 비용(아이당) | 구현 | 시점 |
|---|---|---|---|---|
| **L1 경로** | 선택 조합에 따른 12가지 여정. 영상 에셋은 전 구독자 공유 | $0 | 플레이어 분기 재생 | 런칭 |
| **L2 호명** | 모리가 아이 이름을 부름. 대사 트랙에 `{{child_name}}` 슬롯 3–5개 예약, TTS로 이름 구간만 아이별 합성·믹스 | ~$0.01–0.05 | name_slot 오디오 세그먼트 교체 | 런칭 |
| **L3 나만의 장면** | CP3 이후 아이의 창작 선택(T7 별빛 작업실: "나만의 물방울 도구")을 반영한 10–15초 컷을 아이별 생성. 비동기 5–15분 내 완성 → 리포트/다시보기에 첨부 | ~$0.3–2 | 키프레임 1장 + I2V 1클립 | 베타(프리미엄) |

**개인정보 주의(L2/L3)**: 아이 이름은 개인정보다. 외부 TTS API로 이름을 보낼 때는 이름 단독 발화 세그먼트만 전송(문맥 미포함)하고, 로그 미보존 옵션이 있는 벤더/플랜을 쓰거나, 오픈소스 TTS(Qwen3-TTS 등)를 자사 GCP에 셀프호스팅하여 이름 구간만 로컬 합성하는 것을 기본안으로 한다(기존 로컬 LLM 비식별화 파이프라인과 동일 원칙).

---

## 2. 전체 아키텍처

```
                         ┌─────────────── CEO (Jongwon) ───────────────┐
                         │   승인 큐 · 일일 다이제스트 · 예산/품질 대시보드   │
                         └──────┬───────────────┬───────────────┬──────┘
                          스토리팀장          스튜디오팀장        오케스트레이터
                                │                │                │
┌── Story Guild ──────────────┐ │ ┌── Studio Guild ─────────────┐ │ ┌── Orchestrator Core ────────┐
│ ① Motif Scout (리서치)      │ │ │ ① Showrunner (총감독)        │ │ │ · 워크플로 엔진 (상태머신)     │
│ ② Story Smith (작가)        │◄┼─┤ ② 콘티 (씬→샷 분해/연출)     │ │ │ · Model Registry & Adapter  │
│ ③ Safety Guardian (검수)    │ │ │ ③ Art Director (캐릭터/룩)   │◄┼─┤ · Eval Harness (골든셋 벤치) │
│    → HITL 승인 게이트 #1     │ │ │ ④ Gen Operator (샷 생성)     │ │ │ · Model Scout (신모델 감시)  │
└─────────────────────────────┘ │ │ ⑤ Assembly (편집/조립)       │ │ │ · 비용 가드 / 카나리 / 롤백    │
                                │ │ ⑥ Voice & Sound (더빙/음악)  │ │ └─────────────────────────────┘
     story_seeds (C6 문서 10.1) │ │ ⑦ QC (VLM 판정)             │ │
     branching_script JSON ────►│ │    → HITL 승인 게이트 #2·#3   │ │        아티팩트: GCS
                                │ └─────────────────────────────┘ │        상태/로그: Postgres
                                └─────────── 파이프라인 이벤트 버스 ──┘        게이트웨이: fal.ai + 직결 API
```

**제작 플로우 (스테이트 머신)**:
`brief_accepted → motif_report → script_draft → script_review → [HITL#1 스크립트 승인] → shotlist → keyframes → [HITL#2 키프레임 스팟체크] → shot_generation → auto_qc → assembly → dubbing_mix → final_qc → [HITL#3 최종 시사] → published`

각 스테이지는 멱등(idempotent)이며 실패 시 해당 스테이지만 재실행된다. HITL 게이트는 C6 문서 12절의 검수 체계를 그대로 적용하고, `approval_status: draft → in_review → approved`는 story_seeds 스키마와 동일한 상태 모델을 쓴다.

**구현 스택 권장**: 에이전트는 Claude Agent SDK 기반 서브에이전트(각 역할 = 시스템 프롬프트 + 도구 세트), 워크플로는 Postgres 상태 테이블 + 워커 큐(BullMQ 또는 Celery)로 시작한다. 에피소드 동시 제작이 3편을 넘어가면 Temporal 도입을 검토한다. 기존 GCP 인프라(키오스크 운영 경험) 위에 Cloud Run 워커 + GCS + Cloud SQL로 올리면 신규 인프라 학습 비용이 없다.

---

## 3. Story Guild — 동화작가 에이전트팀

### 3.1 팀 구성과 입출력 계약

| 에이전트 | 역할 | 입력 | 출력 | 실패 정책 |
|---|---|---|---|---|
| **스토리팀장** (Story Director) | 브리프 수락, 작업 분배, 품질 게이트, CEO 다이제스트 | 에피소드 브리프(C6 문서 부록 C 그대로) | 승인된 branching_script | 3회 반려 시 CEO 에스컬레이션 |
| **① Motif Scout** (리서치) | 구조·모티프 리서치 | 브리프(target_axis, subject_domain, 연령) | motif_report | 소스 불명 모티프는 폐기 |
| **② Story Smith** (작가) | 분기 대본 집필 | motif_report + 모리 세계관 바이블 + C6 태깅 규칙 | branching_script JSON (부록 A 스키마) | 스키마 검증 실패 시 자동 재생성 |
| **③ Safety Guardian** (검수) | 아동안전·세계관·법무 검수 | branching_script | pass / revise(사유·라인 지정) | 3회 revise 후 인간 검수로 |

### 3.2 리서치 정책: "우라까이"가 아니라 구조 차용 + 오리지널리티 게이트

Kindy는 도서관(B2G) 채널이 핵심이라 표절 이슈 하나가 채널 전체를 죽인다. 따라서 Motif Scout의 리서치는 다음 규칙으로 운영한다.

1. **소재 코퍼스는 퍼블릭 도메인만**: 한국 전래동화, 그림 형제, 안데르센, 이솝 등 저작권 만료 작품의 **구조·모티프·감정 비트**를 추출한다. 원문 표현은 재사용하지 않는다.
2. **구조 라이브러리**: 프로프의 서사 기능, 3막 구조, 픽사 스토리 스파인("옛날에… 매일… 그러던 어느 날…"), 유아 서사 반복 패턴(3회 반복 법칙)을 템플릿화하여 작가 에이전트의 도구로 제공한다.
3. **동시대 상업작(핑크퐁, 디즈니 등)은 '분석 전용'**: 톤·페이싱·색채 리듬 같은 관습만 분석 리포트로 남기고, 캐릭터·가사·고유 표현·시각 디자인은 프롬프트에 절대 포함하지 않는다(이미지 프롬프트에 브랜드명·캐릭터명 금지어 리스트 적용).
4. **오리지널리티 게이트**: Safety Guardian이 완성 대본을 임베딩 유사도로 코퍼스 및 주요 아동작품 시놉시스 DB와 대조한다. 시놉시스 코사인 유사도 임계 초과 시 자동 반려. 시각물은 QC 단계에서 동일 게이트를 통과한다.

### 3.3 Story Smith 집필 제약 (시스템 프롬프트 하드코딩 항목)

- **모리 톤**(C6 문서 12절): 평가보다 질문. "틀렸어/빨리 해/네가 안 하면 큰일 나" 계열 금지.
- **어휘·문장**: 만 5–7세 수용 어휘, 한 문장 12어절 이하 권장, 핵심 개념어는 에피소드당 3개 이하로 반복 노출.
- **공포·위협 금지**: 갈등은 "작고 안전한 문제"(부록 C의 story_problem 기준). 어둠·괴물·버려짐·처벌 모티프 금지.
- **C6 태깅 의무**: 모든 씬에 axis 연관성, 모든 CP에 axis_id + thinking_tool + 부모 리포트 근거 문장 후보(부록 B 템플릿 문법)를 함께 생성.
- **분기 등가성**: 어떤 선택도 열등하지 않다. 분기 세그먼트 길이 차 ±10% 이내, 감정 보상 동등.
- **대사 슬롯**: 아이 이름 호명 지점을 `{{child_name}}`으로 3–5개 마킹(문장 첫머리 독립 발화로 설계해 오디오 교체가 티 안 나게).

### 3.4 Safety Guardian 체크리스트 (자동 검수 → HITL#1)

C6 문서 12절 표를 기계 검수 가능한 규칙으로 변환한 것이다. 전 항목 통과 후에만 HITL#1 승인 큐에 올라간다.

| 검수 영역 | 자동 판정 규칙 |
|---|---|
| 세계관 | 이야기 숲 지역·모리 정체성 용어집 대조, 세계관 외 고유명사 검출 |
| C6 정합 | 모든 CP에 axis_id/thinking_tool 존재, 브리프의 target_axis와 일치 |
| 금지 카피 | "부족/지연/또래보다/점수/진단" 등 금지어 사전(C6 문서 2·11절) 0건 |
| 정서 안전 | 공포·위협·죄책감 유발 표현 분류기 통과, 갈등 강도 스코어 임계 이하 |
| 문화·편향 | 가족 형태·외모·성별 역할 고정 표현 검출 |
| 오리지널리티 | 시놉시스 임베딩 유사도 임계 이하 |
| 스키마 | JSON 스키마 검증, 분기 그래프 도달성(고아 노드 0), 길이 예산 준수 |

---

## 4. Studio Guild — 영상제작 에이전트팀

### 4.1 팀 구성

| 에이전트 | 사람 직군 대응 | 역할 | 핵심 산출물 |
|---|---|---|---|
| **스튜디오팀장 / ① Showrunner** | 총감독·PD | 프로덕션 플랜, 스타일 락, 예산 배분(샷 티어링), 최종 컷 승인 요청 | production_plan |
| **② 콘티** (Scene Writer/Storyboard) | 각본·콘티 | 승인 대본 → 씬→샷 분해. 샷별 duration·카메라·구도·대사 타이밍·연출 노트 | shotlist JSON |
| **③ Art Director** | 캐릭터·미술감독 | 캐릭터 바이블 관리, 키프레임 생성·선별, 룩 일관성 | keyframes (샷당 1–2장) |
| **④ Gen Operator** | 촬영·애니메이터 | 키프레임→영상 클립 생성, 시드/모델/버전 로깅, 리트라이 | renders |
| **⑤ Assembly** | 편집 | 클립 연결, 트랜지션, 분기 마커, 자막, 컬러 통일 | 분기별 마스터 영상 + branch manifest |
| **⑥ Voice & Sound** | 더빙·음악감독 | 캐릭터별 TTS, name_slot 처리, BGM/SFX, 라우드니스 정규화(-16 LUFS) | 오디오 트랙 |
| **⑦ QC** | 검수 | VLM 프레임 판정 + 오디오 싱크 체크 → 자동 재생성 트리거 | qc_report |

### 4.2 3D 룩 전략: 하이브리드 파이프라인 (권장안)

세 가지 경로를 비교 검토했다.

| 경로 | 방식 | 장점 | 단점 | 판정 |
|---|---|---|---|---|
| A. 풀 3D | Blender/Unity에 리깅된 캐릭터를 실제 렌더링 | 완전한 일관성, 무한 재사용 | 애니메이팅 자동화 난이도·인력, 리드타임 주 단위 | Phase 2 옵션 |
| B. 순수 비디오 생성 | 텍스트/레퍼런스 프롬프트만으로 3D룩 생성 | 가장 빠르고 저렴 | 샷 간 캐릭터 드리프트, 룩 통제 약함 | 보조(필러샷) |
| **C. 하이브리드** ✅ | 3D 마스터 캐릭터 → 캐릭터 시트 → 레퍼런스 조건부 키프레임 → I2V | 일관성·비용·속도 균형, 모델 교체에도 캐릭터 자산 유지 | 파이프라인 단계 수 증가 | **MVP 채택** |

**하이브리드 파이프라인 상세**:

1. **캐릭터 마스터 (1회성 투자)** — 모리 + 조연 4–6종을 3D 에셋으로 확보한다. 경로: (a) 컨셉 아트 → Tripo/Meshy(2026년 기준 Tripo Smart Mesh는 초 단위 클린 토폴로지, Meshy 6는 오토리깅+애니메이션 프리셋까지 제공)로 생성 후 Blender 정리, 또는 (b) 주인공 모리만 전문 모델러 1회 외주(₩200–500만). **모리는 IP의 심장이므로 (b) 권장**, 조연은 (a).
2. **캐릭터 바이블 렌더** — Blender에서 턴어라운드(8각도)·표정 시트(8종)·포즈 시트를 뉴트럴 라이팅으로 렌더. 이것이 모든 키프레임 생성의 레퍼런스 원본이자, 모델이 바뀌어도 유지되는 **회사 자산**이다.
3. **키프레임 생성** — 샷별로 캐릭터 시트 2–4장 + 배경/소품 레퍼런스를 조건으로 이미지 생성. 2026년 중반 기준 멀티 레퍼런스 강자는 FLUX.2(API 8장 레퍼런스, 편집 간 드리프트 최소로 공식 문서화), GPT Image 2(다중 레퍼런스 + 멀티캐릭터 배치), Nano Banana 2. "stylized 3D render, soft subsurface, Pixar-like kids animation" 계열 스타일 토큰을 룩 프리셋으로 고정.
4. **영상 생성 (I2V)** — first-frame(+필요시 last-frame) 조건으로 클립 생성. 주력은 Kling 3.0(Elements로 레퍼런스 1–4장 지정, Motion Control 3.0이 다각도 모션에서 얼굴 정체성 유지, first/last-frame 체이닝으로 씬 연결)과 Seedance 2.0(레퍼런스 입력 12개, 15초 단일 패스, 멀티씬 연속성). 히어로샷은 Veo 3.1 Quality.
5. **씬 연결** — 앞 클립 마지막 프레임 = 다음 클립 첫 프레임(last→first 체이닝)으로 컷 내 연속성 확보. 컷 전환부는 편집 트랜지션으로 처리.

### 4.3 더빙·사운드 설계

- **대사는 비디오 모델의 네이티브 오디오를 쓰지 않는다.** 샷마다 목소리가 달라지는 문제 때문에, 전 에피소드 통합 TTS 트랙으로 더빙한다(네이티브 오디오는 앰비언스 소스로만 선별 활용).
- **한국어 아동 보이스**: 1군 ElevenLabs Eleven v3(2026-02 정식 출시, 오디오 태그로 감정·웃음·속삭임 제어, 한국어 품질 대폭 개선 + Voice Library 한국어 PVC). 벤치 대상: Supertone·Typecast(한국어 특화 성우 라이브러리), CLOVA Voice. 비용 절감/개인정보 옵션: Qwen3-TTS(2026-01 오픈소스, Apache 2.0, 한국어 지원, 3초 보이스 클로닝) 셀프호스팅 — L2 이름 합성 전용으로 우선 검증.
- **캐스팅**: 모리(주 내레이터) 1보이스 + 조연 3–4보이스를 라이선스 확보된 보이스로 고정. 캐릭터별 voice_id는 캐릭터 바이블에 귀속.
- **립싱크**: 5–7세용 동물 캐릭터는 입모양 단순화가 오히려 장르 관습이다. MVP는 정밀 립싱크 생략(입 개폐 타이밍만 프롬프트로 유도)하고, 클로즈업 히어로샷에만 립싱크 패스(Kling 멀티링구얼 립싱크, 한국어 립싱크 지원 모델 벤치)를 선별 적용한다.
- **음악**: 에피소드 테마 1곡 + 지역별 루프. 생성 음악은 라이선스 분쟁 이력이 있는 영역이므로, 상업 라이선스가 명시된 서비스 플랜으로만 사용하고 learning_claim처럼 곡별 출처를 기록한다. SFX는 라이선스 라이브러리 구매가 더 싸고 안전하다.
- **믹스 규격**: 대사 -16 LUFS, BGM은 대사 대비 -12dB 더킹, 순간 최대 -1 dBTP. 급격한 큰 소리(점프스케어성 SFX) 금지 — QC 자동 판정 항목.

### 4.4 QC 에이전트 (자동 품질 게이트)

- **프레임 샘플링 VLM 판정**: 클립당 1fps 샘플을 비전 모델(Claude)로 판정 — 캐릭터 일관성(바이블 대조), 해부학 오류(손가락·눈 왜곡), 공포 유발 프레임, 텍스트 아티팩트, 브랜드/워터마크 혼입.
- **모션 판정**: 프레임 간 급격한 밝기 변화(광과민성 안전: 3회/초 이상 플래시 금지), 오브젝트 순간이동.
- **오디오 판정**: 대사-자막 정렬, 라우드니스, 무음 구간.
- **판정 결과**: pass / regenerate(동일 모델 재시도) / reroute(상위 티어 모델로 승격 재생성) / human_review. 샷당 자동 재시도 상한 3회, 초과 시 인간 큐.

---

## 5. 모델 스택 (2026년 7월 기준) 과 교체 정책

> 이 표는 **오케스트레이터 model_registry의 초기값**이다. 고정 스펙이 아니라 벤치마크로 계속 갱신되는 값이며, 아래 모든 가격은 게이트웨이 기준 대략치로 계약·티어에 따라 달라진다.

| Capability | 1군 (prod) | 2군 (fallback/필러) | 후보 (canary) | 비용 감각 | 선정 근거 |
|---|---|---|---|---|---|
| video_i2v (표준샷) | **Kling 3.0** (Elements 1–4 ref, first/last frame, 15s, 4K) | Seedance 2.0 Fast (~$0.022/s) | Wan 2.6 (오픈소스 셀프호스팅, ~$0.07/s) | $0.02–0.15/s | 캐릭터 레퍼런스 통제력 + 아레나 상위권 |
| video_i2v (히어로샷) | **Veo 3.1 Quality** ($0.03–0.50/s 티어) | Kling Video O3 (~$9/분) | Seedance 2.0 Pro | $0.15–0.50/s | 물리·조명 폴리시, 최고 마감 |
| video_multiref (군중/멀티캐릭터) | **Seedance 2.0** (레퍼런스 12개, 15s 단일패스) | Kling 3.0 | HappyHorse-1.0 (한국어 립싱크 7개국어, fal 제공) | $0.02–0.12/s | 멀티 레퍼런스 최다 |
| keyframe_image | **FLUX.2** (8 ref, 드리프트 최소) | GPT Image 2 / Nano Banana 2 | Seedream 계열 | $0.02–0.13/장 | 멀티 레퍼런스 일관성 공식 지원 |
| character_3d | **Tripo (Smart Mesh P1.0, HD H3.1)** | Meshy 6 (오토리깅+애니 프리셋) | TRELLIS 2 / Hunyuan3D (오픈소스) | 건당 $0.1–2 | 클린 토폴로지 초 단위 생성 |
| tts_ko | **ElevenLabs Eleven v3** | Supertone / Typecast | Qwen3-TTS 셀프호스팅 (L2 이름 전용 우선) | ~$5–15/에피소드 | 감정 태그 + 한국어 품질 |
| lipsync (선별) | Kling 립싱크 | HappyHorse-1.0 (한국어) | — | 샷당 소액 | 클로즈업만 |
| music | 상업 라이선스 명시 생성 서비스 | 라이선스 라이브러리 구매 | — | $5–10/에피소드 | 법무 안전 우선 |
| script_llm / vlm_judge | Claude 최신 모델 | — | 신규 릴리즈 자동 벤치 | $10–30/에피소드 | 에이전트 프레임워크 일원화 |

**제외 결정**: Sora 2 — OpenAI가 앱을 2026-04에 닫았고 API를 2026-09-24에 종료한다. 벤치 대상에서 제외. (외부 모델 의존 리스크의 교과서적 사례로, 6절 오케스트레이터 설계의 존재 이유다.)

**접근 경로**: 기본은 fal.ai 등 애그리게이터(단일 API로 모델 스와핑, 카나리에 최적). 월 생성량이 특정 모델에 집중되면 해당 모델만 직결 계약으로 이전한다(단가·SLA 개선). 오픈소스 라인(Wan, Qwen3-TTS, Hunyuan3D)은 비용 하한선이자 개인정보 처리 경로로 GCP GPU에 셀프호스팅 준비를 해 둔다.

---

## 6. 오케스트레이터: 모델 자동 벤치·교체·리포팅

### 6.1 Model Registry & Adapter

모든 생성 호출은 capability별 어댑터 인터페이스를 거친다. 어댑터가 프롬프트 포맷·레퍼런스 전달 방식·해상도 파라미터의 모델별 차이를 흡수하므로, **모델 교체 = registry의 라우팅 행 하나 변경**이 된다.

```
interface GenAdapter {
  capability: 'video_i2v' | 'keyframe_image' | 'tts_ko' | ...
  generate(task: GenTask): Promise<GenResult>   // 시드·모델버전·비용·지연 자동 로깅
}
```

```sql
create table model_registry (
  id uuid primary key default gen_random_uuid(),
  capability text not null,
  provider text not null,          -- 'fal', 'google', 'elevenlabs', 'self-hosted' ...
  model_id text not null,          -- 'kling-3.0', 'veo-3.1-quality' ...
  version text,
  status text not null default 'candidate',  -- candidate | benchmark | canary | prod | retired
  tier text,                        -- 'hero' | 'standard' | 'filler'
  unit_price numeric,               -- $/sec 또는 $/장
  avg_latency_ms integer,
  quality_score numeric,            -- 최근 골든셋 종합점수 0-100
  safety_score numeric,
  policy_notes text,                -- 라이선스/상업사용/데이터보존 조항 요약
  benchmarked_at timestamptz,
  created_at timestamptz not null default now()
);

create table eval_runs (
  id uuid primary key default gen_random_uuid(),
  model_registry_id uuid references model_registry(id),
  golden_task_id text not null,
  output_url text,
  scores jsonb not null,            -- {consistency: 27, adherence: 22, motion: 18, child_safety: 15, artifact: 9}
  total numeric not null,
  cost numeric,
  latency_ms integer,
  judge_model text,
  human_override numeric,           -- 인간 스팟체크 점수(있을 때)
  created_at timestamptz not null default now()
);
```

### 6.2 Model Scout — 신모델 자동 감지·벤치·승격

1. **감시(주 1회 자동)**: fal/Replicate 신규 모델 피드, 주요 벤더 릴리즈 페이지, Artificial Analysis 아레나 순위를 크롤링해 candidate로 자동 등록. 라이선스·상업사용·아동콘텐츠 정책 조항을 요약해 policy_notes에 기록(정책 결격 시 즉시 retired).
2. **골든셋 벤치(자동)**: capability별 고정 골든 태스크 20개(부록 C)를 실행. VLM 저지가 루브릭 채점 + 비용·지연 실측. 인간은 상위 후보만 10% 스팟체크.
3. **승격 규칙**: `benchmark 총점 ≥ 현 prod 대비 +3점` 또는 `총점 동급 & 비용 -20%` → canary. **canary는 필러샷의 10%에만 배정**(히어로샷·엔딩샷 제외), 2주간 실전 QC 통과율 관찰.
4. **자동 롤백 조건**: canary QC 통과율이 prod 대비 -10%p, 또는 실측 단가 +30%, 또는 안전 판정 실패 1건 이상 → 즉시 candidate로 강등 + 오케스트레이터 다이제스트에 보고.
5. **회귀 방지**: prod 모델도 매주 골든셋 자동 재실행(벤더가 조용히 모델을 바꾸는 경우 탐지). 모든 렌더에 model_id+version+seed가 남으므로 품질 변동의 원인 추적이 가능하다.

### 6.3 비용 가드와 샷 티어 라우팅

- 콘티 에이전트가 샷마다 `tier: hero | standard | filler`를 태깅한다(에피소드당 히어로 10–15%, 필러 30–40% 목표). 라우터는 티어별 prod 모델로 배정한다.
- 에피소드별 예산 상한(기본 $400)을 두고, 소진 80% 도달 시 잔여 샷을 자동으로 하위 티어 모델로 강등 + 팀장 다이제스트 경고. 상한 초과는 인간 승인 없이는 불가.
- 리트라이 예산: 샷당 3회, 에피소드 전체 평균 1.4x 초과 시 콘티 프롬프트 품질 회귀로 간주하고 스튜디오팀장이 원인 리포트 생성.

### 6.4 CEO 인터페이스 (팀장급만 보고)

| 채널 | 내용 | 주기 |
|---|---|---|
| 스토리팀장 다이제스트 | 승인 대기 대본, 반려 사유 톱3, 오리지널리티 게이트 통계 | 일 1회 |
| 스튜디오팀장 다이제스트 | 에피소드 진행률, QC 통과율, 재생성률, 예산 소진 | 일 1회 |
| 오케스트레이터 다이제스트 | 신모델 벤치 결과, 승격/롤백 이벤트, 주간 비용 총계, 골든셋 회귀 | 주 1회 + 이벤트 시 |
| 승인 큐 (HITL#1–3) | 대본 diff·키프레임 보드·최종 시사 링크 + 원클릭 승인/반려 | 상시 |

전달 매체는 Slack/Notion. 예외 상황(안전 실패, 예산 초과, 3회 반려)만 즉시 알림, 나머지는 다이제스트로 묶는다.

---

## 7. 데이터 모델: C6 스키마와의 접합

기존 마이그레이션(C6 문서 10.1)의 `story_seeds`, `c6_axes`, `child_growth_profiles`, `game_rounds`를 그대로 쓰고, 제작·분기 레이어만 추가한다.

```sql
-- 002_story_studio.sql
create table episodes (
  id uuid primary key default gen_random_uuid(),
  story_seed_id uuid references story_seeds(id),
  title text not null,
  target_axis text references c6_axes(id),
  branching_script jsonb not null,      -- 부록 A 스키마
  duration_path_s integer,               -- 시청 경로 길이
  duration_total_s integer,              -- 총 제작 분량
  approval_status text not null default 'draft',
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table episode_nodes (              -- 세그먼트와 선택 노드
  id text not null,                       -- 'S0', 'CP1', 'E2' ...
  episode_id uuid references episodes(id),
  node_type text not null,                -- 'segment' | 'choice'
  axis_id text references c6_axes(id),    -- choice 노드만
  thinking_tool text,
  video_url text,                         -- segment 노드: 최종 인코딩 산출물
  duration_s integer,
  next_nodes jsonb not null default '[]',
  primary key (episode_id, id)
);

create table shots (
  id text not null,                       -- 'S2a_03'
  episode_id uuid references episodes(id),
  node_id text not null,
  seq integer not null,
  tier text not null default 'standard',
  duration_s numeric not null,
  keyframe_prompt text,
  motion_prompt text,
  characters text[] default '{}',
  dialogue jsonb default '[]',            -- [{char, text, name_slot}]
  status text not null default 'pending',
  primary key (episode_id, id)
);

create table renders (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid,
  shot_id text,
  kind text not null,                     -- 'keyframe' | 'clip' | 'tts' | 'music' | 'l3_personal'
  model_registry_id uuid references model_registry(id),
  seed bigint,
  input_refs jsonb,
  output_url text,
  cost numeric,
  latency_ms integer,
  qc_result text,                         -- 'pass' | 'regenerate' | 'reroute' | 'human_review'
  qc_scores jsonb,
  attempt integer default 1,
  created_at timestamptz not null default now()
);
```

**C6 환류**: 플레이어의 선택 이벤트는 기존 표준 스키마(C6 문서 10.2)로 적재한다 — `event_type='story_choice'`, `axis_id`, `thinking_tool`, `elapsed_ms`, `response_payload={"node":"CP1","choice":"b"}`. 즉 **동화 시청이 곧 game_round이며**, 축 업데이트 공식 v0.1과 부모 리포트 근거 카드가 추가 개발 없이 작동한다. L3 산출물은 renders(kind='l3_personal')로 남겨 부모 리포트 expression_output에 연결한다.

---

## 8. 인터랙티브 플레이어

- **재생 구조**: 세그먼트별 HLS 스트림 + 분기 그래프 JSON(episode_nodes). 넷플릭스 밴더스내치와 동일한 원리로, CP 진입 20초 전에 다음 분기 후보 세그먼트들의 첫 청크를 프리로드해 선택 직후 끊김 없이 전환한다.
- **선택 UI**: CP에서 영상은 짧은 대기 루프(모리가 기다리는 3–5초 루프 클립)로 전환되고 큰 터치 타깃 2–3개 표시. 15초 무응답 시 모리가 소리내어 대신 선택(기본 경로) — "고르지 못함"이 실패 경험이 되지 않게 한다.
- **로깅**: 선택·반응시간·재시청을 7절 이벤트로 적재. 오프라인 재생 시 로컬 큐잉 후 동기화.
- **L2 믹스**: name_slot 구간은 별도 오디오 세그먼트 파일로 서빙하여 클라이언트에서 갭리스 교체(영상 재인코딩 불필요).
- **접근성·안전**: 자막 기본 제공, 광과민성 검증 통과 영상만 게시, 연속 시청 알림(AAP 미디어 가이드와 정합 — 에피소드 종료 후 자동 다음 재생 없음).

---

## 9. 품질·안전 게이트 요약 (3중)

| 게이트 | 시점 | 주체 | 기준 |
|---|---|---|---|
| 자동 검수 | 상시 | Safety Guardian·QC 에이전트 | 3.4절 + 4.4절 규칙 |
| HITL#1 대본 | 스크립트 확정 | 교육팀/운영 | C6 문서 12절 표 전체 |
| HITL#2 키프레임 | 키프레임 완료 | 아트 담당 | 캐릭터 바이블 정합, 룩 통일 (샷 전수 아닌 노드당 대표 3장) |
| HITL#3 최종 시사 | 인코딩 완료 | CEO 또는 위임자 | 12경로 중 최장 1경로 전체 + 전 엔딩 시청 |

**아동안전 레드팀(분기별)**: 무서운 프레임 유도 프롬프트, 편향 유도, 잘못된 과학 개념, 금지 카피 우회 표현을 의도적으로 주입해 게이트 누수율을 측정한다. 누수 1건 = 해당 규칙 즉시 패치.

---

## 10. 테스트 플랜

| 단계 | 대상 | 방법 | 통과 기준 |
|---|---|---|---|
| T1 에이전트 단위 | Story Smith, Guardian, QC | 골든 브리프 10개 → 스키마 유효성, 금지어 검출률, 태깅 정확도 | 스키마 100%, 금지어 검출 ≥ 98% |
| T2 파이프라인 통합 | E2E 1편 | **"물방울이 사라진 날"(C6 문서 8.1 브리프 그대로)** 를 파일럿 에피소드로 완주 | 리드타임 ≤ 5일, 예산 ≤ $400 |
| T3 모델 벤치 | 전 capability | 부록 C 골든셋 20태스크 × 후보 모델 | registry 초기 순위 확정 |
| T4 레드팀 | 안전 게이트 | 9절 시나리오 30건 | 누수 0건 |
| T5 키즈 파일럿 | 아이 15–20명 | **C6 타당화 Phase B와 통합 실행** — 검사처럼 느끼는지, CP 이탈 지점, 선택 UI 이해도 | 첫 세션 완료율 ≥ 70%, CP 무응답률 ≤ 25% |
| T6 회귀 | prod 모델 | 주간 골든셋 자동 재실행 | 점수 하락 -3점 초과 시 알림 |

---

## 11. 비용 모델 (에피소드당, 2026-07 단가 기준 추정)

| 항목 | 산식 | 비용 |
|---|---|---|
| 영상 생성 | 870s × 리트라이 1.4 = ~1,220s. 티어 믹스(필러 Seedance Fast $0.022/s 40% + 표준 Kling 45% + 히어로 Veo Quality 15%) | **$80–250** |
| 키프레임 | ~145샷 × 1.5장 × 리트라이 1.5 ≈ 330장 × $0.03–0.13 | $10–45 |
| LLM (에이전트 전체) | 대본·콘티·QC 판정 | $10–30 |
| TTS·립싱크 | 대사 약 6–8천 자 + 클로즈업 립싱크 | $5–15 |
| 음악·SFX | 테마 1곡 + 라이브러리 | $5–10 |
| **합계 (1회성)** | | **약 $110–350** |
| L2 호명 | 아이당 이름 세그먼트 3–5개 | $0.01–0.05/아이 |
| L3 나만의 장면 | 키프레임 1장 + 10–15s 클립 1개 | $0.3–2/아이 |

런칭 라이브러리 12편(C6 로드맵 5–6주차 기준 6축×2편) = 생성비 **약 $1,300–4,200** + HITL 인건비. 에피소드는 전 구독자 공유 자산이므로 Pre-A 목표(유료 1,000가구) 기준 콘텐츠 원가율은 무시 가능한 수준이며, unit economics는 L3 프리미엄 옵션 쪽에서만 아이당 변동비가 발생한다.

---

## 12. 12주 로드맵 (C6 문서 14절과 동기화)

| 주차 | Story Studio 산출물 | C6 로드맵 연동 | 성공 기준 |
|---|---|---|---|
| 1–2 | 스키마(7절) 마이그레이션, 캐릭터 바이블 v1(모리 3D 마스터 발주+조연 생성), 골든셋 확정, registry 초기 벤치(T3) | C6 정본 확정과 용어 통일 | 모리 턴어라운드 승인 |
| 3–4 | Story Guild 가동 → "물방울이 사라진 날" 대본 HITL#1 승인, 어댑터 레이어 v1 | 온보딩 입장 여행 개발과 병행 | 대본 승인 리드타임 ≤ 3일 |
| 5–6 | Studio Guild E2E → **파일럿 에피소드 1편 완성(T2)**, HITL#2·3 툴 | 12개 코어 에피소드 착수 | 예산 ≤ $400, 시사 통과 |
| 7–8 | 인터랙티브 플레이어 + story_choice 로깅 → child_growth_profiles 환류, 부모 리포트 근거카드 연결 | 부모 리포트 live API와 동일 스프린트 | 선택 이벤트가 리포트에 표시 |
| 9–10 | 오케스트레이터 v1 완성(Scout·카나리·롤백·다이제스트), 에피소드 +3편(누적 4) | 추천 v0.1(C6+GACS)과 접합: 추천 씨앗=에피소드 | 신모델 1개 카나리 실주행 |
| 11–12 | **베타 50가구(T5=Phase B 통합)**, L2 호명 가동, 티어 믹스 튜닝, 레드팀 1차 | 베타 50가구·retention 측정과 동일 코호트 | 첫 세션 완료율 70%, 리포트 열람률 60% |

12주 이후: 12편 라이브러리 완성 → L3 프리미엄 베타 → 풀 3D(Phase A안) 타당성 재평가.

---

## 13. 리스크와 대응

| 리스크 | 신호 | 대응 |
|---|---|---|
| 캐릭터 드리프트 | QC 일관성 점수 하락 | 캐릭터 바이블은 모델 독립 자산 — 레퍼런스 세트 보강, 히어로샷 상위 모델 승격, 최악 시 해당 캐릭터만 풀 3D 전환 |
| 외부 모델 종료·정책 변경 | Scout의 policy_notes 변경 감지 | capability당 2군+오픈소스 백업 상시 유지(Sora 2 사례). 셀프호스팅 라인(Wan/Qwen3-TTS) 워밍 |
| 저작권·표절 | 오리지널리티 게이트 임계 근접 | 3.2절 정책 + 시각물 유사도 게이트. B2G 채널 특성상 무관용 |
| 아동 데이터(이름·행동로그) | — | L2 로컬 합성 기본안, 이벤트는 기존 비식별화 파이프라인 경유, 개인정보보호법·AI기본법 체크리스트를 HITL#1에 포함 |
| 비용 폭주 | 에피소드 예산 80% 경보 | 6.3절 자동 강등 + 상한 하드스톱 |
| 무서운 프레임 유출 | QC 안전 판정 | 이중 게이트(VLM 전수 + HITL#3 전 엔딩 시사) + 레드팀 분기 반복 |
| 생성 실패 루프 | 샷 리트라이 평균 > 1.4x | 콘티 프롬프트 회귀 리포트 → 프롬프트 템플릿 버전 롤백 |

---

## 부록 A. 분기 스크립트 JSON 스키마 (요약)

```json
{
  "episode_id": "uuid",
  "story_seed_id": "uuid",
  "target_axis": "C2_observation_inquiry",
  "world_region": "droplet_lab",
  "nodes": [
    {
      "id": "S1", "type": "segment", "duration_s": 60,
      "scenes": [{
        "scene_id": "S1_1",
        "learning_beat": "젖은 것과 마른 것의 차이 관찰",
        "shots": [{
          "shot_id": "S1_03", "duration_s": 6, "tier": "standard",
          "keyframe_prompt": "<룩 프리셋> + 장면 서술",
          "motion_prompt": "카메라·동작 서술",
          "characters": ["mori"],
          "dialogue": [{"char": "mori", "text": "{{child_name}}, 저기 좀 봐!", "name_slot": true}]
        }]
      }],
      "next": "CP1"
    },
    {
      "id": "CP1", "type": "choice",
      "axis_id": "C2_observation_inquiry", "thinking_tool": "observation",
      "prompt_line": "어디부터 살펴볼까?",
      "wait_loop_shot": "CP1_LOOP",
      "options": [
        {"id": "a", "label": "반짝이는 웅덩이", "icon": "puddle", "next": "S2a",
         "report_sentence": "OO이는 반짝이는 단서를 먼저 살펴봤어요."},
        {"id": "b", "label": "젖은 발자국", "icon": "footprint", "next": "S2b",
         "report_sentence": "OO이는 발자국을 따라가 보기로 했어요."}
      ],
      "timeout_ms": 15000, "timeout_default": "a"
    }
  ]
}
```

검증 규칙: 전 노드 도달 가능, 종단은 E* 노드만, 경로 길이 분산 ±10%, 모든 choice에 axis_id·report_sentence 존재, name_slot 총 3–5개.

## 부록 B. 샷 프롬프트 룩 프리셋 (v1 초안)

```
[STYLE] high-quality stylized 3D animation for children, soft rounded shapes,
subsurface-lit felt-like textures, warm forest palette (Mori world colors),
gentle depth of field, no text, no watermark, no scary elements
[CHARACTER] <캐릭터 바이블 레퍼런스 2–4장 첨부> keep exact proportions, colors, eye shape
[NEGATIVE] photorealistic human, horror, dark shadows, flicker, extra fingers, brand logos
```

프리셋은 버전 관리(v1, v1.1…)하며 콘티 에이전트는 프리셋 ID만 참조한다 — 룩 변경이 전 샷에 일괄 반영되는 구조.

## 부록 C. 골든셋 & 이벌 루브릭

**골든 태스크 예 (video_i2v, 20개 중 발췌)**: ① 모리 턴어라운드 워크사이클 ② 물방울 증발 슬로모션(물리) ③ 모리+다람이 2캐릭터 하이파이브(멀티캐릭터) ④ 빗속 우산 씬(파티클) ⑤ 카메라 팬 + 캐릭터 고정(정체성 유지) ⑥ 한국어 짧은 대사 클로즈업(립싱크 후보용) …

**루브릭 (총 100점)**: 캐릭터 일관성 30 · 프롬프트 준수 25 · 모션/물리 20 · 아동 적합성(공포·왜곡 프레임 무) 15 · 아티팩트 무결성 10. VLM 저지 채점 + 상위 후보 10% 인간 스팟체크(human_override 우선). 비용·지연은 점수와 별도 축으로 기록해 라우팅에 사용.

## 부록 D. 리서치 근거 링크 (2026-07 확인)

- 모델 비교: atlascloud.ai/blog (Seedance 2.0·Kling 3.0·Veo 3.1 비교), pinggy.io/blog/best_video_generation_ai_models, wavespeed.ai/blog (Sora 2 API 종료 일정), llm-stats.com 비디오 아레나
- 캐릭터 일관성: queststudio.io (FLUX.2 멀티 레퍼런스), blog.mage.space (Kling Elements·Motion Control 3.0)
- 3D 에셋: meshy.ai/compare/meshy-vs-tripo, trellis2.app/blog (TRELLIS 2·Hunyuan3D)
- TTS: elevenlabs.io/ko (Eleven v3 한국어), humelo.com/tts-api (한국어 TTS API 비교), Qwen3-TTS 오픈소스 리포트

---

**마지막 원칙** — 파이프라인은 자동이지만, 세계관·안전·아이에게 하는 말은 사람이 지킨다. AI는 후보를 만들고, 모리의 목소리는 승인된 것만 아이에게 닿는다.
