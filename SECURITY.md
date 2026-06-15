# Security Policy

**Copyright © 2026 A Square Solutions. All Rights Reserved.**

A Square Solutions takes the security of TrustSeal and its users seriously. This
document describes how to report vulnerabilities and what to expect.

## Reporting a vulnerability

Please report security issues privately — **do not** open a public issue.

- Email: **contact@asquaresolution.com** (subject: `SECURITY — TrustSeal`)
- Include: a description, reproduction steps, affected URL/endpoint, and impact.
- If possible, include a proof of concept and your suggested severity.

We support **responsible/coordinated disclosure**. Please give us a reasonable
window to remediate before any public disclosure.

## Scope

In scope: `trustseal.asquaresolution.com`, the TrustSeal APIs
(`/api/trustseal/*`), the badge loader, the public seal pages, and the domain
ownership / DNS TXT verification flow.

Out of scope: volumetric DoS, social engineering, physical attacks, and findings
that require a compromised end-user device.

## Our commitments

- Acknowledge reports promptly and keep you updated on remediation.
- Not pursue legal action against good-faith research conducted within this policy.
- Credit reporters who wish to be acknowledged, once a fix has shipped.

## Hardening highlights

- Domain ownership is proven via a per-claim DNS TXT token; the first account to
  verify owns the domain.
- The embeddable badge checks **live** status and is **origin-bound** to the
  claimed domain — a copied/static badge cannot fake verification, and a
  revoked/expired seal degrades within the cache TTL.
- Billing entitlement is server-authoritative (webhook-driven); clients cannot
  self-upgrade.

**Official contact:** contact@asquaresolution.com

© 2026 A Square Solutions. All Rights Reserved.
