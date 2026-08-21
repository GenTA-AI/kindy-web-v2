export type ContentReleaseRuntimeConfig =
  | { configured: false }
  | {
      configured: true;
      bucket: string;
      channel: 'staging' | 'production';
      storageOrigin: string;
      storageReaderKey: string;
    };

export const CONTENT_RELEASE_PRIVATE_BUCKET = 'content-releases' as const;

/**
 * The bucket is a fixed private runtime boundary. The channel remains explicit
 * so preview cannot consume production releases (or production consume staging).
 */
export function getContentReleaseRuntimeConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ContentReleaseRuntimeConfig {
  const bucket = env.STORY_CONTENT_RELEASE_BUCKET ?? CONTENT_RELEASE_PRIVATE_BUCKET;
  const channel = env.STORY_CONTENT_RELEASE_CHANNEL;
  const storageReaderKey = env.STORY_CONTENT_RELEASE_STORAGE_READER_KEY?.trim();
  let storageOrigin: string | undefined;
  try {
    const parsed = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? '');
    if (
      parsed.origin === parsed.href.replace(/\/$/, '')
      && !parsed.username
      && !parsed.password
    ) {
      storageOrigin = parsed.origin;
    }
  } catch {
    storageOrigin = undefined;
  }
  if (
    bucket !== CONTENT_RELEASE_PRIVATE_BUCKET
    || (channel !== 'staging' && channel !== 'production')
    || !storageOrigin
    || !storageReaderKey
  ) {
    return { configured: false };
  }
  return {
    configured: true,
    bucket,
    channel,
    storageOrigin,
    storageReaderKey,
  };
}
