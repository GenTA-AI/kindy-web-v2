/**
 * 빌링키 앱레벨 암호화 (AES-256-GCM).
 *
 * 토스 빌링키는 유출 시 부모 카드에 임의 결제가 가능한 민감정보다. DB에 평문으로
 * 저장하면 테이블/백업 유출·SQL injection 한 번에 전 가정 카드가 노출된다.
 * (migration 0017 의 "실서비스 평문 저장 금지" TODO 해소.)
 *
 * 저장 포맷:
 *   - 암호화:   `enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>`
 *   - 테스트(로컬, 키 미설정): `plain:<billingKey>`
 *   - 레거시(접두어 없음): 그대로 평문 취급(하위호환).
 *
 * 키: `BILLING_KEY_SECRET` (base64 또는 hex 32바이트, 혹은 임의 passphrase→scrypt 파생).
 *   프로덕션에서 secret 없이 실 빌링키를 저장하려 하면 throw (auth hard-fail 과 동일 철학).
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const ENC_PREFIX = 'enc:v1:';
const PLAIN_PREFIX = 'plain:';

function isProd(): boolean {
  return process.env.NODE_ENV === 'production' && process.env.KINDY_LOCAL_PREVIEW !== '1';
}

/** BILLING_KEY_SECRET → 32바이트 키. base64/hex 32바이트면 그대로, 아니면 scrypt 파생. */
function resolveKey(): Buffer | null {
  const raw = process.env.BILLING_KEY_SECRET?.trim();
  if (!raw) return null;

  for (const enc of ['base64', 'hex'] as const) {
    try {
      const buf = Buffer.from(raw, enc);
      if (buf.length === 32) return buf;
    } catch {
      // try next encoding
    }
  }
  // 임의 길이 passphrase → 고정 salt scrypt(32). secret 자체가 비밀이므로 고정 salt 허용.
  return scryptSync(raw, 'kindy-billing-key-v1', 32);
}

/** 저장 직전 호출. 평문 빌링키 → 저장 문자열. */
export function encryptBillingKey(plain: string): string {
  const key = resolveKey();
  if (!key) {
    if (isProd()) {
      throw new Error('BILLING_KEY_SECRET가 필요합니다 (프로덕션에서 빌링키 평문 저장 금지).');
    }
    // 로컬/테스트: 평문이지만 접두어로 명시.
    return `${PLAIN_PREFIX}${plain}`;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

/** charge 직전 호출. 저장 문자열 → 평문 빌링키. */
export function decryptBillingKey(stored: string): string {
  if (stored.startsWith(PLAIN_PREFIX)) {
    return stored.slice(PLAIN_PREFIX.length);
  }
  if (!stored.startsWith(ENC_PREFIX)) {
    // 레거시 평문 (암호화 도입 이전 저장). 그대로 사용.
    return stored;
  }
  const key = resolveKey();
  if (!key) {
    throw new Error('BILLING_KEY_SECRET가 없어 암호화된 빌링키를 복호화할 수 없습니다.');
  }
  const [ivB64, tagB64, ctB64] = stored.slice(ENC_PREFIX.length).split(':');
  if (!ivB64 || !tagB64 || !ctB64) {
    throw new Error('빌링키 저장 포맷이 올바르지 않습니다.');
  }
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8');
}
