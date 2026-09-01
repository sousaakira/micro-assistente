const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const binPath = path.join(rootDir, 'main');

const loadDotEnv = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = String(line || '').trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === '') {
      process.env[key] = value;
    }
  }
};

loadDotEnv(path.join(rootDir, '.env'));

if (!fs.existsSync(binPath)) {
  console.error('[whatsmeow-api] Binário não encontrado em:', binPath);
  process.exit(1);
}

const run = () => {
  const child = spawn(binPath, [], { cwd: rootDir, env: process.env, stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code || 0));
  return child;
};

const child = run();

process.on('SIGINT', () => child && child.kill('SIGINT'));
process.on('SIGTERM', () => child && child.kill('SIGTERM'));
