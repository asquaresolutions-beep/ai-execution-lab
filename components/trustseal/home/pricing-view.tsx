// components/trustseal/home/pricing-view.tsx  (asq-trustseal-growth)
// Real /pricing page (server component, indexable). Free + Pro from the existing
// message dicts; Business / Enterprise / Agency from the co-located growth content
// module (lib/trustseal/content/pricing-tiers.ts). Plan cards + a 5-column
// comparison table (incl. Monitoring & API rows). Business/Enterprise/Agency CTAs
// are contact-sales (self-serve Business checkout requires a billing change that is
// out of scope for this pass). RTL-safe.
import type { Locale } from '@/lib/trustseal/locales'
import { t } from '@/lib/trustseal/messages'
import { pricingTiers, PRICING_CONTACT } from '@/lib/trustseal/content/pricing-tiers'

const C = { bg: '#050811', text1: '#e6edf7', text2: '#9aa7c2', text3: '#5d6a86', cyan: '#22d3ee', violet: '#a78bfa' }
const card: React.CSSProperties = { background: 'linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))', border: '1px solid rgba(120,160,255,0.14)', borderRadius: 16 }
const mailto = (plan: string) => `mailto:${PRICING_CONTACT}?subject=${encodeURIComponent('TrustSeal ' + plan)}`

export function PricingView({ locale = 'en' as Locale }: { locale?: Locale }) {
  const x = (k: string) => t(locale, k)
  const L = (s: string) => `/${locale}${s}`
  const tiers = pricingTiers[locale] ?? pricingTiers.en
  const yes = x('pricingPage.yes')
  const no = x('pricingPage.no')

  // Feature | Free | Pro | Business | Enterprise
  const rows: { label: string; cells: [string, string, string, string] }[] = [
    { label: x('pricingPage.domainsRow'), cells: ['1', '10', '10', '∞'] },
    { label: x('pricingPage.sealPageRow'), cells: [yes, yes, yes, yes] },
    { label: x('pricingPage.badgeRow'), cells: [no, yes, yes, yes] },
    { label: tiers.rows.monitoring, cells: [no, no, yes, yes] },
    { label: tiers.rows.api, cells: ['60/min', '600/min', '3k/min', '12k/min'] },
    { label: tiers.rows.certificates, cells: [no, yes, yes, yes] },
    { label: x('pricingPage.commandRow'), cells: [no, yes, yes, yes] },
    { label: x('pricingPage.analyticsRow'), cells: [no, yes, yes, yes] },
    { label: x('pricingPage.supportRow'), cells: [x('pricingPage.supportFree'), x('pricingPage.supportPro'), x('pricingPage.supportPro'), x('pricingPage.supportPro')] },
  ]

  const Card = ({ name, tagline, price, sub, features, cta, href, accent }: { name: string; tagline: string; price: string; sub?: string; features: string[]; cta: string; href: string; accent?: string }) => (
    <div className="relative flex flex-col p-6" style={accent ? { ...card, border: `2px solid ${accent}` } : card}>
      <h2 className="text-lg font-semibold">{name}</h2>
      <p className="text-xs" style={{ color: C.text3 }}>{tagline}</p>
      <p className="mt-3 text-2xl font-bold">{price}</p>
      {sub ? <p className="text-xs" style={{ color: C.text3 }}>{sub}</p> : null}
      <ul className="mt-4 flex-1 space-y-2 text-sm" style={{ color: C.text2 }}>
        {features.map((f) => <li key={f}>{f}</li>)}
      </ul>
      <a href={href} className="mt-6 block rounded-lg px-4 py-2 text-center text-sm font-semibold"
        style={accent ? { background: accent, color: '#06121e' } : { border: '1px solid rgba(120,160,255,0.3)', color: C.text1 }}>{cta}</a>
    </div>
  )

  return (
    <main className="px-6 py-16" style={{ background: `radial-gradient(1100px 560px at 70% -10%, rgba(56,189,248,0.10), transparent 60%), ${C.bg}`, color: C.text1, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <h1 className="mx-auto max-w-3xl text-center text-3xl font-bold sm:text-4xl">{x('pricingPage.title')}</h1>
      <p className="mx-auto mt-3 max-w-2xl text-center text-sm" style={{ color: C.text2 }}>{x('pricingPage.subtitle')}</p>

      {/* Free · Pro · Business · Enterprise */}
      <div className="mx-auto mt-10 grid max-w-6xl gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card name={x('pricing.freeName')} tagline={x('pricing.freeTagline')} price={x('pricing.freePrice')}
          features={[x('pricing.freeF1'), x('pricing.freeF2'), x('pricing.freeF3')]} cta={x('pricing.freeCta')} href={L('/dashboard')} />
        <Card name={x('pricing.proName')} tagline={x('pricing.proTagline')} price={x('pricing.proPriceMonthly')} sub={x('pricing.proPriceYearly')}
          features={[x('pricing.proF1'), x('pricing.proF2'), x('pricing.proF3'), x('pricing.proF4')]} cta={x('pricing.proCta')} href={L('/dashboard')} accent={C.cyan} />
        <Card name={tiers.business.name} tagline={tiers.business.tagline} price={tiers.business.price}
          features={tiers.business.features} cta={tiers.business.cta} href={mailto('Business')} accent={C.violet} />
        <Card name={tiers.enterprise.name} tagline={tiers.enterprise.tagline} price={tiers.enterprise.price}
          features={tiers.enterprise.features} cta={tiers.enterprise.cta} href={mailto('Enterprise')} />
      </div>

      {/* Agency — full-width */}
      <div className="mx-auto mt-4 max-w-6xl p-6" style={card}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">{tiers.agency.name}</h2>
            <p className="text-xs" style={{ color: C.text3 }}>{tiers.agency.tagline}</p>
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm" style={{ color: C.text2 }}>
              {tiers.agency.features.map((f) => <li key={f}>· {f}</li>)}
            </ul>
          </div>
          <a href={mailto('Agency')} className="shrink-0 rounded-lg border px-4 py-2 text-center text-sm font-semibold" style={{ borderColor: 'rgba(120,160,255,0.3)', color: C.text1 }}>{tiers.agency.cta}</a>
        </div>
      </div>

      <p className="mx-auto mt-4 max-w-6xl text-center text-xs" style={{ color: C.text3 }}>{tiers.selfServeNote}</p>

      {/* Comparison table */}
      <div className="mx-auto mt-12 max-w-6xl">
        <h2 className="text-center text-lg font-semibold">{x('pricingPage.compareHeading')}</h2>
        <div className="mt-4 overflow-x-auto" style={card}>
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr style={{ color: C.text2 }}>
                <th className="p-3 text-start font-semibold">{x('pricingPage.featureCol')}</th>
                <th className="p-3 text-center font-semibold">{x('pricing.freeName')}</th>
                <th className="p-3 text-center font-semibold">{x('pricing.proName')}</th>
                <th className="p-3 text-center font-semibold" style={{ color: C.violet }}>{tiers.compareHeads.business}</th>
                <th className="p-3 text-center font-semibold">{tiers.compareHeads.enterprise}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t" style={{ borderColor: 'rgba(120,160,255,0.1)' }}>
                  <td className="p-3 text-start" style={{ color: C.text2 }}>{r.label}</td>
                  {r.cells.map((c, i) => <td key={i} className="p-3 text-center" style={{ color: C.text1 }}>{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-center text-xs" style={{ color: C.text3 }}>{x('pricing.gstNote')}</p>
      </div>
    </main>
  )
}
