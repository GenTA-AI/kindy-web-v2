# 인터랙티브 영상 세션 설계 — 유튜브처럼 보다가, 장면 사이 선택

> 상태: 설계 승인됨 (2026-07-01, 섹션별 승인). 구현 전 헌법.
> 배경: 타겟 5-7세는 글을 못 읽고 유튜브 네이티브. 현재는 "영상 전체 → 별도 게임 화면들"이라
> 앱처럼 끊긴다. 이 설계는 **영상이 주인공 + 장면 사이 인터랙티브 선택**으로 바꾼다.
> 계승: limited 애니 엔진(`src/lib/limited-animation.ts`), 음성(`useVoice`, "못 읽는 아동 필수"),
> 세계관(`docs/superpowers/specs/2026-07-01-worldview-anthology-design.md`), C6 학습기록 파이프라인.

---

## 1. 핵심 전환

| | 현재 | 이 설계 |
|---|---|---|
| 흐름 | 영상 전체 재생 → 별도 게임 화면들(감정·숨은친구·패턴) | 영상이 주인공, 장면 사이 큰 선택지 오버레이 → 이어보기 |
| 느낌 | "공부 앱" | "유튜브 + 가끔 툭 터치" |
| 게임 | 독립 스크린 | 영상 타임라인 안으로 흡수 |

## 2. 구조 — 다이아몬드 + 최종 2결말 (승인)

```
[씬1] → [선택A] → 짧은 가지(1-2씬) → 합류
      → [씬3] → [선택B] → 짧은 가지 → 합류
      → [씬5] → [최종선택] → choiceTally 집계 → 결말① 또는 결말②
```

- **중간 선택**: 짧게 갈라졌다 **본줄기로 합류**(diamond). 몰입("내 선택이 이야기를 바꿈") + 5-7세 길 안 잃음 + 싼 limited 씬 몇 개만 추가(지수폭발 없음).
- **최종 결말**: 누적 선택(choiceTally)이 임계값을 넘으면 결말① 아니면 결말②. 선택이 **끝을 바꾼다**는 보상감. 결말 씬만 2벌.
- **비용 경계**: 중간 가지는 합류하므로 씬 N개 선형 증가. 결말만 ×2. 트리 지수폭발 아님.

## 3. 데이터 모델 (authoring 스키마 확장)

세계관 세션 데이터(`animal-village.ts`류)에 **씬 그래프**를 추가:

```ts
interface Scene {
  id: string;
  videoClip: LimitedClipSpec;   // limited 엔진용 키프레임+나레이션(음성)
  next?: string;                // 선형 다음 씬
  choice?: ChoicePoint;         // 있으면 이 씬 끝에서 일시정지+선택
}
interface ChoicePoint {
  id: string;
  prompt_ko: string;            // 음성이 읽음
  format: 'emotion' | 'clue' | 'creative';  // 큰 얼굴 / 단서카드 / 자유
  options: ChoiceOption[];
  rejoin: string;               // 가지 끝 합류 씬(중간 선택은 필수)
}
interface ChoiceOption {
  id: string; label_ko: string; icon?: string;
  branchScenes?: string[];      // 짧은 가지(없으면 바로 rejoin)
  tally?: Record<string, number>; // 최종 결말 집계용 가중치(예: {warm:1})
  objective_code?: string;      // 학습기록용(감정읽기·단서)
}
interface EndingRule { threshold: Record<string, number>; sceneId: string; }
```

- **중간 선택**: `rejoin` 필수 → 항상 본줄기 복귀.
- **최종 선택**: `branchScenes` 대신 `EndingRule`이 `choiceTally`로 결말 씬 선택.
- 씬은 limited 엔진이 이미 다루는 단위(키프레임+TTS+ffmpeg) → 가지 씬 = 싼 추가.

## 4. 선택 UI (5-7세)

- 영상 일시정지 → **큰 선택지 오버레이**. `EmotionExpressionGame`에서 만든 **큰 얼굴 + 한 단어**(helper 없음, min-h-150px, scale 1.6 얼굴) 패턴 재사용.
- **음성이 프롬프트를 읽어줌**(`useVoice`) → 글 못 읽어도 됨.
- 탭 → 짧은 칭찬 음성 + 이어보기. **오답 개념 없음**(감정은 부드럽게 인정, 단서는 "같이 다시 보자").
- 포맷 3종: `emotion`(큰 얼굴), `clue`(큰 그림 카드 = HiddenFriend류), `creative`(자유 표현).

## 5. 학습 기록 (파이프라인 불변)

각 선택 = `GameRoundResult` 1건(game_type=emotion_expression/Q_quiz/…, objective_code) → `/api/game/events` → C6·learning-profile. **부모 화면·리포트·선별 개인화는 그대로**. 게임이 영상 안으로 옮겨졌을 뿐 기록 계약 동일.

## 6. 무엇이 바뀌나 (구현)

- **신규**: `InteractiveVideoPlayer`(영상 재생 + 씬 그래프 순회 + 선택 오버레이 인터리브 + choiceTally). `SessionShell`의 stage machine(intro→video→round→gate→complete)을 이 플레이어로 교체/흡수.
- **재사용**: `LibraryPlayer`(영상), 큰 얼굴/그림 선택 UI, `useVoice`, limited 엔진, `game_rounds` 기록.
- **불변**: 부모 대시보드·리포트·구독·선별 개인화·세계관 캐논.

## 7. 페이싱 (5-7세)

- 선택 간격 ~20-40초(장면 1-2개마다). 한 세션 3-5회 선택.
- 선택 없이도 흐름이 이어지게(선택은 몰입·기록용, 진행 차단 아님) — 무응답 타임아웃 시 부드럽게 기본 경로.
- 한 화면 한 행동. 큰 요소. 음성 우선.

## 8. 범위 밖 (YAGNI / 후속)

- 실제 씬 대본·선택지 문구·키프레임 이미지 = authoring 단계.
- 결말 분기 로직의 세부 임계값 튜닝, 3개 이상 결말 = 후속.
- 브랜칭 저작 툴(비개발자용) = 후속.

## 9. 다음 단계 (구현 플랜에서)

1. `Scene`/`ChoicePoint` 타입 + `animal-village` 첫 세션을 씬 그래프로 재표현(1 다이아몬드 + 2결말 최소).
2. `InteractiveVideoPlayer` 구현(재생→일시정지→오버레이→선택→가지/합류→결말).
3. 선택 오버레이(큰 얼굴/그림, 음성) + `game_rounds` 기록 배선.
4. limited 엔진으로 씬(본줄기+가지+결말2) 생성 + `c6_focus` 태깅.
5. `SessionShell` → 인터랙티브 플레이어 전환(부모 화면 불변 유지).
