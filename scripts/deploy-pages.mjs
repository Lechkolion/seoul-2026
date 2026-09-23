// Build the app and publish dist/ to the gh-pages branch (GitHub Pages "deploy from branch").
import { execSync } from 'node:child_process';
import { mkdtempSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sh = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit' });
const remote = execSync('git remote get-url origin').toString().trim();

sh('npm run build:app');
const dir = mkdtempSync(join(tmpdir(), 'ghpages-'));
cpSync('dist', dir, { recursive: true });
writeFileSync(join(dir, '.nojekyll'), '');
sh('git init -q -b gh-pages', dir);
sh('git add -A', dir);
sh('git -c user.name=Lechkolion -c user.email=Lechkolion@users.noreply.github.com commit -q -m "Deploy site"', dir);
sh(`git push -f ${remote} gh-pages`, dir);
rmSync(dir, { recursive: true, force: true });
console.log('Deployed to gh-pages.');
