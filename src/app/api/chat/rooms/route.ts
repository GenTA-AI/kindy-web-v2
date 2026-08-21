import { NextRequest } from 'next/server';

import { getCurrentParentId, isAuthError } from '@/lib/auth';
import { isSupabaseServiceConfigured } from '@/lib/supabase';
import { StoryChatRuntimeError } from '@/lib/story-chat/authored-runtime';
import {
  isStoryChatRuntimeError,
  storyChatBadRequestResponse,
  storyChatRuntimeDisabledResponse,
  storyChatRuntimeErrorResponse,
  storyChatSuccessResponse,
  storyChatUnauthorizedResponse,
} from '@/lib/story-chat/http';
import { getStoryChatRuntimeConfig } from '@/lib/story-chat/runtime-config';
import { createStoryChatServerRuntime } from '@/lib/story-chat/server-runtime';
import { StoryChatChildIdSchema } from '@/types/story-chat-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!getStoryChatRuntimeConfig().runtimeEnabled) {
    return storyChatRuntimeDisabledResponse();
  }

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
    const result = await createStoryChatServerRuntime().listRooms({
      parentId,
      childId: childId.data,
    });
    return storyChatSuccessResponse(result);
  } catch (error) {
    if (isStoryChatRuntimeError(error)) return storyChatRuntimeErrorResponse(error);
    return storyChatRuntimeErrorResponse(new StoryChatRuntimeError('storage_unavailable'));
  }
}
