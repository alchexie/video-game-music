import { closeDatabase, getDatabase, loadConfig, loadWorkspaceEnv, pruneCosOrphans, uploadMediaToCos } from '@vgm/core';

const command = process.argv[2] ?? 'upload';
loadWorkspaceEnv(process.cwd());

async function main() {
  const config = loadConfig(process.env, process.cwd());
  const context = await getDatabase(config);

  if (command === 'upload') {
    const summary = await uploadMediaToCos(context, config);
    console.log(JSON.stringify(summary, null, 2));
  } else if (command === 'prune') {
    const summary = await pruneCosOrphans(context, config);
    console.log(JSON.stringify(summary, null, 2));
  } else {
    throw new Error(`Unsupported command: ${command}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
