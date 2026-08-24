# Story Chat AI Runtime — implementation decision

Date: 2026-08-21
Status: implemented foundation, production activation blocked

## Current truth

- Hosted Supabase is healthy for the existing product, but its migration history
  ends at `0029`. Migrations `0030` through `0034` are not applied remotely.
- `world_chat_*`, `content_release_*`, and chat rate-limit tables therefore do
  not exist in the hosted database yet.
- Preview and production currently point at the same Supabase project. The
  preview Cloud Run revision has no service-role Secret and uses demo chat
  fixtures; it is not a persistent chat environment.
- Story chat and free text remain compile-time and deployment-time disabled.

## Conversation API decision

The first provider is Anthropic Messages API with the exact model ID
`claude-sonnet-5`, non-streaming, at most 512 output tokens, and a four-second
model deadline. The account-level synthetic smoke on 2026-08-21 returned the
same model ID, `end_turn`, and schema-valid structured JSON.

The provider is behind `NarrativeActionGenerator`; OpenAI Responses can be
evaluated later without changing the story director. It is not in the launch
path now.

Anthropic references:

- https://platform.claude.com/docs/en/about-claude/models/overview
- https://platform.claude.com/docs/en/build-with-claude/structured-outputs

## Safety sequence

Every free-text turn must complete this sequence before anything is shown:

1. Unicode normalization and deterministic PII/immediate-risk precheck.
2. Wenit input moderation. Anything other than an explicit canonical `allow`
   stops the turn.
3. Claude selects only approved graph actions and IDs. It cannot emit free
   dialogue, URLs, storage keys, tools, or image prompts in v1.
4. The server revalidates every action, transition, option, media node, and
   image recipe against the verified ExperienceGraph.
5. All display text referenced by the plan is projected without storage,
   answer, solution, or release metadata. The sanitized child input and this
   candidate output are then sent together to Wenit so contextual pairs are
   evaluated, not only isolated sentences.
6. The plan is returned only if the second Wenit check explicitly allows it.
   Timeout, refusal, schema drift, unknown policy version, `review`, `block`, or
   provider failure discards the entire candidate and returns an authored
   safety path.

There is no token streaming before output moderation. Authored buttons and
pre-approved paths remain the immediate path; free text may take roughly
10–15 seconds and has a total 15-second fail-closed deadline.

## Implemented foundation

- Provider-neutral structured generator contract and redacted child prompt.
- Anthropic server adapter using `output_config.format` JSON Schema.
- Closed Narrative Director action contract and graph allowlist validator.
- Deterministic child input precheck with no-echo PII/risk redirects.
- Wenit submit/poll client, conservative canonical mapper, bounded I/O,
  timeout/backoff behavior, and safe audit projection.
- PostgreSQL-backed two-phase Wenit scheduler: queue reservation followed by a
  DB-clock actual-start claim, with a 250 ms response-age ceiling. The same
  opaque credential identity must be shared by every process using one raw key.
- Dual Wenit input/output turn orchestrator.
- Explicit self-identification, school, location, contact, and common Korean/
  English crisis-pattern prechecks. These rules remain defense in depth and do
  not replace the required DLP/NER corpus evaluation.
- A browser projection that exposes only the validated plan or fixed safety
  plan; vendor scores, thresholds, tokens, latency, and request IDs stay server
  internal.
- All runtime readiness constants remain `false`.

## Activation gates

Do not enable child free text until all gates are complete:

1. Create a separate preview Supabase project with no production user copy and
   apply `0001` through the latest migration there.
2. Provision an immutable content-object boundary or an RPC-only runtime
   database identity; keep publisher/operator identities separate.
3. Apply `0034`, provision bounded cleanup for the distributed Wenit scheduler,
   and validate queue/actual-start concurrency at the vendor key quota under
   event-loop delay and multi-instance load.
4. Rotate the Wenit key that was previously shared in chat, store only the new
   key in Secret Manager, and never create a `NEXT_PUBLIC_*` key.
5. Capture and operator-approve exact Wenit threshold, pricing, age-group,
   category-shape, pending-status, and matched-rule contract values. Confirm
   whether the response has separate schema/model/policy version fields; pin
   them explicitly, or obtain written evidence that the threshold snapshot is
   the complete behavior-policy version. Unknown behavior-affecting fields are
   a launch blocker.
6. Complete DPA/privacy notice, `child_free_text_ai` parental consent,
   withdrawal, deletion, retention, and parent kill-switch work.
7. Add a high-recall local DLP/NER layer and corpus tests for Korean names,
   schools, free-form addresses, obfuscated contacts, and crisis disclosures;
   deterministic regexes alone cannot substantiate zero PII transmission.
8. Run synthetic/adult shadow evaluation before any child cohort: critical
   false negatives `0`, unsafe output exposure `0`, PII external transmission
   `0`, full-turn P95 within the accepted UI budget, and all failure injection
   cases producing the authored fallback.

Only after those gates pass may preview runtime readiness be changed. Production
database migration and activation require a separate backup/PITR/restore check
and an explicit rollout decision.
