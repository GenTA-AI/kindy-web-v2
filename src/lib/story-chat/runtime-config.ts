import type { StoryChatReleaseChannel } from '@/types/story-chat-api';

export type StoryChatRuntimeEnvironment = Readonly<{
  KINDY_LAUNCH_MODE?: string;
  STORY_CHAT_RUNTIME_ENABLED?: string;
  STORY_CHAT_FREE_TEXT_ENABLED?: string;
  STORY_CONTENT_RELEASE_CHANNEL?: string;
}>;

export type StoryChatRuntimeConfig = Readonly<{
  runtimeEnabled: boolean;
  freeTextEnabled: false;
  releaseChannel: StoryChatReleaseChannel | null;
}>;

/**
 * P0 launch gate. The current Cloud Run process still carries the Supabase
 * service-role credential, which can bypass Storage RLS and mutate release
 * objects even when a second read-only JWT is used by the loader. Flip this
 * only after an immutable GCS identity boundary or a fully RPC-only database
 * runtime identity is implemented and independently verified.
 */
export const STORY_CHAT_RUNTIME_IMMUTABLE_BOUNDARY_READY = false as const;

/**
 * Child chat is an exact opt-in surface. Typos, missing variables, and truthy
 * lookalikes all stay closed. Free text is deliberately hard-disabled in this
 * authored-core milestone even if an environment variable is set.
 */
export function getStoryChatRuntimeConfig(
  environment?: StoryChatRuntimeEnvironment,
): StoryChatRuntimeConfig {
  const runtimeFlag = environment
    ? environment.STORY_CHAT_RUNTIME_ENABLED
    : process.env.STORY_CHAT_RUNTIME_ENABLED;
  const launchMode = environment
    ? environment.KINDY_LAUNCH_MODE
    : process.env.KINDY_LAUNCH_MODE;
  const configuredChannel = environment
    ? environment.STORY_CONTENT_RELEASE_CHANNEL
    : process.env.STORY_CONTENT_RELEASE_CHANNEL;
  const releaseChannel = configuredChannel === 'staging'
    || configuredChannel === 'production'
    ? configuredChannel
    : null;
  return {
    runtimeEnabled:
      STORY_CHAT_RUNTIME_IMMUTABLE_BOUNDARY_READY
      && runtimeFlag === '1'
      && launchMode === 'protected_chat_pilot',
    freeTextEnabled: false,
    releaseChannel,
  };
}
