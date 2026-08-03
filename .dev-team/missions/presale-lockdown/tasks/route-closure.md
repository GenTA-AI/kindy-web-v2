# route-closure: 프리세일 퍼널 밖 라우트를 프로덕션에서 폐쇄 + 색인 차단 + OG 메타데이터
effort: high

## Goal

8/31 프리세일은 **네 개 표면만** 필요하다: 랜딩(`/`), 무료 샘플(`/first-story`), 법무(`/legal/*`),
인증(`/auth/*`), 그리고 결제(`/subscribe`). 나머지 제품 표면 — 미완성 게임 데모, 유아용 레거시
샘플, 대시보드, 레슨, 키오스크·AI 생성 API — 는 프리세일에 필요 없고, 열려 있는 동안은 전부
공격·혼선·브랜드 모순의 표면이다.

지금 상태:
- `robots.ts`·`sitemap.ts`·`robots.txt`가 **아예 없고**, 어떤 페이지에도 noindex가 없다.
  `/demo/*`(키오스크·아이패드·모리·대시보드·라이브러리), `/world`, `/island`, `/sample/*`, `/start`,
  `/play`가 전부 크롤 가능하다.
- OG/트위터 카드 메타데이터가 **한 곳도 없다.** 카톡·인스타가 주 채널인데 링크 미리보기가 안 뜨고,
  내부 페이지는 루트 레이아웃의 낡은 제목(`Kindy Mori - 모리의 이야기 숲`)을 물려받는다.
- 키오스크 이벤트 API는 인증 없이 service-role로 쓰고 CORS가 와일드카드다.

이 태스크가 끝나면: 프로덕션에서 허용 목록 밖 라우트가 닫히고, 검색엔진이 제품 표면을 못 줍고,
공유 링크가 제대로 렌더된다.

## Scope
- `src/proxy.ts` 미들웨어 게이트
- `src/app/robots.ts` NEW
- `src/app/layout.tsx` 루트 메타데이터·OG 기본값
- `src/lib/launch-surface.ts` NEW 허용 목록과 판정 헬퍼를 여기 한 곳에
- `src/app/api/kiosk/events/route.ts` 프로덕션 폐쇄
- `src/app/api/videos/route.ts` 프로덕션 폐쇄
- `src/app/api/attention-quiz/route.ts` 프로덕션 폐쇄
- `src/app/demo` 디렉터리 전체 — noindex/폐쇄
- `src/app/world/page.tsx` noindex
- `src/app/island/page.tsx` noindex
- `src/app/sample` 디렉터리 전체 — noindex
- `src/app/start/page.tsx` noindex

## Constraints
- **미들웨어에만 의존하지 마라.** 이 저장소의 Next 16.2.3에는 미들웨어 우회 취약점이 3건 있다
  (같은 미션의 `next-patch`가 올리지만, 그래도 한 겹으로는 부족하다). 닫는 라우트는
  **미들웨어 + 페이지/핸들러 자체 가드** 두 겹으로 막아라.
- **폐쇄는 환경 기반 스위치여야 한다.** 로컬 개발과 프리뷰에서는 지금처럼 다 열려야 한다.
  하드 삭제하지 마라 — G2에서 다시 연다. 스위치 이름과 기본값을 신중히 정하고
  **"설정 안 하면 닫힌다"가 아니라 "프로덕션이면 닫힌다"** 쪽으로 가라(로컬 DX를 깨지 않게).
- 허용/차단 목록은 **한 파일(`src/lib/launch-surface.ts`)에만** 둔다. 여러 곳에 흩뿌리지 마라 —
  G2에서 되돌릴 때 흩어져 있으면 못 찾는다.
- `/subscribe`는 **열어둔다**(프리세일 결제 표면). 단 색인은 판단해서 정하라.
- `/legal/*`은 열어두고 색인도 허용한다(법적 고지는 접근 가능해야 한다).
- 코드 전에 `node_modules/next/dist/docs/`에서 metadata·robots·미들웨어 가이드를 읽어라.
  이 Next는 훈련 데이터와 다르다.
- `params`/`searchParams`는 Promise다 — await 필수.
- 폐쇄된 API가 반환하는 상태코드를 일관되게 하라(404 권장 — 존재 자체를 숨긴다).
- 고객 화면 문자열에 진단/평가/점수/등급 용어 금지.

## Deliverables

1. **`src/lib/launch-surface.ts`** — 프리세일 허용 목록, 프로덕션 판정, "이 경로가 닫혀 있는가"
   헬퍼. 순수 함수로 만들어 테스트 가능하게.
2. **미들웨어 확장** — `src/proxy.ts`가 프로덕션에서 허용 목록 밖 페이지 경로를 차단한다.
   기존 인증 게이트를 깨지 마라.
3. **페이지/핸들러 자체 가드** — 닫는 표면 각각이 스스로도 막는다(미들웨어를 못 믿는다는 전제).
4. **`src/app/robots.ts`** — 프리세일 허용 목록만 색인 허용, 나머지 disallow. 프로덕션이 아닐 때는
   전체 disallow(프리뷰가 색인되면 안 된다).
5. **개별 페이지 `robots: { index: false, follow: false }`** — `/demo/*`, `/world`, `/island`,
   `/sample/*`, `/start`. robots.txt는 크롤을 막을 뿐 색인을 100% 막지 못하므로 메타도 함께.
6. **루트 메타데이터 갱신** — `src/app/layout.tsx`의 제목이 아직 `Kindy Mori - 모리의 이야기 숲`이다.
   현재 파는 제품(명화·클래식·고전 통합 인문 수업)에 맞게 고치고, **OG·트위터 카드 기본값**을 추가한다.
   OG 이미지는 `public/`에 이미 있는 자산 중에서 고르거나(있으면), 없으면 이미지 없이 제목·설명만
   제대로 세팅하고 그 사실을 핸드오프에 적어라. **새 이미지를 생성하지 마라.**
7. **`launch-surface.ts` 단위 테스트** — 허용 목록 안/밖 경로 판정, 프로덕션/비프로덕션 분기.
   `node:test` + `npx tsx --test`, 상대 import. 기존 테스트 패턴을 먼저 읽어라.

## Validation

```bash
npm run lint
npx next typegen && npx tsc --noEmit
npm test
npm run build
```

## Handoff requirements

최종 메시지 끝에: summary, files_changed, validation(명령어 + **실제 출력**), risks, handoff_note.

`handoff_note`에 반드시:
- **폐쇄 스위치의 이름과 동작** — 어떤 조건에서 닫히고 어떤 조건에서 열리는가. 로컬·프리뷰·프로덕션
  각각에서 무슨 일이 벌어지는지 한 줄씩.
- **G2에서 다시 열 때 정확히 무엇을 고치면 되는가**(파일 하나, 목록 한 줄이어야 한다).
- 열어둔 라우트의 최종 목록 — 리드가 이걸로 승인 판정한다.
- OG 이미지를 붙였는지, 못 붙였으면 무엇이 필요한지.
