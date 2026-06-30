'use client';

import { useEffect, useRef } from 'react';
import { createBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase-browser';
import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_COOKIE_MAX_AGE_DAYS,
  MARKETING_SOURCE_COOKIE,
  MARKETING_SOURCE_COOKIE_MAX_AGE_DAYS,
  type MarketingSource,
} from '@/lib/attribution';

export default function AttributionTracker({
  token,
  source,
}: {
  token: string | null;
  source: MarketingSource | null;
}) {
  const claimedRef = useRef(false);

  useEffect(() => {
    if (token) {
      const maxAge = ATTRIBUTION_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
      document.cookie = `${ATTRIBUTION_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; samesite=lax`;
    }
    if (source) {
      const maxAge = MARKETING_SOURCE_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
      document.cookie = `${MARKETING_SOURCE_COOKIE}=${encodeURIComponent(source)}; path=/; max-age=${maxAge}; samesite=lax`;
    }

    if (claimedRef.current) return;
    claimedRef.current = true;

    (async () => {
      try {
        if (!isSupabaseBrowserConfigured()) return;
        const supabase = createBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        await fetch('/api/attribution/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(token ? { ks: token } : {}),
        });
      } catch {
        // 기록 연결 실패는 화면을 막지 않는다.
      }
    })();
  }, [source, token]);

  return null;
}
