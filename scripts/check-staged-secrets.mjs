import { execFileSync } from 'node:child_process';

function getStagedPaths() {
  const output = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  return output
    .split(/\r?\n/)
    .map((line) => line.trim().replaceAll('\\', '/'))
    .filter(Boolean);
}

const blockedMatchers = [
  {
    matches: (path) => path === 'credentials.json',
    reason: 'root Expo credentials.json contains Android signing secrets',
  },
  {
    matches: (path) => path.startsWith('credentials/'),
    reason: 'credentials/ stores local signing material',
  },
  {
    matches: (path) => /\.(jks|p8|p12|key|mobileprovision)$/i.test(path),
    reason: 'private signing material must not be committed',
  },
];

const blocked = getStagedPaths()
  .map((path) => {
    const matcher = blockedMatchers.find((candidate) => candidate.matches(path));
    return matcher ? { path, reason: matcher.reason } : null;
  })
  .filter(Boolean);

if (blocked.length > 0) {
  console.error('Blocked commit: staged signing credentials were detected.');
  console.error('');

  for (const entry of blocked) {
    console.error(`- ${entry.path}: ${entry.reason}`);
  }

  console.error('');
  console.error('Move signing files outside the repository or into managed credentials, then unstage them.');
  console.error('If you force-added one of these files, run: git restore --staged <path>');
  process.exit(1);
}
