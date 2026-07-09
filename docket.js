/*
 * docket.js
 * Compatibility loader for the split docket module files.
 * Keep this file small; edit feature code under docket/modules/.
 */
(function(){
  var parts = [
    'modules/00-config-fees.js',
    'modules/01-init-ui-handlers.js',
    'modules/02-fee-calculation.js',
    'modules/03-data-email.js',
    'modules/04-excel-template.js',
    'modules/05-send-preview-reset.js'
];
  var version = '20260701-split';
  var prefix = 'docket/';

  function writeScripts() {
    for (var i = 0; i < parts.length; i++) {
      document.write('<script src="' + prefix + parts[i] + '?v=' + version + '"><\/script>');
    }
  }

  function appendSequentially(index) {
    if (index >= parts.length) {
      try { window.dispatchEvent(new CustomEvent('docket:modules-loaded')); } catch (_e) {}
      return;
    }
    var script = document.createElement('script');
    script.src = prefix + parts[index] + '?v=' + version;
    script.async = false;
    script.onload = function(){ appendSequentially(index + 1); };
    script.onerror = function(){ console.error('[docket] failed to load module', parts[index]); appendSequentially(index + 1); };
    (document.head || document.body || document.documentElement).appendChild(script);
  }

  if (typeof document === 'undefined') return;
  if (document.readyState === 'loading' && typeof document.write === 'function') {
    writeScripts();
  } else {
    appendSequentially(0);
  }
})();
