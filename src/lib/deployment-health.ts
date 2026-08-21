import { getProductionEnvironmentViolations } from './env-guard';
import { getContentReleaseRuntimeConfig } from './releases/runtime-content-release-config';

export type DeploymentHealthEnvironment = Readonly<
  Record<string, string | undefined>
>;

export type DeploymentHealthChecks = Readonly<{
  deployEnvironment: boolean;
  launchConfiguration: boolean;
  release: boolean;
  supabase: boolean;
  storyChatRuntime: boolean;
  contentRelease: boolean;
  freeTextDisabled: boolean;
  productionSafety: boolean;
}>;

export type DeploymentHealthLaunchMode =
  | 'open_preview'
  | 'protected_chat_pilot'
  | 'production_presale'
  | 'unknown';

export type DeploymentHealth = Readonly<{
  service: 'kindy';
  status: 'ready' | 'not_ready';
  release: string;
  revision: string;
  environment: 'preview' | 'production' | 'unknown';
  launchMode: DeploymentHealthLaunchMode;
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

function getLaunchMode(value: string | undefined): DeploymentHealthLaunchMode {
  if (
    value === 'open_preview' ||
    value === 'protected_chat_pilot' ||
    value === 'production_presale'
  ) {
    return value;
  }

  return 'unknown';
}

function isValidLaunchConfiguration(
  deployEnvironment: DeploymentHealth['environment'],
  launchMode: DeploymentHealthLaunchMode,
): boolean {
  if (deployEnvironment === 'preview') {
    return launchMode === 'open_preview' || launchMode === 'protected_chat_pilot';
  }

  if (deployEnvironment === 'production') {
    return (
      launchMode === 'production_presale' || launchMode === 'protected_chat_pilot'
    );
  }

  return false;
}

function isValidStoryChatRuntime(
  value: string | undefined,
): boolean {
  // P0 activation gate: this Cloud Run process still needs the Supabase
  // service-role credential for existing server paths. That credential can
  // bypass Storage RLS, so a second read-only Storage JWT alone cannot make
  // ContentRelease objects immutable. Keep authored chat off until either an
  // immutable GCS identity boundary or a fully RPC-only DB identity ships.
  return value === '0';
}

function isValidContentReleaseConfiguration(
  environment: DeploymentHealthEnvironment,
  deployEnvironment: DeploymentHealth['environment'],
): boolean {
  const runtimeEnabled = environment.STORY_CHAT_RUNTIME_ENABLED;
  if (runtimeEnabled === '0') return true;
  if (runtimeEnabled !== '1') return false;

  const config = getContentReleaseRuntimeConfig(environment);
  if (!config.configured) return false;

  return (
    (deployEnvironment === 'preview' && config.channel === 'staging') ||
    (deployEnvironment === 'production' && config.channel === 'production')
  );
}

export function getDeploymentHealth(
  environment: DeploymentHealthEnvironment,
): DeploymentHealth {
  const deployEnvironment = getDeployEnvironment(environment.KINDY_DEPLOY_ENV);
  const launchMode = getLaunchMode(environment.KINDY_LAUNCH_MODE);
  const release = environment.KINDY_RELEASE_SHA?.trim() || 'unknown';
  const revision = environment.K_REVISION?.trim() || 'unknown';
  const checks: DeploymentHealthChecks = {
    deployEnvironment: deployEnvironment !== 'unknown',
    launchConfiguration: isValidLaunchConfiguration(deployEnvironment, launchMode),
    release: release !== 'unknown' && revision !== 'unknown',
    supabase:
      hasValue(environment.NEXT_PUBLIC_SUPABASE_URL) &&
      hasValue(environment.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
      (
        (
          deployEnvironment === 'preview'
          && !hasValue(environment.SUPABASE_SERVICE_ROLE_KEY)
        )
        || (
          deployEnvironment === 'production'
          && hasValue(environment.SUPABASE_SERVICE_ROLE_KEY)
        )
      ),
    storyChatRuntime: isValidStoryChatRuntime(
      environment.STORY_CHAT_RUNTIME_ENABLED,
    ),
    contentRelease: isValidContentReleaseConfiguration(
      environment,
      deployEnvironment,
    ),
    freeTextDisabled: environment.STORY_CHAT_FREE_TEXT_ENABLED === '0',
    productionSafety:
      getProductionEnvironmentViolations(environment).length === 0,
  };

  const ready = Object.values(checks).every(Boolean);

  return {
    service: 'kindy',
    status: ready ? 'ready' : 'not_ready',
    release,
    revision,
    environment: deployEnvironment,
    launchMode,
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
    revision: environment.K_REVISION?.trim() || 'unknown',
  };
}
