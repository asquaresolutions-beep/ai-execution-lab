// lib/trustseal/verify/registry.ts  (asq-trustseal-c1b)
// Assembles the real MVP collector set. Imported by callers (the API route, C1C) —
// NOT by verify.ts (which takes collectors injected, keeping it pure/testable).
import type { Collector } from './types'
import { dnsCollector } from './collectors/dns'
import { tlsCollector } from './collectors/tls'
import { rdapCollector } from './collectors/rdap'
import { blocklistCollector } from './collectors/blocklist'
import { reputationCollector } from './collectors/reputation'
import { impersonationCollector } from './collectors/impersonation'

/** MVP collectors (free/cheap data + reused intel modules). */
export const MVP_COLLECTORS: Collector[] = [
  dnsCollector,
  tlsCollector,
  rdapCollector,
  blocklistCollector,
  reputationCollector,
  impersonationCollector,
]
