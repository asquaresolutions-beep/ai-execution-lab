// ─────────────────────────────────────────────────────────────────
// lib/distribution/export.ts
// Render a ContentBundle to markdown / html / json for download or
// downstream publishing. No external markdown lib needed — a tiny,
// safe markdown->html pass covers the subset our generators emit.
// ─────────────────────────────────────────────────────────────────

import type { ContentBundle, ExportFormat, Locale } from './types'

export function exportBundle(bundle: ContentBundle, format: ExportFormat, locale: Locale = 'en'): string {
  switch (format) {
    case 'json': return JSON.stringify(bundle, null, 2)
    case 'html': return toHTML(bundle, locale)
    case 'markdown':
    default: return toMarkdown(bundle, locale)
  }
}

export function toMarkdown(bundle: ContentBundle, locale: Locale): string {
  const c = bundle.locales[locale]
  if (!c) return `> No content for locale "${locale}"`
  const fm = [
    '---',
    `title: ${JSON.stringify(c.seo.metaTitle)}`,
    `description: ${JSON.stringify(c.seo.metaDescription)}`,
    `slug: ${c.seo.slug}`,
    `locale: ${locale}`,
    `platform: ${bundle.input.platform}`,
    `region: ${bundle.input.region}`,
    `severity: ${bundle.input.severity}`,
    `keywords: [${c.keywords.join(', ')}]`,
    `tags: [${c.tags.join(', ')}]`,
    '---',
  ].join('\n')

  return [
    fm,
    '',
    c.article.trim(),
    '',
    '## Frequently asked questions',
    ...c.faq.map((f) => `\n**${f.question}**\n\n${f.answer}`),
    '',
    '## Related alerts',
    ...bundle.relatedPages.map((l) => `- [${l.anchor}](${l.path})`),
    '',
    `> ${c.cta}`,
  ].join('\n')
}

export function toHTML(bundle: ContentBundle, locale: Locale): string {
  const c = bundle.locales[locale]
  if (!c) return `<p>No content for locale "${locale}"</p>`
  const body = miniMarkdownToHtml(c.article)
  const faq = c.faq.map((f) => `<dt>${esc(f.question)}</dt><dd>${esc(f.answer)}</dd>`).join('\n')
  const related = bundle.relatedPages.map((l) => `<li><a href="${esc(l.path)}">${esc(l.anchor)}</a></li>`).join('\n')
  return `<article lang="${locale}">
${body}
<section><h2>FAQ</h2><dl>${faq}</dl></section>
<section><h2>Related alerts</h2><ul>${related}</ul></section>
<p class="cta">${esc(c.cta)}</p>
<script type="application/ld+json">${JSON.stringify(bundle.faqSchema)}</script>
<script type="application/ld+json">${JSON.stringify(bundle.articleSchema)}</script>
</article>`
}

// Minimal, escaping markdown subset: headings, bold, lists, paragraphs.
function miniMarkdownToHtml(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let inList = false
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false } }
  for (const raw of lines) {
    const line = raw.trimEnd()
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    if (h) { closeList(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); continue }
    const li = line.match(/^[-*]\s+(.*)$/) || line.match(/^\d+\.\s+(.*)$/)
    if (li) { if (!inList) { out.push('<ul>'); inList = true } out.push(`<li>${inline(li[1])}</li>`); continue }
    if (!line) { closeList(); continue }
    closeList()
    out.push(`<p>${inline(line)}</p>`)
  }
  closeList()
  return out.join('\n')
}
function inline(s: string): string {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')
}
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
