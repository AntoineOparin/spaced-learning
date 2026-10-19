// Applies the saved theme before first paint (an external file, so the CSP needs no inline scripts).
(() => {
  try {
    const theme = localStorage.getItem('theme') || 'system';
    const dark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch {
    // Storage may be unavailable (private mode); fall back to the light theme.
  }
})();
