import { getDeploymentLiveness } from '@/lib/deployment-health';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function GET() {
  return Response.json(getDeploymentLiveness(process.env), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
