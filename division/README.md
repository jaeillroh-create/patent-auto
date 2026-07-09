# Division Frontend Structure

`division.js` is a compatibility loader. Feature code lives in `division/modules/` and is loaded in the order listed by `division.parts.json`.

## Modules

1. `00-state-writer-utils.js` - namespace, constants, state, writer exports, shared parsing/diff utilities
2. `01-projects-detail.js` - project list, create/delete/open, detail rendering, type switching
3. `02-pipeline-upload-files.js` - pipeline shell, upload/direct input, file classification and upload
4. `03-parse.js` - parsing checkpoint, parse prompt, parse result UI
5. `04-analysis-selection.js` - analysis checkpoint, support checks, component selection UI
6. `05-assemble-verify-core.js` - claim assembly, verification core, auto-verification
7. `06-verify-final-utils.js` - verification UI, edits/reverify, final confirmation/output, utilities

Keep `division.parts.json` in load order. Tests should use `readModuleBundle(repoRoot, 'division')` when they need the old monolithic source.
