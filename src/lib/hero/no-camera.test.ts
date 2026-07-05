import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

import { formatCameraTokenViolations, scanCameraTokens } from '../../../scripts/scan-camera-tokens';

const THIS_TEST_FILE = fileURLToPath(import.meta.url);

test('child surface contains no photo upload or camera capture code paths', async () => {
  const violations = await scanCameraTokens({
    rootDir: path.resolve(process.cwd(), 'src'),
    allowlistedFiles: [THIS_TEST_FILE],
  });

  assert.equal(
    violations.length,
    0,
    [
      'HERO v1.0 E13-10 forbids photo upload and camera capture code in src/.',
      'A0 voice-name mode may add an audio-only file allowlist through PR review; camera tokens must remain at 0.',
      'DB-side guard: migration 0025 intentionally has no photo, camera, or image-upload columns.',
      'Kiosk name-collection absence is covered separately by the R1 E13-7 acceptance criteria.',
      formatCameraTokenViolations(violations),
    ].join('\n'),
  );
});
