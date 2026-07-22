/*
 * patent/patent.js
 * Compatibility loader for the split patent module files.
 * Keep this file small; edit feature code under patent/modules/.
 */
(function(){
  var parts = [
    'modules/00-state-and-concepts.js',
    'modules/01-projects-dashboard.js',
    'modules/02-invention-scope.js',
    'modules/03-editor-ui.js',
    'modules/04-input-prompts-kipris.js',
    'modules/05-step-execution.js',
    'modules/06-parsers-math.js',
    'modules/07-diagram-engine.js',
    'modules/08-render-output.js',
    'modules/09-review-engine.js'
  ];
  var version = '20260722-b47';
  if (typeof document === 'undefined' || typeof document.write !== 'function') return;
  for (var i = 0; i < parts.length; i++) {
    document.write('<script src="patent/' + parts[i] + '?v=' + version + '"><\/script>');
  }
})();