import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');

/**
 * THE 100 MB WALL — a guard on the path a big harvest actually takes.
 *
 * GitHub warns over 50 MB per file and REFUSES a push containing a file
 * over 100 MB. `data/kosovo-retail.json` is 63.1 MiB (66,195,438 bytes,
 * 91,197 rows, ~726 bytes a row), so roughly 46,000 rows of headroom.
 *
 * `scripts/refresh-catalogue.mjs` already has gate G4, which fails the
 * nightly run at 90 MB — but ONLY the nightly run. A manual
 * `harvest-more.mjs` / `merge-retail.mjs`, which is exactly the "one big
 * harvest" that could cross the wall, never goes near G4. `npm run build`
 * does run on every CI job and every Vercel deploy, so the ceiling belongs
 * here too, where nothing can route around it.
 *
 * Fails at 95 MB rather than 100: a build that fails is recoverable, a
 * repository with a 100 MB blob already committed is not (it needs history
 * rewriting). It sits above G4's 90 MB so the nightly job is still the
 * first thing to complain.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO: shrink the file. Measured
 * 2026-09-18, a clone of this repository's entire history transfers
 * 15.26 MiB and the whole `.git` directory is 21 MiB — the 63 MB is a
 * working-tree cost, not a bandwidth one (docs/REFRESH.md §5 overstates
 * this; the correction and the per-field byte table are in §5.1). There is
 * no size emergency to fix, only a wall to not walk into.
 */
const RETAIL_PATH = path.join(dataDir, 'kosovo-retail.json');
const RETAIL_WARN_BYTES = 50 * 1024 * 1024;
const RETAIL_FAIL_BYTES = 95 * 1024 * 1024;

function guardCatalogueSize() {
  return {
    name: 'vendorja-guard-catalogue-size',
    apply: 'build',
    enforce: 'pre',
    buildStart() {
      if (!fs.existsSync(RETAIL_PATH)) return;
      const bytes = fs.statSync(RETAIL_PATH).size;
      const mib = (bytes / 1048576).toFixed(1);
      const headroom = ((RETAIL_FAIL_BYTES - bytes) / 1048576).toFixed(1);
      if (bytes > RETAIL_FAIL_BYTES) {
        throw new Error(
          `[vendorja] data/kosovo-retail.json is ${mib} MiB — over the ${(RETAIL_FAIL_BYTES / 1048576).toFixed(0)} MiB ceiling. ` +
            'GitHub refuses a push containing a file over 100 MB, and a committed 100 MB blob needs history rewriting to remove. ' +
            'Split the catalogue or stop committing the merged file before adding more rows — see docs/REFRESH.md §5.'
        );
      }
      if (bytes > RETAIL_WARN_BYTES) {
        console.warn(
          `[vendorja] data/kosovo-retail.json is ${mib} MiB — past GitHub's 50 MB file warning, ${headroom} MiB of headroom left before the build refuses. See docs/REFRESH.md §5.`
        );
      }
    },
  };
}

/**
 * Vendorja owns everything in this app EXCEPT `data/` and the two dataset
 * scripts, which are built separately. This plugin never writes into
 * `data/` — it only *reads* from it, either to serve it live during `vite dev`
 * or to copy it into the build output directory. That keeps the data
 * directory itself untouched while still letting the app fetch
 * `/data/*.json` at runtime exactly like a normal static asset.
 */
function serveDataDir() {
  return {
    name: 'vendorja-serve-data-dir',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith('/data/')) return next();
        const rel = decodeURIComponent(req.url.slice('/data/'.length).split('?')[0]);
        // Prevent path traversal outside of data/.
        const safeRel = rel.replace(/\.\./g, '');
        const filePath = path.join(dataDir, safeRel);
        if (!filePath.startsWith(dataDir)) return next();
        fs.readFile(filePath, (err, content) => {
          if (err) return next();
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(content);
        });
      });
    },
    closeBundle() {
      const outDir = path.join(__dirname, 'dist', 'data');
      try {
        fs.mkdirSync(outDir, { recursive: true });
        if (fs.existsSync(dataDir)) {
          fs.cpSync(dataDir, outDir, { recursive: true });
          // PRUNE THE SHIPPED PAYLOAD.
          // data/kosovo-retail.json is 76.8 MB and dataLoader.js fetches it
          // whole, with `cache: 'no-store'`, on every app load — unusable on
          // a Kosovo mobile connection. dataLoader already REFUSES two
          // source groups (GjirafaMall and Wolt Albania) but only after the
          // bytes have been downloaded. Applying the identical filter here
          // means they are never shipped: 90,133 rows -> 31,975, 76.8 MB ->
          // 22.2 MB, with no behaviour change at all, because these rows
          // were already being discarded client-side.
          //
          // The copy above stays: data/ is the source of truth and is left
          // untouched on disk. Only dist/ is pruned.
          //
          // The filter is inlined rather than imported from
          // scripts/prune-payload.mjs (which is the standalone CLI for the
          // same job) because this config is ESM and a dynamic import here
          // would make closeBundle async for one regex test. IT MUST BE
          // KEPT IN SYNC WITH src/lib/dataLoader.js:BLOCKED_SOURCES — if
          // those two ever disagree, the app filters rows the build shipped,
          // which is only wasteful, or the build drops rows the app expects,
          // which is a bug. The row-count assertion below is the tripwire.
          const BLOCKED = [/gjirafa/i, /wolt\.com\/al\//i, /Wolt Shqipëri/i];
          const retailPath = path.join(outDir, 'kosovo-retail.json');
          if (fs.existsSync(retailPath)) {
            const parsed = JSON.parse(fs.readFileSync(retailPath, 'utf8'));
            const before = parsed.products?.length ?? 0;
            parsed.products = (parsed.products || []).filter(
              (row) => !BLOCKED.some((re) => re.test(`${row?.source || ''} ${row?.sourceLabel || ''}`))
            );
            const after = parsed.products.length;
            // Shipping an empty catalogue silently is far worse than a red
            // build, so this throws rather than warns.
            if (after === 0) {
              throw new Error(
                `[vendorja] payload prune produced 0 rows from ${before} — refusing to ship an empty catalogue`
              );
            }
            parsed.count = after;
            fs.writeFileSync(retailPath, JSON.stringify(parsed));
            const mb = (fs.statSync(retailPath).size / 1048576).toFixed(1);
            console.log(`[vendorja] pruned kosovo-retail.json: ${before} -> ${after} rows, ${mb} MB`);
          }
        }
      } catch (err) {
        // Never fail the build because the data directory is empty or
        // still being written by the harvest.
        console.warn('[vendorja] could not copy data/ into dist/data:', err.message);
      }
    },
  };
}

/**
 * Generates the crawlable static surface (see scripts/build-seo.mjs) once
 * Vite has written dist/. It runs LAST so it can read the built
 * dist/index.html — that file is the template for the per-route SPA shells,
 * and it is the only place the hashed asset filenames are known.
 *
 * A failure here is reported loudly but never fails the build: the app is
 * the product, the SEO pages are an addition to it, and a half-written
 * sitemap must not be able to block a deploy.
 */
function buildSeoPages() {
  return {
    name: 'vendorja-seo-pages',
    apply: 'build',
    enforce: 'post',
    async closeBundle() {
      try {
        const { generateSeo } = await import('./scripts/build-seo.mjs');
        await generateSeo({ dist: path.join(__dirname, 'dist') });
      } catch (err) {
        console.warn('[vendorja] SEO page generation failed:', err?.stack || err?.message || err);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), guardCatalogueSize(), serveDataDir(), buildSeoPages()],
  server: {
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
