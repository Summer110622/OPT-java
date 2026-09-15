(() => {
  'use strict';
  const expansion = document.createElement('script');
  expansion.src = 'expansion.js';
  expansion.onload = () => {
    const examples = document.createElement('script');
    examples.src = 'examples-base.js';
    document.head.appendChild(examples);
  };
  document.head.appendChild(expansion);
})();
