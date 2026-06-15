// components/trustseal/home/pricing-view.tsx  (asq-trustseal-harden)
// Real /pricing page (server component, indexable). Command-Center styling, all
// copy via t(locale,key). Plan cards + a comparison table. RTL-safe.
import type { Locale } from '@/lib/trustseal/locales'
import { t } from '@/lib/trustseal/messages'

const C = { bg: '#050811', text1: '#e6edf7', text2: '#9aa7c2', text3: '#5d6a86', cyan: '#22d3ee' }
const card: React.CSSProperties = { background: 'linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))', border: '1px solid rgba(120,160,255,0.14)', borderRadius: 16 }

export function PricingView({ locale = 'en' as Locale }: { locale?: Locale }) {
  const x = (k: string) => t(locale, k)
  const L = (s: string) => `/${locale}${s}`
  const yes = x('pricingPage.yes')
  const no = x('pricingPage.no')
  const rows = [
    { label: x('pricingPage.domainsRow'), free: '1', pro: '10' },
    { label: x('pricingPage.sealPageRow'), free: yes, pro: yes },
    { label: x('pricingPage.badgeRow'), free: no, pro: yes },
    { label: x('pricingPage.commandRow'), free: no, pro: yes },
    { label: x('pricingPage.analyticsRow'), free: no, pro: yes },
    { label: x('pricingPage.supportRow'), free: x('pricingPage.supportFree'), pro: x('pricingPage.supportPro') },
  ]

  return (
    <main className="px-6 py-16" style={{ background: `radial-gradient(1100px 560px at 70% -10%, rgba(56,189,248,0.10), transparent 60%), ${C.bg}`, color: C.text1, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <h1 className="mx-auto max-w-3xl text-center text-3xl font-bold sm:text-4xl">{x('pricingPage.title')}</h1>
      <p className="mx-auto mt-3 max-w-2xl text-center text-sm" style={{ color: C.text2 }}>{x('pricingPage.subtitle')}</p>

      <div className="mx-auto mt-10 grid max-w-3xl gap-4 md:grid-cols-2">
        <div className="p-6" style={card}>
          <h2 className="text-lg font-semibold">{x('pricing.freeName')}</h2>
          <p className="text-xs" style={{ color: C.text3 }}>{x('pricing.freeTagline')}</p>
          <p className="mt-3 text-3xl font-bold">{x('pricing.freePrice')}</p>
          <ul className="mt-4 space-y-2 text-sm" style={{ color: C.text2 }}>
            <li>{x('pricing.freeF1')}</li><li>{x('pricing.freeF2')}</li><li>{x('pricing.freeF3')}</li>
          </ul>
          <a href={L('/dashboard')} className="mt-6 block rounded-lg border px-4 py-2 text-center text-sm font-semibold" style={{ borderColor: 'rgba(120,160,255,0.3)', color: C.text1 }}>{x('pricing.freeCta')}</a>
        </div>
        <div className="relative p-6" style={{ ...card, border: `2px solid ${C.cyan}` }}>
          <span className="absolute -top-3 start-4 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: C.cyan, color: '#06121e' }}>{x('pricing.yearlyBadge')}</span>
          <h2 className="text-lg font-semibold">{x('pricing.proName')}</h2>
          <p className="text-xs" style={{ color: C.text3 }}>{x('pricing.proTagline')}</p>
          <p className="mt-3 text-3xl font-bold">{x('pricing.proPriceMonthly')}</p>
          <p className="text-xs" style={{ color: C.text3 }}>{x('pricing.proPriceYearly')}</p>
          <ul className="mt-4 space-y-2 text-sm" style={{ color: C.text2 }}>
            <li>{x('pricing.proF1')}</li><li>{x('pricing.proF2')}</li><li>{x('pricing.proF3')}</li><li>{x('pricing.proF4')}</li>
          </ul>
          <a href={L('/dashboard')} className="mt-6 block rounded-lg px-4 py-2 text-center text-sm font-semibold" style={{ background: C.cyan, color: '#06121e' }}>{x('pricing.proCta')}</a>
        </div>
      </div>

      <div className="mx-auto mt-12 max-w-3xl">
        <h2 className="text-center text-lg font-semibold">{x('pricingPage.compareHeading')}</h2>
        <div className="mt-4 overflow-hidden" style={card}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: C.text2 }}>
                <th className="p-3 text-start font-semibold">{x('pricingPage.featureCol')}</th>
                <th className="p-3 text-center font-semibold">{x('pricing.freeName')}</th>
                <th className="p-3 text-center font-semibold">{x('pricing.proName')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t" style={{ borderColor: 'rgba(120,160,255,0.1)' }}>
                  <td className="p-3 text-start" style={{ color: C.text2 }}>{r.label}</td>
                  <td className="p-3 text-center" style={{ color: C.text1 }}>{r.free}</td>
                  <td className="p-3 text-center" style={{ color: C.text1 }}>{r.pro}</td>
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
