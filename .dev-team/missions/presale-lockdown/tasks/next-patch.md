# next-patch: Next.js 16.2.3 → 16.2.12 패치 업그레이드
effort: medium

## Goal

Next.js를 16.2.3에서 16.2.12(또는 그 이상의 최신 16.2.x)로 올린다.

16.2.3에는 **미들웨어 우회 취약점 3건**이 있다. 이 저장소에서 `src/proxy.ts`(미들웨어)는
`/dashboard`·`/play`·`/player`·`/settings`·`/library`와 여러 API 그룹을 막는 유일한 게이트이고,
같은 미션의 `route-closure` 태스크가 프리세일 라우트 폐쇄를 여기에 얹는다. **닫는 도구 자체가
우회 가능하면 안 된다.**

같은 마이너 버전 내 패치 범프이고 현재 range가 `^16.2.3`이라 semver 호환이다.

## Scope
- `package.json` 버전 범프
- `package-lock.json` 잠금 갱신

## Constraints
- **같은 마이너(16.2.x) 안에서만 올려라.** 16.3+ 또는 17로 가지 마라.
- Next 이외의 의존성을 임의로 올리지 마라. `npm audit fix`를 돌리지 마라 — 이 태스크는 Next 하나다.
- 소스 코드를 고치지 마라. 업그레이드가 코드 변경을 요구하면 **고치지 말고 멈춰서 핸드오프에 적어라**
  (그러면 이 태스크는 분할된다).
- 네트워크: `npm install`이 레지스트리에 접근해야 한다. 샌드박스에서 막히면 그 사실을 정확히
  보고하고 멈춰라 — 우회하려 하지 마라.
- 새 의존성 추가 금지.

## Deliverables
1. `package.json`의 next 버전이 16.2.12 이상 16.3 미만.
2. `package-lock.json`이 그에 맞게 갱신됨.
3. 전체 검증 통과 — 특히 `npm run build`. Next 16은 훈련 데이터와 다르므로 빌드가 진실이다.
4. 업그레이드로 인한 경고·동작 변화가 있으면 핸드오프에 정리.

## Validation

```bash
npm run lint
npx next typegen && npx tsc --noEmit
npm test
npm run build
```

## Handoff requirements

최종 메시지 끝에: summary, files_changed, validation(명령어 + **실제 출력**, 특히 build 결과와
Next 버전이 찍힌 줄), risks, handoff_note.

`handoff_note`에 반드시:
- 최종 설치된 정확한 버전.
- 빌드 출력에서 새로 나타난 경고가 있으면 그대로.
- `npm audit --omit=dev`를 돌려서 Next 관련 advisory가 사라졌는지 확인하고 결과 요약(수정은 하지 말고 보고만).
