(() => {
  'use strict';

  function finalize() {
    try {
      if (typeof currentPage !== 'undefined') currentPage = 1;
      if (typeof applyLanguage === 'function') {
        applyLanguage();
      } else {
        if (typeof renderFilters === 'function') renderFilters();
        if (typeof renderEntries === 'function') renderEntries();
      }

      const count = document.querySelector('#entry-count');
      if (count && typeof entries !== 'undefined') count.textContent = String(entries.length);

      document.documentElement.dataset.optjavaReady = 'true';
      document.documentElement.dataset.optjavaEntries = typeof entries !== 'undefined' ? String(entries.length) : '0';

      if (location.hash.startsWith('#entry/') && typeof openEntry === 'function') {
        const id = location.hash.split('/')[1];
        requestAnimationFrame(() => openEntry(id));
      }

      window.dispatchEvent(new CustomEvent('optjava:ready', {
        detail: { entries: typeof entries !== 'undefined' ? entries.length : 0 }
      }));
    } catch (error) {
      console.error('OPTjava initialization failed', error);
      const status = document.querySelector('#dictionary-status');
      if (status) status.textContent = 'Initialization error — reload the page.';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', finalize, { once: true });
  } else {
    finalize();
  }
})();
