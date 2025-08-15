// scripts/fix-history-imports.js
const fs = require('fs');
const path = require('path');

const exts = new Set(['.js', '.mjs', '.cjs', '.ts']);
function walk(dir, files=[]) {
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    const st = fs.statSync(p);
    if (st.isDirectory() && !['node_modules', '.git', 'dist', 'build'].includes(entry)) walk(p, files);
    else if (exts.has(path.extname(p))) files.push(p);
  }
  return files;
}

const files = walk(process.cwd());
let changed = 0;

const patterns = [
  /require\((['"`])(\.\.\/|\.\/)?models\/historicalGame\1\)/g,
  /from\s+(['"`])(\.\.\/|\.\/)?models\/historicalGame\1/g,
];

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  let out = src;
  for (const re of patterns) out = out.replace(re, (m, q, rel='') => m.replace('historicalGame', 'historyGame'));
  if (out !== src) {
    fs.writeFileSync(f, out, 'utf8');
    changed++;
    console.log('Updated', f);
  }
}
console.log(`Done. Updated ${changed} file(s).`);
