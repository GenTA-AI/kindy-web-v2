export type LaunchEnvironment = Readonly<{
  NODE_ENV?: string;
  KINDY_DEPLOY_ENV?: string;
  KINDY_LAUNCH_MODE?: string;
  KINDY_PRESALE_LOCKDOWN?: string;
}>;

export type LaunchMode =
  | 'open_preview'
  | 'protected_chat_pilot'
  | 'production_presale';

export type LaunchRouteRule = Readonly<{
  path: string;
  includeDescendants: boolean;
}>;

/**
 * The production presale surface. Keep this as the single route allowlist so G2
 * can reopen surfaces without hunting through Proxy, pages, and handlers.
 */
export const PRESALE_OPEN_ROUTE_RULES: readonly LaunchRouteRule[] = [
  { path: '/', includeDescendants: false },
  { path: '/first-story', includeDescendants: false },
  { path: '/legal', includeDescendants: true },
  { path: '/auth', includeDescendants: true },
  { path: '/subscribe', includeDescendants: true },
];

/** API families that are explicitly unavailable during the presale. */
export const PRESALE_CLOSED_API_RULES: readonly LaunchRouteRule[] = [
  { path: '/api/kiosk/events', includeDescendants: false },
  { path: '/api/videos', includeDescendants: true },
  { path: '/api/attention-quiz', includeDescendants: false },
];

/**
 * The protected pilot adds only the authenticated child setup and story-chat
 * surfaces to the production presale pages.
 */
export const PROTECTED_CHAT_PILOT_OPEN_ROUTE_RULES: readonly LaunchRouteRule[] = [
  ...PRESALE_OPEN_ROUTE_RULES,
  { path: '/onboarding', includeDescendants: false },
  { path: '/chats', includeDescendants: true },
];

/**
 * API families required by the presale pages, Cloud Run probes, and the chat
 * pilot. Everything else is hidden in protected_chat_pilot mode.
 *
 * Authentication is a separate concern: Proxy and each data handler still
 * verify the session for /api/children and /api/chat.
 */
export const PROTECTED_CHAT_PILOT_OPEN_API_RULES: readonly LaunchRouteRule[] = [
  { path: '/api/health', includeDescendants: true },
  { path: '/api/waitlist', includeDescendants: false },
  { path: '/api/subscription', includeDescendants: true },
  { path: '/api/payments', includeDescendants: true },
  { path: '/api/inngest', includeDescendants: false },
  { path: '/api/children', includeDescendants: true },
  { path: '/api/chat', includeDescendants: true },
];

/**
 * Production pages that crawlers may visit. Auth and checkout stay accessible
 * to people but are intentionally absent from this indexing allowlist.
 */
export const PRESALE_ROBOTS_ALLOW = ['/$', '/first-story$', '/legal/'] as const;

let previewEnvironmentLogged = false;

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  const withLeadingSlash = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return withLeadingSlash.replace(/\/+$/, '') || '/';
}

export function matchesLaunchRoute(pathname: string, rule: LaunchRouteRule): boolean {
  const normalizedPathname = normalizePathname(pathname);
  const normalizedRulePath = normalizePathname(rule.path);

  if (normalizedPathname === normalizedRulePath) return true;
  if (!rule.includeDescendants) return false;
  if (normalizedRulePath === '/') return normalizedPathname.startsWith('/');
  return normalizedPathname.startsWith(`${normalizedRulePath}/`);
}

export function isProductionLaunchEnvironment(environment: LaunchEnvironment): boolean {
  if (environment.NODE_ENV !== 'production') {
    return false;
  }

  if (environment.KINDY_DEPLOY_ENV === 'preview') {
    if (!previewEnvironmentLogged) {
      console.warn(
        '[launch-surface] Preview access is enabled because KINDY_DEPLOY_ENV="preview".',
      );
      previewEnvironmentLogged = true;
    }
    return false;
  }

  return true;
}

/**
 * Deployment identity and launch scope are intentionally independent.
 *
 * - A production image defaults to the presale surface.
 * - A preview image defaults to open_preview and may opt into the protected pilot.
 * - protected_chat_pilot is the only valid scope shared by both deployments.
 * - Invalid deploy/mode pairings and unknown production modes fail closed.
 */
export function getLaunchMode(environment: LaunchEnvironment): LaunchMode {
  const requestedMode = environment.KINDY_LAUNCH_MODE?.trim();

  if (environment.KINDY_PRESALE_LOCKDOWN === '1') {
    return 'production_presale';
  }

  if (environment.NODE_ENV !== 'production') {
    if (requestedMode === 'protected_chat_pilot') return 'protected_chat_pilot';
    if (requestedMode === 'production_presale') return 'production_presale';
    return 'open_preview';
  }

  if (environment.KINDY_DEPLOY_ENV === 'preview') {
    if (!requestedMode || requestedMode === 'open_preview') return 'open_preview';
    if (requestedMode === 'protected_chat_pilot') return 'protected_chat_pilot';
    return 'production_presale';
  }

  if (environment.KINDY_DEPLOY_ENV === 'production') {
    if (requestedMode === 'protected_chat_pilot') return 'protected_chat_pilot';
    return 'production_presale';
  }

  return 'production_presale';
}

export function isPresaleLockdownEnabled(environment: LaunchEnvironment): boolean {
  return getLaunchMode(environment) !== 'open_preview';
}

export function isLaunchSurfaceClosed(
  pathname: string,
  environment: LaunchEnvironment,
): boolean {
  const launchMode = getLaunchMode(environment);
  if (launchMode === 'open_preview') return false;

  const normalizedPathname = normalizePathname(pathname);

  if (launchMode === 'protected_chat_pilot') {
    if (normalizedPathname === '/api' || normalizedPathname.startsWith('/api/')) {
      return !PROTECTED_CHAT_PILOT_OPEN_API_RULES.some((rule) =>
        matchesLaunchRoute(normalizedPathname, rule),
      );
    }

    return !PROTECTED_CHAT_PILOT_OPEN_ROUTE_RULES.some((rule) =>
      matchesLaunchRoute(normalizedPathname, rule),
    );
  }

  if (PRESALE_OPEN_ROUTE_RULES.some((rule) => matchesLaunchRoute(pathname, rule))) {
    return false;
  }

  if (normalizedPathname === '/api' || normalizedPathname.startsWith('/api/')) {
    return PRESALE_CLOSED_API_RULES.some((rule) =>
      matchesLaunchRoute(normalizedPathname, rule),
    );
  }

  return true;
}

/**
 * Onboarding may only hand the child into the authenticated chat surface.
 * Keeping this allowlist narrower than a generic same-origin URL check avoids
 * carrying an attacker-controlled or obsolete destination through login.
 */
export function safeChatPilotNextPath(value: string): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/chats';
  }

  try {
    const parsed = new URL(value, 'https://kindy.invalid');
    const rule = { path: '/chats', includeDescendants: true } as const;

    if (parsed.origin !== 'https://kindy.invalid' || !matchesLaunchRoute(parsed.pathname, rule)) {
      return '/chats';
    }

    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return '/chats';
  }
}

/**
 * Preserve the legacy first-journey completion outside the protected pilot.
 * Proxy adds next=/chats to pilot onboarding requests, so only that launch
 * scope moves directly into chat after the child profile is created.
 */
export function resolveOnboardingCompletionPath(
  requestedNext: string | null | undefined,
  childId: string,
): string {
  if (requestedNext == null) {
    return `/play/first-journey?childId=${encodeURIComponent(childId)}`;
  }

  return safeChatPilotNextPath(requestedNext);
}
