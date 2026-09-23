// Runs the data pipeline only if it exists (it is owned by the data-pipeline worker).
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

if (existsSync(new URL('./build-data.mjs', import.meta.url))) {
  const r = spawnSync(process.execPath, ['scripts/build-data.mjs', '--lenient'], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
} else {
  console.log('[build] scripts/build-data.mjs not found — using committed public/data');
}
