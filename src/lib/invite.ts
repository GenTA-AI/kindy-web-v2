import { supabase } from '@/lib/supabase';

const TABLES = {
  waitlist: 'waitlist',
  inviteCodes: 'invite_codes',
  inviteRedemptions: 'invite_redemptions',
} as const;

export type RedeemInviteResult =
  | { ok: true }
  | { error: 'invalid' | 'expired' | 'maxed' | 'already_redeemed' };

interface InviteCodeRow {
  code: string;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
}

function cleanCode(code: string) {
  return code.trim();
}

export async function hasRedeemedAny(parentId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from(TABLES.inviteRedemptions)
    .select('code')
    .eq('parent_id', parentId)
    .limit(1);

  if (error) {
    throw error;
  }

  return (data?.length ?? 0) > 0;
}

export async function redeemInvite(parentId: string, code: string): Promise<RedeemInviteResult> {
  const normalizedCode = cleanCode(code);

  if (!normalizedCode) {
    return { error: 'invalid' };
  }

  const { data: inviteCode, error: inviteError } = await supabase
    .from(TABLES.inviteCodes)
    .select('code, max_uses, used_count, expires_at')
    .eq('code', normalizedCode)
    .maybeSingle<InviteCodeRow>();

  if (inviteError) {
    throw inviteError;
  }

  if (!inviteCode) {
    return { error: 'invalid' };
  }

  if (inviteCode.expires_at && new Date(inviteCode.expires_at).getTime() < Date.now()) {
    return { error: 'expired' };
  }

  if (inviteCode.used_count >= inviteCode.max_uses) {
    return { error: 'maxed' };
  }

  const { error: redemptionError } = await supabase
    .from(TABLES.inviteRedemptions)
    .insert({
      code: normalizedCode,
      parent_id: parentId,
    });

  if (redemptionError) {
    if (redemptionError.code === '23505') {
      return { error: 'already_redeemed' };
    }
    throw redemptionError;
  }

  // v0: read-then-write is acceptable for soft launch, but max_uses can race at the boundary.
  // A follow-up RPC/transaction should move the count increment and redemption insert into one atomic operation.
  const { error: updateError } = await supabase
    .from(TABLES.inviteCodes)
    .update({ used_count: inviteCode.used_count + 1 })
    .eq('code', normalizedCode);

  if (updateError) {
    throw updateError;
  }

  return { ok: true };
}
