# Mori C6 창의 성장지도 v1.0 — 구현 정본 (PDF 증류판)

> 원본: Mori_C6_창의성장지도_연구_및_서비스적용_명세서_v1.0.pdf (2026-06-28).
> **이 문서가 기존 코드의 C6 개념보다 우선한다.** 기존 코드의 C6ToolKey(observe|imagine|pattern|transform|design|compose)는
> "창의 6도구"였고, 이 정본의 C6는 **여섯 성장 축**이다. 기존 도구 개념은 13 생각도구(thinking_tool)의 부분집합으로 흡수된다.

## 0. 대원칙 (대표 지시 + 명세서)

1. **애플처럼 간결·미니멀 UIUX.** 한 화면 한 행동, 큰 요소, 글보다 이미지/음성.
2. **보이지 않는 AI.** 이용자는 AI가 돌고 있음을 몰라야 한다. AI는 목적이 아니라 UX 도구. 고객 표면에 "AI가 진단/분석" 류 문구 금지(법정 AI 생성물 라벨 1곳 제외).
3. **초개인화.** 쓸수록 모든 표면이 그 아이에게 맞춰진다. 데이터→성장지도→추천→콘텐츠 선별이 한 루프.
4. 타겟 5-7세 고정. 영상이 주, 영상 중간 인터랙티브 선택지가 관찰(진단) 신호이자 학습.
5. **"진단"은 내부 언어.** 고객 표면은 "성장지도/관찰/씨앗". 금지 카피: "부족합니다", "발달 지연", "ADHD 경향", "또래보다 낮음", "상상력 42점", "AI가 진단했습니다", "놓치면 뒤처집니다", 점수/등급/또래비교.

## 1. C6 여섯 축 (id는 코드 정본)

| axis_id | name_ko | 정의(행동) | 주요 행동 신호 | world_region |
|---|---|---|---|---|
| C1_focus_flow | 집중·몰입 | 짧은 활동에 머물고 규칙을 기억하며 힌트 후 다시 시도 | 완료율, 이탈 지점, 반응 지연, 힌트 후 재시도, 활동 전환 적응 | 별빛 언덕 |
| C2_observation_inquiry | 관찰·탐구 | 작은 차이·질감·소리·변화를 주의 깊게 발견 | 탐색 시간, 발견 수, 첫 클릭까지 시간, 힌트 사용, 단서 종류 | 숨은 관찰길 |
| C3_pattern_problem | 패턴·문제해결 | 반복·순서·규칙을 알아차리고 예측/새 규칙 생성 | 정답률, 순서 완성, 규칙 전환 성공, 재시도 후 완료, 오류 유형 | 물방울 실험터 |
| C4_language_expression | 언어·표현 | 단어·그림·소리·문장을 연결하고 자기 방식으로 설명 | 그림-단어 연결, 이야기 이해, 문장 선택, 자기 설명 길이, 산출물 저장 | 말장원 |
| C5_imagination_analogy | 상상·유추 | 서로 다른 것을 연결, 익숙한 것을 낯설게, 가능성 통합 (핵심 차별화 축) | 아이디어 수, 선택 다양성, 독창 선택, 연결 이유, 변형 횟수 | 거꾸로 시장 |
| C6_social_emotional | 마음·사회성 | 캐릭터 감정·관점 인지, 도움/기다림/나눔/협력 선택 | 감정 선택, 도움 전략, 갈등 선택, prosocial choice, 캐릭터 선호 | 마음 호수 |

(world_region 이름은 아이 표면 언어 — 콘텐츠팀이 조정 가능, id는 고정)

## 2. 측정 모델: ECD + Stealth Assessment

- Student Model: `child_growth_profiles(child_id, axis_id, current_level 0-100, confidence 0-1, evidence_count, trend, preferred_activity_type, preferred_character_id)`
- Evidence Model: 행동 로그 → 축 근거 (예: 힌트 후 재시도 = C1/C3 근거)
- Task Model: 과제 템플릿이 어떤 행동을 유도하는지 (T1-T7)
- Assembly: 한 세션 안에 축·난이도 균형 배치 (C1+C2+C3 또는 C1+C5+C6 조합)
- Reporting: 부모에게 점수 대신 관찰 문장 ("재도전 후 완성" 카드)
- **내부 숫자·외부 성장상태**: axis_level_0_100/confidence/trend는 절대 고객 노출 금지. confidence 낮음 → "성장지도가 더 선명해지는 중".

## 3. 축 업데이트 공식 v0.1 (그대로 구현)

증거 묶음: Performance(과제 달성, is_correct/completed) 0.30 · Process(풀이 질, elapsed_ms 적정, hint_count, error_type) 0.25 · Persistence(retried, retry_success, abandon_after_error) 0.20 · Preference(preferred_character, activity_type_revisit) 0.10 · Transfer(same_concept_success_later) 0.15

```ts
function updateAxis(previous, evidence) {
  const base = 0.30*evidence.performance + 0.25*evidence.process + 0.20*evidence.persistence
             + 0.10*evidence.preference + 0.15*evidence.transfer;           // 각 0..1
  const ageAdjusted = clamp(base + evidence.age_band_adjustment, 0, 1);
  const confidenceGain = Math.min(0.08, 0.02 + evidence.quality * 0.06);
  return {
    level: round(100 * (0.85 * previous.level/100 + 0.15 * ageAdjusted)),
    confidence: clamp(previous.confidence + confidenceGain, 0, 1),
    evidence_count: previous.evidence_count + 1,
  };
}
```

## 4. 과제 템플릿 T1-T7 (영상·게임·퀴즈에 삽입)

| id | 아이 이름 | 축 | 설명 | 수집 변수 |
|---|---|---|---|---|
| T1_HIDDEN_CLUE | 숨은 관찰길 | C2/C1 | 장면 속 친구·색 변화·소리 단서 찾기 | elapsed_ms, found_count, hint_count |
| T2_RULE_SWITCH | 반대로 찾기 | C1/C3 | 색으로→모양으로 규칙 전환(DCCS식) | rule_switch_success, retry_count |
| T3_SEQUENCE | 물방울 길 만들기 | C3 | 상태 변화/사건 순서 맞추기 | sequence_order, retry_count |
| T4_WORD_IMAGE | 말징원 연결 | C4 | 말한 단어와 그림/장면 연결 | selected_answer, exposure_count |
| T5_ANALOGY_MARKET | 거꾸로 시장 | C5 | 사물의 새 용도·공통점 고르기 | idea_choice, novelty_tag, reason_type |
| T6_HEART_LAKE | 마음 호수 | C6 | 캐릭터 마음·도와줄 방법 선택 | emotion_choice, prosocial_choice |
| T7_CREATE_SCENE | 별빛 작업실 | C4/C5 | 선택으로 장면 꾸미기/결말 만들기 | asset_count, saved, diversity_index |

13 생각도구(thinking_tool): observation, visualization, abstraction, pattern_recognition, pattern_forming, analogy, body_thinking, empathy, dimensional_thinking, modeling, play, transformation, synthesis. (기존 C6ToolKey는 이 중 observation/analogy/pattern_*/transformation/synthesis 등으로 매핑)

## 5. 첫 사용 10분 "모리의 숲 입장 여행" (온보딩 = 기준선, 검사 화면 금지)

| # | 아이 경험 | 측정 축 | 핵심 로그 |
|---|---|---|---|
| 1 | 모리 인사 "너에게 빛나는 씨앗을 찾아볼게" | 진입/몰입 | start_time, skip_intro |
| 2 | 숨은 반짝이 찾기 | C2/C1 | found_count, elapsed_ms, hint_count |
| 3 | 색으로 찾기→모양으로 찾기 | C3/C1 | rule_switch_success, attempts |
| 4 | 다음 무늬 고르기 | C3 | accuracy, retry_count |
| 5 | 캐릭터 마음 고르기 | C6 | emotion_choice, response_time |
| 6 | 그림에 맞는 단어 고르기 | C4 | selected_answer, confidence_proxy |
| 7 | "이 구름은 무엇이 될 수 있을까?" | C5 | idea_choice_diversity, novelty_tag |
| 8 | 짧은 이야기 영상 후 한 문제 | C1/C4 | video_completion, quiz_result |
| 9 | 오늘 빛난 씨앗 2개 추천 | 개인화 시작 | recommended_seed_ids, reason_codes |

첫날 리포트: "오늘은 첫 관찰이에요. OO이가 어떤 이야기와 활동에서 더 오래 머무는지 살펴봤어요. 3번의 세션이 쌓이면 성장지도가 더 선명해져요."

## 6. DB (마이그레이션 §10.1 — 기존 테이블 갈아엎지 않고 추가)

```sql
create table if not exists c6_axes (id text primary key, name_ko text not null, world_region text not null,
  parent_label text not null, child_label text not null, description text not null);
create table if not exists story_seeds (id uuid pk default gen_random_uuid(), title text not null,
  world_region text not null, target_axis text references c6_axes(id), secondary_axis text references c6_axes(id),
  thinking_tools text[] not null default '{}', subject_domain text not null, age_band int4range not null,
  difficulty int not null default 1, approval_status text not null default 'draft',
  published boolean not null default false, created_at timestamptz not null default now());
alter table library_videos add column if not exists story_seed_id uuid references story_seeds(id),
  add column if not exists target_axis text references c6_axes(id),
  add column if not exists thinking_tools text[] default '{}', add column if not exists world_region text;
alter table game_rounds add column if not exists axis_id text references c6_axes(id),
  add column if not exists story_seed_id uuid references story_seeds(id),
  add column if not exists thinking_tool text, add column if not exists world_region text,
  add column if not exists elapsed_ms integer, add column if not exists hint_count integer default 0,
  add column if not exists retry_count integer default 0,
  add column if not exists response_payload jsonb default '{}'::jsonb;
create table if not exists child_growth_profiles (child_id uuid not null references children(id),
  axis_id text not null references c6_axes(id), current_level numeric not null default 50,
  confidence numeric not null default 0, evidence_count integer not null default 0, trend text,
  preferred_activity_type text, preferred_character_id text, last_evidence_at timestamptz,
  updated_at timestamptz not null default now(), primary key (child_id, axis_id));
create table if not exists recommendation_logs (id uuid pk default gen_random_uuid(),
  child_id uuid not null references children(id), recommended_story_seed_id uuid references story_seeds(id),
  reason_axis_id text references c6_axes(id), reason_summary_parent text not null,
  personalization_inputs jsonb not null default '{}'::jsonb, accepted boolean, completed boolean,
  created_at timestamptz not null default now());
```
(RLS: 기존 컨벤션 준수 — child 데이터는 parent 스코프 select, 쓰기는 service-role 전용. game_rounds 기존 RLS 유지.)

이벤트 표준 필드: event_type, child_id, session_id, round_id, axis_id, thinking_tool, story_seed_id, elapsed_ms, hint_count, retry_count, is_correct(boolean|null), response_payload(jsonb).

## 7. 추천 v0.1 (C6=what, GACS=how)

```
input = { c6: child_growth_profiles, gacs: word_profiles_or_gacs, recent: last_3_sessions, pool: approved story_seeds }
rule: 1) 근거 충분+보통 필요의 growth_axis 1개  2) strength_axis 1개(다리)
      3) story_seeds: age 5-7, approved, target_axis ∈ {growth, bridge}
      4) rank by preferred_activity_type, preferred_character, novelty_limit, difficulty_band
      5) top 2 + parent_reason_summary
```
예: "찾기 활동에서 오래 머문 관찰 강점을 활용해 다음에는 물의 변화 순서를 짧은 게임으로 이어갑니다."
모든 추천은 recommendation_logs에 기록(입력 스냅샷 포함).

## 8. 부모 리포트 7섹션

이번 주 이야기 / C6 성장지도(6각형 or 씨앗 6개 상태) / 잘 들어간 학습 문(강점) / 더 자랄 씨앗(부족 단정 없이) / 생각도구 기록 / 다음 추천(이유 포함) / 부모 대화 힌트.
문장 템플릿(부록 B): "OO이는 {activity}에서 작은 단서를 찾는 데 오래 머물렀어요. 다음에는 이 관찰 강점을 활용해 {next_concept}을 이어갈게요."

## 9. HITL

세계관·축 연결·생각도구·모리 톤·부모 리포트·문화 안전은 사람이 승인(published=false→approve→true). 모리 톤: 평가보다 질문, 안정적·따뜻. 금지: "틀렸어", "빨리 해", "네가 안 하면 큰일 나".
