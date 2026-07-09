import { readFileSync } from 'node:fs';
import path from 'node:path';

export function readPatentBundle(repoRoot) {
  const manifestPath = path.join(repoRoot, 'patent', 'patent.parts.json');
  const parts = JSON.parse(readFileSync(manifestPath, 'utf8'));
  return parts
    .map((part) => readFileSync(path.join(repoRoot, 'patent', part), 'utf8'))
    .join('');
}
