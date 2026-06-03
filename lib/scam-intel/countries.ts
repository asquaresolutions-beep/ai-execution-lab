// ─────────────────────────────────────────────────────────────────
// lib/scam-intel/countries.ts
// Country-aware scam-reporting config so ScamCheck gives correct helplines,
// agencies, and report URLs per country instead of India-only advice. Pure
// data + resolvers — safe on client and server, no live dependency.
// ─────────────────────────────────────────────────────────────────

export interface CountryConfig {
  code: string                 // ISO-3166-1 alpha-2
  name: string
  currency: string
  phoneCc: string[]            // dialing codes used to infer country from numbers
  helpline: string             // primary fraud helpline (display)
  agency: string               // reporting agency name
  reportUrl: string            // official fraud-reporting URL
  bankingGuidance: string      // one-line, country-correct banking advice
  topCategories: string[]      // locally prevalent scam categories
}

export const COUNTRIES: Record<string, CountryConfig> = {
  IN: { code: 'IN', name: 'India', currency: '₹', phoneCc: ['+91', '91'], helpline: '1930 (Cyber Crime Helpline)', agency: 'National Cyber Crime Reporting Portal', reportUrl: 'https://cybercrime.gov.in', bankingGuidance: 'Never share OTP/UPI PIN. Banks never ask for KYC via SMS/WhatsApp links.', topCategories: ['UPI refund', 'fake KYC', 'courier customs', 'digital arrest'] },
  US: { code: 'US', name: 'United States', currency: '$', phoneCc: ['+1', '1'], helpline: 'FTC: reportfraud.ftc.gov', agency: 'Federal Trade Commission / FBI IC3', reportUrl: 'https://reportfraud.ftc.gov', bankingGuidance: 'The IRS and banks never demand payment by gift card, wire, or crypto over the phone.', topCategories: ['IRS/tax scam', 'gift-card scam', 'tech support', 'crypto investment'] },
  GB: { code: 'GB', name: 'United Kingdom', currency: '£', phoneCc: ['+44', '44'], helpline: 'Action Fraud: 0300 123 2040', agency: 'Action Fraud (NFIB)', reportUrl: 'https://www.actionfraud.police.uk', bankingGuidance: 'Forward scam texts to 7726. Banks never ask you to move money to a "safe account".', topCategories: ['courier/parcel scam', 'HMRC tax scam', 'safe-account scam', 'investment'] },
  CA: { code: 'CA', name: 'Canada', currency: 'C$', phoneCc: ['+1', '1'], helpline: 'CAFC: 1-888-495-8501', agency: 'Canadian Anti-Fraud Centre', reportUrl: 'https://antifraudcentre-centreantifraude.ca', bankingGuidance: 'The CRA never threatens arrest or demands payment by gift card or crypto.', topCategories: ['CRA tax scam', 'gift-card scam', 'romance', 'crypto investment'] },
  SG: { code: 'SG', name: 'Singapore', currency: 'S$', phoneCc: ['+65', '65'], helpline: 'ScamShield: 1799', agency: 'Singapore Police Force — ScamShield', reportUrl: 'https://www.scamshield.gov.sg', bankingGuidance: 'Banks never ask for OTP/Internet-banking login via links. Verify on the official app.', topCategories: ['Telegram investment', 'job scam', 'phishing', 'e-commerce'] },
  AU: { code: 'AU', name: 'Australia', currency: 'A$', phoneCc: ['+61', '61'], helpline: 'Scamwatch / ReportCyber', agency: 'ACCC Scamwatch', reportUrl: 'https://www.scamwatch.gov.au/report-a-scam', bankingGuidance: 'The ATO never demands payment by gift card or crypto, or threatens arrest.', topCategories: ['ATO tax scam', 'parcel scam', 'investment', 'remote-access'] },
}

export const DEFAULT_COUNTRY = 'IN'

// International fallback for unsupported countries (graceful degradation).
export const INTERNATIONAL_FALLBACK: CountryConfig = {
  code: 'INT', name: 'International', currency: '', phoneCc: [],
  helpline: 'Contact your local police / national fraud agency',
  agency: 'Your national consumer-protection or cybercrime agency',
  reportUrl: 'https://www.consumersinternational.org',
  bankingGuidance: 'Never share OTP, PIN, or passwords. Verify in your official banking app, not via links.',
  topCategories: ['phishing', 'investment', 'romance', 'tech support'],
}

export const SUPPORTED_COUNTRIES = Object.keys(COUNTRIES)

export function getCountry(code?: string | null): CountryConfig {
  if (!code) return COUNTRIES[DEFAULT_COUNTRY]
  return COUNTRIES[code.toUpperCase()] ?? INTERNATIONAL_FALLBACK
}

/** Infer country from a locale string (e.g. en-IN, en-GB) or language. */
export function countryFromLocale(locale?: string | null): string | null {
  if (!locale) return null
  const region = locale.split('-')[1]?.toUpperCase()
  if (region && COUNTRIES[region]) return region
  if (/^hi/i.test(locale)) return 'IN'
  return null
}

/** Infer country from phone numbers found in OCR text (dialing code prefix). */
export function countryFromPhones(phones: string[]): string | null {
  for (const p of phones) {
    const norm = p.replace(/[\s-]/g, '')
    for (const cfg of Object.values(COUNTRIES)) {
      for (const cc of cfg.phoneCc) {
        if (cc.startsWith('+') && norm.startsWith(cc)) return cfg.code
      }
    }
  }
  return null
}

export type GeoSource = 'override' | 'phone' | 'geo-header' | 'locale' | 'fallback'

/**
 * Resolve country + the SIGNAL that decided it, in priority order:
 * explicit override → phone codes → CDN geo header → locale → default fallback.
 */
export function resolveCountryDetailed(opts: { override?: string | null; phones?: string[]; locale?: string | null; geoHeader?: string | null }): { config: CountryConfig; source: GeoSource; code: string } {
  if (opts.override && COUNTRIES[opts.override.toUpperCase()]) return { config: getCountry(opts.override), source: 'override', code: opts.override.toUpperCase() }
  const fromPhones = opts.phones?.length ? countryFromPhones(opts.phones) : null
  if (fromPhones) return { config: getCountry(fromPhones), source: 'phone', code: fromPhones }
  if (opts.geoHeader && COUNTRIES[opts.geoHeader.toUpperCase()]) return { config: getCountry(opts.geoHeader), source: 'geo-header', code: opts.geoHeader.toUpperCase() }
  const fromLocale = countryFromLocale(opts.locale)
  if (fromLocale) return { config: getCountry(fromLocale), source: 'locale', code: fromLocale }
  return { config: getCountry(DEFAULT_COUNTRY), source: 'fallback', code: DEFAULT_COUNTRY }
}

/** Convenience wrapper returning only the config. */
export function resolveCountry(opts: { override?: string | null; phones?: string[]; locale?: string | null; geoHeader?: string | null }): CountryConfig {
  return resolveCountryDetailed(opts).config
}
