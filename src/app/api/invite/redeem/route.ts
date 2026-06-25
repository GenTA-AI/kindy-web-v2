import { NextRequest, NextResponse } from 'next/server';
import { getCurrentParentId, isAuthError } from '@/lib/auth';
import { hasRedeemedAny, redeemInvite } from '@/lib/invite';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function GET() {
  let parentId: string;
  try {
    parentId = await getCurrentParentId();
  } catch (error) {
    if (isAuthError(error)) return unauthorized();
    throw error;
  }

  const redeemed = await hasRedeemedAny(parentId);
  return NextResponse.json({ redeemed });
}

export async function POST(request: NextRequest) {
  let parentId: string;
  try {
    parentId = await getCurrentParentId();
  } catch (error) {
    if (isAuthError(error)) return unauthorized();
    throw error;
  }

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === 'string' ? body.code : '';
  const result = await redeemInvite(parentId, code);

  if ('ok' in result) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: result.error }, { status: 400 });
}
