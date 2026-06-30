import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');

export const config = {
  projectRoot: PROJECT_ROOT,
  port: Number(process.env.SOCKET_PORT) || 3847,
  dataDir: path.join(PROJECT_ROOT, 'data'),
  runsDir: path.join(PROJECT_ROOT, 'data', 'runs'),
  tmpDir: path.join(PROJECT_ROOT, 'data', 'tmp'),
  publicDir: path.join(PROJECT_ROOT, 'public'),
};

export function ensureDataDirs() {
  fs.mkdirSync(config.runsDir, { recursive: true });
  fs.mkdirSync(config.tmpDir, { recursive: true });
}