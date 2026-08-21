import { isProductionLaunchEnvironment } from './launch-surface';

export type EnvironmentMap = Readonly<Record<string, string | undefined>>;

export type GuardedEnvironmentVariable =
  | 'KINDY_LOCAL_PREVIEW'
  | 'LESSON_GUEST_MODE'
  | 'BILLING_KEY_SECRET'
  | 'WENIT_SAFEGUARD_RUNTIME_ENABLED'
  | 'NEXT_PUBLIC_WENIT_SAFEGUARD_API_KEY';

export type EnvironmentViolation = Readonly<{
  variable: GuardedEnvironmentVariable;
  reason: string;
  remediation: string;
}>;

export function isProductionEnvironment(environment: EnvironmentMap): boolean {
  return isProductionLaunchEnvironment(environment);
}

/**
 * Return every unsafe production setting without reading process.env directly.
 * Local development and explicitly labeled Kindy previews keep their bypasses;
 * production images with missing or invalid deploy labels fail closed.
 */
export function getProductionEnvironmentViolations(
  environment: EnvironmentMap,
): EnvironmentViolation[] {
  if (!isProductionEnvironment(environment)) return [];

  const violations: EnvironmentViolation[] = [];

  if (environment.KINDY_LOCAL_PREVIEW === '1') {
    violations.push({
      variable: 'KINDY_LOCAL_PREVIEW',
      reason: '프리뷰 전용 인증 우회를 활성화해 프로덕션 보호를 약화시킵니다.',
      remediation:
        '프로덕션 환경에서 KINDY_LOCAL_PREVIEW를 제거하거나 "0"으로 설정하세요.',
    });
  }

  if (environment.LESSON_GUEST_MODE === '1') {
    violations.push({
      variable: 'LESSON_GUEST_MODE',
      reason: '로그인·자녀·멤버십 게이트를 건너뛰어 유료 레슨을 공개합니다.',
      remediation:
        '프로덕션 환경에서 LESSON_GUEST_MODE를 제거하거나 "0"으로 설정하세요.',
    });
  }

  if (!environment.BILLING_KEY_SECRET?.trim()) {
    violations.push({
      variable: 'BILLING_KEY_SECRET',
      reason: '빌링키를 AES-256-GCM으로 암호화할 필수 키가 없습니다.',
      remediation:
        '프로덕션 시크릿 저장소에서 BILLING_KEY_SECRET을 비어 있지 않은 값으로 설정하세요.',
    });
  }

  if (environment.WENIT_SAFEGUARD_RUNTIME_ENABLED === '1') {
    violations.push({
      variable: 'WENIT_SAFEGUARD_RUNTIME_ENABLED',
      reason: '별도 preview DB, DLP·위기 평가, vendor 계약 pin과 아동 안전 게이트가 아직 준비되지 않았습니다.',
      remediation:
        '모든 activation gate와 입출력 이중 검사가 승인되기 전에는 값을 "0"으로 유지하세요.',
    });
  }

  if (environment.NEXT_PUBLIC_WENIT_SAFEGUARD_API_KEY?.trim()) {
    violations.push({
      variable: 'NEXT_PUBLIC_WENIT_SAFEGUARD_API_KEY',
      reason: 'Wenit 원본 API 키를 브라우저 번들에 노출합니다.',
      remediation:
        'NEXT_PUBLIC_* 변수를 제거하고 서버 Secret Manager의 WENIT_SAFEGUARD_API_KEY만 사용하세요.',
    });
  }

  return violations;
}
