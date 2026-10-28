import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
// Windows의 python3는 스토어 안내 창일 수 있어 python을 쓴다.
const PYTHON = process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');

export function runSeed(dbPath, rows) {
  return new Promise((resolve, reject) => {
    const script = join(ROOT, 'scripts/bench/seed_synthetic.py');
    const child = spawn(PYTHON, [script, '--db', dbPath, '--rows', String(rows)]);
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk) => (out += chunk));
    child.stderr.on('data', (chunk) => (err += chunk));
    child.on('close', (code) => (code === 0 ? resolve(JSON.parse(out)) : reject(new Error(`seed 실패: ${err}`))));
  });
}

// 포트 0이면 서비스가 빈 포트를 잡고 runtime.json에 적는다.
export async function startCore(homeDir, dbPath) {
  const env = { ...process.env, HELPER_HOME: homeDir, HELPER_DB: dbPath, HELPER_PORT: '0' };
  const child = spawn(PYTHON, ['-m', 'core.service'], { cwd: ROOT, env, stdio: 'ignore' });
  const runtimeFile = join(homeDir, 'runtime.json');
  for (let waited = 0; !existsSync(runtimeFile); waited += 50) {
    if (waited > 10000) throw new Error('코어가 10초 안에 뜨지 않았다');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const { port, token } = JSON.parse(readFileSync(runtimeFile, 'utf-8'));
  return { connection: { baseUrl: `http://127.0.0.1:${port}`, token }, stop: () => child.kill() };
}

export async function coreGet(connection, path) {
  const response = await fetch(connection.baseUrl + path, {
    headers: { Authorization: `Bearer ${connection.token}`, 'X-Schema-Version': '1' },
  });
  if (!response.ok) throw new Error(`${path} → HTTP ${response.status}`);
  return response.json();
}
