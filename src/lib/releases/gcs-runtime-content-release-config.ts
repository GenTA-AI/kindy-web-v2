export const CONTENT_RELEASE_GCS_BACKEND = 'gcs' as const;

export const CONTENT_RELEASE_GCS_BUCKETS = {
  staging: 'kindy-493701-content-releases-staging',
  production: 'kindy-493701-content-releases-production',
} as const;

export const CONTENT_RELEASE_GCS_SIGNERS = {
  staging: 'kindy-preview-runtime@kindy-493701.iam.gserviceaccount.com',
  production: 'kindy-runtime@kindy-493701.iam.gserviceaccount.com',
} as const;

export type GcsContentReleaseRuntimeConfig =
  | { configured: false }
  | {
      configured: true;
      backend: typeof CONTENT_RELEASE_GCS_BACKEND;
      bucket: (typeof CONTENT_RELEASE_GCS_BUCKETS)[keyof typeof CONTENT_RELEASE_GCS_BUCKETS];
      channel: keyof typeof CONTENT_RELEASE_GCS_BUCKETS;
      signerServiceAccount:
        (typeof CONTENT_RELEASE_GCS_SIGNERS)[keyof typeof CONTENT_RELEASE_GCS_SIGNERS];
    };

/**
 * Future GCS activation config. It is intentionally separate from the current
 * Supabase adapter so merely adding these variables cannot switch production.
 * Cloud Run obtains credentials from its attached service account through ADC;
 * this config has no field for a JSON key, private key, or bearer token.
 */
export function getGcsContentReleaseRuntimeConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): GcsContentReleaseRuntimeConfig {
  const deployEnvironment = env.KINDY_DEPLOY_ENV;
  const backend = env.STORY_CONTENT_RELEASE_STORAGE_BACKEND;
  const channel = env.STORY_CONTENT_RELEASE_CHANNEL;
  const bucket = env.STORY_CONTENT_RELEASE_BUCKET;
  const signerServiceAccount =
    env.STORY_CONTENT_RELEASE_GCS_SIGNER_SERVICE_ACCOUNT;

  const expectedChannel = deployEnvironment === 'preview'
    ? 'staging'
    : deployEnvironment === 'production'
      ? 'production'
      : null;

  if (
    backend !== CONTENT_RELEASE_GCS_BACKEND
    || expectedChannel === null
    || channel !== expectedChannel
    || bucket !== CONTENT_RELEASE_GCS_BUCKETS[expectedChannel]
    || signerServiceAccount !== CONTENT_RELEASE_GCS_SIGNERS[expectedChannel]
    || hasValue(env.STORY_CONTENT_RELEASE_STORAGE_READER_KEY)
    || hasValue(env.STORY_CONTENT_RELEASE_GCS_CREDENTIALS_JSON)
    || hasValue(env.STORY_CONTENT_RELEASE_GCS_PRIVATE_KEY)
    || hasValue(env.GOOGLE_APPLICATION_CREDENTIALS)
  ) {
    return { configured: false };
  }

  return {
    configured: true,
    backend,
    bucket,
    channel,
    signerServiceAccount,
  };
}

function hasValue(value: string | undefined): boolean {
  return Boolean(value?.trim());
}
