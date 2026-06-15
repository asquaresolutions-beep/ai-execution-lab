// ─────────────────────────────────────────────────────────────────
// app/trustseal/[locale]/layout.tsx  (asq-trustseal-a1)
// TrustSeal locale wrapper. Sets `lang` + `dir` and applies the scoped
// [data-trustseal] design-token system on a WRAPPER <div> — deliberately
// NOT on <html> (the shared root app/layout.tsx is untouched, so ScamCheck/
// Lab and the 942-page SSG build are unaffected). `dir` on a container is
// valid and honoured by browsers for full RTL.
//
// Routing note (Phase A): scaffolded under /trustseal/[locale] to avoid any
// conflict with the existing root /es and /hi ScamCheck routes and to work
// without middleware. Phase A3 will rewrite the trustseal.* host root onto
// this path; the internal structure stays the same.
//
// SSG preserved: locale comes from static params (generateStaticParams below),
// dynamicParams=false → only en/hi/es/ar prerender; anything else 404s. No
// dynamic request reads (no headers()/cookies()), so nothing is forced dynamic.
// ─────────────────────────────────────────────────────────────────
import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { LOCALES, isLocale, dirFor, DEFAULT_LOCALE, type Locale } from '@/lib/trustseal/locales'
import { TrustSealNav } from '@/components/trustseal/nav'
import { TrustSealFooter } from '@/components/trustseal/site-footer'
import { localeFontClass, localeFontFamily } from '@/lib/trustseal/fonts'

export const dynamicParams = false

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export default async function TrustSealLocaleLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const lc: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE

  return (
    <div
      lang={locale}
      dir={dirFor(locale)}
      data-trustseal
      className={`ts-shell flex min-h-screen flex-col ${localeFontClass(locale)}`.trim()}
      style={{
        background: 'rgb(var(--ts-bg))',
        color: 'rgb(var(--ts-text-1))',
        fontFamily: localeFontFamily(locale),
      }}
    >
      <TrustSealNav locale={lc} />
      <div className="flex-1">{children}</div>
      <TrustSealFooter locale={lc} />
    </div>
  )
}
