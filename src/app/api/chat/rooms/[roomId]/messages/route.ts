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
  if (!isSupabaseServerConfigured()) return storyChatUnauthorizedResponse();

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
    const { createStoryChatServerBrowserSurface } = await import(
      '@/lib/story-chat/server-browser-surface'
    );
    const result = await createStoryChatServerBrowserSurface().getRoomMessages({
      parentId,
      childId: query.data.child_id,
      roomId: roomId.data,
      afterSequence: query.data.after,
    });
    return storyChatSuccessResponse(result);
  } catch (error) {
    return storyChatGetErrorResponse(error);
  }
}
