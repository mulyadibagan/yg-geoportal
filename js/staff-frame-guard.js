(function () {
  "use strict";

  // GitHub Pages cannot attach frame-ancestors or X-Frame-Options headers.
  // The document starts visibility:hidden, and this synchronous head script
  // keeps it non-interactive if a different page attempts to frame it.
  if (window.top === window.self) return;
  document.documentElement.style.setProperty("display", "none", "important");
  document.documentElement.setAttribute("aria-hidden", "true");
  try { window.stop(); } catch (_) {}
})();
