/*
 * opinion/opinion.js
 * Compatibility loader for the split opinion module files.
 * Keep this file small; edit feature code under opinion/modules/.
 */
(function(){
  var parts = [
    'modules/00-state-review-template.js',
    'modules/01-projects-navigation.js',
    'modules/02-upload-files.js',
    'modules/03-parse-type.js',
    'modules/04-analysis-gates.js',
    'modules/05-draft-validation-opinion.js',
    'modules/06-output-data-json.js'
];
  var version = '20260814j';
  var prefix = 'opinion/';

  function writeScripts() {
    for (var i = 0; i < parts.length; i++) {
      document.write('<script src="' + prefix + parts[i] + '?v=' + version + '"><\/script>');
    }
  }

  function appendSequentially(index) {
    if (index >= parts.length) {
      try { window.dispatchEvent(new CustomEvent('opinion:modules-loaded')); } catch (_e) {}
      return;
    }
    var script = document.createElement('script');
    script.src = prefix + parts[index] + '?v=' + version;
    script.async = false;
    script.onload = function(){ appendSequentially(index + 1); };
    script.onerror = function(){ console.error('[opinion] failed to load module', parts[index]); appendSequentially(index + 1); };
    (document.head || document.body || document.documentElement).appendChild(script);
  }

  if (typeof document === 'undefined') return;
  if (document.readyState === 'loading' && typeof document.write === 'function') {
    writeScripts();
  } else {
    appendSequentially(0);
  }
})();
