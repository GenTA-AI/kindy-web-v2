# 27. Story Chat API·DB 활성화 결정

작성일: 2026-08-24
상태: 코드 foundation 구현, hosted runtime 미활성

## 결론

첫 출시선의 대화 API는 두 경로를 분리한다.

1. **선택지·빠른 답장**
   - LLM을 호출하지 않는 authored ExperienceGraph 전이다.
   - 서버가 현재 node, option allowlist, release pin, revision을 검증한 뒤
     DB RPC로 CAS commit한다.
   - 아이에게는 commit된 결과를 signed ContentRelease로 다시
     렌더링한 메시지만 보여 준다.

2. **자유 채팅**
   - 현재 코드와 배포에서 완전히 OFF다.
   - 활성화 후에도 자유 대화를 생성하는 것이 아니라, 승인된
     graph 안의 다음 행동 ID만 모델이 선택하는 `Narrative Director`로 제한한다.

## 모델과 API

첫 내부 후보는 Anthropic Messages API의 `claude-sonnet-5`다.

- `output_config.format` JSON Schema structured output을 사용한다.
- 모델은 새 대사·URL·이미지 prompt를 만들지 못하고, 서버가 제공한
  `reply|choice|cinematic|imageRecipe|safetyAction` ID만 반환한다.
- 현재 기본은 output 512 tokens, provider timeout 4초, non-streaming이다.
- 응답 전체가 schema·graph·안전 검사를 통과하기 전에는 browser에
  한 글자도 stream하지 않는다.

Anthropic은 Sonnet 5의 API ID를 `claude-sonnet-5`로 명시하고, structured
outputs에서 JSON Schema 구속을 제공한다.

- https://platform.claude.com/docs/en/about-claude/models/whats-new-sonnet-5
- https://platform.claude.com/docs/en/build-with-claude/structured-outputs

OpenAI는 provider-neutral interface의 다음 bake-off 후보로 남겨 둔다. 현재
서버에 안전하게 연결된 production adapter는 Anthropic 하나이므로,
평가 없이 provider를 동적 전환하지 않는다.

## Wenit 검수 순서

사용자가 지연보다 안전을 우선했으므로, 자유 입력 활성화 시
다음의 두 개 inline gate를 유지한다.

```text
auth + child ownership + child_free_text_ai consent
  → local normalization / PII / crisis hard gate
  → Wenit input moderation
  → Claude Sonnet 5 structured action selection
  → exact graph allowlist validation
  → final rendered candidate + child context Wenit output moderation
  → atomic DB commit
  → server-rendered browser DTO
```

Wenit `timeout|429|failed|unknown schema|version drift`는 모두 allow가 아니라
`unavailable`로 취급하고 검수된 고정 대사로 degrade한다. 실측상 두
번의 Wenit polling과 모델을 직렬로 거치면 일반 답장도 10–15초가
걸릴 수 있다. UI는 4초 이내에 검수 중 상태를 보여 주되,
검수 완료 전 생성 대사를 노출하지 않는다.

## DB 현재 상태

- 로컬 PostgreSQL 17 하네스에서 chat/content release/Wenit scheduler 마이그레이션을
  clean apply하고 RLS·RPC·CAS·권한을 검증했다.
- hosted `Kindy v0.0.1` Supabase는 아직 `0029`까지다.
- Supabase 계정에 Kindy preview 전용 project는 아직 없다.
- preview와 production을 같은 DB/service-role로 열지 않는다. 별도 preview
  project가 준비된 뒤에만 신규 migration을 적용한다.

## 활성화 전 남은 gate

1. GCS immutable bucket + runtime `objectViewer` + publisher `objectCreator` 분리.
2. runtime DB identity에서 registry/publisher/direct table mutation 제거.
3. 별도 preview Supabase project 생성 및 전체 migration/PG 하네스 재검증.
4. staging ContentRelease 하나를 upload→byte verify→approve→activate.
5. authored-only protected pilot route smoke 및 rollback.
6. 한국어 아동 안전 corpus·Wenit 부하·오탐/미탐 gate 통과 후
   `child_free_text_ai` 자유 입력을 별도로 연다.

이 순서에서 authored chat runtime과 free-text runtime은 동시에 켜지 않는다.
먼저 authored-only DB/UI를 열고, 자유 입력은 독립 go/no-go를 거친다.
