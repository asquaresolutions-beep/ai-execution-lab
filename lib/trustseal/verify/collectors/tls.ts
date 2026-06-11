// lib/trustseal/verify/collectors/tls.ts  (asq-trustseal-c1b)
// SSL/TLS signals: valid cert, validation level (DV vs OV/EV), cert age.
// SSRF-guarded: resolves the domain first and refuses non-public IPs (freeze §1).
import type { Collector, CollectorContext, CollectorOutput, Signal } from '../types'
import { connect, type PeerCertificate } from 'node:tls'
import { resolve4 } from 'node:dns/promises'
import { allResolvedPublic } from '../ssrf'

// Connect to the ALREADY-VALIDATED public IP (not the hostname) to close the
// DNS-rebinding / TOCTOU window — node would otherwise re-resolve `host` here,
// possibly landing on a different (private) IP than the one we SSRF-checked.
// `servername` preserves SNI so the server still returns the correct cert.
function getCert(ip: string, servername: string, ms: number): Promise<PeerCertificate> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: ip, port: 443, servername, timeout: ms, rejectUnauthorized: false }, () => {
      const cert = socket.getPeerCertificate()
      const authorized = socket.authorized
      socket.end()
      ;(cert as PeerCertificate & { _authorized?: boolean })._authorized = authorized
      resolve(cert)
    })
    socket.on('error', reject)
    socket.on('timeout', () => { socket.destroy(); reject(new Error('tls_timeout')) })
  })
}

export const tlsCollector: Collector = {
  id: 'tls',
  tier: 'mvp',
  timeoutMs: 5000,
  async collect(ctx: CollectorContext): Promise<CollectorOutput> {
    const start = Date.now()
    const at = ctx.now
    try {
      const addrs = await resolve4(ctx.domain).catch(() => [] as string[])
      if (!allResolvedPublic(addrs)) {
        return { signals: [{ id: 'ssl.cert', category: 'ssl', status: 'blocked', score: 0, value: 'non-public-ip', source: 'tls', observedAt: at }], ms: Date.now() - start, error: 'ssrf_blocked' }
      }
      // Connect to the validated IP (every addr already confirmed public), SNI = domain.
      const cert = (await getCert(addrs[0], ctx.domain, this.timeoutMs - 500)) as PeerCertificate & { _authorized?: boolean }
      if (!cert || !cert.valid_to) {
        return { signals: [{ id: 'ssl.cert', category: 'ssl', status: 'missing', score: 0, value: false, source: 'tls', observedAt: at }], ms: Date.now() - start }
      }
      const validChain = cert._authorized !== false
      const notAfter = Date.parse(cert.valid_to)
      const notBefore = Date.parse(cert.valid_from)
      const expired = isFinite(notAfter) && notAfter < at
      const certAgeDays = isFinite(notBefore) ? (at - notBefore) / 86_400_000 : 0
      // OV/EV heuristic: subject carries an Organization (O) field.
      const org = (cert.subject as { O?: string } | undefined)?.O
      const validationLevel = org ? 'ov_ev' : 'dv'
      return {
        signals: [
          { id: 'ssl.valid', category: 'ssl', status: 'ok', score: validChain && !expired ? 100 : 10, value: validChain && !expired, evidence: expired ? 'expired' : validChain ? 'valid chain' : 'untrusted chain', source: 'tls', observedAt: at },
          { id: 'ssl.validation_level', category: 'ssl', status: 'ok', score: org ? 100 : 60, value: org ? true : false, evidence: validationLevel + (org ? ` (${org})` : ''), source: 'tls', observedAt: at },
          { id: 'ssl.cert_age', category: 'ssl', status: 'ok', score: certAgeDays > 90 ? 90 : certAgeDays > 14 ? 70 : 45, value: Math.round(certAgeDays), source: 'tls', observedAt: at },
        ],
        ms: Date.now() - start,
      }
    } catch (err) {
      // No TLS / handshake failure on a hard category → transparency-penalty signal.
      return { signals: [{ id: 'ssl.valid', category: 'ssl', status: 'error', score: 0, value: false, evidence: (err as Error).message.slice(0, 80), source: 'tls', observedAt: at }], ms: Date.now() - start, error: (err as Error).message }
    }
  },
}
