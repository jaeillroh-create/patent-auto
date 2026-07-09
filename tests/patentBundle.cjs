const fs = require('fs');
const path = require('path');

function readPatentBundle(repoRoot) {
  const manifestPath = path.join(repoRoot, 'patent', 'patent.parts.json');
  const parts = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  return parts
    .map((part) => fs.readFileSync(path.join(repoRoot, 'patent', part), 'utf8'))
    .join('');
}

module.exports = { readPatentBundle };
