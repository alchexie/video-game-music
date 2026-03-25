import { closeDatabase, commitLibrary, getDatabase, loadConfig, loadWorkspaceEnv } from '@vgm/core';

loadWorkspaceEnv(process.cwd());
const config = loadConfig(process.env, process.cwd());

function formatImportProgress(event: import('@vgm/shared').ImportProgressEvent) {
  const progress = event.total ? ` ${event.processed ?? 0}/${event.total}` : '';
  const elapsed = typeof event.elapsedMs === 'number' ? ` (${Math.round(event.elapsedMs / 1000)}s)` : '';
  return `[import:${event.phase}]${progress}${elapsed} ${event.message}`;
}

async function main() {
  const context = await getDatabase(config);
  const summary = await commitLibrary(context, {
    ...config,
    onImportProgress: (event) => console.log(formatImportProgress(event)),
  });
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
