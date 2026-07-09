import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export function readModuleBundle(repoRoot, moduleName) {
  const manifestPath = path.join(repoRoot, moduleName, `${moduleName}.parts.json`);
  if (!existsSync(manifestPath)) {
    return readFileSync(path.join(repoRoot, moduleName, `${moduleName}.js`), 'utf8');
  }
  const parts = JSON.parse(readFileSync(manifestPath, 'utf8'));
  return parts
    .map((part) => readFileSync(path.join(repoRoot, moduleName, part), 'utf8'))
    .join('');
}
