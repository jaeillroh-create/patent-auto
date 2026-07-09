# Opinion Frontend Structure

`opinion.js` is a compatibility loader. Feature code lives in `opinion/modules/` and is loaded in the order listed by `opinion.parts.json`.

## Modules

1. `00-state-review-template.js` - namespace, constants, state, review integration, rewrite flow, templates
2. `01-projects-navigation.js` - project list, create/delete/open, detail view, pipeline navigation
3. `02-upload-files.js` - upload UI, file roles, file rendering, usage display
4. `03-parse-type.js` - file text extraction, parsing, parsed view, rejection type determination
5. `04-analysis-gates.js` - discussion rendering, analysis, gates, strategy UI
6. `05-draft-validation-opinion.js` - draft, validation, opinion drafting, contamination controls
7. `06-output-data-json.js` - output view, downloads, data loading/status, JSON helpers

Keep `opinion.parts.json` in load order. Tests should use `readModuleBundle(repoRoot, 'opinion')` when they need the old monolithic source.
