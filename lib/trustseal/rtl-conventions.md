# TrustSeal RTL & i18n conventions (asq-trustseal-a6)

TrustSeal ships full RTL (Arabic). The architecture makes RTL *almost free* — but only if every component follows these rules. The physical-class guardrail test (`scripts/test-trustseal-seo-rtl.mjs`) fails the build if they're broken.

## 1. Direction is set once, on the wrapper
`app/trustseal/[locale]/layout.tsx` sets `dir={dirFor(locale)}` on the wrapper `<div>` (never `<html>` — keeps SSG + leaves ScamCheck/Lab untouched). Everything inside inherits direction.

## 2. Use CSS LOGICAL properties — never physical inline-axis ones
The whole point: write once, mirror automatically.

| ❌ Don't use (physical, inline-axis) | ✅ Use (logical) |
|---|---|
| `ml-*` / `mr-*` | `ms-*` / `me-*` |
| `pl-*` / `pr-*` | `ps-*` / `pe-*` |
| `left-*` / `right-*` | `start-*` / `end-*` |
| `text-left` / `text-right` | `text-start` / `text-end` |
| `rounded-l-*` / `rounded-r-*` | `rounded-s-*` / `rounded-e-*` |
| `border-l-*` / `border-r-*` | `border-s-*` / `border-e-*` |

**Block-axis is fine** in any direction: `mt-/mb-/pt-/pb-/top-/bottom-/border-t-/border-b-`, and symmetric `mx-/my-/px-/py-` are all allowed.

The guardrail test only bans the inline-axis physical classes (`ml-/mr-/pl-/pr-/left-/right-`) inside `app/trustseal/**` and `components/trustseal/**`.

## 3. Inputs that must stay LTR inside RTL
Email, URL, phone, code, and numeric inputs render LTR even on Arabic pages: set `dir="ltr"` + `text-align:start` on those fields (Phase C form components).

## 4. Icons & motion mirror with direction
Directional chevrons/arrows flip with `dir`; entrance animations enter from inline-start, not "left". When JS genuinely needs a physical side, use `inlineStart(dir)` / `inlineEnd(dir)` from `lib/trustseal/rtl.ts` — don't hardcode `left`/`right`.

## 5. Fonts
`lib/trustseal/fonts.ts` loads Noto Sans Arabic (ar) + Noto Sans Devanagari (hi), applied per-locale on the wrapper. Latin (en/es) inherits Inter. Never letter-space Arabic (breaks ligatures); give Arabic slightly larger line-height in Phase C type scale.

## 6. Numbers
Use Western digits (0–9) for trust scores and pricing (Gulf SaaS norm); reserve `Intl.NumberFormat('ar')` for places that culturally expect Eastern-Arabic numerals.
