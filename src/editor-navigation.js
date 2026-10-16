(() => {
  const mode = location.pathname.startsWith('/blocks/') ? 'blocks' : 'icon';
  try { localStorage.setItem('cocube-entry-tool', mode); } catch {}
  if (mode !== 'icon') return;
  const style = document.createElement('style');
  style.textContent = `.cocube-editor-navigation{display:flex;flex-direction:column;gap:8px;margin-top:16px;padding-top:16px;border-top:1px solid #e1e8ef}.cocube-editor-navigation button{box-sizing:border-box;display:flex;align-items:center;gap:12px;width:100%;min-height:52px;padding:12px 14px;border:1px solid #dce6ef;border-radius:12px;background:#f4f8fb;color:#426579;font:500 16px/1.4 system-ui;text-align:left;cursor:pointer}.cocube-editor-navigation button svg{width:24px;height:24px;flex:0 0 24px}.cocube-editor-navigation button span{flex:1;min-width:0}.cocube-editor-navigation button:hover{background:#eaf2f9}.cocube-editor-navigation button:focus-visible{outline:3px solid #087fe6;outline-offset:2px}`;
  document.head.append(style);
  const labels = {zh:'切换到积木编程 ↗',en:'Switch to block coding ↗',es:'Cambiar a bloques ↗'};
  const addSwitch = () => {
    const panel = document.querySelector('.cocube-child-menu');
    if (!panel || panel.classList.contains('cocube-language-menu') || panel.classList.contains('cocube-connection-menu')) return;
    const grid = panel.querySelector('.cocube-menu-grid');
    if (!grid || panel.querySelector('[data-editor-switch]')) return;
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.editorSwitch = ''; button.dataset.noTranslate = '';
    let lang = 'en';
    try { lang = (typeof GetText !== 'undefined' && GetText.currentLocale) || localStorage.getItem('cocube-entry-language') || navigator.language; } catch {}
    lang = lang.toLowerCase().startsWith('zh') ? 'zh' : lang.toLowerCase().startsWith('es') ? 'es' : 'en';
    const text = labels[lang] || labels.en;
    button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M8 10v4m8-4v4"/></svg>';
    const label = document.createElement('span'); label.textContent = text; button.append(label);
    button.setAttribute('aria-label',text);
    button.onclick = () => { window.open('https://cocube.fun/blocks/', '_blank', 'noopener'); panel.querySelector('header button')?.click(); };
    const navigation = document.createElement('div'); navigation.className = 'cocube-editor-navigation';
    navigation.append(button);
    const choose = document.createElement('button');
    choose.type = 'button'; choose.dataset.noTranslate = '';
    const chooseText = ({zh:'选择编程方式',en:'Choose a coding tool',es:'Elegir herramienta'})[lang] || 'Choose a coding tool';
    choose.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m3 10 9-7 9 7v11h-6v-7H9v7H3Z"/></svg>';
    const chooseLabel = document.createElement('span'); chooseLabel.textContent = chooseText; choose.append(chooseLabel);
    choose.setAttribute('aria-label', chooseText);
    choose.onclick = () => { window.open('https://cocube.fun/?choose=1', '_blank', 'noopener'); panel.querySelector('header button')?.click(); };
    navigation.append(choose);
    panel.append(navigation);
  };
  new MutationObserver(addSwitch).observe(document.body,{childList:true,subtree:true});
  addSwitch();
})();
