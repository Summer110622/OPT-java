(() => {
  'use strict';

  const refreshExpandedWiki = () => {
    try {
      // expansion.js mutates the shared topics/entries/categories/ui collections.
      // The original app has already rendered by this point, so explicitly
      // re-apply the language and rebuild filters/list/count after expansion.
      if (typeof applyLanguage === 'function') {
        applyLanguage();
      } else {
        if (typeof renderFilters === 'function') renderFilters();
        if (typeof renderEntries === 'function') renderEntries();
      }

      // A permalink may point directly at one of the newly added 4,000 entries.
      // The first open attempt happened before expansion.js loaded, so retry it.
      if (location.hash.startsWith('#entry/') && typeof openEntry === 'function') {
        const id = location.hash.slice('#entry/'.length);
        requestAnimationFrame(() => openEntry(id, false));
      }

      document.dispatchEvent(new CustomEvent('optjava:expanded', {
        detail: {
          topics: typeof topics !== 'undefined' ? topics.length : 0,
          entries: typeof entries !== 'undefined' ? entries.length : 0
        }
      }));
    } catch (error) {
      console.error('OPTjava expansion refresh failed:', error);
    }
  };

  const loadExamples = () => {
    const examples = document.createElement('script');
    examples.src = 'examples-base.js';
    document.head.appendChild(examples);
  };

  const expansion = document.createElement('script');
  expansion.src = 'expansion.js';
  expansion.onload = () => {
    refreshExpandedWiki();
    loadExamples();
  };
  expansion.onerror = () => {
    console.error('OPTjava expansion data failed to load.');
    loadExamples();
  };
  document.head.appendChild(expansion);
})();
