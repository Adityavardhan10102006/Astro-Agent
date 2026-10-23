const fs = require('fs');
const path = require('path');

const files = fs.readdirSync('tests').filter(f => f.endsWith('.test.js'));
let total = 0;
for (const file of files) {
  const content = fs.readFileSync(path.join('tests', file), 'utf8');
  const matches = [...content.matchAll(/(?:test|it)\(\s*['"`]([^'"`]+)['"`]/g)].map(m => m[1]);
  console.log(`${file.padEnd(42)} -> ${matches.length}`);
  total += matches.length;
}
console.log('Total identified tests:', total);
