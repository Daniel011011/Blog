(() => {
  const form = document.getElementById('writer');
  // Validate after switching back to the editor, so hidden required fields can receive focus.
  form.noValidate = true;
  const status = document.getElementById('writer-status');
  const output = document.getElementById('markdown-output');
  const body = document.getElementById('post-body');
  const preview = document.getElementById('markdown-preview');
  const storageKey = `blog-draft:${form.dataset.repository}`;
  const fields = ['title', 'slug', 'date', 'tags', 'description', 'body'];
  const localDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  form.elements.date.value = localDate;
  let storageOK = true;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (saved) {
      for (const key of fields) if (typeof saved[key] === 'string') form.elements[key].value = saved[key];
      form.elements.draft.checked = saved.draft === true;
      status.textContent = '已恢复这台设备上次保存的草稿。';
    }
  } catch { storageOK = false; status.textContent = '浏览器无法保存草稿，请及时导出 Markdown。'; }
  const data = () => ({ ...Object.fromEntries(fields.map(key => [key, form.elements[key].value])), draft: form.elements.draft.checked });
  function markdown() {
    const post = data();
    const date = post.date && !Number.isNaN(new Date(post.date).valueOf()) ? new Date(post.date).toISOString() : new Date().toISOString();
    const tags = [...new Set(post.tags.split(/[,，]/).map(tag => tag.trim()).filter(Boolean))];
    return `---\ntitle: ${JSON.stringify(post.title)}\ndate: ${JSON.stringify(date)}\ntags: ${JSON.stringify(tags)}\ndescription: ${JSON.stringify(post.description)}\ndraft: ${post.draft}\n---\n\n${post.body}\n`;
  }
  const filename = () => `${form.elements.date.value.slice(0, 10)}-${form.elements.slug.value}.md`;
  // Raw HTML is disabled in the browser preview; build-time HTML is sanitized separately.
  const md = window.markdownit({ html: false, linkify: true });
  const imageRenderer = md.renderer.rules.image;
  md.renderer.rules.image = (tokens, index, options, env, renderer) => {
    const token = tokens[index];
    const source = token.attrGet('src');
    const base = new URL('../', location.href).pathname;
    if (source?.startsWith('/') && !source.startsWith('//') && !source.startsWith(base)) token.attrSet('src', base + source.slice(1));
    return imageRenderer(tokens, index, options, env, renderer);
  };
  function update() {
    output.value = markdown();
    if (!preview.hidden) preview.innerHTML = md.render(body.value || '*从一个念头开始。*');
  }
  form.addEventListener('input', () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(data()));
      storageOK = true;
      status.textContent = `草稿已保存到这台设备 · ${new Date().toLocaleTimeString('zh-CN')}`;
    } catch { storageOK = false; status.textContent = '草稿未能保存，请导出 Markdown 备份。'; }
    update();
  });
  function selectMode(isPreview) {
    body.hidden = isPreview;
    preview.hidden = !isPreview;
    document.getElementById('edit-tab').setAttribute('aria-pressed', String(!isPreview));
    document.getElementById('preview-tab').setAttribute('aria-pressed', String(isPreview));
    update();
  }
  document.getElementById('edit-tab').addEventListener('click', () => selectMode(false));
  document.getElementById('preview-tab').addEventListener('click', () => selectMode(true));
  function valid() { if (!body.value.trim()) selectMode(false); return form.reportValidity(); }
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!valid()) return;
    const url = URL.createObjectURL(new Blob([markdown()], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename();
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = `已导出 ${filename()}。放入仓库 content/posts/ 并提交即可。`;
  });
  async function copy() {
    try { await navigator.clipboard.writeText(markdown()); return true; }
    catch { output.closest('details').open = true; output.focus(); output.select(); return false; }
  }
  document.getElementById('copy-post').addEventListener('click', async () => {
    if (!valid()) return;
    status.textContent = await copy() ? '已复制完整 Markdown（含标题、日期和标签）。' : '无法自动复制，已选中完整 Markdown，请手动复制。';
  });
  document.getElementById('github-post').addEventListener('click', () => {
    if (!valid()) return;
    const destination = new URL(`https://github.com/${form.dataset.repository}/new/${encodeURIComponent(form.dataset.branch)}/content/posts`);
    destination.searchParams.set('filename', filename());
    // Keep article text out of URLs and their length limits. Commit happens on GitHub.
    const opened = window.open(destination.href, '_blank');
    if (opened) opened.opener = null;
    copy().then(copied => {
      status.textContent = !opened ? '新窗口被浏览器拦截，请允许弹窗后重试，或导出文件上传到 GitHub。' : copied ? '已复制 Markdown 并打开 GitHub；粘贴正文，确认文件名后点击 Commit changes。尚未发布。' : '已打开 GitHub。请先手动复制下方 Markdown，再在 GitHub 粘贴并提交。尚未发布。';
    });
  });
  window.addEventListener('beforeunload', event => { if (!storageOK && body.value.trim()) { event.preventDefault(); event.returnValue = ''; } });
  update();
})();
