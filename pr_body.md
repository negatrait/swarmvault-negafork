*   🎯 **Target:** Port the stateless utility file `packages/engine/src/large-repo-defaults.ts` to Go.
*   💡 **Rationale:** This file is a pure leaf node and its entire contents (around 100 lines) will be ported in a single run. The physical audit of the Go codebase revealed NO stubs, TODOs, fakes or mocks. We are cleared to progress according to Scenario A of the migration decision tree.
*   🛡️ **Boundaries:** Explicit confirmation that zero stubs or mocks are required for this run, and that Go-to-Go calls will be imported natively.
*   ✨ **Expected Parity:** Input/Output schema must match structurally 1:1. Unit tests must run the exact same JSON test fixtures in `/shared-fixtures` across both TS and Go to verify identical output.
