import { NextRequest } from 'next/server';

import { getCurrentParentId, isAuthError } from '@/lib/auth';
import { isSupabaseServiceConfigured } from '@/lib/supabase';
import { isSupabaseServerConfigured } from '@/lib/supabase-server';
import { StoryChatRuntimeError } from '@/lib/story-chat/authored-runtime';
import {
  storyChatBadRequestResponse,
  storyChatGetErrorResponse,
  storyChatRuntimeDisabledResponse,
  storyChatSuccessResponse,
  storyChatUnauthorizedResponse,
  storyChatRuntimeErrorResponse,
} from '@/lib/story-chat/http';
import { getStoryChatRuntimeConfig } from '@/lib/story-chat/runtime-config';
import { StoryChatChildIdSchema } from '@/types/story-chat-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!getStoryChatRuntimeConfig().runtimeEnabled) {
    return storyChatRuntimeDisabledResponse();
  }
  if (!isSupabaseServerConfigured()) return storyChatUnauthorizedResponse();

  let parentId: string;
  try {
    parentId = await getCurrentParentId(request);
  } catch (error) {
    if (isAuthError(error)) return storyChatUnauthorizedResponse();
    return storyChatRuntimeErrorResponse(new StoryChatRuntimeError('storage_unavailable'));
  }

  const childId = StoryChatChildIdSchema.safeParse(
    request.nextUrl.searchParams.get('child_id'),
  );
  if (!childId.success) return storyChatBadRequestResponse();
  if (!isSupabaseServiceConfigured()) {
    return storyChatRuntimeErrorResponse(new StoryChatRuntimeError('storage_unavailable'));
  }

  try {
    const { createStoryChatServerBrowserSurface } = await import(
      '@/lib/story-chat/server-browser-surface'
    );
    const result = await createStoryChatServerBrowserSurface().listRooms({
      parentId,
      childId: childId.data,
    });
    return storyChatSuccessResponse(result);
  } catch (error) {
    return storyChatGetErrorResponse(error);
  }
}
