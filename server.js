import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, ensureDataDirs } from './src/core/config.js';
import { bootstrapDropins } from './src/bootstrap.js';
import { runWorkflow } from './src/core/workflow-runner.js';
import { youtubeToTranscriptWorkflow } from './src/workflows/transcript/youtube-to-transcript.js';
import { listSources, listDestinations } from './src/core/capability-registry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

bootstrapDropins();
ensureDataDirs();

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${config.port}`);

  try {
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return json(res, 200, {
        ok: true,
        sources: listSources(),
        destinations: listDestinations(),
        workflows: ['youtube-to-transcript'],
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/workflows/transcript') {
      const body = await readBody(req);
      const input = JSON.parse(body);
      const result = await runWorkflow(youtubeToTranscriptWorkflow, input);
      const status = result.success ? 200 : 422;
      return json(res, status, result);
    }

    if (req.method === 'GET') {
      return serveStatic(req, res, url.pathname);
    }

    json(res, 404, { error: 'Not found' });
  } catch (err) {
    json(res, 500, { success: false, error: err.message || String(err) });
  }
});

server.listen(config.port, () => {
  console.log(`Socket running at http://localhost:${config.port}`);
  console.log('Drop-ins: youtube (source), obsidian (destination)');
});

function serveStatic(req, res, pathname) {
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(config.publicDir, filePath);

  if (!filePath.startsWith(config.publicDir)) {
    return json(res, 403, { error: 'Forbidden' });
  }

  if (!fs.existsSync(filePath)) {
    return json(res, 404, { error: 'Not found' });
  }

  const ext = path.extname(filePath);
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  res.end(content);
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}