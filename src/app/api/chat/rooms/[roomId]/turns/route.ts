import { NextRequest } from 'next/server';

import { getCurrentParentId, isAuthError } from '@/lib/auth';
import { isSupabaseServiceConfigured } from '@/lib/supabase';
import { StoryChatRuntimeError } from '@/lib/story-chat/authored-runtime';
import { readBoundedJson } from '@/lib/story-chat/bounded-json';
import {
  isStoryChatRuntimeError,
  storyChatBadRequestResponse,
  storyChatPostBoundaryResponse,
  storyChatPayloadTooLargeResponse,
  storyChatRateLimitErrorResponse,
  storyChatRuntimeDisabledResponse,
  storyChatRuntimeErrorResponse,
  storyChatSuccessResponse,
  storyChatUnauthorizedResponse,
} from '@/lib/story-chat/http';
import { isStoryChatRateLimitError } from '@/lib/story-chat/rate-limit';
import { getStoryChatRuntimeConfig } from '@/lib/story-chat/runtime-config';
import {
  StoryChatRoomIdSchema,
  StoryChatTurnRequestSchema,
} from '@/types/story-chat-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ roomId: string }> };
const MAX_TURN_BODY_BYTES = 4 * 1024;

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
  const body = await readBoundedJson(request, MAX_TURN_BODY_BYTES);
  if (!body.ok) {
    return body.reason === 'too_large'
      ? storyChatPayloadTooLargeResponse()
      : storyChatBadRequestResponse();
  }
  const turnRequest = StoryChatTurnRequestSchema.safeParse(body.value);
  if (!roomId.success || !turnRequest.success) return storyChatBadRequestResponse();
  if (!isSupabaseServiceConfigured()) {
    return storyChatRuntimeErrorResponse(new StoryChatRuntimeError('storage_unavailable'));
  }

  try {
    const { createStoryChatServerRuntime } = await import(
      '@/lib/story-chat/server-runtime'
    );
    const result = await createStoryChatServerRuntime().submitTurn({
      parentId,
      roomId: roomId.data,
      request: turnRequest.data,
    });
    return storyChatSuccessResponse(result, result.kind === 'authored_fallback' ? 409 : 200);
  } catch (error) {
    if (isStoryChatRateLimitError(error)) {
      return storyChatRateLimitErrorResponse(error);
    }
    if (isStoryChatRuntimeError(error)) return storyChatRuntimeErrorResponse(error);
    return storyChatRuntimeErrorResponse(new StoryChatRuntimeError('storage_unavailable'));
  }
}
