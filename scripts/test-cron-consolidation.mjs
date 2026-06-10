#!/usr/bin/env node
// Static tests for the cron consolidation (asq-cron-consolidate-v1).
// Verifies drain-queue now runs the maintenance jobs, keeps auth + the primary
// drain, isolates failures, and that the standalone routes + vercel.json are
// unchanged (still 2 scheduled crons → within Hobby limit).
// Run: node scripts/test-cron-consolidation.mjs
import fs from 'node:fs'

let pass = 0, fail = 0
const ok = (l, c) => { if (c) pass++; else { fail++; console.error(`✗ ${l}`) } }
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8')

const dq = read('app/api/cron/drain-queue/route.ts')
// auth + primary drain preserved
ok('drain-queue still auth-gated', /isAuthorizedCron\(req\)/.test(dq) && /status:\s*401/.test(dq))
ok('drain-queue still drains the queue', /drainQueue\(20\)/.test(dq) && /hasQueueWork\(\)/.test(dq))
// maintenance folded in
ok('imports recomputeTrending', /import\s*\{\s*recomputeTrending\s*\}\s*from\s*'@\/lib\/scam-intel\/feed'/.test(dq))
ok('imports cache cleaners', /cleanExpiredCache.*cleanExpiredRateLimits/.test(dq))
ok('calls recomputeTrending()', /await recomputeTrending\(\)/.test(dq))
ok('calls cleanExpiredCache + cleanExpiredRateLimits', /cleanExpiredCache\(\)/.test(dq) && /cleanExpiredRateLimits\(\)/.test(dq))
// failure isolation: 3 independent try blocks (drain, trending, cleanup)
ok('>=3 isolated try/catch blocks', (dq.match(/try\s*\{/g) || []).length >= 3)
ok('maintenance failures are warnings, not fatal', /severity:\s*'warning'/.test(dq))
ok('rollback marker present', dq.includes('asq-cron-consolidate-v1'))

// standalone routes still exist (kept for manual/Pro use)
ok('update-trending route still exists', fs.existsSync(new URL('../app/api/cron/update-trending/route.ts', import.meta.url)))
ok('clean-cache route still exists', fs.existsSync(new URL('../app/api/cron/clean-cache/route.ts', import.meta.url)))

// vercel.json unchanged: still exactly 2 scheduled crons (no Hobby-limit risk)
const vj = JSON.parse(read('vercel.json'))
ok('vercel.json still has exactly 2 crons', Array.isArray(vj.crons) && vj.crons.length === 2)
ok('autopilot + drain-queue scheduled', vj.crons.some(c => c.path.includes('autopilot')) && vj.crons.some(c => c.path.includes('drain-queue')))

console.log(`\ncron-consolidation: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
