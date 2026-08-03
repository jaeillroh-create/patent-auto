import { readFileSync } from 'node:fs';
import path from 'node:path';

export function readTrademarkBundle(repoRoot) {
  const manifestPath = path.join(repoRoot, 'trademark', 'trademark.parts.json');
  const parts = JSON.parse(readFileSync(manifestPath, 'utf8'));
  return parts
    .map((part) => readFileSync(path.join(repoRoot, 'trademark', part), 'utf8'))
    .join('');
}
