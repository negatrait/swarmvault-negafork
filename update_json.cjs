const fs = require('fs');

const data = JSON.parse(fs.readFileSync('docs/PORTING_PROGRESS.json', 'utf8'));
const file = data.files.find(f => f.path === 'src/graph-interchange.ts');
if (file) {
    file.status = 'bridged';
    file.bridged = true;
    file.subcommand = 'graph';
} else {
    console.error("File not found in JSON");
}

fs.writeFileSync('docs/PORTING_PROGRESS.json', JSON.stringify(data, null, 2));
