🎯 **What:** The testing gap addressed in `parseStoredPage`.
📊 **Coverage:** Added coverage for three new edge cases:
- Validation that `compiledFrom` falls back to `sourceIds` when not provided.
- Validation that kind-specific fields (e.g. `tier`, `outputFormat`) are ignored and left `undefined` if the page is of a different kind.
- Validation that empty string fields (like `superseded_by`) are handled gracefully.
✨ **Result:** Increased edge-case test coverage for the `parseStoredPage` normalizer.

Tests pass and linter issues were auto-fixed via pre-commit.
