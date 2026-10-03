#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// MUST be kept in sync with src/lib/dataLoader.js:BLOCKED_SOURCES
const BLOCKED_SOURCES = [/gjirafa/i, /wolt\.com\/al\//i, /Wolt Shqipëri/i];

function isBlockedSource(product) {
  const hay = `${product?.source || ''} ${product?.sourceLabel || ''}`;
  return BLOCKED_SOURCES.some((re) => re.test(hay));
}

function getFileSize(path) {
  try {
    const stats = fs.statSync(path);
    return stats.size / 1024 / 1024; // MB
  } catch {
    return null;
  }
}

// Read input
const inputPath = path.resolve('data/kosovo-retail.json');
if (!fs.existsSync(inputPath)) {
  console.error(`Error: input file not found: ${inputPath}`);
  process.exit(1);
}

let rawData;
try {
  rawData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
} catch (err) {
  console.error(`Error: failed to parse ${inputPath}:`, err.message);
  process.exit(1);
}

const inputList = Array.isArray(rawData?.products) ? rawData.products : Array.isArray(rawData) ? rawData : [];
const inputCount = inputList.length;
const inputSizeMB = getFileSize(inputPath);

// Filter
const outputList = inputList.filter((product) => !isBlockedSource(product));

if (outputList.length === 0) {
  console.error('Error: pruning would result in 0 rows — aborting write');
  process.exit(1);
}

// Build output
const outputData = {
  ...rawData,
  products: outputList,
};

// Write output
const outputDir = path.resolve('public/data');
fs.mkdirSync(outputDir, { recursive: true });

const outputPath = path.join(outputDir, 'kosovo-retail.json');
fs.writeFileSync(outputPath, JSON.stringify(outputData), 'utf8');

const outputCount = outputList.length;
const outputSizeMB = getFileSize(outputPath);

// Compute stats
const rowsRemoved = inputCount - outputCount;
const percentReduction = ((rowsRemoved / inputCount) * 100).toFixed(1);

// Print to stdout
console.log(`Input:  ${inputCount} rows, ${inputSizeMB.toFixed(1)} MB`);
console.log(`Output: ${outputCount} rows, ${outputSizeMB.toFixed(1)} MB`);
console.log(`Reduction: ${rowsRemoved} rows (${percentReduction}%)`);

// THE 100 MB WALL. Same ceiling vite.config.js enforces on every build, and
// the same one refresh-catalogue.mjs gate G4 enforces (at 90 MB) on the
// nightly run. Reported here too because this is the one tool a human runs
// by hand after a harvest, and a harvest is the only thing that moves this
// number. Reported, not enforced: pruning the payload is read-only against
// data/ and must not start failing because of how big its input is.
const FAIL_MB = 95;
const WARN_MB = 50;
const perRow = inputCount > 0 ? (inputSizeMB * 1024 * 1024) / inputCount : 0;
const rowsLeft = perRow > 0 ? Math.round(((FAIL_MB - inputSizeMB) * 1024 * 1024) / perRow) : 0;
console.log(
  `Source of truth: ${inputSizeMB.toFixed(1)} MB of a ${FAIL_MB} MB ceiling ` +
    `(GitHub refuses a push over 100 MB) — room for about ${rowsLeft.toLocaleString('en-US')} more rows at ${Math.round(perRow)} bytes each.`
);
if (inputSizeMB > FAIL_MB) {
  console.error(`!! data/kosovo-retail.json is over the ${FAIL_MB} MB ceiling — \`npm run build\` will refuse. See docs/REFRESH.md §5.`);
} else if (inputSizeMB > WARN_MB) {
  console.warn(`!  data/kosovo-retail.json is past GitHub's ${WARN_MB} MB per-file warning. See docs/REFRESH.md §5.`);
}
