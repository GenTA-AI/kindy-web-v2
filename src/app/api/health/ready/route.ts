import { getDeploymentHealth } from '@/lib/deployment-health';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function GET() {
  const health = getDeploymentHealth(process.env);

  return Response.json(health, {
    status: health.status === 'ready' ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
