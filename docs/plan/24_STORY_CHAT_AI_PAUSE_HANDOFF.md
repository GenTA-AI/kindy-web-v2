# Story Chat AI — pause handoff

Date: 2026-08-21
Branch: `codex/kindy-chat-gcp-preview`
State: local implementation checkpoint; runtime and hosted DB activation remain blocked

## What is true now

- Existing hosted Supabase functions for the current product are healthy.
- Hosted migration history stops at `0029`; migrations `0030`–`0034` have not
  been applied. The hosted database therefore is **not** a persistent story-chat
  runtime yet.
- Preview and production still share one Supabase project. Do not apply the chat
  migrations or enable free text there as a shortcut.
- `/chats` in preview remains fixture UI. No new AI route, database migration,
  GCP deployment, Secret Manager write, or production traffic change was made
  in this slice.
- Story-chat, free-text, Wenit, Narrative Director, and safe-turn readiness stay
  hard-disabled.

## Chosen runtime

The first narrative provider is Anthropic Messages API with exact model
`claude-sonnet-5`, non-streaming structured output, 512 output-token ceiling,
and a four-second model timeout. A synthetic account smoke returned the same
model ID, `end_turn`, and schema-valid JSON.

The model does not write arbitrary dialogue. It may select only approved
ExperienceGraph action, node, option, cinematic, and image-recipe IDs.

Free-text sequence:

1. deterministic Unicode/PII/immediate-risk precheck;
2. Wenit input check;
3. Claude closed-action selection;
4. server graph transition revalidation;
5. contextual Wenit check over sanitized child input plus authored candidate;
6. server-internal plan commit followed by a rendered message DTO; no plan is
   serialized to the browser.

## Implemented files

- `src/lib/ai/narrative-generator.ts`
- `src/lib/ai/narrative-action-contract.ts`
- `src/lib/ai/anthropic-narrative-generator.ts`
- `src/lib/ai/server-anthropic-narrative-generator.ts`
- `src/lib/story-chat/narrative-director.ts`
- `src/lib/story-chat/safe-narrative-turn.ts`
- `src/lib/safety/child-input-precheck.ts`
- `src/lib/safety/wenit/*`
- `supabase/migrations/0034_wenit_poll_scheduler.sql`
- `supabase/tests/0034_wenit_poll_scheduler.*.sql`
- `docs/plan/23_STORY_CHAT_AI_RUNTIME.md`
- `docs/plan/23_WENIT_POLL_SCHEDULER.md`

Wenit polling uses a two-phase PostgreSQL reservation/actual-start claim. The
PG17 harness passed eight-session contention, adversarial late wake, replay,
deadline, RLS/ACL, and cleanup checks. No raw key, hash, prompt, task ID, or
child/user identifier enters the scheduler tables.

## Do not activate before these blockers are closed

1. Revoke and rotate the Wenit key previously pasted into chat. Put only the
   replacement in server-side Secret Manager.
2. Create a separate preview Supabase project, then apply and verify
   `0001`–`0034` there. Never copy production children into it.
3. Finish immutable/RPC-only runtime identity separation and load only a
   server-verified ContentRelease snapshot; never accept a client graph.
4. Fix final-render moderation: `{{child_name}}` is currently substituted after
   authored text moderation. Either moderate the fully rendered text or admit
   only separately approved immutable display names.
5. Add high-recall DLP/NER and Korean child-language evaluation. Regex rules are
   defense in depth and cannot prove zero name, school, free-form address, or
   obfuscated-contact leakage.
6. Confirm and pin every behavior-affecting Wenit schema/model/policy/threshold
   version from an actual terminal payload.
7. Add a single `server-only` composition root enforcing auth, child ownership,
   consent, readiness, verified release, rate limits, and the public projection.
8. Add generated-image moderation and immutable human-approved video/audio/
   subtitle QC.
9. Complete DPA, privacy notice, cross-border processing, retention/deletion,
   `child_free_text_ai` consent/withdrawal, kill switch, and approved crisis UI.
10. Register scheduler cleanup and operational alerts, then run synthetic/adult
    shadow and fault-injection tests before any child cohort.

## First commands after resuming

Run locally before changing runtime flags or external infrastructure:

```bash
git status --short
npx tsc --noEmit
npm run lint
npm test
npm run build
```

Then rerun the `0034` PostgreSQL 17 harness and inspect the exact staged diff.
Do not stage the unrelated existing kiosk edit or the untracked proposal/output
folders. The next product slice is the separate preview Supabase bootstrap,
followed by the server-only composition root; it is not production activation.
