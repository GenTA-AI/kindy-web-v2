import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// 임시 금칙어 grep 검사 — E16-1이 정식화할 때 대체 사전과 CI 배선으로 이전한다.
const FORBIDDEN_TERMS = [
  '로딩',
  '추천',
  '맞춤',
  '분석',
  '점수',
  '레벨',
  '%',
  '오답',
  'AI',
  '진단',
  '평가',
] as const;

const ROOT = process.cwd();
const TARGETS = [
  join(ROOT, 'src', 'app', 'page.tsx'),
  join(ROOT, 'src', 'components', 'landing'),
];

type Finding = {
  file: string;
  line: number;
  column: number;
  term: string;
  text: string;
};

function collectFiles(target: string): string[] {
  try {
    const stat = statSync(target);
    if (stat.isFile()) return [target];
    if (!stat.isDirectory()) return [];

    return readdirSync(target)
      .flatMap((entry) => collectFiles(join(target, entry)))
      .filter((file) => file.endsWith('.tsx') || file.endsWith('.ts'));
  } catch {
    return [];
  }
}

function findForbiddenTerms(file: string): Finding[] {
  const source = readFileSync(file, 'utf8');
  const lines = source.split(/\r?\n/);
  const findings: Finding[] = [];

  lines.forEach((text, index) => {
    FORBIDDEN_TERMS.forEach((term) => {
      let start = 0;
      while (start <= text.length) {
        const column = text.indexOf(term, start);
        if (column === -1) break;
        findings.push({
          file,
          line: index + 1,
          column: column + 1,
          term,
          text: text.trim(),
        });
        start = column + term.length;
      }
    });
  });

  return findings;
}

const files = TARGETS.flatMap(collectFiles);
const findings = files.flatMap(findForbiddenTerms);

if (findings.length > 0) {
  console.error('금칙어가 발견되었습니다.');
  findings.forEach(({ file, line, column, term, text }) => {
    console.error(`${file.replace(`${ROOT}/`, '')}:${line}:${column} "${term}" — ${text}`);
  });
  process.exit(1);
}

console.log(`copy-ok (${files.length} files)`);
