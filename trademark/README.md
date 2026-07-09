# Trademark Frontend Structure

`trademark.js` is a compatibility loader. Feature code lives in `trademark/modules/` and is loaded in the order listed by `trademark.parts.json`.

## Modules

1. `00-core-dashboard-crud.js` - `window.TM`, state, init, settings, dashboard, project CRUD, workspace shell, shared utilities
2. `01-application-steps-search.js` - application steps 1-4, goods editing, KIPRIS search and similarity evaluation
3. `02-risk-priority-output.js` - risk, fees, priority examination, document/output steps
4. `03-ai-analysis-reports.js` - AI business analysis, Vienna/code helpers, goods recommendation, report generation

Keep `trademark.parts.json` in load order. `trademark.js` supports both parser-time loading and the dynamic loader used by `index.html`.
