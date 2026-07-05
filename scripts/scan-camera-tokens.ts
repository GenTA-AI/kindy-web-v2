import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const TEXT_EXTENSIONS = new Set([
  '.cjs',
  '.css',
  '.cts',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.mjs',
  '.mts',
  '.ts',
  '.tsx',
]);

const SINGLE_TOKEN_RULES = [
  { id: 'getUserMedia', pattern: /getUserMedia/g },
  { id: 'capture=', pattern: /capture\s*=/g },
  { id: 'ImageCapture', pattern: /ImageCapture/g },
  { id: 'navigator.mediaDevices', pattern: /navigator\s*\.\s*mediaDevices/g },
  { id: 'react-webcam', pattern: /react-webcam/g },
  { id: 'expo-camera', pattern: /expo-camera/g },
] as const;

const FILE_UPLOAD_TYPE_PATTERN = /type\s*=\s*["']file["']/;
const IMAGE_ACCEPT_PATTERN = /accept\s*=\s*["']image/;

export type CameraTokenViolation = {
  file: string;
  rule: string;
  line: number;
  column: number;
  snippet: string;
};

type ScanOptions = {
  rootDir?: string;
  allowlistedFiles?: string[];
};

export async function scanCameraTokens({
  rootDir = path.resolve(process.cwd(), 'src'),
  allowlistedFiles = [],
}: ScanOptions = {}): Promise<CameraTokenViolation[]> {
  const root = path.resolve(rootDir);
  const allowlist = new Set(allowlistedFiles.map((file) => path.resolve(file)));
  const files = await collectTextFiles(root);
  const violations: CameraTokenViolation[] = [];

  for (const file of files) {
    const absoluteFile = path.resolve(file);
    if (allowlist.has(absoluteFile)) {
      continue;
    }

    const text = await readFile(absoluteFile, 'utf8');
    for (const rule of SINGLE_TOKEN_RULES) {
      violations.push(...matchesForRule(text, absoluteFile, root, rule.id, rule.pattern));
    }

    if (FILE_UPLOAD_TYPE_PATTERN.test(text) && IMAGE_ACCEPT_PATTERN.test(text)) {
      const match = text.match(FILE_UPLOAD_TYPE_PATTERN) ?? text.match(IMAGE_ACCEPT_PATTERN);
      violations.push(violationForIndex(text, absoluteFile, root, 'type="file" + accept="image"', match?.index ?? 0));
    }
  }

  return violations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column);
}

export function formatCameraTokenViolations(violations: CameraTokenViolation[]): string {
  return violations
    .map((violation) => {
      return `${violation.file}:${violation.line}:${violation.column} ${violation.rule} ${violation.snippet}`;
    })
    .join('\n');
}

async function collectTextFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return collectTextFiles(entryPath);
      }
      if (!entry.isFile() || !TEXT_EXTENSIONS.has(path.extname(entry.name))) {
        return [];
      }
      return [entryPath];
    }),
  );

  return files.flat();
}

function matchesForRule(
  text: string,
  absoluteFile: string,
  root: string,
  rule: string,
  pattern: RegExp,
): CameraTokenViolation[] {
  pattern.lastIndex = 0;
  const violations: CameraTokenViolation[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    violations.push(violationForIndex(text, absoluteFile, root, rule, match.index));
  }

  return violations;
}

function violationForIndex(
  text: string,
  absoluteFile: string,
  root: string,
  rule: string,
  index: number,
): CameraTokenViolation {
  const before = text.slice(0, index);
  const lines = before.split('\n');
  const line = lines.length;
  const column = lines[lines.length - 1].length + 1;
  const snippet = text.split('\n')[line - 1]?.trim() ?? '';

  return {
    file: path.relative(root, absoluteFile),
    rule,
    line,
    column,
    snippet,
  };
}
