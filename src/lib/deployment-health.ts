import { getProductionEnvironmentViolations } from './env-guard';

export type DeploymentHealthEnvironment = Readonly<
  Record<string, string | undefined>
>;

export type DeploymentHealthChecks = Readonly<{
  deployEnvironment: boolean;
  release: boolean;
  supabase: boolean;
  productionSafety: boolean;
}>;

export type DeploymentHealth = Readonly<{
  service: 'kindy';
  status: 'ready' | 'not_ready';
  release: string;
  environment: 'preview' | 'production' | 'unknown';
  checks: DeploymentHealthChecks;
}>;

function hasValue(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function getDeployEnvironment(
  value: string | undefined,
): DeploymentHealth['environment'] {
  if (value === 'preview' || value === 'production') return value;
  return 'unknown';
}

export function getDeploymentHealth(
  environment: DeploymentHealthEnvironment,
): DeploymentHealth {
  const deployEnvironment = getDeployEnvironment(environment.KINDY_DEPLOY_ENV);
  const release = environment.KINDY_RELEASE_SHA?.trim() || 'unknown';
  const checks: DeploymentHealthChecks = {
    deployEnvironment: deployEnvironment !== 'unknown',
    release: release !== 'unknown',
    supabase:
      hasValue(environment.NEXT_PUBLIC_SUPABASE_URL) &&
      hasValue(environment.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
      hasValue(environment.SUPABASE_SERVICE_ROLE_KEY),
    productionSafety:
      getProductionEnvironmentViolations(environment).length === 0,
  };

  const ready = Object.values(checks).every(Boolean);

  return {
    service: 'kindy',
    status: ready ? 'ready' : 'not_ready',
    release,
    environment: deployEnvironment,
    checks,
  };
}

export function getDeploymentLiveness(
  environment: DeploymentHealthEnvironment,
) {
  return {
    service: 'kindy' as const,
    status: 'ok' as const,
    release: environment.KINDY_RELEASE_SHA?.trim() || 'unknown',
  };
}
