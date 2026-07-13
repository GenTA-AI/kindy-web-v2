import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderMarkdown } from '@/lib/markdown';

const articleClassName =
  'pb-12 text-sm font-medium leading-relaxed text-gray-600 [&_a]:font-bold [&_a]:text-saged [&_a]:underline [&_a]:underline-offset-2 [&_h1]:mb-6 [&_h1]:text-2xl [&_h1]:font-extrabold [&_h1]:leading-tight [&_h1]:text-gray-900 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-gray-900 [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-gray-900 [&_li]:mt-1 [&_p]:mt-2 [&_strong]:font-bold [&_strong]:text-gray-900 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5';

export default function RefundPage() {
  const md = readFileSync(join(process.cwd(), 'src/content/legal/refund.md'), 'utf8');
  const html = renderMarkdown(md);

  return <article className={articleClassName} dangerouslySetInnerHTML={{ __html: html }} />;
}
