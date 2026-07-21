# eduvid 디자인 시스템

이 문서는 디자인 토큰과 원칙을 담는다. 모든 UI는 여기 정의된 토큰을 따라야 한다.

> **R3 갱신 (2026-06-22):** 색을 **보라 → 크림+세이지(책정령 모리)**로 전환. 정본 = `~/dev/kindy-web/DESIGN.md`. 토큰은 `src/app/globals.css`의 `@theme` 블록(`bg-cream`·`text-sage`·`border-line` 등). 옛 violet 팔레트는 폐기.

## 브랜드 포지셔닝

- **톤:** 부모에게 따뜻하지만 데이터 기반, 아이 친화적이지만 유치하지 않음
- **감성 목표:** "이게 우리 아이예요" 인정의 순간 (magical moment)
- **반대편:** 차가운 SaaS 대시보드, 유치한 kids 앱 (무지개 색상 남발), 기술자 스러운 AI 생성 티

## 색상 (R3 — 크림 + 세이지 · globals.css `@theme` 토큰)

| 이름 | HEX | Tailwind 유틸 | 용도 |
|-----|-----|---------|------|
| Cream | `#F4EAD2` | `bg-cream` | 페이지 배경 |
| Surface | `#FBF7EC` | `bg-surface` | 카드·강조 구역 |
| Cream-deep | `#E9DBBE` | `bg-deep` | 더블 배경·키오스크 프레임 |
| Sage (primary) | `#46763F` | `bg-sage` `text-sage` `fill-sage` | 주 CTA·모리·활성 |
| Sage-deep | `#2E5129` | `bg-saged` `text-saged` | hover·강조 텍스트 |
| Sage-soft | `#93B589` | `bg-sages` | 보조 액센트·포커스링 |
| Sage-bg | `#E4EDDF` | `bg-sagebg` | 히어로 비주얼 배경 |
| Ink | `#231F18` | `text-ink` `fill-ink` | 제목·본문 (웜 차콜) |
| Ink-2 | `#534B40` | `text-ink2` | 보조 텍스트 |
| Ink-3 | `#8A8070` | `text-ink3` | 메타·캡션 |
| Line | `#E0D4BB` | `border-line` | 구분선·테두리 (웜) |
| Gentle | `#159C84` | `text-gentle` `fill-gentle` | 모리 하트빛·기분 액센트 |
| Gold | `#C9871E` | `text-gold` | 별·반짝임 액센트 |

**기분 4톤 (액센트 · GACS 무드 시프트):** gentle `#159C84` · lively `#EC9E0C` · mystery `#6446C2` · warm `#DA4E80`. **보라는 mystery 액센트 하나(전역 primary 아님).**
**시맨틱:** success `#3F8139` · warning `#CC7E1E` · error `#C84E36`(소프트코랄, 아이에게 강한 빨강 금지) · info `#3C8FBE`.

**규칙:** 무지개 남발 금지 · 베이스는 크림+세이지 고정 · 한 화면 1무드 · 보라는 mystery일 때만.

## 타이포그래피

**폰트:** `Pretendard Variable` (웹폰트), 폴백 `Pretendard → -apple-system → system-ui → sans-serif`. Korean/Latin 동시 최적화.

| 역할 | 크기 | Weight | Line-height | 예 |
|-----|-----|--------|-------------|----|
| Hero H1 | 24-28px | 800 (extrabold) | 1.3 | 감정 헤드라인 "서연이는 부드럽고..." |
| H2 | 18-20px | 700 (bold) | 1.4 | 섹션 제목 "취향 프로파일" |
| H3 / Card title | 15-16px | 700 (bold) | 1.5 | 카드 제목 "과학탐구 12주" |
| Body | 14px | 500 (medium) | 1.5 | 본문, 설명 |
| Meta | 12-13px | 500-600 | 1.4 | 부가 정보 |
| Caption | 10-11px | 700 (bold) | 1.3 | UPPERCASE 라벨 (tracking-wider) |

**한글 최적화:** Pretendard는 한글-영문 동시 balance 우수. 기본 font-size 14px 이상 유지 (한글 가독성).

## Radius

| 토큰 | 값 | Tailwind | 용도 |
|-----|---|---------|------|
| sm | 12px | rounded-xl | 작은 칩, secondary 버튼 |
| md | 16px | rounded-2xl | **기본 카드**, primary 버튼 |
| lg | 24px | rounded-3xl | 큰 hero 카드, modal top |
| pill | 9999px | rounded-full | 배지, 아바타, nav active 점 |

**규칙:** radius-md를 기본. 큰 hero 요소만 lg. 라운드 덜 중요한 요소는 rounded-lg (8px).

## Shadow

| 토큰 | 값 | 용도 |
|-----|---|------|
| card | `shadow-sm` (rgba(0,0,0,0.05) 0 1px 2px) | 일반 카드 |
| elevated | `shadow-md` | 모달, 오버레이 |
| cta | `shadow-cta` (sage 틴트, 토큰 참조) | 주요 CTA 버튼 |
| modal | `shadow-2xl` | 드로어 모달 top |

## Spacing

모바일 컨테이너: `max-w-[375px] mx-auto px-6`. 섹션 간격:
- **Tight:** 12-16px (카드 내 요소)
- **Normal:** 20-24px (섹션 내 블록)
- **Loose:** 32-40px (섹션 간)

## 애니메이션

- **Transition default:** `cubic-bezier(0.16, 1, 0.3, 1)` (swift-ease), 200-300ms
- **Bar fill:** 800ms swift-ease (취향 프로파일 바 채움)
- **Modal slide-up:** 300ms swift-ease
- **Button active:** `scale-[0.98]` on press
- **Selected card:** `scale-[1.02]` + shadow

원칙: 딱 한 번 이상 필요한 곳에만 animation. 장식 animation 금지.

## 컴포넌트 기본값

### 버튼

**Primary:** `px-6 py-4 bg-sage hover:bg-saged text-white font-bold text-base rounded-2xl shadow-cta active:scale-[0.98] transition`

**Secondary:** `px-6 py-3 bg-sagebg border border-line text-saged font-bold rounded-xl hover:bg-sages/30`

**Tertiary/link:** `text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2 font-medium`

### 카드

```
<div class="bg-white rounded-2xl p-5 shadow-sm">
  ...
</div>
```

액센트 카드 (강조):
```
<div class="bg-sagebg border border-line rounded-2xl p-4">
  ...
</div>
```

### 취향 프로파일 바

`h-[7px] bg-sagebg rounded-full overflow-hidden`
내부: `h-full rounded-full` + `background: linear-gradient(90deg, #79A271 0%, #335A2E 100%)` (상위) 또는 `linear-gradient(90deg, #C2D5B9 0%, #79A271 100%)` (중간) 또는 `#d1d5db` (하위). R3 세이지.

## 접근성 기준

- **최소 폰트:** 본문 14px, 한글 고려
- **터치 타겟:** 44px × 44px minimum (py-3 이상 버튼)
- **명도 대비:**
  - ink `#231F18` on cream/white: 13+ (AAA)
  - sage `#46763F` text on white: ~5.2 (AA)
  - ink3 `#8A8070` on white: ~3.0 — meta 텍스트 전용, 핵심 정보 금지
  - white on sage `#46763F`: ~4.9 (AA)
- **포커스 링:** `focus-within:ring-2 focus-within:ring-sages focus-within:ring-offset-2`
- **키보드 탐색:** 모든 interactive 요소에 tab order

## AI Slop 회피 룰

1. 퍼플은 mystery 무드 액센트일 때만. 전역 배경/그라디언트 금지(베이스는 크림+세이지).
2. 아이콘 in colored circles 반복 배치 금지 (SaaS 템플릿 티).
3. 중앙 정렬은 감정 헤드라인/hero/CTA에만. 목록/데이터는 left align.
4. 3-column symmetric feature grid 금지 (→ 1개 큰 스토리 카드 + FAQ).
5. 장식용 SVG blob, 파도, floating circle 금지.
6. 이모지는 아이콘 대용 OK (🔬 🔤) but 제목 강조용 금지 (❌ "🚀 빠른 시작").
7. Generic hero 카피 금지: "Welcome to", "Your all-in-one", "Unlock the power of"

## 디자인 토큰 (CSS 변수 참조용, 구현 시 적용)

```css
:root {
  --color-primary: #46763F;       /* R3 sage */
  --color-primary-dark: #2E5129;  /* sage-deep */
  --color-primary-light: #93B589; /* sage-soft */
  --color-accent-bg: #EDF2E7;     /* sage tint */
  --color-accent-border: #DCE7D4; /* sage-100 */
  --color-text-primary: #231F18;  /* warm ink */
  --color-text-secondary: #534B40;
  --color-text-meta: #8A8070;
  --color-border: #E0D4BB;        /* warm line */
  --color-surface: #FBF7EC;       /* cream surface */

  --radius-sm: 12px;
  --radius-md: 16px;
  --radius-lg: 24px;

  --shadow-card: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-cta: 0 10px 25px -5px rgba(70,118,63,0.3);

  --font-sans: 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif;

  --ease-swift: cubic-bezier(0.16, 1, 0.3, 1);
}
```

## 부모 대시보드 — 차분한 도구 (2026-07-21 확정)

부모(30대 아이폰 유저)와 아이는 다른 사용자다. **아이 화면은 따뜻·놀이(크림·모리), 부모 대시보드는 애플 건강/저널 레인의 조용한 도구**로 표면을 분리한다. 감성 목표("이게 우리 아이예요")는 busy한 대시보드가 아니라 **잘 짜인 인사이트 하나**로 전달.

**색 재조율(핵심)**: 부모 화면은 크림이 배경을 뒤덮지 않는다. **웜 화이트를 배경으로(page `#FBFAF6`, surface 흰색), 세이지는 희소한 액센트**(활성·CTA·'집에서 한마디' 틴트)로만. 크림은 썸네일·틴트 등 드물게. 에러는 소프트 코랄 유지.
**모리**: 부모 화면에서 히어로가 아니라 **하단 구석의 작은 존재**(≈22px, 저채도). 아이 화면에선 계속 히어로.
**히어로 = 주간 편지**: 감정 문장 하나("이번 주, 서연이는 더 오래 바라봤어요")가 상단, 숫자는 그 아래 잔잔한 신호(애플 건강식: 라벨 + 스파크라인 + 조용한 델타, tabular-nums). 데이터 좌측 정렬, 중앙은 히어로 문장만.
**여백**: spacious — 섹션 간 32–40px. **표면 언어 금지**: AI·진단·평가·점수·내부 C코드 노출 0(부모 라벨만: 관찰=자세히 보기, 표현=떠올려 말하기).
**타이포**: Pretendard 유지(한글), 위계만 애플 건강처럼 크게. 정본 목업 = `scratchpad/parent-dashboard-mockup.html` (아티팩트).

## 결정 로그
| 날짜 | 결정 | 근거 |
|------|------|------|
| 2026-07-21 | 부모 대시보드 = 차분한 도구(애플 건강 레인), 아이 화면과 표면 분리 | /design-consultation. 대표 확정. 크림 후퇴·세이지 희소 액센트·모리 축소·주간편지 히어로 |
| 2026-07-21 | 컴포넌트 예시 violet→sage 이관 완료 | R3 크림+세이지 토큰과 컴포넌트 예시 불일치(반쯤 이관) 정정 |

## 참조

- **최신 목업:** `~/.gstack/projects/eduvid/designs/mockups-20260417/*-FINAL.html`
- **승인 토큰:** `~/.gstack/projects/eduvid/designs/mockups-20260417/approved.json`
- **설계문서:** `~/.gstack/projects/eduvid/jongwonlee-main-design-20260417-174556.md`

기본적으로 모든 신규 UI는 여기 토큰으로 시작. 토큰 변경은 DESIGN.md를 먼저 업데이트.
