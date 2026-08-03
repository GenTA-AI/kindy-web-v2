export type LaunchEnvironment = Readonly<{
  NODE_ENV?: string;
  VERCEL_ENV?: string;
  KINDY_PRESALE_LOCKDOWN?: string;
}>;

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
 * Production pages that crawlers may visit. Auth and checkout stay accessible
 * to people but are intentionally absent from this indexing allowlist.
 */
export const PRESALE_ROBOTS_ALLOW = ['/$', '/first-story$', '/legal/'] as const;

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
  if (environment.VERCEL_ENV !== undefined) {
    return environment.VERCEL_ENV === 'production';
  }

  return environment.NODE_ENV === 'production';
}

export function isPresaleLockdownEnabled(environment: LaunchEnvironment): boolean {
  return (
    isProductionLaunchEnvironment(environment) ||
    environment.KINDY_PRESALE_LOCKDOWN === '1'
  );
}

export function isLaunchSurfaceClosed(
  pathname: string,
  environment: LaunchEnvironment,
): boolean {
  if (!isPresaleLockdownEnabled(environment)) return false;

  if (PRESALE_OPEN_ROUTE_RULES.some((rule) => matchesLaunchRoute(pathname, rule))) {
    return false;
  }

  const normalizedPathname = normalizePathname(pathname);
  if (normalizedPathname === '/api' || normalizedPathname.startsWith('/api/')) {
    return PRESALE_CLOSED_API_RULES.some((rule) =>
      matchesLaunchRoute(normalizedPathname, rule),
    );
  }

  return true;
}
