#!/usr/bin/env node
/**
 * scripts/capture-evidence.mjs
 *
 * Captures a cropped region of the screen (browser viewport area) and saves as PNG.
 *
 * Usage: node capture-evidence.mjs <output-path> [x] [y] [width] [height]
 *
 * x, y: position in CSS pixels within the browser viewport (viewport-relative)
 * width, height: crop size in CSS pixels
 *
 * Browser geometry constants (1536x864 screen, 125% DPI):
 *   VIEWPORT_Y = 86   (tabs + address bar height)
 *   SCREEN_W   = 1536
 *   SCREEN_H   = 864
 *   VIEWPORT_H = 730
 */

import { execFileSync, execSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

const VIEWPORT_Y = 86;
const SCREEN_W   = 1536;
const SCREEN_H   = 864;
const VIEWPORT_H = 730;

function screenshot(outputPath, x = 0, y = 0, w = SCREEN_W, h = VIEWPORT_H) {
  const absX = Math.max(0, Math.round(x));
  const absY = Math.max(0, Math.round(y + VIEWPORT_Y));
  const absW = Math.min(Math.round(w), SCREEN_W - absX);
  const absH = Math.min(Math.round(h), SCREEN_H - absY);

  const ps = [
    'Add-Type -AssemblyName System.Windows.Forms',
    'Add-Type -AssemblyName System.Drawing',
    '$sc = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds',
    '$bmp = New-Object System.Drawing.Bitmap($sc.Width, $sc.Height)',
    '$g = [System.Drawing.Graphics]::FromImage($bmp)',
    '$g.CopyFromScreen([System.Drawing.Point]::Empty, [System.Drawing.Point]::Empty, $sc.Size)',
    '$g.Dispose()',
    `$rect = [System.Drawing.Rectangle]::new(${absX}, ${absY}, ${absW}, ${absH})`,
    '$crop = $bmp.Clone($rect, $bmp.PixelFormat)',
    '$bmp.Dispose()',
    `$outPath = '${outputPath.replace(/'/g, "''")}'`,
    '$dir = Split-Path $outPath -Parent',
    'if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }',
    '$crop.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)',
    '$crop.Dispose()',
    `Write-Output "OK ${absW}x${absH}"`,
  ].join('\n');

  const tmpPs = path.join(tmpdir(), `capture_${Date.now()}.ps1`);
  writeFileSync(tmpPs, ps, 'utf8');

  const result = execFileSync('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', tmpPs
  ], { timeout: 15000, encoding: 'utf8' });

  return result.trim();
}

const [,, outputPath, x, y, w, h] = process.argv;
if (!outputPath) {
  console.error('Usage: node capture-evidence.mjs <output> [x] [y] [w] [h]');
  process.exit(1);
}

try {
  const res = screenshot(outputPath, +x||0, +y||0, +w||SCREEN_W, +h||VIEWPORT_H);
  console.log(res);
} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
}
