import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'dotenv';

const initialEnvKeys = new Set(Object.keys(process.env));

function loadBackendEnv(options?: { includeLocalOverride?: boolean }) {
  const backendRoot = path.resolve(__dirname, '..');
  const envFiles = [path.join(backendRoot, '.env')];

  if (options?.includeLocalOverride) {
    envFiles.push(path.join(backendRoot, '.env.local'));
  }

  for (const envFile of envFiles) {
    if (!fs.existsSync(envFile)) {
      continue;
    }

    const parsed = parse(fs.readFileSync(envFile, 'utf8'));
    for (const [key, value] of Object.entries(parsed)) {
      if (!initialEnvKeys.has(key)) {
        process.env[key] = value;
      }
    }
  }
}

loadBackendEnv({ includeLocalOverride: true });

void (async () => {
  const [{ createApp }, { serverConfig }, { warmBackendStorefrontSource }] = await Promise.all([
    import('./app'),
    import('./config'),
    import('./sources'),
  ]);

  const app = createApp();

  await warmBackendStorefrontSource();

  app.listen(serverConfig.port, () => {
    console.log(`CanopyTrove backend listening on http://localhost:${serverConfig.port}`);
  });
})();
