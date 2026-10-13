// cocubePrompt.js
// 首次打开应用时询问用户是否使用 CoCube 设备

const STORAGE_KEY = 'cocube-device-choice';
const SESSION_KEY = 'cocube-session-choice';
const COCUBE_HASH = 'scripts=GP%20Scripts%0Adepends%20%27CoCube%27';

function getStoredChoice() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    return null;
  }
}

function setStoredChoice(choice) {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch (e) {}
}

function getSessionChoice() {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch (e) {
    return null;
  }
}

function setSessionChoice(choice) {
  try {
    sessionStorage.setItem(SESSION_KEY, choice);
  } catch (e) {}
}

function getLocale() {
  try {
    const prefs = JSON.parse(localStorage.getItem('user-prefs') || '{}');
    const locale = prefs.locale || 'en';
    // 将中文语言统一映射为 'cn'
    if (locale.startsWith('zh')) return 'cn';
    return locale;
  } catch (e) {
    return 'en';
  }
}

function getI18nText(locale) {
  const texts = {
    cn: {
      message: '请选择您的设备类型',
      cocubeLabel: 'CoCube',
      otherLabel: '其他设备',
      dontShowAgain: '不再提示'
    },
    en: {
      message: 'Please select your device type',
      cocubeLabel: 'CoCube',
      otherLabel: 'Other Devices',
      dontShowAgain: "Don't show again"
    }
  };
  return texts[locale] || texts['en'];
}

function showPromptDialog() {
  return new Promise((resolve) => {
    const locale = getLocale();
    const i18n = getI18nText(locale);
    let selectedChoice = null;

    // 创建遮罩和弹窗
    const overlay = document.createElement('div');
    overlay.style = `
      position: fixed; left: 0; top: 0; width: 100vw; height: 100vh;
      background: rgba(0,0,0,0.35); z-index: 9999; display: flex; align-items: center; justify-content: center;`;
    
    const dialog = document.createElement('div');
    dialog.style = `
      background: #fff; border-radius: 12px; box-shadow: 0 2px 16px #0002;
      max-width: 600px; padding: 20px 30px; font-family: arial; color: #222;
      text-align: center; position: relative;`;
    
    // 提示信息
    const message = document.createElement('div');
    message.textContent = i18n.message;
    message.style = 'color: #333; font-size: 1.1em; margin-bottom: 24px; font-weight: 500;';
    dialog.appendChild(message);
    
    // 设备选择区 - 横向排列
    const deviceSelection = document.createElement('div');
    deviceSelection.style = 'display: flex; justify-content: center; align-items: center; gap: 40px; margin-bottom: 20px;';
    
    // CoCube 选项
    const cocubeOption = document.createElement('div');
    cocubeOption.style = `
      cursor: pointer; transition: all 0.2s; padding: 12px;
      border: 3px solid transparent; border-radius: 8px;`;
    
    const cocubeImgContainer = document.createElement('div');
    cocubeImgContainer.style = `
      width: 140px; height: 140px; display: flex; align-items: center; justify-content: center;
      border-radius: 8px; overflow: hidden;`;
    
    const cocubeImg = document.createElement('img');
    // 尝试多个可能的路径
    const imagePaths = [
      './features/img/CoCube_select.png',
      'features/img/CoCube_select.png',
      '/features/img/CoCube_select.png',
      './src/features/img/CoCube_select.png'
    ];
    cocubeImg.src = imagePaths[0];
    cocubeImg.style = 'width: 100%; height: 100%; object-fit: contain; padding: 10px;';
    
    let pathIndex = 0;
    cocubeImg.onerror = () => {
      pathIndex++;
      if (pathIndex < imagePaths.length) {
        cocubeImg.src = imagePaths[pathIndex];
      } else {
        // 所有路径都失败,显示文字
        cocubeImgContainer.innerHTML = '<div style="color: #999; font-size: 1.1em; font-weight: bold;">CoCube</div>';
      }
    };
    cocubeImgContainer.appendChild(cocubeImg);
    cocubeOption.appendChild(cocubeImgContainer);
    
    const cocubeLabel = document.createElement('div');
    cocubeLabel.textContent = i18n.cocubeLabel;
    cocubeLabel.style = 'margin-top: 10px; font-size: 1em; font-weight: bold; color: #333;';
    cocubeOption.appendChild(cocubeLabel);
    
    cocubeOption.onclick = () => {
      selectedChoice = 'yes';
      cocubeOption.style.border = '3px solid #4a9eff';
      cocubeOption.style.background = '#f0f8ff';
      otherOption.style.border = '3px solid transparent';
      otherOption.style.background = 'transparent';
    };
    
    deviceSelection.appendChild(cocubeOption);
    
    // 其他设备选项
    const otherOption = document.createElement('div');
    otherOption.style = `
      cursor: pointer; transition: all 0.2s; padding: 12px;
      border: 3px solid transparent; border-radius: 8px;`;
    
    const otherImgContainer = document.createElement('div');
    otherImgContainer.style = `
      width: 140px; height: 140px; display: flex; align-items: center; justify-content: center;
      border: 2px dashed #bbb; border-radius: 8px;`;
    
    const plusIcon = document.createElement('div');
    plusIcon.textContent = '+';
    plusIcon.style = 'font-size: 56px; color: #999; font-weight: 300; line-height: 1;';
    otherImgContainer.appendChild(plusIcon);
    otherOption.appendChild(otherImgContainer);
    
    const otherLabel = document.createElement('div');
    otherLabel.textContent = i18n.otherLabel;
    otherLabel.style = 'margin-top: 10px; font-size: 1em; font-weight: bold; color: #333;';
    otherOption.appendChild(otherLabel);
    
    otherOption.onclick = () => {
      selectedChoice = 'no';
      otherOption.style.border = '3px solid #4a9eff';
      otherOption.style.background = '#f0f8ff';
      cocubeOption.style.border = '3px solid transparent';
      cocubeOption.style.background = 'transparent';
    };
    
    deviceSelection.appendChild(otherOption);
    dialog.appendChild(deviceSelection);
    
    // 底部区域 - 复选框和按钮横向排列
    const bottomContainer = document.createElement('div');
    bottomContainer.style = 'display: flex; align-items: center; justify-content: space-between; margin-top: 20px;';
    
    // "不再提示"复选框
    const checkboxContainer = document.createElement('div');
    checkboxContainer.style = 'display: flex; align-items: center; gap: 8px;';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'dontShowAgain';
    checkbox.style = 'width: 18px; height: 18px; cursor: pointer;';
    checkboxContainer.appendChild(checkbox);
    
    const checkboxLabel = document.createElement('label');
    checkboxLabel.htmlFor = 'dontShowAgain';
    checkboxLabel.textContent = i18n.dontShowAgain;
    checkboxLabel.style = 'cursor: pointer; font-size: 0.95em; color: #666; user-select: none;';
    checkboxContainer.appendChild(checkboxLabel);
    
    bottomContainer.appendChild(checkboxContainer);
    
    // 确认按钮
    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'OK';
    confirmBtn.style = `
      background: #4a9eff; color: #fff; border: none; border-radius: 6px;
      padding: 10px 36px; font-size: 1em; font-weight: bold; cursor: pointer;
      box-shadow: 0 2px 8px rgba(74, 158, 255, 0.3);`;
    confirmBtn.onmouseover = () => confirmBtn.style.background = '#3a8eef';
    confirmBtn.onmouseout = () => confirmBtn.style.background = '#4a9eff';
    confirmBtn.onclick = () => {
      if (!selectedChoice) {
        // 如果没有选择,高亮提示
        deviceSelection.style.animation = 'shake 0.3s';
        setTimeout(() => deviceSelection.style.animation = '', 300);
        return;
      }
      
      document.body.removeChild(overlay);
      
      // 先记录本次会话的选择(防止刷新后死循环)
      setSessionChoice(selectedChoice);
      
      // 只有勾选了"不再提示"才永久存储选择
      if (checkbox.checked) {
        setStoredChoice(selectedChoice);
      }
      
      resolve(selectedChoice);
    };
    bottomContainer.appendChild(confirmBtn);
    
    dialog.appendChild(bottomContainer);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    // 添加抖动动画
    const style = document.createElement('style');
    style.textContent = `
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
      }
    `;
    document.head.appendChild(style);
  });
}

async function checkAndPromptCoCube() {
  // 首先检查是否有永久存储的选择(勾选了"不再提示")
  const storedChoice = getStoredChoice();
  
  if (storedChoice === 'yes' || storedChoice === 'no') {
    // 用户已经做过选择并勾选了"不再提示",不再显示对话框
    // 注意:不需要在这里处理 hash,因为 index.html 中的脚本已经根据 storedChoice 处理了
    return;
  }
  
  // 检查本次会话是否已经做过选择(防止刷新后死循环)
  const sessionChoice = getSessionChoice();
  
  if (sessionChoice === 'yes' || sessionChoice === 'no') {
    // 本次会话已经选择过了,不再显示对话框
    return;
  }
  
  // 首次打开且本次会话未选择,显示提示对话框
  const choice = await showPromptDialog();
  
  if (choice === 'no') {
    // 用户选择不使用 CoCube，移除 hash 参数并刷新
    // 检查是否有实际的 hash 内容(不只是 '#')
    const hash = window.location.hash;
    if (hash && hash.length > 1) {
      window.location.hash = '';
      window.location.reload();
    }
  }
  // 如果选择 yes，已经有 hash 了，不需要额外操作
}

export { checkAndPromptCoCube };
