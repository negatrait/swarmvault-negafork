const fs = require('fs');

const file = 'cmd/swarmvault-native/main.go';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('case "agents":')) {
    code = code.replace(`default:\n\t\t\tfmt.Fprintf(os.Stderr, "Unknown command\\n")`, `case "agents":\n\t\t\thandleAgents()\n\n\t\tdefault:\n\t\t\tfmt.Fprintf(os.Stderr, "Unknown command\\n")`);
}

fs.writeFileSync(file, code);
