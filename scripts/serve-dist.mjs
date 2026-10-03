// Local stand-in for the vercel.json routing (cleanUrls + the /b rewrite),
// used only to verify the generated pages before a deploy.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const DIST = path.resolve('dist');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

http
  .createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let file = null;
    const cands = [
      url === '/' ? '/index.html' : url,
      url + '.html',
      url.replace(/\/$/, '') + '/index.html',
    ];
    if (/^\/b\/\d{8,14}$/.test(url)) cands.unshift('/b.html');
    for (const c of cands) {
      const f = path.join(DIST, c);
      if (f.startsWith(DIST) && fs.existsSync(f) && fs.statSync(f).isFile()) {
        file = f;
        break;
      }
    }
    if (!file) {
      const nf = path.join(DIST, '404.html');
      res.writeHead(404, { 'Content-Type': TYPES['.html'] });
      res.end(fs.existsSync(nf) ? fs.readFileSync(nf) : 'not found');
      return;
    }
    const body = fs.readFileSync(file);
    const type = TYPES[path.extname(file)] || 'application/octet-stream';
    const accepts = String(req.headers['accept-encoding'] || '');
    const compressible = /text|json|xml|javascript|svg/.test(type);
    if (compressible && accepts.includes('br')) {
      const out = zlib.brotliCompressSync(body);
      res.writeHead(200, { 'Content-Type': type, 'Content-Encoding': 'br', 'Content-Length': out.length });
      res.end(out);
      return;
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': body.length });
    res.end(body);
  })
  .listen(4180, () => console.log('serving dist on http://localhost:4180'));
