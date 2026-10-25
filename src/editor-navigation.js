(() => {
  const mode = location.pathname.startsWith('/blocks/') ? 'blocks' : 'icon';
  try { localStorage.setItem('cocube-entry-tool', mode); } catch {}
  if (mode !== 'icon') return;
  const labels = {zh:'积木编程',en:'Blocks',es:'Bloques'};
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
    grid.append(button);
    const choose = document.createElement('button');
    choose.type = 'button'; choose.dataset.noTranslate = '';
    const chooseText = ({zh:'入口页',en:'Start page',es:'Inicio'})[lang] || 'Start page';
    choose.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m3 10 9-7 9 7v11h-6v-7H9v7H3Z"/></svg>';
    const chooseLabel = document.createElement('span'); chooseLabel.textContent = chooseText; choose.append(chooseLabel);
    choose.setAttribute('aria-label', chooseText);
    choose.onclick = () => { window.open('https://cocube.fun/?choose=1', '_blank', 'noopener'); panel.querySelector('header button')?.click(); };
    grid.append(choose);
  };
  new MutationObserver(addSwitch).observe(document.body,{childList:true,subtree:true});
  addSwitch();
})();
