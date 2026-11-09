// Lättviktig markdown → HTML. Escapar ALLT först, formaterar sedan.

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatInline(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.+?)\*\*/gs, "<strong>$1</strong>");
  html = html.replace(/(^|[^*])\*([^*\n]+?)\*/g, "$1<em>$2</em>");
  html = html.replace(/`([^`\n]+?)`/g, "<code>$1</code>");
  return html;
}

export function formatMarkdown(text: string): string {
  const blocks = text.split(/\n{2,}/);
  const out: string[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      const level = Math.min(4, heading[1].length + 2); // h3–h6
      out.push(`<h${level}>${formatInline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^([-*•]|\d+\.)\s+/.test(trimmed)) {
      const items = trimmed
        .split(/\n/)
        .filter((l) => /^([-*•]|\d+\.)\s+/.test(l.trim()))
        .map((l) => `<li>${formatInline(l.replace(/^([-*•]|\d+\.)\s+/, ""))}</li>`)
        .join("");
      out.push(`<ul>${items}</ul>`);
      continue;
    }

    out.push(`<p>${formatInline(trimmed).replace(/\n/g, "<br>")}</p>`);
  }

  return out.join("");
}
