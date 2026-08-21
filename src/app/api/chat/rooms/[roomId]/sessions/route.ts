import { NextRequest } from 'next/server';

import { getCurrentParentId, isAuthError } from '@/lib/auth';
import { isSupabaseServiceConfigured } from '@/lib/supabase';
import { StoryChatRuntimeError } from '@/lib/story-chat/authored-runtime';
import { readBoundedJson } from '@/lib/story-chat/bounded-json';
import {
  storyChatBadRequestResponse,
  storyChatPayloadTooLargeResponse,
  storyChatPostBoundaryResponse,
  storyChatRateLimitErrorResponse,
  storyChatRuntimeDisabledResponse,
  storyChatRuntimeErrorResponse,
  storyChatSuccessResponse,
  storyChatUnauthorizedResponse,
} from '@/lib/story-chat/http';
import { isStoryChatRateLimitError } from '@/lib/story-chat/rate-limit';
import {
  isStoryChatRoomLifecycleError,
  StoryChatOpenSessionRequestSchema,
} from '@/lib/story-chat/room-lifecycle';
import { storyChatRoomLifecycleErrorResponse } from '@/lib/story-chat/room-lifecycle-http';
import { getStoryChatRuntimeConfig } from '@/lib/story-chat/runtime-config';
import { StoryChatRoomIdSchema } from '@/types/story-chat-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ roomId: string }> };
const MAX_OPEN_SESSION_BODY_BYTES = 1024;

export async function POST(request: NextRequest, { params }: RouteParams) {
  const boundaryResponse = storyChatPostBoundaryResponse(request);
  if (boundaryResponse) return boundaryResponse;

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
  const body = await readBoundedJson(request, MAX_OPEN_SESSION_BODY_BYTES);
  if (!body.ok) {
    return body.reason === 'too_large'
      ? storyChatPayloadTooLargeResponse()
      : storyChatBadRequestResponse();
  }
  const sessionRequest = StoryChatOpenSessionRequestSchema.safeParse(body.value);
  if (!roomId.success || !sessionRequest.success) {
    return storyChatBadRequestResponse();
  }
  if (!isSupabaseServiceConfigured()) {
    return storyChatRuntimeErrorResponse(new StoryChatRuntimeError('storage_unavailable'));
  }

  try {
    const { createStoryChatRoomLifecycle } = await import(
      '@/lib/story-chat/server-room-lifecycle'
    );
    const result = await createStoryChatRoomLifecycle().openSession({
      parentId,
      roomId: roomId.data,
      request: sessionRequest.data,
    });
    return storyChatSuccessResponse(
      result,
      result.session.resumed_existing ? 200 : 201,
    );
  } catch (error) {
    if (isStoryChatRateLimitError(error)) {
      return storyChatRateLimitErrorResponse(error);
    }
    if (isStoryChatRoomLifecycleError(error)) {
      return storyChatRoomLifecycleErrorResponse(error);
    }
    return storyChatRuntimeErrorResponse(new StoryChatRuntimeError('storage_unavailable'));
  }
}
