(() => {
  let theme = 'system';
  try { theme = localStorage.getItem('blog-theme') || 'system'; } catch {}
  if (!['system', 'light', 'dark'].includes(theme)) theme = 'system';
  document.documentElement.dataset.theme = theme;
})();
