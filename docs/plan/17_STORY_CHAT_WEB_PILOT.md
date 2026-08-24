# 17. 세계관 채팅 웹 파일럿

작성일: 2026-08-19
상태: 제품 방향 승인, UI 프로토타입 구현 단계

## 1. 제품 결정

Kindy의 아이용 첫 화면을 콘텐츠 라이브러리가 아니라 메신저형 세계관 입구로 바꾼다.

- `대화방`은 하나의 지속되는 세계관이다.
- `에피소드`는 그 세계에서 벌어지는 사건이다.
- 사전 제작 영상, 선택 카드, 미니게임, 생성 이미지는 채팅 타임라인에 도착하는 특수 메시지다.
- 웹 파일럿에서는 새 세계관 초대 방 하나를 가장 강하게 노출한다.
- 나머지 방은 운영 공지, 이용 안내, 다음 이야기 예고처럼 보이게 한다.
- 자유 입력창은 열어 두되 실제 서사 상태는 승인된 스토리 그래프 안에서만 이동한다.

이 문서는 `docs/plan/10_FABLE_RPG_WORLD.md`와 `docs/plan/11_LIGHTHOUSE_ISLAND.md`의 “실시간 자유 대화 없음” 원칙을 **이 웹 파일럿 범위에서만** 갱신한다. 무제한 AI 친구를 만드는 것이 아니라, 아이가 자기 말로 참여할 수 있는 저작 세계형 대화를 검증한다.

## 2. 웹 파일럿 범위

### `/chats`

- 새 세계관 초대: `그림 속 탐정단`
- 공지방: `킨디 소식`, `모리의 이용 안내`, `다음 세계 예고`
- 초대 방에는 대표 캐릭터, 새 세계 배지, 마지막 메시지, 9:16 장면 미리보기를 표시한다.
- 공지방은 방송형임을 분명히 표시하고 입력창을 제공하지 않는다.

### `/chats/[roomId]`

메시지 종류:

- 캐릭터 텍스트
- 아이 텍스트
- 빠른 답장
- 행동 선택 카드
- 9:16 사전 제작 영상
- 개인화 생성 이미지와 생성 중 상태
- 사건 시작·완료 안내
- 공지 메시지

이번 프로토타입은 fixture와 클라이언트 상태만 사용한다. 외부 LLM 호출, 원문 저장, 보호자 데이터 연결은 하지 않는다.

## 3. 대화 모델 결정

웹 파일럿의 기본 모델은 Anthropic `claude-haiku-4-5`로 시작한다. 다만 실제 아동에게 열기 전, 같은 한국어 골든셋으로 OpenAI `gpt-5.6-terra`와 Google `gemini-3.6-flash`를 함께 평가해 출시 모델을 고정한다.

선택 이유:

- 현재 저장소에 Anthropic SDK와 서버 호출 경로가 이미 있어 새 공급자 연동 없이 가장 빨리 검증할 수 있다.
- Anthropic은 Haiku 4.5를 실시간·고빈도·비용 민감 작업용의 가장 빠른 모델로 안내하고, JSON Schema 기반 Structured Outputs를 지원한다.
- Haiku 4.5의 공식 가격은 입력 $1/MTok, 출력 $5/MTok으로 짧은 채팅 턴의 초기 비용을 통제하기 쉽다.
- `gpt-5.6-terra`는 지능·비용 균형과 Structured Outputs가 강점이고, `gemini-3.6-flash`는 속도·지능 균형을 내세우는 안정 모델이다. 두 모델을 품질 challenger로 유지하면 공급자 종속 없이 결과로 선택할 수 있다.

권장 초기 설정:

```text
provider             anthropic
model                claude-haiku-4-5
output_config        JSON Schema (additionalProperties: false)
thinking             사용 안 함
max_tokens           320
raw-log              저장 안 함
safety               규칙·PII 제거 + 독립 입출력 안전 분류
timeout              6초
retry                네트워크 오류 1회만
fallback             다른 모델이 아니라 승인된 고정 대사
```

모델 bake-off는 최소 200개의 한국어 아동 대화 턴으로 `스키마 준수`, `허용 노드 선택`, `세계관 기억`, `연령 적합 문체`, `PII·위기 안전 경로`, `P95 지연`, `턴당 비용`을 비교한다. Haiku가 아래 품질 게이트를 통과하지 못하면 Terra를 출시 기본값으로 올린다. Gemini는 품질 동등성과 운영비 우위가 동시에 확인될 때만 기본값으로 쓴다.

근거:

- [Anthropic 모델 선택 가이드](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model)
- [Anthropic Structured Outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [OpenAI 모델 가이드](https://developers.openai.com/api/docs/guides/latest-model)
- [GPT-5.6 Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra)
- [Responses API와 Structured Outputs](https://developers.openai.com/api/reference/resources/responses)
- [Gemini 모델 목록](https://ai.google.dev/gemini-api/docs/models)
- [Gemini Structured Outputs](https://ai.google.dev/gemini-api/docs/structured-output)
- [omni-moderation-latest](https://developers.openai.com/api/docs/models/omni-moderation-latest)
- [OpenAI Usage Policies](https://openai.com/policies/usage-policies/)

모델 별칭은 내부 파일럿에서만 쓴다. 출시 전에는 동일 골든셋을 통과한 고정 모델 ID나 스냅샷을 사용하고, `NARRATIVE_PROVIDER`와 `NARRATIVE_MODEL`로 미디어 제작 모델과 분리한다.

## 4. Narrative Director의 역할

모델은 이야기를 마음대로 만드는 작가가 아니다. 아이의 말을 이해하고, 승인된 다음 장면 중 하나를 고르는 연출자다.

입력:

- 현재 세계와 에피소드 ID
- 현재 노드와 이동 가능한 다음 노드 ID
- 최근 정제된 대화 최대 6턴
- 구조화된 세계 기억
- 읽기 난이도, 힌트 수준, 선호 장르 같은 경험 프로필
- 이번 노드의 학습 목표와 금지 항목

출력은 strict JSON Schema로 제한한다.

```ts
type NarrativeTurn = {
  reply: string;
  acknowledgedIntent: 'observe' | 'ask' | 'choose' | 'imagine' | 'off_topic';
  nextNodeId: string;
  quickReplyIds: string[];
  action: 'continue_chat' | 'show_choice' | 'play_cinematic' | 'request_image' | 'safe_redirect';
  memoryPatch: {
    choiceId?: string;
    discoveredClueIds?: string[];
    relationshipDelta?: 'warmer' | 'same';
  };
  safetyRoute: 'normal' | 'privacy_redirect' | 'trusted_adult' | 'blocked';
};
```

서버가 반드시 다시 검증할 항목:

- `nextNodeId`, 빠른 답장, 영상, 이미지 recipe가 현재 노드의 허용 목록에 존재하는가
- 답변이 2개 말풍선·220자 이하인가
- 새로운 URL, 인물, 아이템, 이미지 프롬프트를 임의로 만들지 않았는가
- 입력과 출력 moderation을 모두 통과했는가
- 실패 시 고정 안전 대사로 전환했는가

모델은 미디어 URL, 이미지 프롬프트, DB 변경, 학습 점수를 직접 만들 수 없다.

## 5. 캐릭터 대화 가이드라인 v1

### 말투와 진행

- 아이 이름은 자연스럽게 사용하되 매번 부르지 않는다.
- 한 번에 1~2개의 짧은 말풍선, 질문은 하나만 한다.
- 먼저 아이의 말을 구체적으로 받아주고, 다음에 세계 안의 행동을 제안한다.
- 정답을 즉시 말하지 않고 관찰, 이유, 비교, 상상을 한 번 더 묻는다.
- 엉뚱한 답도 1턴은 세계 안의 작은 반응으로 인정한 뒤 사건으로 돌아온다.
- 빠른 답장은 도움 장치이며 자유 입력보다 우월하게 보이지 않게 한다.

### 관계 경계

- 캐릭터는 사람, 선생님, 상담사라고 속이지 않는다.
- “나만 믿어”, “비밀로 하자”, “너만 내 친구야” 같은 독점 관계를 만들지 않는다.
- 돌아오지 않았다고 서운함·죄책감·소멸 압박을 주지 않는다.
- 사용 시간, 결제, 연속 접속을 유도하지 않는다.
- 보호자나 친구를 대신하려 하지 않고 현실의 관계를 연결한다.

### 개인정보와 위험 상황

- 실명 전체, 학교, 주소, 전화번호, 위치, 사진을 묻지 않는다.
- 아이가 개인정보를 보내면 반복 인용하거나 기억하지 않고 공유하지 말라는 고정 문구로 전환한다.
- 폭력·성적·그래픽한 역할극, 위험한 도전, 외부 만남을 진행하지 않는다.
- 자해, 학대, 즉각적인 위험 신호에는 이야기를 중단하고 믿을 수 있는 어른에게 지금 알리도록 안내하는 승인 문구를 사용한다.
- 내면 감정이나 성격을 진단하지 않는다. “집중력이 낮다”, “불안하다” 같은 라벨을 만들지 않는다.

### 학습과 개인화

- 자유 채팅을 자동 채점하지 않는다.
- 작가가 rubric을 붙인 체크포인트만 학습 근거가 될 수 있다.
- 개인화는 문장 길이, 힌트 양, 선택지 수, 영상 간격, 소재 추천을 바꾼다.
- 체류시간 최대화가 아니라 이해, 자기 표현, 건강한 종료를 함께 최적화한다.

## 6. 출시 전 하드게이트

UI 파일럿은 바로 공개할 수 있지만 실제 LLM 대화는 아래가 완료되기 전 켜지 않는다.

1. 보호자의 명시적 `child_free_text_ai` 동의
2. 개인정보처리방침에 자유 입력, 외부 AI 처리, 보존·삭제 방법 고지
3. 원문 최소 보존 및 보호자 삭제 기능
4. 입력 PII 제거와 입출력 moderation
5. 프롬프트 인젝션·위기 상황·부적절 역할극 골든셋
6. 아동용 고정 안전 대사에 대한 인간 검수
7. `model`, `promptVersion`, `policyVersion`, 지연, 토큰, 안전 결과 감사 로그
8. 모델 실패·6초 초과·네트워크 단절 시 저작 대사 폴백

선택한 AI 공급자의 미성년자·데이터 처리 약관을 다시 확인하고, 자유 입력의 외부 AI 전송에 대한 보호자 동의와 고지를 별도로 마련한다. 국내 아동 개인정보 처리와 국외 이전 요건은 별도 법률 검토를 거쳐야 한다.

## 7. 파일럿 평가

- 앱 진입 후 새 세계관 방을 스스로 찾는가
- 첫 대화에서 자유 입력 또는 빠른 답장을 자연스럽게 사용하는가
- 영상이 채팅의 단절이 아니라 액션 장면처럼 느껴지는가
- 영상 종료 후 같은 대화 맥락을 기억하는가
- 생성 이미지가 자신의 선택 결과라고 이해하는가
- 특정 방을 기억하고 다시 열고 싶어 하는가
- 캐릭터를 실제 사람이나 비밀 친구로 오해하지 않는가

LLM 단계의 초기 품질 게이트:

- 허용되지 않은 `nextNodeId` 0건
- 위험 출력 노출 0건
- 개인정보 재인용 0건
- 고정 안전 폴백 성공률 100%
- 첫 답변 P95 3초 목표, 6초 초과 시 폴백
- 작가 평가 대화 적합도 95% 이상
