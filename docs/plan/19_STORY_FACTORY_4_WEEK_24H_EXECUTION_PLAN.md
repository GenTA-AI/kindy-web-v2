# 19. Kindy Story Factory 4주 · 24시간 실행계획

작성일: 2026-08-20
실행기간: 2026-08-20 ~ 2026-09-16 (D1~D28, 28 calendar days)
상태: **LATEST · 실행 정본**
대상 저장소: `kindy-web.v2`, `mori-studio`
선행 정본: `18_STORY_FACTORY_SAFETY_UX_MASTER_PLAN.md`

이 문서는 18번 문서의 제품·안전·아키텍처 결정을 유지하면서, 그 문서의 **12주 일정과 P0 순서만 4주 24시간 실행계획으로 대체**한다. 일정 때문에 권리, 아동안전, 개인정보, 사람 승인 gate를 생략하지 않는다.

---

## 0. 대표 결정

4주 안에 끝내는 대상은 “완전 자동화된 다세계 AI 플랫폼”이 아니다. 다음 두 가지를 끝낸다.

1. **보호된 웹 파일럿으로 출시 가능한 세계 1개**
2. **같은 형식의 다음 세계를 다시 만들 수 있는 Story Factory v0**

4주 종료일은 미루지 않는다. 대신 출시 모드를 두 개로 분리한다.

| 모드 | D28 결과 | 채택 조건 |
|---|---|---|
| **A. Authored Core** | 승인된 빠른 답장·선택·영상·이미지 variant·퀴즈로 완결되는 대화형 동화 | 필수 출시선. G0~G5 통과 시 출시 |
| **B. Strict Free Text** | 아이 자유입력 → PII·위기 검사 → Wenit 입력 검사 → 닫힌 Narrative Director → Wenit 출력 검사 | stretch. 안전·법무·성능 gate 전부 통과할 때만 A 위에 flag로 활성화 |

D20 또는 D27에 B의 항목 하나라도 미달하면 `free_text=false`로 고정하고 A로 출시한다. **자유입력 실패가 전체 제품 출시 실패가 되게 만들지 않는다.**

24시간 일하는 주체는 자동화 에이전트, CI, 평가, 렌더 queue다. 사람을 3교대로 소모하지 않는다. 사람은 정해진 승인창과 S0/S1 온콜에만 개입한다.

---

## 1. 4주 완료 정의

### 1.1 제품 범위

- 첫 세계 후보: `그림 속 탐정단 — 쇠라와 사라진 색점`.
- 한 세션 3~5분.
- 의미 있는 선택 2회.
- 서로 다른 결말 2개.
- 사전제작 9:16 시네마틱 2개, 총 30~60초.
- 선택 결과를 남기는 4:5 기억 이미지 1개.
- 인문학 관찰·설명과 연결되는 퀴즈 1개.
- 위험·장애·시간초과용 승인 fallback path 1개 이상.
- `오늘은 여기까지`로 끝나는 건강한 종료.
- Mori의 승인 artifact가 `ContentRelease`로 묶여 Kindy에서 재생됨.
- release pin, last-known-good, 5분 내 rollback.

### 1.2 영상 규격 결정

현재 채팅 fixture의 `seurat-alive.mp4`는 1280×720, 16:9 임시 자산이다. D8~D14 사이에 교체한다.

- 채팅 액션 시네마틱 master: **1080×1920, 9:16**.
- 주요 인물·단서: 중앙 80% safe area.
- 하단 220px: 자막·UI safe area.
- 자막 기본 ON, 무음으로도 사건 이해 가능.
- 채팅 preview와 전체화면 stage도 9:16 profile 사용.
- 기존 수업·라이브러리의 16:9 자산은 별도 legacy profile로 유지.
- 기억 이미지: **1080×1350, 4:5**.

### 1.3 Story Factory v0 완료 조건

- source/rights/evidence packet에서 premise까지 자동 handoff.
- premise → synopsis → story bible → beat → branching screenplay.
- StorySmith revision과 Safety Guardian loop.
- `ExperienceGraph v1`의 Chat/Choice/Cinematic/Image/Quiz/Ending compile.
- 모든 path simulated transcript와 terminal 검증.
- keyframe → I2V 또는 limited animation → TTS/SFX/caption → assembly.
- G0~G5 artifact hash 승인과 downstream 무효화.
- atomic `ContentRelease` publish.
- 동일 harness로 두 번째 source packet을 dry-run하여 재생산 가능성을 확인.

### 1.4 D0에서 이미 완료된 기준선

- StorySmith의 `motifReport`·`revision` 누락 수정.
- `iyagi`·`gongbang`까지 docent craft로 처리하던 장르 판정 수정.
- Kindy/Mori 양쪽 `ExperienceGraph v1` 계약과 회귀 테스트.
- `/chats` 모바일 fixture vertical slice.
- 선택 → 캐릭터 대화 → 영상 → 이미지 → 후속 선택 → 엔딩 흐름.
- 현재 16:9 자산을 무크롭 재생하는 player 동작 검증.
- Wenit text/image/video 연결·응답 schema POC.

### 1.5 4주 범위에서 자르는 것

- 세계관 2개 이상 정식 제작.
- 음성 입력과 아이 사진·영상 업로드.
- 그룹 채팅, 소셜, 공유, 결제, 스트릭.
- 장기 감성 profile과 contextual bandit.
- 생성형 미니게임과 매 회차 실시간 영상 생성.
- 무제한 인터넷 crawling.
- 20-agent 전체를 조작하는 완성형 Studio 관리 UI.
- GPT·Claude·GLM·Kimi 전 모델의 대규모 bake-off.
- Qwen3Guard 4B의 production 상시 GPU 운영.
- 일반 아동 대상 무제한 자유생성 채팅 공개.

### 1.6 구현 진행 기록 — 2026-08-20

- `ContentRelease v1` 공통 계약을 Kindy/Mori byte-identical로 구현.
- `preparedAt → G5 → finalizedAt → signedAt` 시간 순서를 계약으로 고정.
- G0~G5의 9개 reviewer-role 승인과 G5 전체 release scope hash 결속 구현.
- model/prompt/policy pin, 8개 필수 artifact, kind별 media 규격, canonical JSON을 검증.
- Mori의 2단계 candidate compiler와 Ed25519 signer 구현.
- Kindy의 trusted key·release pin·graph·asset byte 검증기 구현.
- 9:16 cinematic이 아닌 release candidate를 compiler 단계에서 차단.
- 실제 Supabase publish 대신 `upsert:false`·비실행 CAS dry-run plan만 구현. 현재 legacy `library_videos` insert와 `upsert:true` storage에는 연결하지 않음.

다음 코드 단위는 `BranchingScript`를 바로 재사용하지 않고, 승인된 story/chat/quiz/game/media 입력에서 `ExperienceGraph`를 만드는 enriched compiler다. live publisher와 Inngest 연결은 immutable release bucket, content release tables, atomic CAS migration 이후에만 연다.

---

## 2. 24시간 운영체계

### 2.1 하루 3개 실행 구간

모든 시간은 KST다.

| 시간 | 자동화 중심 작업 | 사람의 역할 | shift 산출물 |
|---|---|---|---|
| 00:00~08:00 | full CI, safety eval, story bake-off, media render·QC, 비용·지연 집계 | S0/S1 온콜만 | 실패 분류, draft PR 후보, render proxy, 오전 승인함 |
| 08:00~16:00 | 승인 결과 반영, 핵심 구현, contract·story·rights 통합 | 주 근무, 10:00 승인창 | 승인 artifact hash, 통합 branch, revision instruction |
| 16:00~24:00 | Kindy/Mori 통합, 모바일 검증, keyframe·animatic, 다음 queue 구성 | 18:00 승인창 | staging RC, media manifest, 야간 run plan |

각 shift 마지막 20분에는 새 일을 시작하지 않는다.

```text
07:40 / 15:40 / 23:40  변경 freeze
07:40 / 15:40 / 23:40  affected test 실행
08:00 / 16:00 / 00:00  incoming owner 인수 확인
```

### 2.2 Handoff 계약

에이전트끼리 자유 대화로 문맥을 넘기지 않는다. 매 shift 종료 시 아래 artifact를 남긴다.

```yaml
run_id:
objective:
completed_artifacts:
draft_prs:
artifact_hashes:
tests_and_results:
spent_and_remaining_budget:
open_risks:
human_approval_required:
next_queue:
rollback_or_fallback:
```

- handoff가 불완전하면 다음 shift는 추측해서 이어가지 않고 `needs_clarification`으로 전환한다.
- 같은 실패의 자동 수정은 최대 2회다. 세 번째 실패는 사람에게 올린다.
- 하나의 에이전트가 branch나 artifact를 8시간 넘게 소유하지 않는다.
- 작성 agent와 검수 agent를 분리한다.
- 모든 코드 변경은 격리 branch와 **DRAFT PR**로만 만든다.
- `main` 직접 push와 agent 자동 merge를 금지한다.
- 사람 승인 전 media는 private quarantine을 벗어나지 않는다.

### 2.3 자동화 worker와 WIP 제한

| Worker | 책임 | 쓰기 범위 |
|---|---|---|
| Dispatcher | 의존성, WIP, 비용, 승인 queue | 상태 ledger만 |
| Kindy Runtime | chat UI/API, auth, consent, player, session | Kindy 전용 branch |
| Mori Pipeline | artifact DAG, compiler, release publisher | Mori 전용 branch |
| Contract Guardian | schema parity, graph/path 검증 | contract·test PR만 |
| Story/Education | evidence→script→quiz 초안 | Mori artifact만 |
| Safety Evaluator | golden set, 공격·PII·moderation 비교 | eval result만 |
| Media Operator | keyframe, I2V, TTS, SFX, caption, assembly | quarantine storage만 |
| Release Reviewer | 독립 diff, 회귀, 비용, readiness | 읽기 전용 |

동시 실행 제한:

- 쓰기 가능한 code agent 최대 4개.
- 같은 파일을 수정하는 agent 최대 1개.
- video 생성 최대 2 job.
- image 생성 최대 4 job.
- 자체 GPU eval 최대 1 job.
- Wenit poll은 key별 공유 scheduler를 사용하고 최소 1.1초+jitter 간격을 둔다.
- 서로 의존하는 artifact는 hash 승인 전 fan-out하지 않는다.

### 2.4 사람 승인창

| 시간·일자 | 승인 대상 |
|---|---|
| 매일 10:00 | overnight triage, G0 권리·근거, G1 premise·synopsis, G2 script |
| 매일 18:00 | G3 keyframe, G4 animatic, 통합 RC |
| D25 18:00 | G5 release와 rollback 최종 승인 |

- G5는 Release Owner와 Safety/Privacy Reviewer 두 명이 승인한다.
- 승인 대상은 설명문이 아니라 정확한 artifact content hash다.
- 승인된 artifact가 바뀌면 그 gate와 downstream 승인을 자동 무효화한다.
- 승인자가 없으면 `waiting_human`에서 멈춘다. 시간초과를 자동 승인으로 처리하지 않는다.
- production publish는 08:00~21:30에만 수행한다.
- 야간에는 eval, render, DRAFT PR까지만 허용한다.

---

## 3. 병렬 실행 스트림

| ID | 스트림 | Critical output | 종료 gate |
|---|---|---|---|
| R | Release/Contract | `ContentRelease v1`, artifact hash, atomic publish, rollback | G5 |
| K | Kindy Runtime | auth, room/session, authored resolver, safe runtime, mobile UI | RC |
| M | Mori Story | rights packet, story DAG, compiler, simulated path | G0~G2 |
| V | Media/Audio | 9:16 cinematic, 4:5 image, TTS/SFX/caption | G3~G4 |
| Q | Quality/Safety | rights, learning, safety, accessibility, load, observability | G5 |
| F | Free Text Stretch | local hard gate, Wenit, closed director, 200-turn shadow | 별도 GO/NO-GO |

Critical path:

```text
ExperienceGraph v1 [DONE]
  → ContentRelease v1
  → Mori compiler/publisher
  → Kindy loader/authored resolver
  → signed RC
  → G5
  → Authored Core 출시

G0 권리·근거
  → G1 synopsis
  → G2 모든 분기 대본
  → G3 keyframe
  → G4 animatic
  → G5 release

auth·consent
  → local PII/hard-risk
  → Wenit input
  → closed Narrative Director
  → graph allowlist
  → Wenit output
  → 200-turn shadow + full benchmark
  → 선택적 free_text flag
```

F 스트림은 위쪽 출시 critical path에 합류시키지 않는다.

---

## 4. D1~D28 실행 일정

### Week 1 — 계약·권리·저작 runtime 뼈대 (D1~D7)

| 일자 | Critical path | 병렬 작업과 당일 종료조건 |
|---|---|---|
| **D1 · 8/20** | 출시 정의와 범위 동결 | 변경 소유권 정리, 노출 Wenit key 폐기·재발급, 비용 ceiling 승인, reviewer 일정 예약, authored-only 기본 mode 확정 |
| **D2 · 8/21** | `ContentRelease v1`, asset hash, approval schema | Kindy/Mori contract parity, signature/schema 불일치 fail-closed, model/prompt/policy registry pin |
| **D3 · 8/22** | 첫 세계 source/rights/evidence packet | G0 승인. 실패 시 승인된 public-domain 대체 소재로 즉시 교체 |
| **D4 · 8/23** | premise 3안 → synopsis 1안 | G1 승인, Kindy chat DB/API/auth/proxy migration 초안, 1080×1920 safe-area template |
| **D5 · 8/24** | story bible, beat sheet, 두 분기 인과 고정 | release loader, room/session/world state, consent·kill-switch skeleton |
| **D6 · 8/25** | branching screenplay, fallback, quiz 초안 | Mori 실제 story DAG 첫 실행, Kindy authored turn resolver와 idempotency |
| **D7 · 8/26** | 모든 path script lock | G2 편집·교육·안전 승인, ExperienceGraph compile, simulated transcript 100% 통과 |

Week 1 종료조건:

- key 회전과 server-only secret.
- ContentRelease contract 양 저장소 일치.
- 첫 세계 권리·근거 packet 승인.
- 두 결말 대본과 안전 fallback lock.
- authored resolver가 fixture 없이 graph를 순회.

### Week 2 — 9:16 제작과 첫 end-to-end (D8~D14)

| 일자 | Critical path | 병렬 작업과 당일 종료조건 |
|---|---|---|
| **D8 · 8/27** | shot list, storyboard, keyframe 생성 | Kindy fixture를 실제 release bundle로 교체, 모든 node renderer 연결 |
| **D9 · 8/28** | 캐릭터·배경 keyframe lock | 첫 9:16 I2V sample, 중앙 80%·하단 220px·자막 검사 |
| **D10 · 8/29** | cinematic 2개 render | TTS·SFX·caption 병렬 생성, 실패 shot은 limited animation fallback |
| **D11 · 8/30** | 4:5 기억 카드 variant와 quiz 완성 | core release는 선택 조합별 사전 승인 image variant 사용 |
| **D12 · 8/31** | animatic assembly | MediaManifest, asset hash, Wenit publish-time media 검사, staging E2E |
| **D13 · 9/1** | media/audio/graph 자동 QC | 전 경로 traversal, caption sync, loudness, 360/390px, reduced-motion 수정 |
| **D14 · 9/2** | G3 keyframe·G4 animatic 승인 | 반려 시 핵심 shot만 1회 재생성. authored vertical slice 완성 |

Week 2 종료조건:

- 1080×1920 시네마틱 2개, 총 30~60초.
- 1080×1350 기억 이미지 variant.
- 자막·음성·효과음과 QC report.
- 승인 media hash가 포함된 staging `ContentRelease`.
- 선택 → 채팅 → 9:16 영상 → 이미지 → quiz → ending E2E.

### Week 3 — 릴리스 안전성·Strict free text 판정 (D15~D21)

| 일자 | Critical path | 병렬 작업과 당일 종료조건 |
|---|---|---|
| **D15 · 9/3** | atomic publish와 release pin | Wenit canonical parser, scheduler, timeout fixture를 synthetic data로 검증 |
| **D16 · 9/4** | rollback·last-known-good | strict free text를 flag 뒤에 구현: input gate → closed action → output gate |
| **D17 · 9/5** | auth/ownership/consent/delete/kill switch | PII redaction, grooming·자해·학대·외부 만남 hard router |
| **D18 · 9/6** | 장애·중복·race chaos test | 429, malformed, timeout, duplicate turn, stale revision에서 authored fallback 100% |
| **D19 · 9/7** | 성인 내부 scripted 200-turn shadow | 모바일 실기기, 접근성, 성능, raw child text가 log·Studio로 가지 않는지 확인 |
| **D20 · 9/8** | strict free text 별도 GO/NO-GO | gate 미달이면 flag OFF 고정. 신규 core feature freeze |
| **D21 · 9/9** | RC1 staging·보호자 walkthrough | 첫 진입부터 건강한 종료까지 도움 없는 dry run |

Week 3 종료조건:

- atomic release와 5분 rollback.
- auth·소유권·동의·삭제·kill switch.
- 모든 provider 장애의 fail-closed authored fallback.
- RC1과 D20 free-text 결정문.
- free-text 미달이어도 authored core는 계속 진행.

### Week 4 — 회귀·관찰·G5·출시 (D22~D28)

| 일자 | Critical path | 병렬 작업과 당일 종료조건 |
|---|---|---|
| **D22 · 9/10** | 전체 회귀·성능·browser matrix | authored action P95 <500ms, 360/390px overflow 0, 9:16 재생·복귀 |
| **D23 · 9/11** | security/privacy/ops audit | secret, auth bypass, cross-child, raw log, signed URL, DPA·고지 점검 |
| **D24 · 9/12** | publish·rollback·kill-switch drill | 새 release atomic 전환, 5분 안에 last-known-good 복귀 |
| **D25 · 9/13** | RC2와 G5 최종 승인 | rights·story·safety·media·bundle hash를 한 release manifest로 확인, 기능 freeze |
| **D26 · 9/14** | 소규모 보호자 동반 closed pilot | blocker만 수정. 신규 기능·새 콘텐츠 추가 금지 |
| **D27 · 9/15** | 최종 GO/NO-GO | 실패 기능 제거 또는 authored fallback. 미해결 safety/privacy면 아동 pilot 중단 |
| **D28 · 9/16** | 보호된 웹 파일럿 배포 | 모니터링, 비용 차단, incident runbook, golden release 보관, 48시간 변경 freeze |

Week 4 종료조건:

- G5 승인된 RC 또는 안전한 authored-only RC.
- 보호자 동반 관찰 결과와 blocker 처리.
- 배포·rollback·kill-switch rehearsal.
- golden release와 incident runbook.
- 두 번째 source packet의 Factory v0 dry-run report.

---

## 5. CI·평가·QC Harness

### 5.1 모든 push — 10분 이내

- 변경 저장소 lint, typecheck, unit test.
- ExperienceGraph schema와 Kindy/Mori parity.
- secret·PII fixture scan.
- graph reachability, cycle, terminal, invalid transition.
- 미승인 media path와 asset 참조 차단.
- 동일 파일 다중 writer와 migration 번호 충돌 검사.

### 5.2 모든 DRAFT PR

- Kindy production build.
- Mori 전체 test.
- StoryGraph → Chat/Quiz/Game compiler snapshot.
- 모든 선택과 결말 simulated transcript.
- unsafe hard-rule 입력에서 narrative model call 0건.
- malformed, timeout, unknown provider schema fail-closed.
- 360px·390px overflow, 48px touch target, 9:16 player smoke.
- artifact hash 변경 시 기존 human approval 무효화 확인.

### 5.3 매일 야간 schedule

| 시각 | Job |
|---|---|
| 00:10 | commit, prompt, model, policy version freeze |
| 00:30 | Kindy/Mori full CI와 contract parity |
| 01:00 | critical safety 100건 + 자모분리·은어·오타 회귀 |
| 02:00 | 200-turn synthetic chat와 모든 branch path simulation |
| 03:00 | story packet 소규모 bake-off와 judge disagreement 추출 |
| 03:30 | 대기 media render, OCR·motion·audio deterministic QC |
| 05:30 | 비용·지연·retry·provider drift 분석 |
| 07:00 | 오전 승인함과 stop/go report 생성 |

### 5.4 안전 평가의 두 단계

Authored Core 필수선:

- 매일 critical text 100건.
- hard-rule과 fallback 회귀 100%.
- 모든 authored node와 media publish-time 검사.
- unsafe generated output 실제 노출 0.

Strict Free Text 활성화선:

- text 800, image 240, video 160의 총 1,200건 paired benchmark.
- 전문가 2인 라벨과 disagreement adjudication.
- critical false negative 0.
- 기타 위험 recall ≥97%.
- 안전 pass ≥95%.
- PII 외부 전송·재인용 0.

1,200건이 D27까지 끝나지 않거나 기준을 통과하지 못하면 D28 `free_text=false`다. benchmark 지연 때문에 Authored Core 출시를 미루지 않는다.

---

## 6. 출시 Gate

### 6.1 G0~G5

| Gate | 시점 | 승인 대상 | Pass 기준 |
|---|---|---|---|
| G0 | D3 | source·rights·evidence | 권리 미확정 source 0, orphan claim 0 |
| G1 | D4 | premise·synopsis | 학습 주장·사건·연령 적합성 승인 |
| G2 | D7 | 모든 분기 대본·quiz·fallback | 모든 path 안전·등가 보상·terminal 100% |
| G3 | D14 이전 | character·background·keyframe | 9:16 safe area, continuity, 권리, 아동안전 |
| G4 | D14 | animatic·TTS·SFX·caption | 영상·음성·자막·motion QC 통과 |
| G5 | D25 | signed ContentRelease | 승인 hash, runtime test, rollback, 운영 준비 완료 |

### 6.2 Authored Core launch gate

- 권리 미확정 source 0.
- orphan factual claim 0.
- graph/schema/all-path pass 100%.
- 승인되지 않은 node·asset 노출 0.
- 1080×1920 master와 자막 기본 ON.
- 360px·390px horizontal overflow 0.
- 영상 종료 후 대화 복귀 성공 100% in test, 관찰 목표 ≥95%.
- authored choice P95 <500ms.
- duplicate submit·duplicate bubble 0.
- release rollback 5분 이내.
- raw child text의 Studio·일반 trace 전송 0.
- `오늘은 여기까지`를 언제든 찾을 수 있음.

### 6.3 Strict Free Text 추가 gate

- 보호자 동의·철회·삭제·kill switch 완료.
- DPA, 개인정보 고지, 국외 이전, 하위처리자 검토 완료.
- PII 외부 전송 0.
- critical safety false negative 0.
- provider 오류·15초 deadline에서 fail-closed 100%.
- 검수 전 generated output 노출 0.
- 내부 성인 200턴 full-turn P95 ≤13초.
- 1,200건 paired benchmark 통과.

하나라도 실패하면 D28 출시는 Authored Core다.

---

## 7. Authored-only Fallback 명세

Authored Core는 축소판이 아니라 4주 출시의 독립 제품이다.

- 빠른 답장·선택지만 노출하거나 text composer를 읽기 전용으로 전환.
- 캐릭터 대사는 승인 release bundle 안의 문장만 사용.
- 모든 이동은 `allowedNextNodeIds` 안에서만 수행.
- 9:16 영상은 사전제작·사전 moderation.
- 기억 이미지는 실시간 생성 대신 선택 조합별 사전 승인 4:5 variant.
- quiz와 ending은 authored rubric만 사용.
- provider 장애 시 새 텍스트를 만들지 않고 승인 fallback node로 이동.
- 잘못된 bundle은 노출하지 않고 last-known-good release 유지.
- `free_text`와 `realtime_image`를 독립 feature flag로 운영.

---

## 8. 비용·토큰·GPU Circuit Breaker

이 문서는 결제를 승인하지 않는다. D1에 Release Owner가 실제 계약 단가를 확인하고 hard cap을 승인해야 유료 queue를 연다.

초기 계획 ceiling은 인건비 제외 **USD 2,000 / 4주**다.

| 영역 | 계획 상한 |
|---|---:|
| LLM·story·code/eval API | $500 |
| video·image·audio | $700 |
| Wenit 등 safety vendor | $250 |
| OSS safety GPU | $200 |
| CI·storage·observability | $150 |
| G5 reserve | $200 |

- 일일 hard cap $70, shift cap $25.
- episode media cap $150, shot cap $25.
- shot당 정상 생성 2회 + 수정 생성 1회.
- 70% 사용 시 경고.
- 80% 사용 시 filler·variant 중단, limited animation 전환.
- 100% 사용 시 유료 생성 queue 정지.
- G5 reserve는 Release Owner만 해제.
- 비용 때문에 safety judge, moderation, human gate를 낮추지 않는다.

Token 제한:

- 전체 하루 input 8M / output 1.5M tokens.
- Story DAG 단계당 input 60k / output 12k.
- revision당 input 30k / output 8k.
- premise seed 최대 3개.
- 동일 오류 retry 최대 2회.
- 80% 도달 시 frontier rewrite를 중단하고 기존 후보 deterministic QC만 수행.

GPU 제한:

- Qwen3Guard 4B 평가용 24GB GPU 최대 1대.
- 최대 12 GPU-hour/day.
- 10분 idle 시 종료.
- OOM 2회 또는 health alert 시 job 중단, Wenit+authored fallback.

---

## 9. Incident와 Stop-the-line

| 등급 | 조건 | 즉시 조치 |
|---|---|---|
| S0 | 위험 콘텐츠 실제 노출, PII 외부 전송, secret 노출, child cross-account data | free-text·generated asset global kill, publish 중지, key 폐기, 15분 내 Owner+Safety 호출 |
| S1 | auth 우회, release hash/signature 불일치, 미검수 asset 공개 | affected runtime 차단, 5분 내 이전 release rollback |
| S2 | provider unknown schema, 오류율 5%/10분, moderation P95 >15초, retry storm, 비용 이상 | provider circuit open, authored fallback |
| S3 | 사실·연출·자막·화면 품질 결함 | artifact 격리·재작업, 안전한 기존 release 유지 |

아래 조건 하나라도 발생하면 해당 출시는 정지한다.

- critical safety false negative 1건.
- PII가 LLM, Wenit, 일반 log로 전달된 사례 1건.
- 미검수 image/video 노출 1건.
- release hash 또는 approval chain 불일치 1건.
- CI나 contract가 red.
- G0~G5 승인자 부재.
- 비용 hard cap 도달.
- provider timeout에서 fail-open.
- rollback이 5분 안에 완료되지 않음.

복구에는 human incident report, 원인 수정, golden regression 추가, Safety Reviewer와 Release Owner 재승인이 필요하다.

---

## 10. 최소 인력과 책임

24시간 자동화 pipeline을 유지하는 최소 coverage는 8개 역할이다.

| 역할 | 최소 coverage | 최종 책임 |
|---|---:|---|
| Product/Release Owner | 1 | 범위, 비용, GO/NO-GO, G5 |
| Kindy frontend/full-stack | 1 | chat/mobile/player |
| Runtime/backend/security | 1 | auth, data, moderation orchestration |
| Mori/AI pipeline | 1 | DAG, compiler, model registry |
| Story/education editor | 1 | 인문학 정확성, 연령 적합성, G1/G2 |
| Art/video/audio producer | 1 | G3/G4, media quality |
| QA/automation/SRE | 1 | CI, eval, load, rollback, incident |
| Child safety/rights/privacy | 1 또는 fractional 2명 | G0, safety/privacy, G5 공동승인 |

- 사람이 실제 24시간 상주하려면 휴무·backup을 포함해 12~14명이 필요하다.
- 권장 운영은 8개 역할의 주간·저녁 승인과 자동화의 야간 실행이다.
- 누구도 8시간/일, 6일 연속을 넘기지 않는다.
- 야간 사람 온콜은 S0/S1만 받는다.
- coverage가 확보되지 않으면 D26의 아동 동반 pilot을 성인 proxy walkthrough로 대체하고 Authored Core staging까지만 완료한다.

---

## 11. 매일 보는 Ship Board

매일 08:30에 다음 한 화면만 본다.

| 영역 | 지표 |
|---|---|
| Critical path | 오늘의 단 하나 blocker, gate owner, decision deadline |
| Code | CI green rate, open draft PR, stale branch, contract parity |
| Story | G0~G2 status, orphan claim, path·terminal pass |
| Media | approved/queued/failed shot, QC reason, media cost |
| Safety | critical FN, PII leak, fallback rate, unknown schema, moderation latency |
| Runtime | authored P95, duplicate turn, rollback time, client error |
| Budget | shift/day/4주 spend, retry waste, remaining reserve |
| Human | waiting approval, reviewer SLA, next approval window |

원칙:

- blocker는 스트림당 1개만 최상단에 둔다.
- WIP가 막히면 새 기능을 열지 않고 blocker를 푼다.
- 매일 23:40에 다음 날의 필수 3개 outcome만 queue에 넣는다.
- “거의 완료”를 보고하지 않는다. artifact hash와 pass/fail만 보고한다.

---

## 12. D1 즉시 실행 체크리스트

1. 노출된 Wenit API key 폐기·재발급.
2. 4주 비용 hard cap 승인 또는 수정.
3. G0~G5 reviewer와 매일 10:00·18:00 승인창 예약.
4. 첫 세계 scope와 대체 public-domain source 1개 lock.
5. `authored_core`, `free_text`, `realtime_image` feature flag 정의.
6. `ContentRelease v1` owner와 migration 번호 배정.
7. Kindy/Mori integration train용 DRAFT PR 규칙 적용.
8. nightly queue와 handoff schema 저장소 결정.
9. D7, D14, D20, D25, D28 calendar gate 생성.
10. D1 23:40 첫 야간 CI·critical safety·story packet run freeze.

---

## 13. 최종 판정

24시간 자동화와 8개 역할의 고정 승인 coverage가 있으면 4주 안에 다음은 가능하다.

- 안전하게 끝까지 재생되는 세계 1개.
- 9:16 액션 시네마틱이 포함된 대화형 인문학 동화.
- Mori → ContentRelease → Kindy의 실제 제작·배포 경로.
- 같은 형식의 다음 세계를 다시 생산할 수 있는 Factory v0.
- 안전·법무 gate에 따라 켜거나 끌 수 있는 strict free text.

4주 안에 불가능하다고 간주하는 것은 “아동용 무제한 자유생성 채팅을 검증 없이 함께 공개하는 것”이다. D28의 성공은 기능 수가 아니라 **승인된 한 세계를 반복 가능하게 만들고, 미달 기능을 안전하게 끈 채 출시하는 것**으로 정의한다.
