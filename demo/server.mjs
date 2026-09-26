import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const scenario = process.env.DEMO_SCENARIO ?? 'baseline';
const port = Number(process.env.DEMO_PORT ?? 4173);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

function resolve(urlPath) {
  const relative = normalize(urlPath === '/' ? '/index.html' : urlPath).replace(/^(\.\.[/\\])+/, '');
  const overlay = join(root, 'candidate', relative);
  if (scenario === 'candidate' && existsSync(overlay)) {
    return overlay;
  }
  return join(root, 'app', relative);
}

createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  if (url.pathname === '/api/health') {
    response.writeHead(200, { 'content-type': 'application/json' }).end('{"status":"ok"}');
    return;
  }
  const file = resolve(url.pathname);
  if (!existsSync(file)) {
    response.writeHead(404).end('not found');
    return;
  }
  response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
}).listen(port, () => {
  process.stdout.write(`demo app (${scenario}) on http://localhost:${port}\n`);
});
