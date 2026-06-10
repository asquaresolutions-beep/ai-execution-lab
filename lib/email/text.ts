// ─────────────────────────────────────────────────────────────────
// lib/email/text.ts  (asq-deliverability-p1)
// Pure, dependency-free HTML→plaintext conversion for the email layer.
// Sending a text/plain alternative alongside text/html removes the
// `MIME_HTML_ONLY` spam heuristic. No project imports → unit-testable under
// `node --experimental-strip-types` without the webpack path-alias resolver.
// ─────────────────────────────────────────────────────────────────

/** Convert a small transactional/marketing HTML body into readable plaintext. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<\/(p|div|h[1-6]|li|tr|ul|ol)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr\s*\/?>/gi, '\n----------\n')
    // keep links readable: "text (url)" — parens, not <>, so the generic
    // tag-stripper below doesn't treat the URL as a tag and delete it.
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    // common entities
    .replace(/&#8377;/g, '₹')
    .replace(/&#8377;|&rupee;/gi, '₹')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#8211;|&ndash;/gi, '-')
    .replace(/&#8212;|&mdash;/gi, '—')
    .replace(/&#8217;|&rsquo;/gi, '’')
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#?[a-z0-9]+;/gi, '')
    // whitespace tidy
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}
