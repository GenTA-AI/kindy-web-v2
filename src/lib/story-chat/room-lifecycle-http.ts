import { NextResponse } from 'next/server';

import type {
  StoryChatRoomLifecycleError,
  StoryChatRoomLifecycleErrorCode,
} from './room-lifecycle';

const NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store' } as const;

const SESSION_ERROR_RESPONSES: Record<
  StoryChatRoomLifecycleErrorCode,
  { status: number; message: string }
> = {
  runtime_disabled: { status: 404, message: '찾을 수 없어요.' },
  invalid_request: { status: 400, message: '요청 정보를 다시 확인해 주세요.' },
  storage_unavailable: { status: 503, message: '대화방을 잠시 열 수 없어요.' },
  child_not_found: { status: 404, message: '아이 정보를 찾지 못했어요.' },
  consent_required: { status: 403, message: '보호자 동의를 먼저 확인해 주세요.' },
  room_not_found: { status: 404, message: '대화방을 찾지 못했어요.' },
  room_not_openable: { status: 409, message: '지금은 이 대화방을 열 수 없어요.' },
  release_unavailable: { status: 503, message: '승인된 이야기를 확인하는 중이에요.' },
  client_session_conflict: {
    status: 409,
    message: '대화방 세션 정보를 새로고침해 주세요.',
  },
};

export function storyChatRoomLifecycleErrorResponse(
  error: StoryChatRoomLifecycleError,
): NextResponse {
  const response = SESSION_ERROR_RESPONSES[error.code];
  return NextResponse.json(
    { error: { code: error.code, message: response.message } },
    { status: response.status, headers: NO_STORE_HEADERS },
  );
}
