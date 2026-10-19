// Starts the dev server for end-to-end tests with a fresh, throwaway local D1 database.
import { execSync, spawn } from 'node:child_process';
import { copyFileSync, existsSync, rmSync } from 'node:fs';

const STATE = '.wrangler/e2e-state';
const PORT = process.env.E2E_PORT ?? '5199';

rmSync(STATE, { recursive: true, force: true });
if (!existsSync('.dev.vars')) copyFileSync('.dev.vars.example', '.dev.vars');

execSync(`npx wrangler d1 migrations apply spaced-learning --local --persist-to ${STATE}`, {
  stdio: 'inherit',
  env: { ...process.env, CI: '1' },
});

const server = spawn('npx', ['vite', '--port', PORT, '--strictPort'], {
  stdio: 'inherit',
  env: { ...process.env, E2E_STATE: STATE },
});
const stop = () => server.kill('SIGTERM');
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
server.on('exit', (code) => process.exit(code ?? 0));
