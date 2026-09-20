(() => {
  const media = matchMedia('(prefers-color-scheme: dark)');
  function update() {
    const theme = document.documentElement.dataset.theme || 'system';
    const dark = theme === 'dark' || (theme === 'system' && media.matches);
    document.querySelectorAll('[data-theme-value]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.themeValue === theme)));
    const lightSheet = document.getElementById('code-light');
    const darkSheet = document.getElementById('code-dark');
    if (lightSheet) lightSheet.media = dark ? 'not all' : 'all';
    if (darkSheet) darkSheet.media = dark ? 'all' : 'not all';
  }
  document.querySelectorAll('[data-theme-value]').forEach(button => button.addEventListener('click', () => {
    document.documentElement.dataset.theme = button.dataset.themeValue;
    try { localStorage.setItem('blog-theme', button.dataset.themeValue); } catch {}
    update();
  }));
  media.addEventListener('change', update);
  update();
})();
