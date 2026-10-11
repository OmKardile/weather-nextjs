/**
 * Generates PWA icon PNGs from the Aether brand SVG.
 * Run: bun scripts/generate-icons.mjs
 */
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const OUT_ICON = 'public/icons';
const OUT_APP = 'src/app';
mkdirSync(OUT_ICON, { recursive: true });

const mark = (rx) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#45D1B3"/>
      <stop offset="1" stop-color="#0F5F55"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${rx}" fill="url(#g)"/>
  <circle cx="256" cy="232" r="80" fill="#F6FEFB"/>
  <path d="M96 320 q40 -40 80 0 t80 0 t80 0 t80 0" fill="none" stroke="#F6FEFB" stroke-width="32" stroke-linecap="round" opacity="0.95"/>
  <path d="M128 392 q32 -32 64 0 t64 0 t64 0 t64 0" fill="none" stroke="#F6FEFB" stroke-width="28" stroke-linecap="round" opacity="0.6"/>
</svg>`;

const maskable = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#45D1B3"/>
      <stop offset="1" stop-color="#0F5F55"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <circle cx="256" cy="236" r="66" fill="#F6FEFB"/>
  <path d="M136 312 q30 -30 60 0 t60 0 t60 0 t60 0" fill="none" stroke="#F6FEFB" stroke-width="24" stroke-linecap="round" opacity="0.95"/>
  <path d="M160 372 q24 -24 48 0 t48 0 t48 0 t48 0" fill="none" stroke="#F6FEFB" stroke-width="21" stroke-linecap="round" opacity="0.6"/>
</svg>`;

async function render(svg, size, file) {
  await sharp(Buffer.from(svg)).resize(size, size).png({ quality: 95 }).toFile(file);
  console.log('✓', file);
}

// Standard icons (rounded corners, transparency outside)
await render(mark(112), 512, `${OUT_ICON}/icon-512.png`);
await render(mark(112), 192, `${OUT_ICON}/icon-192.png`);
// Apple touch icon (180px, fully opaque background for iOS)
await render(maskable, 180, `${OUT_APP}/apple-icon.png`);
// Maskable icon (full-bleed, safe-zone padding)
await render(maskable, 512, `${OUT_ICON}/maskable-512.png`);

console.log('Done.');
