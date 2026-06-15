// ─────────────────────────────────────────────────────────────────
// lib/trustseal/legal-content.ts  (asq-trustseal-harden-legal)
// Source of truth for the TrustSeal legal center (/legal/[doc]). Bodies are in
// English (the controlling language for these policies); the page chrome — nav,
// "last updated", section index — is localized. Each doc maps to a route slug.
// Contact for all policies: contact@asquaresolution.com.
// ─────────────────────────────────────────────────────────────────
export const LEGAL_CONTACT = 'contact@asquaresolution.com'
export const LEGAL_UPDATED = '2026-06-15'

export interface LegalSection {
  heading: string
  paras?: string[]
  bullets?: string[]
}
export interface LegalDoc {
  slug: string
  title: string
  description: string
  intro: string
  sections: LegalSection[]
}

export const LEGAL_SLUGS = [
  'license',
  'trademark-policy',
  'copyright',
  'security',
  'code-of-conduct',
  'privacy',
  'terms',
  'acceptable-use',
  'dmca',
] as const
export type LegalSlug = (typeof LEGAL_SLUGS)[number]

export const LEGAL_DOCS: Record<LegalSlug, LegalDoc> = {
  license: {
    slug: 'license',
    title: 'License',
    description: 'TrustSeal proprietary, source-available license. All rights reserved.',
    intro:
      'TrustSeal is proprietary, source-available software. It is NOT open source and is NOT licensed under MIT, Apache, GPL, or any permissive or copyleft license.',
    sections: [
      { heading: 'Limited grant', paras: ['You are granted a personal, non-exclusive, non-transferable, revocable license to view and read the source, and to clone or fork it solely for private, non-commercial educational or reference purposes.'] },
      { heading: 'You may not', bullets: [
        'Use TrustSeal, in whole or part, for any commercial purpose without written permission.',
        'Clone TrustSeal or operate a competing hosted/SaaS version.',
        'Resell, redistribute, sublicense, rehost, mirror, or republish the software or any derivative.',
        'Reproduce the verification infrastructure or trust-score system.',
        'Reuse TrustSeal branding, logos, or trust marks beyond factual reference.',
        'Remove or obscure copyright, trademark, or attribution notices.',
      ] },
      { heading: 'Service use', paras: ['You may use the hosted TrustSeal service in accordance with the Terms of Service and Acceptable Use Policy.'] },
      { heading: 'No warranty', paras: ['The software and service are provided "as is", without warranty of any kind. A Square Solutions is not liable for any claim or damages arising from use.'] },
      { heading: 'Termination', paras: ['This license terminates automatically on breach; you must then cease all use and destroy all copies.'] },
    ],
  },
  'trademark-policy': {
    slug: 'trademark-policy',
    title: 'Trademark Usage Policy',
    description: 'How the TrustSeal name, logo, trust marks, and badges may be used.',
    intro:
      'TrustSeal, A Square Solutions, the TrustSeal logo, trust badges, trust marks, verification graphics, and trust-score indicators are trademarks and brand assets of A Square Solutions, protected whether or not registered.',
    sections: [
      { heading: 'Allowed uses', bullets: [
        'Factual, nominative reference to TrustSeal.',
        'Displaying the official "Verified by TrustSeal" badge on a domain you have verified, via the official badge loader, while verification is active.',
        'Linking to TrustSeal and to your public seal page.',
      ] },
      { heading: 'Forbidden uses', bullets: [
        'Implying endorsement, partnership, or affiliation that does not exist.',
        'Brand impersonation via look-alike domains, accounts, apps, or handles.',
        'Altering, recoloring, redrawing, or recombining the logo or trust marks.',
        'Reproducing verification graphics or trust-score indicators outside the official badge system.',
        'Using the marks as part of your own product, service, or company name.',
      ] },
      { heading: 'Badge misuse & fraudulent verification claims', paras: ['Displaying a "Verified" badge for an unverified domain, or retaining a badge after verification has expired or been revoked, is prohibited and may constitute trademark infringement and consumer fraud. The official badge is live-checked and origin-bound to prevent forgery.'] },
      { heading: 'Logo restrictions', paras: ['Use the official badge embed only. Do not self-host, screenshot, hardcode, or modify the badge markup to suppress its downgrade/expiry behavior.'] },
      { heading: 'Trademark complaint process', paras: [`Report misuse, impersonation, or fraudulent verification claims to ${LEGAL_CONTACT} with the mark involved, the URL/location, a description, and your contact details.`] },
    ],
  },
  copyright: {
    slug: 'copyright',
    title: 'Copyright Policy',
    description: 'Copyright ownership of TrustSeal code, designs, and content.',
    intro:
      'All source code, designs, text, graphics, trust marks, badges, verification infrastructure, and documentation in TrustSeal are the exclusive property of A Square Solutions and are protected by copyright law.',
    sections: [
      { heading: 'Ownership', paras: ['A Square Solutions owns all right, title, and interest in the TrustSeal platform, the trust-score system, and the badge and seal-page systems.'] },
      { heading: 'Usage', paras: ['Use is governed by the License and the Trademark Policy. No ownership or license is transferred except as expressly stated there.'] },
      { heading: 'Reporting infringement', paras: [`To report copyright infringement or submit a DMCA notice, see the DMCA / Copyright Complaints policy or email ${LEGAL_CONTACT}.`] },
    ],
  },
  security: {
    slug: 'security',
    title: 'Security Policy',
    description: 'How to report vulnerabilities and our responsible-disclosure commitments.',
    intro: 'A Square Solutions supports responsible, coordinated disclosure. Please report security issues privately.',
    sections: [
      { heading: 'Reporting a vulnerability', bullets: [
        `Email ${LEGAL_CONTACT} with subject "SECURITY — TrustSeal".`,
        'Include a description, reproduction steps, affected URL/endpoint, and impact.',
        'Allow a reasonable remediation window before public disclosure.',
      ] },
      { heading: 'Scope', paras: ['In scope: trustseal.asquaresolution.com, the TrustSeal APIs, the badge loader, public seal pages, and the DNS TXT verification flow. Out of scope: volumetric DoS, social engineering, and physical attacks.'] },
      { heading: 'Our commitments', bullets: [
        'Acknowledge reports promptly and share remediation progress.',
        'No legal action for good-faith research within this policy.',
        'Credit reporters who wish to be acknowledged after a fix ships.',
      ] },
    ],
  },
  'code-of-conduct': {
    slug: 'code-of-conduct',
    title: 'Code of Conduct',
    description: 'Standards of respectful, harassment-free conduct in TrustSeal spaces.',
    intro: 'A Square Solutions is committed to a respectful, harassment-free environment for everyone who interacts with TrustSeal.',
    sections: [
      { heading: 'Expected behavior', bullets: ['Be respectful, professional, and considerate.', 'Assume good faith and give constructive feedback.', 'Respect privacy and confidentiality.'] },
      { heading: 'Unacceptable behavior', bullets: ['Harassment, discrimination, or hateful conduct.', 'Personal attacks, trolling, or intimidation.', 'Publishing others’ private information without consent.', 'Abuse of the service, including fraudulent verification claims or badge misuse.'] },
      { heading: 'Reporting & enforcement', paras: [`Report violations to ${LEGAL_CONTACT}. A Square Solutions may warn, suspend, or ban offenders and revoke service access for serious or repeated violations.`] },
    ],
  },
  privacy: {
    slug: 'privacy',
    title: 'Privacy Policy',
    description: 'What data TrustSeal collects, why, and your rights.',
    intro: 'This policy explains what personal data TrustSeal processes and how. We collect the minimum needed to provide verification, billing, and account services.',
    sections: [
      { heading: 'Data we collect', bullets: [
        'Account data: email and authentication identifiers (via Firebase Authentication).',
        'Verification data: domains you claim and the DNS TXT records used to prove ownership.',
        'Billing data: subscription status and identifiers from our payment processor (Razorpay). We do not store card numbers.',
        'Usage data: limited logs and metrics needed to operate and secure the service.',
      ] },
      { heading: 'How we use it', bullets: ['To provide and secure domain verification, badges, and seal pages.', 'To manage billing and entitlements.', 'To prevent abuse and fraudulent verification claims.'] },
      { heading: 'Sharing', paras: ['We share data only with processors that run the service (e.g., authentication, hosting, payments) and as required by law. We do not sell personal data.'] },
      { heading: 'Public information', paras: ['Verified domains and their public seal pages are intentionally public — that is the purpose of the trust signal. Account email is not shown publicly.'] },
      { heading: 'Your rights & contact', paras: [`You may request access, correction, or deletion of your personal data by emailing ${LEGAL_CONTACT}.`] },
    ],
  },
  terms: {
    slug: 'terms',
    title: 'Terms of Service',
    description: 'The terms governing use of the TrustSeal service.',
    intro: 'By using TrustSeal you agree to these Terms, the Acceptable Use Policy, and the License. If you do not agree, do not use the service.',
    sections: [
      { heading: 'The service', paras: ['TrustSeal provides domain ownership verification, trust scoring, embeddable badges, and public seal pages. Free and Pro plans are described on the pricing page.'] },
      { heading: 'Accounts', paras: ['You are responsible for your account and for the accuracy of the domains you claim. The first account to verify a domain owns it within TrustSeal.'] },
      { heading: 'Billing', paras: ['Paid plans renew until cancelled. Cancelling stops renewal; Pro access continues until the end of the period already paid for. Prices include applicable taxes as shown.'] },
      { heading: 'Acceptable use', paras: ['Your use must comply with the Acceptable Use Policy. We may suspend or terminate accounts that abuse the service or make fraudulent verification claims.'] },
      { heading: 'Disclaimer & liability', paras: ['The service is provided "as is" without warranties. To the maximum extent permitted by law, A Square Solutions is not liable for indirect or consequential damages.'] },
      { heading: 'Changes', paras: ['We may update these Terms; material changes will be reflected by the "last updated" date.'] },
    ],
  },
  'acceptable-use': {
    slug: 'acceptable-use',
    title: 'Acceptable Use Policy',
    description: 'What you may and may not do with the TrustSeal service.',
    intro: 'This policy keeps TrustSeal trustworthy. It applies to everyone using the service.',
    sections: [
      { heading: 'You must not', bullets: [
        'Claim or verify domains you do not control.',
        'Display a verified badge for an unverified, expired, or revoked domain.',
        'Tamper with the badge loader or attempt to forge verification status.',
        'Probe, scan, or attempt to disrupt the service except under the Security Policy.',
        'Reuse TrustSeal branding or build a competing hosted clone.',
      ] },
      { heading: 'Enforcement', paras: [`Violations may result in badge takedown, account suspension or termination, and referral to authorities for fraud. Report abuse to ${LEGAL_CONTACT}.`] },
    ],
  },
  dmca: {
    slug: 'dmca',
    title: 'DMCA / Copyright & Abuse Complaints',
    description: 'How to file copyright, trademark, and abuse complaints and counter-notices.',
    intro: 'A Square Solutions responds to valid copyright (DMCA), trademark, and abuse complaints regarding TrustSeal.',
    sections: [
      { heading: 'Copyright complaints (DMCA notice)', bullets: [
        'Identify the copyrighted work and the infringing material/URL.',
        'Provide your contact details and a good-faith statement that use is unauthorized.',
        'Include a statement, under penalty of perjury, that the information is accurate and you are authorized to act.',
        'Sign (physical or electronic).',
      ] },
      { heading: 'Trademark complaints', paras: ['Report misuse of the TrustSeal name, logo, badges, or trust marks, including brand impersonation, per the Trademark Usage Policy.'] },
      { heading: 'Abuse reports', paras: ['Report fraudulent verification claims, badge misuse, or other service abuse with the offending URL and a description.'] },
      { heading: 'Counter-notification', bullets: [
        'Identify the removed material and its prior location.',
        'Provide a statement, under penalty of perjury, of a good-faith belief the removal was a mistake or misidentification.',
        'Provide your contact details and consent to jurisdiction.',
      ] },
      { heading: 'Where to send', paras: [`Send all notices and counter-notices to ${LEGAL_CONTACT}.`] },
    ],
  },
}
