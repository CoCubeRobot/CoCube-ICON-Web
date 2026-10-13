import { icon } from './jsEditorMenus.js';
import { translateUI } from './jsEditorI18n.js';

// Keep the upstream response callbacks, replace only ICON's old floating UI.
export function installChildDialogs() {
    const original = {};
    for (const name of ['inform', 'confirm', 'prompt']) original[name] = FloatingWindow[name];
    const show = ({title, text, accept, cancel, input, defaultValue, multiline, confirm}) => {
        window.CoCubeActiveDialog?.close();
        MB_IconInputs.close();
        window.CoCubeEditorShell?.menus.close();
        const overlay = document.createElement('div'); overlay.className = 'cocube-dialog-overlay';
        const card = document.createElement('section'); card.className = 'cocube-dialog';
        card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true');
        card.setAttribute('aria-label', translateUI(title));
        const heading = document.createElement('header');
        const badge = document.createElement('span'); badge.className = 'cocube-dialog-symbol';
        badge.innerHTML = icon(confirm ? 'clear' : input ? 'settings' : 'check');
        const name = document.createElement('h2'); name.textContent = translateUI(title);
        const close = document.createElement('button'); close.className = 'cocube-dialog-close';
        close.innerHTML = icon('close');close.setAttribute('aria-label', translateUI('Close'));
        heading.append(badge, name, close);card.append(heading);
        const body = document.createElement('div'); body.className = 'cocube-dialog-body';
        // Upstream information messages sometimes contain links and line breaks.
        if (text) body.innerHTML = text;
        let field;
        if (input) {
            field = document.createElement(multiline ? 'textarea' : 'input');
            field.className = 'cocube-dialog-input';field.type = 'text';
            field.value = defaultValue ?? '';field.setAttribute('aria-label', translateUI(title));
            body.append(field);
        }
        const controls = document.createElement('footer');
        const yes = document.createElement('button');yes.className = 'cocube-dialog-primary';
        yes.innerHTML = icon('check');const yesText=document.createElement('span');yesText.textContent=translateUI(confirm ? 'Confirm' : 'Ok');yes.append(yesText);
        let settled = false;
        const finish = accepted => {
            if (settled) return;
            settled = true;overlay.remove();window.CoCubeActiveDialog=null;
            GP.delegateKeyboardEvents=false;
            if (accepted) accept?.(field?.value);else (cancel || accept)?.(null);
        };
        if (cancel) {
            const no=document.createElement('button');no.className='cocube-dialog-secondary';
            no.innerHTML=icon('back');const text=document.createElement('span');text.textContent=translateUI('Cancel');no.append(text);
            no.onclick=()=>finish(false);controls.append(no);
        }
        controls.append(yes);card.append(body,controls);overlay.append(card);document.body.append(overlay);
        close.onclick=()=>finish(false);yes.onclick=()=>finish(true);
        overlay.onclick=event=>{if(event.target===overlay)finish(false);};
        card.onkeydown=event=>{event.stopPropagation();if(event.key==='Escape')finish(false);if(event.key==='Enter'&&!multiline)finish(true);};
        const fit=()=>{
            const vv=window.visualViewport;
            const height=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cocube-visible-height')) || vv?.height || innerHeight;
            card.style.maxHeight=`${Math.max(80,height-24)}px`;
            overlay.style.height=`${height}px`;
        };
        fit();
        window.addEventListener('cocube-keyboard-insets',fit);
        window.visualViewport?.addEventListener('resize',fit);
        const remove=overlay.remove.bind(overlay);
        overlay.remove=()=>{window.removeEventListener('cocube-keyboard-insets',fit);window.visualViewport?.removeEventListener('resize',fit);remove();};
        window.CoCubeActiveDialog={close:()=>finish(false)};
        if(field){GP.delegateKeyboardEvents=true;field.focus({preventScroll:true});}else (cancel ? controls.firstChild : yes).focus({preventScroll:true});
        return {remove:()=>finish(false)};
    };
    FloatingWindow.inform = function (title, text, onAccept) {
        if (!MB_editor.iconLayout) return original.inform.apply(this, arguments);
        return show({title:title||'Information',text:translateUI(text),accept:onAccept});
    };
    FloatingWindow.confirm = function (title, text, onAccept, onCancel) {
        if (!MB_editor.iconLayout) return original.confirm.apply(this, arguments);
        return show({title:title||'Confirm',text:translateUI(text),accept:onAccept,cancel:onCancel,confirm:true});
    };
    FloatingWindow.prompt = function (title, text, onAccept, onCancel, input, defaultValue, editRule) {
        if (!MB_editor.iconLayout) return original.prompt.apply(this, arguments);
        return show({title:title||'Input',text:translateUI(text),accept:onAccept,cancel:onCancel,input:true,
            defaultValue:input?.defaultValue??defaultValue,multiline:input?.multiline||editRule==='editable'});
    };
    const confirmProject = MB_Editor.prototype.confirm;
    MB_Editor.prototype.confirm = function (question) {
        if (!this.iconLayout) return confirmProject.call(this, question);
        return new Promise(resolve => FloatingWindow.confirm(null, question, () => resolve(true), () => resolve(false)));
    };
    const promptProject = MB_Editor.prototype.prompt;
    MB_Editor.prototype.prompt = function (question, defaultValue, editRule) {
        if (!this.iconLayout) return promptProject.call(this, question, defaultValue, editRule);
        return new Promise(resolve => FloatingWindow.prompt(question, null, resolve, () => resolve(null), null, defaultValue, editRule));
    };

    // Built-in files remain browsable, but use the same scrollable DOM cards as menus.
    const open = MB_FilePicker.prototype.open;
    const remove = MB_FilePicker.prototype.removeFromOwner;
    const find = MB_FilePicker.findOpen;
    let activePicker;
    MB_FilePicker.prototype.open = function (aWorld) {
        if (!MB_editor.iconLayout) return open.call(this,aWorld);
        activePicker?.removeFromOwner();activePicker=this;
        window.CoCubeEditorShell?.menus.close();MB_IconInputs.close();
        const overlay=document.createElement('div');overlay.className='cocube-dialog-overlay';
        const card=document.createElement('section');card.className='cocube-dialog cocube-file-dialog';
        card.setAttribute('role','dialog');card.setAttribute('aria-label',translateUI('Open'));
        const header=document.createElement('header');const title=document.createElement('h2');title.textContent=translateUI('Open');
        const close=document.createElement('button');close.className='cocube-dialog-close';close.innerHTML=icon('close');close.setAttribute('aria-label',translateUI('Close'));
        header.append(title,close);
        const navigation=document.createElement('nav');navigation.className='cocube-file-navigation';
        const parent=document.createElement('button');parent.innerHTML=icon('back');parent.setAttribute('aria-label',translateUI('Back'));
        const folder=document.createElement('strong');navigation.append(parent,folder);
        const shortcuts=document.createElement('div');shortcuts.className='cocube-file-shortcuts';
        for(const [label,action] of [['Examples',()=>this.showFolder('Examples',true)],['Libraries',()=>this.showFolder('Libraries',true)],['Computer',()=>this.setComputer()]]){
            if(label==='Libraries'&&!this.extensions?.includes('.ubl'))continue;
            const button=document.createElement('button');button.textContent=translateUI(label);button.onclick=()=>{action();if(this.domOverlay)render();};shortcuts.append(button);
        }
        const list=document.createElement('div');list.className='cocube-file-list';
        const render=()=>{
            folder.textContent=this.localizeDir(this.currentDir.split('/').at(-1));
            parent.disabled=this.currentDir===this.topDir;
            list.replaceChildren();
            for(const [label,value] of this.folderContents()){
                const button=document.createElement('button');const isFolder=value.startsWith('[ ] ');
                button.innerHTML=icon(isFolder?'open':'new');const name=document.createElement('span');name.textContent=label.replace(/^\[ \] /,'');name.setAttribute('data-no-translate','');button.append(name);
                button.onclick=()=>{
                    if(isFolder){this.fileOrFolderSelected(value);render();}
                    else {this.selection=value;this.okay();}
                };list.append(button);
            }
        };
        parent.onclick=()=>{this.parentFolder();render();};close.onclick=()=>this.removeFromOwner();
        overlay.onclick=event=>{if(event.target===overlay)this.removeFromOwner();};
        card.append(header,shortcuts,navigation,list);overlay.append(card);document.body.append(overlay);this.domOverlay=overlay;
        card.style.maxHeight=`${innerHeight-24}px`;
        render();return this;
    };
    MB_FilePicker.prototype.removeFromOwner=function(){
        if(this.domOverlay){this.domOverlay.remove();this.domOverlay=null;if(activePicker===this)activePicker=null;}
        else remove.call(this);
    };
    MB_FilePicker.findOpen=world=>activePicker||find(world);
}
