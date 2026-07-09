# Patent Frontend Structure

`patent.js` is a compatibility loader. Feature code lives in `patent/modules/` and is loaded in the order listed by `patent.parts.json`.

## Load Order

1. `00-state-and-concepts.js` - shared state, constants, concept/output history helpers
2. `01-projects-dashboard.js` - dashboard, project CRUD, global references, provisional viewer
3. `02-invention-scope.js` - invention scope checks, judgment UI, baseline/drift helpers
4. `03-editor-ui.js` - editor tabs, toggles, user figures, concept UI, dependency helpers
5. `04-input-prompts-kipris.js` - file upload, prompts, KIPRIS, diagram prompt utilities
6. `05-step-execution.js` - step execution, review/apply flow, batch/provisional flow
7. `06-parsers-math.js` - parsers, math insertion, reference-number helpers
8. `07-diagram-engine.js` - unified diagram layout/render/validation/download/PPTX
9. `08-render-output.js` - output renderers, preview, Word/download helpers
10. `09-review-engine.js` - `window.Patent` exports, review integration, direction rewrite, init

## Editing Rules

- Keep `patent.parts.json` in browser load order whenever a module is added or moved.
- Keep `patent/patent.js` small; do not put feature logic back into the loader.
- Tests that need the old monolithic source should use `readPatentBundle(...)`, which concatenates the parts in manifest order.
- Top-level declarations are intentionally loaded as classic scripts, so later modules can reference earlier module bindings.
