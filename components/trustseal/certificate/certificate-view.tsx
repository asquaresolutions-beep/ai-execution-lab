// components/trustseal/certificate/certificate-view.tsx  (asq-trustseal-phase3)
// Server-rendered, print-optimized verification certificate. Shows every required
// field (ID, dates, reverification due, domain, score, level, QR, URL, signature
// block, tamper-evident fingerprint). Print CSS hides the site nav/footer so the
// PDF output is the certificate alone.
import type { Locale } from '@/lib/trustseal/locales'
import { t } from '@/lib/trustseal/messages'
import { formatDate } from '@/lib/trustseal/format'
import { bandMeta } from '@/lib/trustseal/band'
import type { Certificate } from '@/lib/trustseal/certificate'
import { PrintButton } from './print-button'

export function CertificateView({ locale, cert }: { locale: Locale; cert: Certificate }) {
  const x = (k: string) => t(locale, k)
  const meta = bandMeta(cert.band)
  const border = 'rgb(var(--ts-border))'

  const Row = ({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) => (
    <div className="flex flex-col gap-0.5 py-2" style={{ borderTop: `1px solid ${border}` }}>
      <dt className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'rgb(var(--ts-text-2))' }}>{label}</dt>
      <dd className={`text-sm ${mono ? 'break-all font-mono text-xs' : 'font-semibold'}`} style={{ color: 'rgb(var(--ts-text-1))' }} dir="ltr">{value}</dd>
    </div>
  )

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      {/* Print rules: hide global chrome so the PDF is just the certificate. */}
      <style>{`@media print { header, footer, [data-no-print] { display: none !important } body { background: #fff !important } }`}</style>

      <div data-no-print className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--ts-text-1))' }}>{x('cert.title')}</h1>
          <p className="mt-1 text-sm" style={{ color: 'rgb(var(--ts-text-2))' }}>{x('cert.subtitle')}</p>
        </div>
        <PrintButton label={x('cert.download')} />
      </div>

      {/* The certificate sheet */}
      <article className="rounded-2xl border p-8" style={{ borderColor: border, background: 'rgb(var(--ts-surface-2))' }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span aria-hidden className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold" style={{ background: meta.color, color: '#06121e' }}>{meta.icon}</span>
            <div>
              <p className="text-sm font-bold" style={{ color: 'rgb(var(--ts-text-1))' }}>TrustSeal</p>
              <p className="text-xs" style={{ color: 'rgb(var(--ts-text-2))' }}>{x('cert.title')}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}` }}>
            <span aria-hidden>{meta.icon}</span>{x(meta.labelKey)}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-[1fr_auto]">
          <dl>
            <Row label={x('cert.domainLabel')} value={cert.domain} />
            <Row label={x('cert.trustLevel')} value={x(meta.labelKey)} />
            <Row label={x('cert.trustScore')} value={cert.score != null ? `${cert.score}/100` : '—'} />
            <Row label={x('cert.verifiedOn')} value={formatDate(locale, cert.verifiedAt)} />
            <Row label={x('cert.reverifyDue')} value={formatDate(locale, cert.reverifyDue)} />
            <Row label={x('cert.certificateId')} value={cert.certId} mono />
            <Row label={x('cert.verificationUrl')} value={cert.verifyUrl} mono />
          </dl>
          {cert.qrSvg && (
            <div className="flex flex-col items-center">
              <div dangerouslySetInnerHTML={{ __html: cert.qrSvg }} />
              <p className="mt-2 text-[11px]" style={{ color: 'rgb(var(--ts-text-2))' }}>{x('cert.scanToVerify')}</p>
            </div>
          )}
        </div>

        {/* tamper-evident fingerprint + signature */}
        <dl className="mt-2">
          <Row label={x('cert.fingerprint')} value={cert.fingerprint} mono />
          {cert.signature && <Row label={x('cert.signature')} value={cert.signature} mono />}
        </dl>

        {/* signature block */}
        <div className="mt-6 border-t pt-4" style={{ borderColor: border }}>
          <p className="text-xs font-semibold" style={{ color: 'rgb(var(--ts-text-1))' }}>{x('cert.issuedBy')}: A Square Solutions</p>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: 'rgb(var(--ts-text-2))' }}>{x('cert.issuedByBody')}</p>
          <p className="mt-2 text-[11px]" style={{ color: 'rgb(var(--ts-text-3))' }}>© 2026 A Square Solutions · {formatDate(locale, cert.issuedAt)}</p>
        </div>
      </article>
    </main>
  )
}
