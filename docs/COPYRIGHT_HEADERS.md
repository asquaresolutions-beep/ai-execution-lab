# Copyright header guidance

The repository is **source-available, All Rights Reserved** (see `LICENSE.md` and
`NOTICE`). Add a short copyright header to substantial source files so the
proprietary status travels with the code.

## Recommended header

**TypeScript / JavaScript / CSS** (`.ts`, `.tsx`, `.js`, `.mjs`, `.css`):
```ts
// Copyright © 2026 A Square Solutions. All Rights Reserved.
// Proprietary and source-available — see LICENSE.md. No commercial use,
// redistribution, rehosting, or SaaS cloning without written permission.
```

**Markdown / MDX** (where a header is appropriate):
```md
<!-- © 2026 A Square Solutions. All Rights Reserved. See LICENSE.md. -->
```

## Guidance
- Apply to new substantial source files (libraries, routes, components). Trivial
  config or generated files do not need it.
- Keep it to the 2–3 lines above; do not restate the full license in each file.
- Never replace it with an SPDX/MIT/Apache/GPL identifier — this project is **not**
  under a permissive or copyleft license.
- The canonical terms always live in `LICENSE.md`; file headers are a pointer.
