import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { config, ensureDataDirs } from './src/core/config.js';
import { bootstrapDropins } from './src/bootstrap.js';
import { runWorkflow } from './src/core/workflow-runner.js';
import { youtubeToTranscriptWorkflow } from './src/workflows/transcript/youtube-to-transcript.js';
import { listSources, listDestinations, listProcessors } from './src/core/capability-registry.js';
import { getRuntimeDiagnostics } from './src/core/runtime-diagnostics.js';
import { loadUserConfig, saveUserDefaults } from './src/core/user-config.js';

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
        processors: listProcessors(),
        workflows: ['youtube-to-transcript'],
        diagnostics: getRuntimeDiagnostics(),
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/reveal') {
      const body = await readBody(req);
      const { path: filePath } = JSON.parse(body);
      return revealInFileManager(res, filePath);
    }

    if (req.method === 'GET' && url.pathname === '/api/config') {
      const { defaults, exists, source, migration } = loadUserConfig();
      return json(res, 200, { defaults, exists, source, migration });
    }

    if (req.method === 'POST' && url.pathname === '/api/config/defaults') {
      const body = await readBody(req);
      const input = JSON.parse(body);
      try {
        const saved = saveUserDefaults(input.defaults ?? input);
        return json(res, 200, {
          success: true,
          defaults: saved.defaults,
          message: 'Defaults saved',
        });
      } catch (err) {
        return json(res, 422, { success: false, error: err.message || String(err) });
      }
    }

    if (req.method === 'POST' && url.pathname === '/api/workflows/transcript') {
      const body = await readBody(req);
      const input = JSON.parse(body);
      const stream = req.headers.accept === 'application/x-ndjson';

      if (stream) {
        return streamWorkflow(res, input);
      }

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

async function streamWorkflow(res, input) {
  res.writeHead(200, {
    'Content-Type': 'application/x-ndjson',
    'Transfer-Encoding': 'chunked',
    'Cache-Control': 'no-cache',
  });

  const writeEvent = (event) => {
    res.write(JSON.stringify(event) + '\n');
  };

  try {
    const result = await runWorkflow(youtubeToTranscriptWorkflow, input, {
      onProgress: (stage, message) => {
        writeEvent({ type: 'progress', stage, message });
      },
    });

    writeEvent({ type: 'complete', ...result });
  } catch (err) {
    writeEvent({ type: 'error', error: err.message || String(err) });
  }

  res.end();
}

server.listen(config.port, () => {
  console.log(`Socket running at http://localhost:${config.port}`);
  console.log('Drop-ins: youtube (source), obsidian (destination), local_whisper (processor)');
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

function revealInFileManager(res, filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return json(res, 422, { success: false, error: 'path is required' });
  }

  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    return json(res, 404, { success: false, error: 'File not found' });
  }

  if (process.platform !== 'darwin') {
    return json(res, 501, {
      success: false,
      error: 'Reveal in file manager is only supported on macOS',
      path: resolved,
    });
  }

  return new Promise((resolve) => {
    const proc = spawn('open', ['-R', resolved], { stdio: 'ignore' });
    proc.on('close', (code) => {
      if (code === 0) {
        json(res, 200, { success: true, path: resolved });
      } else {
        json(res, 500, { success: false, error: `open exited with code ${code}` });
      }
      resolve();
    });
    proc.on('error', (err) => {
      json(res, 500, { success: false, error: err.message });
      resolve();
    });
  });
}