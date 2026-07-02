import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const APPROVED_FRAMES_DIR = resolve(process.cwd(), 'src', 'content', 'studio', 'approved-frames');
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);

function imageExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf('.');
  return dotIndex === -1 ? '' : filename.slice(dotIndex).toLowerCase();
}

export function listApprovedFrames(limit = 2): string[] {
  if (limit <= 0 || !existsSync(APPROVED_FRAMES_DIR)) return [];

  return readdirSync(APPROVED_FRAMES_DIR)
    .filter((filename) => IMAGE_EXTENSIONS.has(imageExtension(filename)))
    .sort((a, b) => b.localeCompare(a))
    .map((filename) => resolve(APPROVED_FRAMES_DIR, filename))
    .filter((path) => statSync(path).isFile())
    .slice(0, limit);
}
