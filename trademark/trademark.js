/*
 * trademark/trademark.js
 * Compatibility loader for the split trademark module files.
 * Keep this file small; edit feature code under trademark/modules/.
 */
(function(){
  var parts = [
    'modules/00-core-dashboard-crud.js',
    'modules/01-application-steps-search.js',
    'modules/02-risk-priority-output.js',
    'modules/03-ai-analysis-reports.js'
];
  var version = '20260814j';
  var prefix = 'trademark/';

  function writeScripts() {
    for (var i = 0; i < parts.length; i++) {
      document.write('<script src="' + prefix + parts[i] + '?v=' + version + '"><\/script>');
    }
  }

  function appendSequentially(index) {
    if (index >= parts.length) {
      try { window.dispatchEvent(new CustomEvent('trademark:modules-loaded')); } catch (_e) {}
      return;
    }
    var script = document.createElement('script');
    script.src = prefix + parts[index] + '?v=' + version;
    script.async = false;
    script.onload = function(){ appendSequentially(index + 1); };
    script.onerror = function(){ console.error('[trademark] failed to load module', parts[index]); appendSequentially(index + 1); };
    (document.head || document.body || document.documentElement).appendChild(script);
  }

  if (typeof document === 'undefined') return;
  if (document.readyState === 'loading' && typeof document.write === 'function') {
    writeScripts();
  } else {
    appendSequentially(0);
  }
})();
