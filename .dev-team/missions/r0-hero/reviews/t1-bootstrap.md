# review: t1-bootstrap
decision: approve
date: 2026-07-05

## 검증 방식
main-tree 태스크(diff-blind) — git show/ls-files/트리 실사 + gate(validation_exit=0, scope_ok=1) + last-message.

## 판정 근거 (LEAD 렌즈 순)
1. 정본 일치: 04 Task 1 절차 준수 — 기반 26a5f5f, 미추적 복사 목록 정확(스테일 .dev-team/MISSION 제외 확인), 원본 보관 9+1 완료.
2. 기반 무결: b9d0346은 추가 파일 25 + tsconfig 1줄(exclude tmp — 사유: 복사된 gitignored LoRA 스크립트가 tsc 파괴, 문서화됨). 시크릿·tmp·node_modules 커밋 0.
3. CI: 잡명 `ci`, lint+tsc, node 20 — 04 Task 1.5 개정 스펙 일치.

## 특이사항 (환경·플랜 제약 — 워커 과실 아님)
- Codex 샌드박스가 워크스페이스 `.git` 생성·GitHub 접속 거부 → 워커가 외부 gitdir로 히스토리 보존, **리드가 ops 마무리**(메타데이터 부착·gh repo create·push). 재발 대비: 이후 태스크는 worktree 기반이라 비영향.
- **main 브랜치 보호 403**: GenTA-AI 무료 플랜 + private 저장소 조합은 GitHub Pro 필요. 대체: dev-team 하네스가 전 머지를 리드 경유로 강제(프로세스 보호). 클라이언트에 보고, 플랜 업그레이드 시 재적용.
- Turbopack 빌드는 샌드박스 포트 바인딩 실패, `--webpack` 빌드 통과 — 문서화된 동작.
- 검증 라인 1건(wc 패딩)은 리드 스펙 버그 — 수정 커밋 3e0d?? (chore(dev-team)).

## critical
없음.
## should_fix
없음 — CI 원격 첫 실행 결과는 다음 push에서 확인.
## nice_to_have
- Node 22(로컬) vs 20(CI) 핀 차이 — 문제 시 CI를 22로 상향 검토.
