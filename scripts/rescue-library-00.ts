/**
 * Rescue: video #0 (공주 미리와 물의 여행) — batch 첫 시도가 vtt mime type 거부로 실패.
 * 영상/썸네일/대본/자막 파일 다 tmp/library/00.../ 에 살아있음.
 *
 * 단계:
 *   1. videos bucket 의 allowedMimeTypes 에 text/vtt 추가 (admin API)
 *   2. final.mp4 + thumbnail.jpg + subtitles.vtt 업로드 (upsert)
 *   3. signed URL 발급
 *   4. library_videos 에 row insert (published=false)
 *
 * 재실행 안전 (idempotent — 이미 있으면 skip 또는 update).
 *
 * 실행: npx tsx --env-file=.env.local scripts/rescue-library-00.ts
 */

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LIBRARY_MATRIX } from './library-matrix';
import { getSupabase } from '../src/lib/supabase';
import { uploadBytes, getSignedUrl } from '../src/lib/supabase-storage';

const INDEX = 0;
const STORAGE_PREFIX = 'library/00-princess-science-age5';
const WORK_DIR = join(process.cwd(), 'tmp', 'library', '00-princess-science-age5');

async function main() {
  const supabase = getSupabase();
  const spec = LIBRARY_MATRIX[INDEX];
  if (!spec) throw new Error('matrix index 0 missing');

  console.log(`rescue: ${spec.title}`);

  // 1. bucket allowed_mime_types 에 text/vtt 추가 (admin API)
  console.log('[1/5] bucket allowedMimeTypes 에 text/vtt 추가');
  const bucketMeta = await supabase.storage.getBucket('videos');
  if (bucketMeta.error) {
    console.error('  failed to read bucket:', bucketMeta.error.message);
    process.exit(1);
  }
  const current = bucketMeta.data.allowed_mime_types ?? [];
  console.log('  현재 mime types:', current);
  if (!current.includes('text/vtt')) {
    const updated = [...current, 'text/vtt'];
    const updRes = await supabase.storage.updateBucket('videos', {
      // updateBucket 은 public 필수 — 기존 설정 유지 (videos 버킷은 private).
      public: bucketMeta.data.public,
      allowedMimeTypes: updated,
    });
    if (updRes.error) {
      console.error('  failed to update bucket:', updRes.error.message);
      process.exit(1);
    }
    console.log('  ✓ added text/vtt to allowed mime types');
  } else {
    console.log('  ✓ text/vtt already allowed');
  }

  // 2. 산출물 읽기
  const finalMp4 = readFileSync(join(WORK_DIR, 'final.mp4'));
  const thumbnail = readFileSync(join(WORK_DIR, 'thumbnail.jpg'));
  const vtt = readFileSync(join(WORK_DIR, 'subtitles.vtt'), 'utf-8');
  const script = JSON.parse(readFileSync(join(WORK_DIR, 'script.json'), 'utf-8'));
  const durationSec = script.scenes.reduce((acc: number, s: { durationSec?: number }) => acc + (s.durationSec ?? 0), 0) || 30;
  console.log(`[2/5] 산출물 읽음 — mp4=${(finalMp4.length / 1024 / 1024).toFixed(2)}MB, vtt=${vtt.length}b, dur=${durationSec}s`);

  // 3. 업로드 (upsert: true 로 재실행 안전)
  console.log('[3/5] Supabase Storage 업로드');
  const finalPath = `${STORAGE_PREFIX}/final.mp4`;
  const thumbPath = `${STORAGE_PREFIX}/thumbnail.jpg`;
  const vttPath = `${STORAGE_PREFIX}/subtitles.vtt`;

  await uploadBytes(finalPath, finalMp4, { contentType: 'video/mp4', upsert: true });
  console.log(`  ✓ ${finalPath}`);
  await uploadBytes(thumbPath, thumbnail, { contentType: 'image/jpeg', upsert: true });
  console.log(`  ✓ ${thumbPath}`);
  await uploadBytes(vttPath, Buffer.from(vtt, 'utf-8'), { contentType: 'text/vtt', upsert: true });
  console.log(`  ✓ ${vttPath}`);

  // 4. signed URL
  console.log('[4/5] signed URL');
  const videoUrl = await getSignedUrl(finalPath);
  const thumbnailUrl = await getSignedUrl(thumbPath);
  const subtitlesUrl = await getSignedUrl(vttPath);

  // 5. library_videos insert (idempotent — 같은 (title, topic, age_band) 있으면 update)
  console.log('[5/5] library_videos insert/upsert');
  const { data: existing } = await supabase
    .from('library_videos')
    .select('id')
    .eq('title', spec.title)
    .eq('topic', spec.topic)
    .eq('age_band', spec.age_band)
    .maybeSingle();

  const row = {
    title: spec.title,
    description: spec.description,
    topic: spec.topic,
    age_band: spec.age_band,
    style_tags: spec.style_tags,
    duration_sec: durationSec,
    video_url: videoUrl,
    thumbnail_url: thumbnailUrl,
    subtitles_url: subtitlesUrl,
    character_name: script.characters[0]?.displayName ?? '미리',
    script,
    published: false,
  };

  if (existing) {
    const { error: updErr } = await supabase
      .from('library_videos')
      .update(row)
      .eq('id', existing.id);
    if (updErr) {
      console.error('  update failed:', updErr.message);
      process.exit(1);
    }
    console.log(`  ✓ updated existing row id=${existing.id}`);
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from('library_videos')
      .insert(row)
      .select('id')
      .single();
    if (insErr) {
      console.error('  insert failed:', insErr.message);
      process.exit(1);
    }
    console.log(`  ✓ inserted new row id=${inserted!.id}`);
  }

  console.log('\n=== rescue 완료 ===');
  console.log(`title: ${spec.title}`);
  console.log(`video URL: ${videoUrl.slice(0, 80)}...`);
  console.log(`subtitles URL: ${subtitlesUrl.slice(0, 80)}...`);
  console.log(`published: false (운영자가 토글 필요)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
