#!/usr/bin/env node
/**
 * scripts/screenshot-server.mjs
 *
 * Tiny HTTP server that receives base64 PNG screenshots from the browser and
 * saves them to disk. Run once during evidence capture session.
 *
 * POST /save  body: { filename: "foo.png", data: "<base64 string>" }
 * GET  /ping  → 200 "pong"
 * GET  /quit  → saves any pending, exits
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'public', 'evidence', 'wordpress-rollout');

fs.mkdirSync(OUT_DIR, { recursive: true });

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'GET' && req.url === '/ping') {
    res.writeHead(200); res.end('pong'); return;
  }

  if (req.method === 'GET' && req.url === '/quit') {
    res.writeHead(200); res.end('shutting down');
    setTimeout(() => { server.close(); process.exit(0); }, 200);
    return;
  }

  if (req.method === 'POST' && req.url === '/save') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { filename, data } = JSON.parse(body);
        if (!filename || !data) throw new Error('missing filename or data');
        // Sanitize filename
        const safe = path.basename(filename).replace(/[^a-z0-9._-]/gi, '-');
        const outPath = path.join(OUT_DIR, safe);
        fs.writeFileSync(outPath, Buffer.from(data, 'base64'));
        const size = Math.round(fs.statSync(outPath).size / 1024);
        console.log(`✓ saved ${safe} (${size} KB)`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, path: outPath, size }));
      } catch (e) {
        console.error('save error:', e.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404); res.end('not found');
});

server.listen(9876, '127.0.0.1', () => {
  console.log('screenshot-server listening on http://127.0.0.1:9876');
  console.log('saving to:', OUT_DIR);
});
