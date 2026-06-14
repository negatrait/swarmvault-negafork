const fs = require('fs');
const file = 'packages/engine/src/vault.ts';
let content = fs.readFileSync(file, 'utf8');

const search = '  const candidateResults = results.slice(0, Math.min(results.length, 20));';
const replace = '  const candidateLimit = Math.min(results.length, Math.max(limit * 2, 8), 20);\n  const candidateResults = results.slice(0, candidateLimit);';

if (content.includes(search)) {
    content = content.replace(search, replace);
    fs.writeFileSync(file, content);
    console.log('Patch applied successfully.');
} else {
    console.error('Search string not found.');
}
