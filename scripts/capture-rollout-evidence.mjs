#!/usr/bin/env node
/**
 * scripts/capture-rollout-evidence.mjs
 *
 * Launches headless Chrome with CDP, navigates to each rollout deliverable,
 * scrolls to the right section, and saves PNG evidence to:
 *   /public/evidence/wordpress-rollout/
 *
 * Requires: Chrome at standard Windows path. Node 22+ (built-in WebSocket).
 * Run: node scripts/capture-rollout-evidence.mjs
 */

import { spawn }           from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import http                from 'http';
import path                from 'path';
import { fileURLToPath }   from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = path.join(__dirname, '..', 'public', 'evidence', 'wordpress-rollout');
const CHROME    = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CDP_PORT  = 9878;  // separate port to avoid conflicts

mkdirSync(OUT_DIR, { recursive: true });

// ─── CDP helpers ──────────────────────────────────────────────────────────────

function httpGet(port, path) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port, path }, res => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch { resolve(b); } });
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

class CDPClient {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = {};
    ws.addEventListener('message', ({ data }) => {
      const msg = JSON.parse(data);
      if (msg.id != null && this.pending[msg.id]) {
        const { resolve, reject } = this.pending[msg.id];
        delete this.pending[msg.id];
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result ?? {});
      }
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.pending[id] = { resolve, reject };
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async navigate(url, waitMs = 4000) {
    await this.send('Page.navigate', { url });
    await sleep(waitMs);
  }

  async scroll(y) {
    await this.send('Runtime.evaluate', {
      expression: `window.scrollTo(0, ${y}); document.documentElement.scrollTop`,
      awaitPromise: false,
    });
    await sleep(600);
  }

  async scrollToElement(selector) {
    await this.send('Runtime.evaluate', {
      expression: `
        const el = document.querySelector(${JSON.stringify(selector)});
        if (el) { el.scrollIntoView({behavior:'instant', block:'start'}); el.getBoundingClientRect().top; }
        else { 'not found: ' + ${JSON.stringify(selector)}; }
      `,
      awaitPromise: false,
    });
    await sleep(500);
  }

  async getScrollHeight() {
    const r = await this.send('Runtime.evaluate', {
      expression: 'document.body.scrollHeight',
    });
    return r.result?.value || 0;
  }

  async screenshot(clip) {
    const params = {
      format: 'png',
      captureBeyondViewport: true,
    };
    if (clip) params.clip = { ...clip, scale: 1 };
    const r = await this.send('Page.captureScreenshot', params);
    return r.data;
  }

  async getScrollY() {
    const r = await this.send('Runtime.evaluate', {
      expression: 'window.scrollY || window.pageYOffset || 0',
    });
    return r.result?.value || 0;
  }

  async scrollToTextAndGetY(searchText) {
    const r = await this.send('Runtime.evaluate', {
      expression: `
        (function() {
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          let node;
          while ((node = walker.nextNode())) {
            if (node.textContent.includes(${JSON.stringify(searchText)})) {
              const el = node.parentElement;
              el.scrollIntoView({ behavior: 'instant', block: 'start' });
              return window.scrollY;
            }
          }
          // Try heading elements
          const els = Array.from(document.querySelectorAll('h1,h2,h3,h4,p,div'));
          const el = els.find(e => e.textContent.trim().includes(${JSON.stringify(searchText)}));
          if (el) {
            el.scrollIntoView({ behavior: 'instant', block: 'start' });
            return window.scrollY;
          }
          return -1;
        })()
      `,
      awaitPromise: false,
    });
    return r.result?.value ?? -1;
  }
}

async function connectCDP(retries = 10) {
  for (let i = 0; i < retries; i++) {
    try {
      const targets = await httpGet(CDP_PORT, '/json');
      const page    = targets.find(t => t.type === 'page');
      if (!page) throw new Error('no page target');
      const wsUrl   = page.webSocketDebuggerUrl;
      const ws      = new WebSocket(wsUrl);
      await new Promise((resolve, reject) => {
        ws.addEventListener('open',  resolve);
        ws.addEventListener('error', reject);
        setTimeout(() => reject(new Error('ws timeout')), 5000);
      });
      return new CDPClient(ws);
    } catch (e) {
      if (i === retries - 1) throw e;
      await sleep(500);
    }
  }
}

function saveB64(b64, filename) {
  const outPath = path.join(OUT_DIR, filename);
  writeFileSync(outPath, Buffer.from(b64, 'base64'));
  const kb = Math.round(Buffer.byteLength(b64, 'base64') / 1024);
  console.log(`  ✓ saved ${filename} (${kb} KB)`);
  return outPath;
}

// ─── Capture plan ─────────────────────────────────────────────────────────────

const BASE  = 'https://asquaresolution.com';
const ABOUT = 'https://asquaresolution.com/about-us';
const W = 1400, H = 900;

async function runCaptures(cdp) {
  // Set viewport
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: W, height: H, deviceScaleFactor: 1, mobile: false
  });

  // ── 1. Homepage nav with AI Lab ───────────────────────────────────────────
  console.log('\n[1/9] Homepage nav with AI Lab link');
  await cdp.navigate(BASE, 5000);
  await cdp.scroll(0);
  const navShot = await cdp.screenshot({ x: 0, y: 0, width: W, height: 120 });
  saveB64(navShot, 'wordpress-nav-link.png');

  // ── 2. Homepage above-fold ────────────────────────────────────────────────
  console.log('[2/9] Homepage above fold (hero + nav)');
  const heroShot = await cdp.screenshot({ x: 0, y: 0, width: W, height: H });
  saveB64(heroShot, 'homepage-above-fold.png');
  await sleep(500);

  // ── 3. "The Work, Made Public" section ────────────────────────────────────
  console.log('[3/9] "The Work, Made Public" section');
  const workScrollY = await cdp.scrollToTextAndGetY('The Work, Made Public');
  console.log('     scrollY for Work section:', workScrollY);
  await sleep(700);
  const workActualY = await cdp.getScrollY();
  const workShot = await cdp.screenshot({ x: 0, y: workActualY, width: W, height: H });
  saveB64(workShot, 'homepage-ai-lab-section.png');
  await sleep(300);

  // ── 4. "What We Build and Run" 3-col ─────────────────────────────────────
  console.log('[4/9] Ecosystem 3-column section');
  await cdp.scrollToTextAndGetY('What We Build and Run');
  await sleep(700);
  const ecoY = await cdp.getScrollY();
  const ecoShot = await cdp.screenshot({ x: 0, y: ecoY, width: W, height: H });
  saveB64(ecoShot, 'homepage-ecosystem-3col.png');

  // ── 5. Evaluation CTA section ─────────────────────────────────────────────
  console.log('[5/9] Evaluation CTA section');
  await cdp.scrollToTextAndGetY('evaluating whether we know');
  await sleep(700);
  const ctaY = await cdp.getScrollY();
  const ctaShot = await cdp.screenshot({ x: 0, y: ctaY, width: W, height: H });
  saveB64(ctaShot, 'homepage-evaluation-cta.png');

  // ── 6. Footer with "Our Work" widget ──────────────────────────────────────
  console.log('[6/9] Footer ecosystem links');
  const scrollH = await cdp.getScrollHeight();
  await cdp.scroll(scrollH);
  await sleep(700);
  const footerActualY = await cdp.getScrollY();
  const footerShot = await cdp.screenshot({ x: 0, y: footerActualY, width: W, height: H });
  saveB64(footerShot, 'footer-ecosystem-links.png');

  // ── 7. About page "Built in Public" ───────────────────────────────────────
  console.log('[7/9] About page Built in Public');
  await cdp.navigate(ABOUT, 5000);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: W, height: H, deviceScaleFactor: 1, mobile: false
  });
  await cdp.scrollToTextAndGetY('Built in Public');
  await sleep(700);
  const aboutY = await cdp.getScrollY();
  console.log('     scrollY for About section:', aboutY);
  const aboutShot = await cdp.screenshot({ x: 0, y: aboutY, width: W, height: H });
  saveB64(aboutShot, 'about-built-in-public.png');

  // ── 8. Mobile homepage ────────────────────────────────────────────────────
  console.log('[8/9] Mobile homepage (375px)');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 375, height: 812, deviceScaleFactor: 2, mobile: true
  });
  await cdp.navigate(BASE, 5000);
  await cdp.scroll(0);
  const mobileY = await cdp.getScrollY();
  const mobileShot = await cdp.screenshot({ x: 0, y: mobileY, width: 375, height: 812 });
  saveB64(mobileShot, 'mobile-homepage-view.png');

  // Mobile scrolled to new sections
  await cdp.scrollToTextAndGetY('The Work, Made Public');
  await sleep(500);
  const mobileSectY = await cdp.getScrollY();
  const mobileSectionShot = await cdp.screenshot({ x: 0, y: mobileSectY, width: 375, height: 812 });
  saveB64(mobileSectionShot, 'mobile-homepage-sections.png');

  // ── 9. Rich Results test (screenshot the test page) ───────────────────────
  // Can't use Rich Results Test easily in headless — skip for now
  // Instead: capture the schema as text from view-source
  console.log('[9/9] Schema validation (view-source)');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: W, height: H, deviceScaleFactor: 1, mobile: false
  });
  await cdp.navigate('view-source:https://asquaresolution.com', 4000);
  await sleep(2000);
  // Find ld+json in source and scroll to it
  await cdp.send('Runtime.evaluate', {
    expression: `
      // In view-source, content is in a pre element
      const pre = document.querySelector('pre');
      if (pre) {
        const idx = pre.textContent.indexOf('ld+json');
        if (idx > -1) {
          // Estimate scroll position
          const lines = pre.textContent.slice(0, idx).split('\\n').length;
          const lineH = 16;
          window.scrollTo(0, lines * lineH - 200);
          'found at line ' + lines;
        } else 'ld+json not found in source';
      } else 'no pre element';
    `
  });
  await sleep(600);
  const schemaShot = await cdp.screenshot({ x: 0, y: 0, width: W, height: H });
  saveB64(schemaShot, 'schema-viewsource-deployed.png');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log('Starting headless Chrome for evidence capture...');

  const chrome = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-extensions',
    '--hide-scrollbars',
    `--remote-debugging-port=${CDP_PORT}`,
    `--window-size=${W},${H}`,
    '--user-data-dir=' + path.join(OUT_DIR, '_chrome_tmp'),
    'about:blank',
  ], { stdio: 'pipe' });

  chrome.on('error', e => console.error('Chrome spawn error:', e.message));

  // Wait for Chrome to start
  await sleep(2000);

  let cdp;
  try {
    cdp = await connectCDP();
    console.log('CDP connected.\n');
    await runCaptures(cdp);
    console.log('\nAll evidence screenshots saved to:');
    console.log('  ' + OUT_DIR);
  } catch (e) {
    console.error('Error:', e.message);
    console.error(e.stack);
  } finally {
    if (cdp) cdp.ws.close();
    chrome.kill();
    process.exit(0);
  }
})();
