import { NextResponse } from 'next/server';

import { StoryChatRuntimeError } from './authored-runtime';
import {
  isStoryChatRateLimitError,
  type StoryChatRateLimitError,
} from './rate-limit';

const NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store' } as const;

const JSON_MEDIA_TYPE = 'application/json';
const BEARER_AUTHORIZATION = /^Bearer\s+(.+)$/i;

const ERROR_RESPONSES: Record<
  StoryChatRuntimeError['code'],
  { status: number; message: string }
> = {
  runtime_disabled: { status: 404, message: '찾을 수 없어요.' },
  storage_unavailable: { status: 503, message: '대화방을 잠시 열 수 없어요.' },
  child_not_found: { status: 404, message: '아이 정보를 찾지 못했어요.' },
  consent_required: { status: 403, message: '보호자 동의를 먼저 확인해 주세요.' },
  room_not_found: { status: 404, message: '대화방을 찾지 못했어요.' },
  room_not_active: { status: 409, message: '지금은 이 대화방에서 선택할 수 없어요.' },
  session_not_open: { status: 409, message: '대화방을 다시 열고 이어가 주세요.' },
  client_turn_conflict: { status: 409, message: '답장 정보를 새로고침해 주세요.' },
  stale_revision: { status: 409, message: '새 답장이 도착했어요. 대화방을 새로고침해 주세요.' },
  current_node_mismatch: { status: 409, message: '현재 선택지를 다시 확인해 주세요.' },
  invalid_transition: { status: 409, message: '이 선택은 지금 사용할 수 없어요.' },
  release_unavailable: { status: 503, message: '승인된 이야기를 확인하는 중이에요.' },
};

export function storyChatUnauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { error: { code: 'authentication_required', message: '보호자 로그인이 필요해요.' } },
    { status: 401, headers: NO_STORE_HEADERS },
  );
}

export function storyChatBadRequestResponse(): NextResponse {
  return NextResponse.json(
    { error: { code: 'invalid_request', message: '요청 정보를 다시 확인해 주세요.' } },
    { status: 400, headers: NO_STORE_HEADERS },
  );
}

export function storyChatForbiddenResponse(): NextResponse {
  return NextResponse.json(
    { error: { code: 'request_forbidden', message: '요청을 처리할 수 없어요.' } },
    { status: 403, headers: NO_STORE_HEADERS },
  );
}

export function storyChatUnsupportedMediaTypeResponse(): NextResponse {
  return NextResponse.json(
    { error: { code: 'unsupported_media_type', message: 'JSON 요청만 사용할 수 있어요.' } },
    { status: 415, headers: NO_STORE_HEADERS },
  );
}

export function storyChatPayloadTooLargeResponse(): NextResponse {
  return NextResponse.json(
    { error: { code: 'payload_too_large', message: '요청 내용이 너무 길어요.' } },
    { status: 413, headers: NO_STORE_HEADERS },
  );
}

export function storyChatRuntimeDisabledResponse(): NextResponse {
  return storyChatRuntimeErrorResponse(new StoryChatRuntimeError('runtime_disabled'));
}

export function storyChatRuntimeErrorResponse(error: StoryChatRuntimeError): NextResponse {
  const response = ERROR_RESPONSES[error.code];
  return NextResponse.json(
    { error: { code: error.code, message: response.message } },
    { status: response.status, headers: NO_STORE_HEADERS },
  );
}

export function storyChatSuccessResponse(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

export function storyChatRateLimitErrorResponse(
  error: StoryChatRateLimitError,
): NextResponse {
  if (error.code === 'rate_limited') {
    return NextResponse.json(
      {
        error: {
          code: 'rate_limited',
          message: '요청이 너무 빨라요. 잠시 후 다시 시도해 주세요.',
        },
      },
      {
        status: 429,
        headers: {
          ...NO_STORE_HEADERS,
          'Retry-After': String(error.retryAfterSeconds ?? 1),
        },
      },
    );
  }

  const response = {
    storage_unavailable: { status: 503, message: '대화방을 잠시 열 수 없어요.' },
    child_not_found: { status: 404, message: '아이 정보를 찾지 못했어요.' },
    consent_required: { status: 403, message: '보호자 동의를 먼저 확인해 주세요.' },
    room_not_found: { status: 404, message: '대화방을 찾지 못했어요.' },
  }[error.code];
  return NextResponse.json(
    { error: { code: error.code, message: response.message } },
    { status: response.status, headers: NO_STORE_HEADERS },
  );
}

/** Shared error boundary for consent-gated chat GET routes. */
export function storyChatGetErrorResponse(error: unknown): NextResponse {
  if (isStoryChatRateLimitError(error)) {
    return storyChatRateLimitErrorResponse(error);
  }
  if (isStoryChatRuntimeError(error)) {
    return storyChatRuntimeErrorResponse(error);
  }
  return storyChatRuntimeErrorResponse(
    new StoryChatRuntimeError('storage_unavailable'),
  );
}

export function isStoryChatRuntimeError(error: unknown): error is StoryChatRuntimeError {
  return error instanceof StoryChatRuntimeError;
}

/**
 * Reject unsafe POSTs before authentication, body reads, or runtime work.
 *
 * Cookie credentials are ambient browser authority, so they require a
 * same-origin `Origin` header. A syntactically present Bearer credential is
 * non-ambient and may omit Origin for mobile clients; the Route Handler still
 * verifies that token with Supabase before any mutation.
 */
export function storyChatPostBoundaryResponse(request: Request): NextResponse | null {
  const contentType = request.headers.get('content-type');
  const mediaType = contentType?.split(';', 1)[0]?.trim().toLowerCase();
  if (mediaType !== JSON_MEDIA_TYPE) {
    return storyChatUnsupportedMediaTypeResponse();
  }

  const authorization = request.headers.get('authorization') ?? '';
  const bearerMatch = authorization.match(BEARER_AUTHORIZATION);
  if (bearerMatch?.[1].trim()) return null;

  const originHeader = request.headers.get('origin');
  if (!originHeader) return storyChatForbiddenResponse();

  try {
    const origin = new URL(originHeader);
    const requestOrigin = new URL(request.url).origin;
    const isHttpOrigin = origin.protocol === 'https:' || origin.protocol === 'http:';
    const isOriginOnly =
      origin.username === '' &&
      origin.password === '' &&
      origin.pathname === '/' &&
      origin.search === '' &&
      origin.hash === '';

    if (!isHttpOrigin || !isOriginOnly || origin.origin !== requestOrigin) {
      return storyChatForbiddenResponse();
    }
  } catch {
    return storyChatForbiddenResponse();
  }

  return null;
}
