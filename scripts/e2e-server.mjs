import { execFileSync, spawn } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temp = mkdtempSync(resolve(tmpdir(), 'tripplanner-e2e-'));
try {
  execFileSync('npm', ['--prefix', 'client', 'run', 'build'], { cwd: root, stdio: 'inherit' });
  execFileSync('dotnet', ['publish', 'server/server.csproj', '-c', 'Release', '-o', resolve(temp, 'app'), '-p:UseSharedCompilation=false'], { cwd: root, stdio: 'inherit' });
  mkdirSync(resolve(temp, 'app/wwwroot'), { recursive: true });
  cpSync(resolve(root, 'client/dist'), resolve(temp, 'app/wwwroot'), { recursive: true });
  const child = spawn('dotnet', ['server.dll'], { cwd: resolve(temp, 'app'), stdio: 'inherit', env: {
    ...process.env, ASPNETCORE_ENVIRONMENT: 'Development', ASPNETCORE_URLS: 'http://127.0.0.1:4179',
    ConnectionStrings__TripPlanner: `Data Source=${resolve(temp, 'e2e.db')}`,
    Hosting__DataProtectionPath: resolve(temp, 'keys'), Notifications__DisableWorker: 'true', PasswordReset__DisableWorker: 'true',
  }});
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  child.on('exit', code => { rmSync(temp, { recursive: true, force: true }); process.exit(code ?? 0); });
} catch (error) { rmSync(temp, { recursive: true, force: true }); throw error; }
