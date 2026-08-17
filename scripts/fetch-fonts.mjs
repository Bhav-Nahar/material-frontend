#!/usr/bin/env node
/**
 * Fetches the five faces the brand system ships, as latin-subset woff2, into public/fonts.
 *
 * Brand book §05: "Self-host the latin subset; never link a font CDN." It also forbids
 * shipping a weight we do not have a file for -- asking CSS for 650 makes the browser
 * synthesise it by smearing outlines, which looks subtly wrong and is hard to diagnose.
 * So this list is exhaustive and `globals.css` must not reference anything outside it.
 *
 * The binaries are gitignored: this runs at setup and in CI rather than committing ~120KB
 * of font to the repo.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'fonts');

/** The exact five faces from §05's weight matrix, plus Mono for SKU codes and dimensions. */
const FACES = [
  { family: 'Bai Jamjuree', weight: 600, file: 'bai-jamjuree-600.woff2' },
  { family: 'Bai Jamjuree', weight: 700, file: 'bai-jamjuree-700.woff2' },
  { family: 'IBM Plex Sans', weight: 400, file: 'ibm-plex-sans-400.woff2' },
  { family: 'IBM Plex Sans', weight: 500, file: 'ibm-plex-sans-500.woff2' },
  { family: 'IBM Plex Sans', weight: 600, file: 'ibm-plex-sans-600.woff2' },
  { family: 'IBM Plex Mono', weight: 400, file: 'ibm-plex-mono-400.woff2' },
];

// A modern UA string is required: the Google Fonts CSS API serves woff2 only to browsers
// it recognises, and falls back to ttf otherwise -- which would roughly triple the payload.
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function urlsFor({ family, weight }) {
  const api = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;
  const css = await fetch(api, { headers: { 'User-Agent': UA } }).then((r) => {
    if (!r.ok) throw new Error(`${family} ${weight}: CSS API returned ${r.status}`);
    return r.text();
  });

  // The response is a series of @font-face blocks, one per unicode-range subset. We want
  // only `latin` -- the full set includes cyrillic, greek and vietnamese for these families
  // and would be several times the size for text we will never render.
  const blocks = css.split('@font-face').filter((b) => b.includes('unicode-range'));
  const latin = blocks.find(
    (b) => b.includes('U+0000-00FF') && !b.includes('U+0102-0103'), // latin, not latin-ext
  );
  if (!latin) throw new Error(`${family} ${weight}: no latin subset found in CSS response`);

  const url = latin.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
  if (!url) throw new Error(`${family} ${weight}: no woff2 URL in latin block`);
  return url;
}

await mkdir(OUT, { recursive: true });

let total = 0;
for (const face of FACES) {
  const url = await urlsFor(face);
  const buf = Buffer.from(await fetch(url).then((r) => r.arrayBuffer()));
  await writeFile(join(OUT, face.file), buf);
  total += buf.byteLength;
  console.log(`  ${face.file.padEnd(28)} ${(buf.byteLength / 1024).toFixed(1)} KB`);
}

const kb = total / 1024;
console.log(`\n${FACES.length} faces, ${kb.toFixed(1)} KB total`);

// docs/performance/budget.md sets 120 KB for all faces after subsetting. Fail rather than
// warn: a font budget that only prints a warning is a font budget nobody enforces.
if (kb > 120) {
  console.error(`\nFAIL: exceeds the 120 KB font budget in docs/performance/budget.md`);
  process.exit(1);
}
