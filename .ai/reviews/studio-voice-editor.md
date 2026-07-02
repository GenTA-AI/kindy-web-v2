# Review: studio-voice-editor

## decision
request_changes

## critical
- **package.json is out of declared Scope and must be reverted.** The worker changed
  `smoke:limited-animation` from `tsx scripts/smoke-limited-animation.ts` to
  `node --import tsx scripts/smoke-limited-animation.ts` to dodge a `tsx` IPC-pipe
  failure that only exists in the worker's own sandbox. I empirically settled the
  keep/revert question:
  - **(a) Works identically in the real environment?** Yes — I ran the *original*
    `npx tsx scripts/smoke-limited-animation.ts` here (Node v22.15.1) and it exits 0
    with identical output (`limited animation smoke ok`, `narration-delay duration=4.00s`).
    The workaround provides zero benefit in the user's environment.
  - **(b) Creates inconsistency?** Yes. All six sibling `smoke:*` scripts use `tsx …`;
    this would be the lone script on `node --import tsx …`. That is a maintenance trap
    (future copy-paste / "why is this one different?"). Standardizing on `node --import tsx`
    would be a deliberate, uniform change — out of this package's scope.
  - **Verdict: revert** the line back to `tsx scripts/smoke-limited-animation.ts`.
    This is the only blocking item; it's a one-line revert, not a re-implementation.
  - Note: the other two `scope_ok=0` flags (`KIOSK_하드웨어_제작계획.md`,
    `키오스크_앱_개발플랜.md`) are **untracked user files** (`??`), not worker output —
    they do not count against this run.

## should_fix
- (none — all code deliverables are correct and validated; see validation_notes)

## nice_to_have
- `limited-animation.ts` `audioDelaySec` option is added (scoped) but never exercised:
  the pipeline bakes the narration 0.5s delay into `normalizeAudioToDuration` and
  `stepLimitedAnimationScene` does **not** pass `audioDelaySec`; the smoke pre-bakes the
  delay with an external `adelay` and feeds an already-delayed wav. So `buildAudioFilter`'s
  `adelay` branch has no caller and no keyless coverage. Limited-mode narration still gets
  the delay correctly (via the normalized audio file), so this is harmless — but consider
  either having the smoke pass `audioDelaySec` directly (to cover the branch) or dropping
  the unused option.
- `normalizeVideo` now maps `[0:a]` unconditionally, adding a new requirement that its input
  always carries an audio track. All current callers (lipsync raw, VEED raw, concat inputs)
  do carry audio, so it's fine today — but a future silent-video caller would break. Worth a
  one-line comment noting the audio-track precondition.
- DRY_RUN estimate hardcodes 3 dialogue scenes (`3 * 0.05`) and 60s of premium `videoSilent`;
  real episodes may differ. This is only the estimate — real ledger comes from
  `COST_PER_SEC × audioDuration` — and the HUMAN gate reconciles it. FYI only.

## validation_notes
- **Gate ground truth accepted:** validation_exit=0 (lint + tsc + keyless smoke). validation.log
  shows lint clean, no tsc errors, smoke `ok`. I re-ran the smoke myself two ways (original `tsx`
  and the modified `node --import tsx`) — both exit 0, identical output.
- **Casting wiring (episode-pipeline stepSceneAudio, lines 644-680):** verified.
  narration → `voiceName=ANIMAL_VILLAGE_BIBLE.narrator.voice` (bible = `'Kore'`, confirmed line 223) +
  `styleOverride=narrator.style` + speedWpm 130. character_speaking →
  `resolveVoiceCasting(scene.speakerId).voice` + `resolveVoiceStyle(scene.speakerId, scene.voiceEmotion)`.
  Both resolvers fall back to narrator when speakerId is missing (bible lines 245-258), so P1's
  soft-fill is not even required for safety.
- **gemini-tts backward compat:** `voice` made optional; `voiceSpec` rebuilt as
  `{ voiceName: input.voiceName ?? base?.voiceName, style: input.styleOverride ?? base?.style }`
  with a guard that throws if either is missing. `VoiceSpec` only ever exposes `voiceName`/`style`
  (consumed at buildPrompt + prebuiltVoiceConfig + voiceUsed), so the refactor drops nothing. Only
  caller of `synthesizeKorean` is stepSceneAudio (grepped) — no other path to break.
- **rawTtsPath / lip-sync integrity (the flagged high-attention item):** `rawTtsPath = basePath`
  = the raw `_tts.wav` **before** waitBeat silence and **before** `normalizeAudioToDuration`.
  VEED consumes `audio.rawTtsPath` (stepVeedSpeakingScene line 730). The narration 0.5s delay is
  applied only inside `normalizeAudioToDuration` on the *normalized* path via `delayMs`, and
  `delayMs` is 0 for non-narration. `overlayAudio` applies no `adelay`. So no delay ever touches
  dialogue raw audio → no lip-sync drift. Confirmed.
- **VEED path (veed-fabric.ts):** `generateSceneFromFiles` mirrors sync-lipsync.ts exactly
  (`fal.config` in ctor, `fal.storage.upload` of image+audio, `fal.subscribe('veed/fabric-1.0')`,
  same Blob/File upload helper). `costUsd = audioDurationSec × COST_PER_SEC[resolution]` (real,
  WAV-header probe with ffprobe fallback). `COST_PER_SEC` constant untouched (480p 0.08 / 720p 0.15).
  Dialogue-scene duration fit = `tpad=stop_mode=clone` freeze (covers waitBeat silence) → `trim` →
  fades 0.3s; premium skips Seedance on speaking scenes and extracts last-frame from the VEED clip
  (line 742). EPISODE_LIPSYNC veed/sync/off + SKIP_LIPSYNC=1 semantics preserved via
  `resolveLipsyncMode` and `lipsyncMode !== 'sync'` at the composite call.
- **Edit recipe:** narration `adelay=500` then `apad`/`atrim`/`-t durationSec` (delay stays inside
  the scene's own duration → 85-95s script total unchanged). `buildNormalizedVideoFilter` targets
  1920x1080 (`force_original_aspect_ratio=decrease` + centered pad), yuv420p / crf18 / r24 /
  aac 192k / 44100 / stereo. All scenes get fades; concat-time normalize passes no fade options
  (defaults 0) so there is no double-fade. limited-animation fade defaults (0.15/0.25) preserve
  prior behavior; buildAudioFilter with no delay == old `apad,atrim,asetpts`.
- **gen-village-tts:** bible lookup via `line.characterId` (VoiceLine has it, line 688), voice ==
  existing per-character voice (bible/village voice tables match), explicit style passed as
  `generateTtsToBuffer(text, voice, style)` (provider already accepts optional 3rd `style` arg —
  no out-of-scope edit of the provider). kind→emotion map: `.intro`→bright, `.praise`→excited,
  `sess.*`→storytelling (matches spec). FORCE/ONLY/mp3/manifest untouched; keyless error mentions
  both GOOGLE_API_KEY and GEMINI_API_KEY.
- **Cost ledger:** `perStageCostUsd.veed` added and included in `totalCost`; `costFromOutput`
  spreads it through to the report; DRY_RUN adds `veed` with an in-code source comment and keeps
  it distinct from the real `COST_PER_SEC` measurement. `resolveEpisodeLipsyncMode` mirrors the
  pipeline's mode resolution.
- **Not verified (keyless constraint, HUMAN gate):** real VEED/Gemini calls, actual lip-sync
  quality, per-character voice/emotion audibility, and real VEED $/scene vs the $0.05 estimate —
  all correctly deferred to the human gate per spec.
