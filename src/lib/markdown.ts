export function renderMarkdown(md: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const inline = (s: string) => esc(s)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  const out: string[] = [];
  let list = false;
  const close = () => { if (list) out.push('</ul>'); list = false; };
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { close(); continue; }
    const item = line.match(/^[-*]\s+(.+)/);
    if (item) {
      if (!list) out.push('<ul>');
      list = true;
      out.push(`<li>${inline(item[1])}</li>`);
      continue;
    }
    close();
    const heading = line.match(/^(#{1,3})\s+(.+)/);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    out.push(`<p>${inline(line)}</p>`);
  }
  close();
  return out.join('\n');
}
