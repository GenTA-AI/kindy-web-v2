# Kindy (kindy-web) — 프로젝트 노트

`kindy-web` = 전략·콘텐츠·법무·디자인 **spec 폴더** (코드 아님). 실제 웹앱 = `~/dev/eduvid`, iOS+파이프라인 = `~/dev/kindy-app`.
승인된 런칭 설계: `~/.gstack/projects/kindy-web/jongwonlee-web-launch-design-20260619-204045.md`.

## Design System
Always read **DESIGN.md** before making any visual or UI decision.
모든 폰트·색·간격·미학 방향은 거기 정의됨 (R3 = 크림+세이지 책정령 모리, 기분-시프트 팔레트, Pretendard).
승인 없이 벗어나지 말 것. QA 모드에서 DESIGN.md와 안 맞는 코드는 플래그.
이 DESIGN.md가 정본 — `eduvid/DESIGN.md`(옛 보라)를 대체하며, Lane C 구현 시 eduvid로 동기화.

## Skill routing
요청이 스킬과 맞으면 Skill 도구로 호출. 애매하면 호출.
- 제품 아이디어/브레인스토밍 → /office-hours
- 전략/스코프 → /plan-ceo-review
- 아키텍처 → /plan-eng-review
- 디자인 시스템/플랜 → /design-consultation 또는 /plan-design-review
- 버그/에러 → /investigate
- QA → /qa
- 코드리뷰 → /review
- 비주얼 폴리시 → /design-review
- 출시/배포/PR → /ship 또는 /land-and-deploy
