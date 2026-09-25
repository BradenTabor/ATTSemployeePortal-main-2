// Serve two releases of the real production bundle, with an optional failed install.
// No database writes or external services are needed for these lifecycle checks.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const root = resolve('dist');
let release = 'A';
let failInstall = false;
let offline = false;
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:5190');
  if (url.pathname === '/__release') {
    release = url.searchParams.get('version') === 'B' ? 'B' : 'A';
    failInstall = url.searchParams.get('fail') === '1';
    offline = url.searchParams.get('offline') === '1';
    res.end('ok'); return;
  }
  res.setHeader('Cache-Control', 'no-store');
  if (offline) { res.writeHead(503).end(); return; }
  if (url.pathname === '/update-install-probe.txt') {
    res.statusCode = failInstall ? 503 : 200;
    res.end(release); return;
  }
  const path = resolve(root, `.${decodeURIComponent(url.pathname)}`);
  if (path !== root && !path.startsWith(`${root}/`)) { res.writeHead(403).end(); return; }
  try {
    let data;
    let extension = extname(path);
    if (url.pathname === '/sw.js') {
      data = (await readFile(path, 'utf8'))
        .replace(/"revision":"[^"]+","url":"index.html"/, `"revision":"release-${release}","url":"index.html"`);
      if (!data.includes(`"revision":"release-${release}"`)) throw new Error('Missing index precache entry');
      if (release === 'B') data = data.replace('"url":"index.html"}', '"url":"index.html"},{"revision":"B","url":"update-install-probe.txt"}');
      data += `\n// release ${release}\n`;
    } else {
      try { data = await readFile(path); }
      catch {
        if (extension) { res.writeHead(404).end(); return; }
        data = await readFile(resolve(root, 'index.html')); extension = '.html';
      }
      if (extension === '.html') data = data.toString().replace('<title>ATTS Employee Portal</title>', `<title>ATTS Release ${release}</title>`);
    }
    res.setHeader('Content-Type', types[extension] || 'application/octet-stream');
    res.end(data);
  } catch { res.writeHead(500).end(); }
}).listen(5190, '127.0.0.1');
