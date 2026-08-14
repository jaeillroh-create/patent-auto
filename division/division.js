/*
 * division/division.js
 * Compatibility loader for the split division module files.
 * Keep this file small; edit feature code under division/modules/.
 */
(function(){
  var parts = [
    'modules/00-state-writer-utils.js',
    'modules/01-projects-detail.js',
    'modules/02-pipeline-upload-files.js',
    'modules/03-parse.js',
    'modules/04-analysis-selection.js',
    'modules/05-assemble-verify-core.js',
    'modules/06-verify-final-utils.js'
];
  var version = '20260814j';
  var prefix = 'division/';

  function writeScripts() {
    for (var i = 0; i < parts.length; i++) {
      document.write('<script src="' + prefix + parts[i] + '?v=' + version + '"><\/script>');
    }
  }

  function appendSequentially(index) {
    if (index >= parts.length) {
      try { window.dispatchEvent(new CustomEvent('division:modules-loaded')); } catch (_e) {}
      return;
    }
    var script = document.createElement('script');
    script.src = prefix + parts[index] + '?v=' + version;
    script.async = false;
    script.onload = function(){ appendSequentially(index + 1); };
    script.onerror = function(){ console.error('[division] failed to load module', parts[index]); appendSequentially(index + 1); };
    (document.head || document.body || document.documentElement).appendChild(script);
  }

  if (typeof document === 'undefined') return;
  if (document.readyState === 'loading' && typeof document.write === 'function') {
    writeScripts();
  } else {
    appendSequentially(0);
  }
})();
