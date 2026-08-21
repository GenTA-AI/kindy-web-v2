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
import {
  StoryChatMessagesQuerySchema,
  StoryChatRoomIdSchema,
} from '@/types/story-chat-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ roomId: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
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

  const { roomId: rawRoomId } = await params;
  const roomId = StoryChatRoomIdSchema.safeParse(rawRoomId);
  const query = StoryChatMessagesQuerySchema.safeParse({
    child_id: request.nextUrl.searchParams.get('child_id'),
    after: request.nextUrl.searchParams.get('after') ?? undefined,
  });
  if (!roomId.success || !query.success) return storyChatBadRequestResponse();
  if (!isSupabaseServiceConfigured()) {
    return storyChatRuntimeErrorResponse(new StoryChatRuntimeError('storage_unavailable'));
  }

  try {
    const result = await createStoryChatServerRuntime().getRoomMessages({
      parentId,
      childId: query.data.child_id,
      roomId: roomId.data,
      afterSequence: query.data.after,
    });
    return storyChatSuccessResponse(result);
  } catch (error) {
    if (isStoryChatRuntimeError(error)) return storyChatRuntimeErrorResponse(error);
    return storyChatRuntimeErrorResponse(new StoryChatRuntimeError('storage_unavailable'));
  }
}
