const { mkdirSync, cpSync, rmSync, writeFileSync } = require('fs');

const serverItems = [
  { src: 'apps/api', dest: 'server/apps/api' },
  { src: 'packages/core', dest: 'server/packages/core' },
  { src: 'packages/shared', dest: 'server/packages/shared' },
];
for (const { src, dest } of serverItems) {
  const targetDir = `dist/${dest}`;
  mkdirSync(targetDir, { recursive: true });
  cpSync(`${src}/dist`, `${targetDir}/dist`, { recursive: true });
  cpSync(`${src}/package.json`, `${targetDir}/package.json`);
  if (!src.includes('packages')) {
    rmSync(`${src}/dist`, { recursive: true, force: true });
  }
}

cpSync('pnpm-workspace.yaml', 'dist/server/pnpm-workspace.yaml');
writeFileSync(
  'dist/server/package.json',
  JSON.stringify({ name: 'vgm-server', private: true }, null, 2),
);
cpSync('.env', 'dist/server/.env');

mkdirSync('dist/web', { recursive: true });
cpSync('apps/web/dist', 'dist/web', { recursive: true });
rmSync('apps/web/dist', { recursive: true, force: true });

console.log('√ All dist synced');
