// lib/trustseal/content/types.ts  (asq-trustseal-harden)
// Shared shape for fully-localized content pages (Security, Docs, About). Content
// is co-located per page as Record<Locale, ContentPage> so translations live
// together and stay in lockstep (no English leakage on these surfaces).
import type { Locale } from '../locales'

export interface ContentSection {
  heading: string
  paras?: string[]
  bullets?: string[]
}
export interface ContentPage {
  title: string
  subtitle: string
  sections: ContentSection[]
}
export type LocalizedPage = Record<Locale, ContentPage>
