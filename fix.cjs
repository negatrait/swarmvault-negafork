const fs = require('fs');

const tsPath = 'packages/engine/src/vault.ts';
let ts = fs.readFileSync(tsPath, 'utf8');

const regex = /  for \(const entry of selectedEntries\) \{[\s\S]*?entry\.status = "accepted";\n  \}/;

const newLoop = `  for (const entry of selectedEntries) {
    const { nextPage, deletedPage } = await syncStagedEntry(paths, approvalId, entry, bundleGraph);
    if (nextPage) {
      nextPages = nextPages.filter(
        (page) => page.id !== entry.pageId && page.path !== entry.nextPath && (!entry.previousPath || page.path !== entry.previousPath)
      );
      nextPages.push(nextPage);
      updateCandidateHistory(compileState, nextPage);
    } else {
      nextPages = nextPages.filter((page) => page.id !== entry.pageId && page.path !== entry.previousPath);
      updateCandidateHistory(compileState, deletedPage ?? null, true);
    }
    entry.status = "accepted";
  }`;

if (ts.match(regex)) {
    ts = ts.replace(regex, newLoop);
    fs.writeFileSync(tsPath, ts);
    console.log("Replaced!");
} else {
    console.log("Could not find loop to replace");
}
