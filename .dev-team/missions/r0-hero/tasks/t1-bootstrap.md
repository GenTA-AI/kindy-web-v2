# t1-bootstrap: kindy-web@26a5f5f → kindy-web.v2 이어받기 + 원격 푸시
effort: high

## Goal
빈(문서만 있는) kindy-web.v2를 kindy-web의 `codex/ai-diagnosis-demo`(커밋 26a5f5f) 기반 git 저장소로 만든다 — 히스토리 보존, 미추적 자산 선별 복사, 의존성 설치·기반 그린 확인, 최소 CI, GitHub 원격(GenTA-AI/kindy-web-v2, private) 생성·푸시, main 보호까지. 완료 시 다음 워커들이 worktree 기반으로 병렬 작업 가능한 상태가 된다.

**절차 정본: `docs/plan/04_R0_EXECUTION_PLAN.md`의 Task 1(1.1~1.5)과 Task 4.5의 "원본 보관" 스텝.** 먼저 그 절을 읽고 그대로 수행하라. 아래는 요지와 이 태스크 고유의 주의사항이다.

## Scope
- 저장소 루트 전체(부트스트랩 태스크 — 트리 실체화가 목적)
- 단, `docs/plan/*.md` 내용 수정 금지(추가 파일 생성은 가능), `.dev-team/missions/r0-hero/**` 수정 금지

## Constraints
- 기반 소스는 **로컬 경로** `/Users/jongwonlee/dev/kindy-web`, 브랜치 `codex/ai-diagnosis-demo`, 커밋 `26a5f5f` 고정. 네트워크 클론 금지(로컬 fetch).
- 절차: `git init -b main` → `git remote add source /Users/jongwonlee/dev/kindy-web` → `git fetch source codex/ai-diagnosis-demo` → `git reset --hard 26a5f5f`. (docs/plan·.dev-team/missions/r0-hero는 미추적이라 안전 — 04 Task 1.1에서 실측 검증됨)
- kindy-web **미추적 파일 복사 목록**(04 Task 1.2): `키오스크_하드웨어_제작계획.md`, `키오스크_앱_개발플랜.md` + gitignored 자산 `.env.local`(경로 복사만, **내용 열람·출력 절대 금지**), `tmp/studio/`(LoRA 데이터셋 ~32MB — gitignored 상태 유지 확인). kindy-web의 `.dev-team/MISSION`과 `.dev-team/missions/first-content/tasks/*`는 **복사하지 마라**(스테일 — 우리 하네스가 이 디렉토리를 사용 중).
- 원본 보관(04 Task 4.5): `mkdir -p docs/research/original` 후 `~/Documents/GenTA/연구자료/Mori_C6_창의성장지도_연구_및_서비스적용_명세서_v1.0.pdf` 1본과 `/Users/jongwonlee/Downloads/아이별_문서세트_2026-07-05/01_현행정본/` 전체(9파일)를 `docs/research/original/문서세트_2026-07-05_현행정본/`으로 복사.
- 최소 CI(04 Task 1.5 개정): `.github/workflows/ci.yml` — PR·push 트리거, `npm ci` 후 `npm run lint`와 `npx tsc --noEmit` 두 잡(잡 이름 `ci`). 골든테스트 잡은 후속 태스크(t3)가 확장한다 — 지금 넣지 마라.
- 원격: `gh repo create GenTA-AI/kindy-web-v2 --private --source . --push` 또는 create 후 `git remote add origin` + `git push -u origin main`. **이 최초 push만 main 직푸시 예외**(BRIEF). push 후 main 보호: `gh api -X PUT repos/GenTA-AI/kindy-web-v2/branches/main/protection` — required_status_checks `{"strict":true,"contexts":["ci"]}`, enforce_admins false, required_pull_request_reviews `{"required_approving_review_count":0}`, restrictions null. (04 Task 1.5의 명령 참조)
- 커밋: reset --hard 이후의 신규 자산(docs/plan, docs/research/original, 키오스크 문서 2본, ci.yml, .dev-team/missions/r0-hero 스펙)은 의미 단위 1~2 커밋(`chore(v2): R0 부트스트랩 — 플랜 정본·CI·연구 원본` 계열)으로. gitignored 파일이 커밋에 섞이면 안 된다.
- `npm install`(lockfile 존중 — `npm ci`가 실패하면 `npm install` 후 사유 기록), 이후 lint·tsc 그린 확인. `npm run build`는 시도하되 .env.local 의존 실패 시 "문서화된 동작"으로 기록만(BRIEF minefield).
- prod 조작 금지(supabase db push·gcloud·Inngest·Toss). 네트워크는 npm·gh만.

## Deliverables
- kindy-web.v2 = git repo(main), HEAD 부모 계보에 26a5f5f, 작업 트리 그린(lint·tsc)
- 미추적 자산 복사 완료(위 목록), docs/research/original/ 채워짐
- `.github/workflows/ci.yml` 존재, GenTA-AI/kindy-web-v2(private) 원격에 main 푸시 + 보호 설정
- node_modules 설치 완료(다음 워커가 바로 테스트 실행 가능)

## Validation
```bash
git rev-parse --abbrev-ref HEAD | grep -qx main
git merge-base --is-ancestor 26a5f5f HEAD && echo base-ok
git remote get-url origin | grep -q 'GenTA-AI/kindy-web-v2'
test -f .github/workflows/ci.yml && echo ci-ok
test -f .env.local && echo env-ok
ls docs/research/original/ | grep -qi pdf && echo research-ok
test -f 키오스크_하드웨어_제작계획.md && test -f 키오스크_앱_개발플랜.md && echo kiosk-docs-ok
git status --porcelain | grep -v '^??' | wc -l | grep -qx '0' && echo tree-clean
npm run lint
npx tsc --noEmit
```

## Handoff requirements
End your final message with: summary, files_changed, validation (commands + results), risks, handoff_note (what the next worker/reviewer must know — 특히 build 시도 결과와 kindy-web 대비 달라진 점).
