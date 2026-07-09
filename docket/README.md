# Docket Frontend Structure

`docket.js` is a compatibility loader. Feature code lives in `docket/modules/` and is loaded in the order listed by `docket.parts.json`.

## Modules

1. `00-config-fees.js` - namespace, configuration, database-specific templates, fee schedules and defaults
2. `01-init-ui-handlers.js` - initialization, UI event handlers, notes textarea behavior
3. `02-fee-calculation.js` - fee calculation, government fee resolution, selection state
4. `03-data-email.js` - form collection, email subject/body generation
5. `04-excel-template.js` - XML/XLSX helpers and template expansion
6. `05-send-preview-reset.js` - Excel download, email sending, preview modal, reset

Keep `docket.parts.json` in load order.
