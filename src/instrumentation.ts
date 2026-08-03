import { getProductionEnvironmentViolations } from './lib/env-guard';

export function register(): void {
  const violations = getProductionEnvironmentViolations(process.env);
  if (violations.length === 0) return;

  const details = violations.map(
    ({ variable, reason, remediation }) =>
      `- ${variable}: ${reason} 해결: ${remediation}`,
  );

  const message = [
    '[env-guard] 프로덕션 환경 설정이 안전하지 않아 서버 시작을 중단합니다.',
    ...details,
    '환경변수를 수정한 뒤 다시 배포하세요. 시크릿 값은 이 오류에 출력되지 않습니다.',
  ].join('\n');

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.error(message);
    process.exit(1);
  }

  throw new Error(message);
}
