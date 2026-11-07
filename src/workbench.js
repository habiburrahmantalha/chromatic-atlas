// Drafts keep original palette values intact. Named presets are explicit snapshots.
const DRAFT_KEY = 'chromatic-atlas-workbench-v1';
const clone = value => JSON.parse(JSON.stringify(value));
let browserStorage;
try { browserStorage = window.localStorage; } catch (_) { browserStorage = null; }
let libraryResult = AtlasCore.loadLibrary(browserStorage);
let library = libraryResult.presets.map(p=>({...p,id:p.id||uniqueId()}));
let workingDrafts = {};
let editHistory = [];
let pendingDelete = null;
let storageMessage = libraryResult.error || '';
let draft = freshDraft(palettes[0]);
let auditRows = [];
let suggestions = new Map();

function freshDraft(p) {
 return {version:1,name:p.name,basePaletteId:p.id,font:state.font,template:state.template,light:clone(p.light),dark:clone(p.dark)};
}
function activeTheme() {
 return {...palettes[state.palette],name:draft.name || 'Untitled theme',light:draft.light,dark:draft.dark};
}
function currentPreset() {
 return AtlasCore.validatePreset({...draft,font:state.font,template:state.template});
}
function buildTokenExport() {
 const source=palettes[state.palette],rows=AtlasCore.audit(draft);
 return {version:1,name:draft.name||'Untitled theme',source:{id:source.id,name:source.name,colors:clone(source.colors)},light:clone(draft.light),dark:clone(draft.dark),typography:exportFonts(),semantic:DATA.semantic,contrast:{method:'WCAG sRGB relative luminance; opaque colors',checked:rows.length,passed:rows.filter(row=>row.pass).length,failed:rows.filter(row=>!row.pass).length,pairs:rows},notes:['Audit results describe these exported role pairs only; verify rendered components, transparency, gradients and interactive states in your app.']};
}
function undoEdit() {
 if(!editHistory.length)return;
 const loadedId=state.activePresetId;
 draft=editHistory.pop();
 if(loadedId)draft.id=loadedId;else delete draft.id;
 state.font=draft.font;state.template=draft.template;
 rememberDraft();renderAll();toast('Previous theme values restored.');
}
function setStorageNotice(message) {
 storageMessage = message || '';
 $('#storage-notice').hidden = !storageMessage;
 $('#storage-notice').textContent = storageMessage;
}
function rememberDraft() {
 draft.font=state.font;draft.template=state.template;
 try {
  const valid=currentPreset();workingDrafts[valid.basePaletteId]=clone(valid);
  if(!browserStorage) throw Error('Storage unavailable');
  browserStorage.setItem(DRAFT_KEY,JSON.stringify({version:1,paletteId:valid.basePaletteId,view:state.view,size:state.size,editMode:state.editMode,drafts:Object.values(workingDrafts)}));
  $('#draft-status').textContent='Drafts autosaved in this browser. Save a named preset to keep a reusable snapshot.';
 } catch(error) {
  if(!draft.name.trim()) $('#draft-status').textContent='Enter a theme name to save your draft.';
  else {
   $('#draft-status').textContent='Draft stays in this tab. Export a preset to keep it.';
   setStorageNotice('Browser storage could not save this draft. Editing still works; export a preset for a portable backup.');
  }
 }
}
function restoreWorkbench() {
 try {
  if(!browserStorage) return;
  const raw=browserStorage.getItem(DRAFT_KEY);if(!raw)return;
  if(raw.length>250000)throw Error('Too large');
  const saved=JSON.parse(raw);
  if(saved.version!==1||!Array.isArray(saved.drafts)||saved.drafts.length>12)throw Error('Invalid draft cache');
  const restored={};
  for(const item of saved.drafts){const valid=AtlasCore.validatePreset(item);restored[valid.basePaletteId]=valid;}
  const index=palettes.findIndex(p=>p.id===saved.paletteId);
  if(index<0||!restored[saved.paletteId])throw Error('Invalid active draft');
  workingDrafts=restored;state.palette=index;draft=clone(restored[saved.paletteId]);
  state.font=draft.font;state.template=draft.template;
  state.activePresetId=library.some(p=>p.id===draft.id)?draft.id:null;
  state.view=['both','light','dark'].includes(saved.view)?saved.view:'both';
  state.size=['fluid','mobile'].includes(saved.size)?saved.size:'fluid';
  state.editMode=['light','dark'].includes(saved.editMode)?saved.editMode:'light';
  $('#draft-status').textContent='Your last working draft has been restored from this browser.';
 } catch(_) {setStorageNotice('A saved draft could not be read. Original palettes are available; import a preset backup if needed.');}
}
function pushHistory() {
 editHistory.push(clone({...draft,font:state.font,template:state.template}));
 if(editHistory.length>25)editHistory.shift();
 $('#undo-edit').disabled=false;
}
function refreshSelectUI() { if(typeof AtlasSelects!=='undefined')AtlasSelects.refreshAll(); }
function syncControls() {
 $('#font-select').value=state.font;$('#template-select').value=state.template;
 $('#theme-name').value=draft.name;
 $$('[data-edit-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.editMode===state.editMode));
 $('#undo-edit').disabled=!editHistory.length;
 refreshSelectUI();
}
function selectPalette(index) {
 rememberDraft();state.palette=index;
 draft=clone(workingDrafts[palettes[index].id]||freshDraft(palettes[index]));
 state.font=draft.font;state.template=draft.template;
 state.activePresetId=library.some(p=>p.id===draft.id)?draft.id:null;
 editHistory=[];syncControls();rememberDraft();renderAll();
 setChecker(paletteColors(palettes[index])[0],paletteColors(palettes[index])[5]);
 toast(palettes[index].name+' selected');
}
function scopedMarkup(markup,scope) {
 return markup.replace(/\bid="([^"]+)"/g,(_,id)=>`id="${scope}-${id}"`)
  .replace(/\b(for|aria-labelledby|aria-describedby|aria-controls)="([^"]+)"/g,(_,attribute,ids)=>`${attribute}="${ids.split(' ').map(id=>scope+'-'+id).join(' ')}"`);
}
function themeStyle(mode) {
 const tokens=draft[mode],font=FONTS[state.font];
 return Object.entries(tokens).map(([k,v])=>`--${k}:${v}`).join(';')+`;--body:${font.body};--display:${font.display};--mono:${font.mono||'ui-monospace, monospace'}`;
}
function screenContext(mode) {
 return {mode,tokens:draft[mode],font:FONTS[state.font],semantic:DATA.semantic[mode],escapeHTML};
}
function wrapScreen(mode,content,scope) {
 return scopedMarkup(`<div class="preview-column"><div class="mode-caption"><span>${mode==='light'?'Light · everyday clarity':'Dark · low-light focus'}</span><span>${draft[mode].canvas}</span></div><div class="app" data-mode="${mode}" style="${escapeHTML(themeStyle(mode))}">${content}</div></div>`,scope);
}
function previewMarkup(mode,scope) {
 if(state.template==='dashboard')return scopedMarkup(dashboardHTML(mode),scope);
 const notice=state.feedback==='none'?'':`<div class="app-toast template-feedback" style="background:${DATA.semantic[mode][state.feedback].bg};color:${DATA.semantic[mode][state.feedback].fg};border-color:${DATA.semantic[mode][state.feedback].fg}"><strong>${feedbackCopy[state.feedback][1]}</strong><br>${feedbackCopy[state.feedback][2]}</div>`;
 return wrapScreen(mode,notice+AtlasScreens.render(state.template,screenContext(mode)),scope);
}
function bindDemo(root) {
 $$('[data-create]',root).forEach(b=>b.addEventListener('click',()=>{$('#project-dialog').showModal();$('#project-name').focus()}));
 $$('[data-demo-tab]',root).forEach(b=>b.addEventListener('click',()=>{state.demoTabs[b.dataset.mode]=b.dataset.demoTab;renderPreview()}));
 $$('[data-task]',root).forEach(b=>b.addEventListener('change',()=>{state.tasks[+b.dataset.task]=b.checked;renderPreview()}));
 $$('[data-notifications]',root).forEach(b=>b.addEventListener('change',()=>{state.notifications=b.checked;renderPreview()}));
 $$('[data-invite]',root).forEach(form=>form.addEventListener('submit',e=>{e.preventDefault();toast('Invite preview complete. No message was sent.')}));
 AtlasScreens.bind(root,{onNotice:toast});
}
function renderPreview() {
 const p=activeTheme(),modes=state.view==='both'?['light','dark']:[state.view];
 $('#current-palette').textContent=p.name;
 $('#current-mood').textContent=`${palettes[state.palette].name} foundation · ${state.template[0].toUpperCase()+state.template.slice(1)} template`;
 const edited=['light','dark'].some(m=>Object.keys(draft[m]).some(k=>draft[m][k]!==palettes[state.palette][m][k]));
 $('#live-status').textContent=edited?'Custom theme':'Original colors';
 $('#preview-grid').className='preview-grid'+(modes.length===1?' single':'')+(state.size==='mobile'?' mobile':'');
 $('#preview-grid').innerHTML=modes.map(m=>previewMarkup(m,'preview-'+m)).join('');
 $('#builder-preview-label').textContent=state.editMode+' · '+state.template;
 $('#builder-preview').innerHTML=previewMarkup(state.editMode,'builder-'+state.editMode);
 $('#gallery-grid').className=$('#preview-grid').className;
 $('#gallery-grid').innerHTML=modes.map(m=>wrapScreen(m,AtlasScreens.gallery(screenContext(m)),'gallery-'+m)).join('');
 for(const id of ['preview-grid','builder-preview','gallery-grid'])bindDemo($('#'+id));
 $$('[data-view]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.view===state.view));
 $$('[data-size]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.size===state.size));
 const f=FONTS[state.font];$('#font-status').textContent=f.required.length?`${f.name}: embedded for a consistent offline preview.`:'System font: the actual face follows your device.';
 $('#source-swatches').innerHTML=paletteColors(p).map((c,i)=>`<button type="button" class="swatch" data-copy="${c}" aria-label="Copy source color ${i+1}, ${c}"><span class="chip" style="background:${c};color:${inkOn(c)}">${i+1}</span><span class="meta">${c}</span></button>`).join('');
 $('#pairing-note').textContent='These original source swatches never change. Custom semantic roles are shown in Theme builder and exported tokens.';
 $$('[data-copy]',$('#panel-preview')).forEach(b=>b.addEventListener('click',()=>copy(b.dataset.copy,b.dataset.copy+' copied')));
 refreshSelectUI();
}
function renderEditor() {
 syncControls();
 const groups=[['Surfaces',['canvas','surface','raised']],['Text',['text','secondary','link']],['Actions & selection',['primary','onPrimary','hover','pressed','selected','onSelected']],['Edges & context',['borderStrong','borderSubtle','focus','subtle','onSubtle']]];
 $('#token-editor').innerHTML=groups.map(([title,keys])=>`<fieldset class="editor-group"><legend>${title}</legend>${keys.map(key=>`<div class="editor-field"><label for="edit-${key}">${key}<small>${tokenUses[key]}</small></label><div class="editor-inputs"><input type="color" data-edit-color="${key}" value="${draft[state.editMode][key]}" aria-label="Pick ${key} color"><input type="text" id="edit-${key}" data-edit-hex="${key}" value="${draft[state.editMode][key]}" maxlength="7" spellcheck="false" aria-describedby="error-${key}"></div><span id="error-${key}" class="editor-error" role="status"></span></div>`).join('')}</fieldset>`).join('');
 $$('[data-edit-color]').forEach(input=>input.addEventListener('input',()=>{const key=input.dataset.editColor;$('#edit-'+key).value=input.value.toUpperCase();changeToken(key,input.value)}));
 $$('[data-edit-hex]').forEach(input=>input.addEventListener('input',()=>changeToken(input.dataset.editHex,input.value)));
}
function changeToken(key,value) {
 const color=normalizeHex(value),input=$('#edit-'+key),error=$('#error-'+key);
 input.setAttribute('aria-invalid',!color);error.textContent=color?'':'Use an opaque #RGB or #RRGGBB color.';
 if(!color)return;
 $(`[data-edit-color="${key}"]`).value=color;
 if(draft[state.editMode][key]===color)return;
 pushHistory();draft[state.editMode][key]=color;rememberDraft();renderPreview();renderMatrix();renderAudit();
}
function renderAudit() {
 auditRows=AtlasCore.audit(draft);suggestions=new Map();
 const failures=auditRows.filter(r=>!r.pass),summary=`${auditRows.length-failures.length} of ${auditRows.length} pairs pass${failures.length?' · '+failures.length+' need attention':'. Both modes meet the listed thresholds.'}`;
 $('#audit-summary').textContent=summary;
 $('#live-audit').innerHTML=`<span class="audit-badge ${failures.length?'needs-work':'all-pass'}">${failures.length?'! '+failures.length+' contrast issues':'✓ '+auditRows.length+' contrast pairs pass'}</span><button type="button" class="note-link" data-audit-jump>Review contrast in builder →</button>`;
 $('[data-audit-jump]').addEventListener('click',()=>{selectTab('builder',true);$('#audit-title').scrollIntoView({block:'start',behavior:'auto'})});
 const modeRows=auditRows.filter(r=>r.mode===state.editMode),modeFails=modeRows.filter(r=>!r.pass);
 $('#builder-summary').textContent=`${state.editMode==='light'?'Light':'Dark'} mode: ${modeRows.length-modeFails.length}/${modeRows.length} pairs pass. Changes affect all templates and exports.`;
 const filter=$('#audit-mode').value,showPassing=$('#show-passing').checked;
 const visible=auditRows.filter(r=>(filter==='all'||r.mode===filter)&&(showPassing||!r.pass));
 if(!visible.length){$('#audit-results').innerHTML='<div class="audit-empty">✓ No failing pairs in this view. Show passing pairs to inspect every ratio.</div>';return;}
 const proposalCache=new Map();
 $('#audit-results').innerHTML=visible.map(row=>{
  let proposal=null;
  if(!row.pass){const cacheKey=row.mode+':'+row.foreground;if(!proposalCache.has(cacheKey))proposalCache.set(cacheKey,AtlasCore.suggestion(draft,row));proposal=proposalCache.get(cacheKey);if(proposal){proposal={...proposal,afterRatio:contrast(proposal.color,draft[row.mode][row.background])};suggestions.set(row.id,proposal);}}
  return `<article class="audit-row ${row.pass?'audit-pass':'audit-fail'}"><div><span class="audit-mode">${row.mode}</span><h4>${escapeHTML(row.label)}</h4><p>${draft[row.mode][row.foreground]} / ${draft[row.mode][row.background]} · ${row.threshold}:1 required</p></div><div class="audit-measure"><strong>${row.ratio.toFixed(2)}:1</strong><span>${row.pass?'Pass':'Fail'}</span></div><div class="audit-suggestion">${row.pass?'':proposal?`<p>Set ${proposal.token} to <b>${proposal.color}</b><br>This pair becomes ${proposal.afterRatio.toFixed(2)}:1.</p><button type="button" class="action" data-fix="${row.id}">Apply ${proposal.color}</button>`:'<p>No single foreground adjustment passes all affected pairs. Adjust the backgrounds or paired labels.</p>'}</div></article>`;
 }).join('');
 $$('[data-fix]').forEach(b=>b.addEventListener('click',()=>{const row=auditRows.find(r=>r.id===b.dataset.fix),suggestion=suggestions.get(b.dataset.fix);if(!row||!suggestion)return;pushHistory();draft[row.mode][suggestion.token]=suggestion.color;rememberDraft();renderEditor();renderPreview();renderMatrix();renderAudit();toast(`${row.mode} ${suggestion.token} updated to ${suggestion.color}. Undo is available.`)}));
}
function renderLibrary() {
 const selected=$('#preset-select').value||state.activePresetId||'';
 $('#preset-select').innerHTML='<option value="">Choose a saved preset</option>'+library.map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''}>${escapeHTML(p.name)} · ${escapeHTML(p.basePaletteId)}</option>`).join('');
 $('#update-preset').disabled=!library.some(p=>p.id===state.activePresetId);
 $('#load-preset').disabled=!library.length;$('#delete-preset').disabled=!library.length;$('#export-library').disabled=!library.length;
 refreshSelectUI();
}
function setPresetMessage(message,error=false) {
 $('#preset-message').textContent=message;$('#preset-message').classList.toggle('is-error',error);
}
function uniqueId() {return 'preset-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);}
function savePresets(next) {
 if(next.length>AtlasCore.MAX_PRESETS)throw Error('This browser library is limited to 50 presets. Export a backup and remove an unused preset first.');
 const valid=next.map(p=>AtlasCore.validatePreset(p));
 const saved=AtlasCore.saveLibrary(browserStorage,valid);
 library=saved.presets;
 if(saved.error)setStorageNotice(saved.error);
 renderLibrary();return !saved.error;
}
function saveCurrent(update) {
 try {
  const preset=currentPreset();
  preset.id=update?state.activePresetId:uniqueId();
  if(update&&!library.some(p=>p.id===preset.id))throw Error('Load a saved preset before updating it.');
  const next=update?library.map(p=>p.id===preset.id?preset:p):[...library,preset];
  const persisted=savePresets(next);state.activePresetId=preset.id;draft.id=preset.id;rememberDraft();
  $('#preset-select').value=preset.id;renderLibrary();
  setPresetMessage(`${update?'Updated':'Saved'} “${preset.name}”${persisted?' in this browser.':' in this tab only. Export it to keep a copy.'}`);
 } catch(error){setPresetMessage(error.message,true);}
}
function loadPreset(id) {
 const preset=library.find(p=>p.id===id);if(!preset){setPresetMessage('Choose a saved preset first.',true);return;}
 draft=clone(preset);state.palette=palettes.findIndex(p=>p.id===draft.basePaletteId);state.font=draft.font;state.template=draft.template;state.activePresetId=preset.id;editHistory=[];
 syncControls();rememberDraft();renderAll();$('#preset-select').value=id;refreshSelectUI();setPresetMessage('Loaded “'+preset.name+'”. Edit its name and choose Update loaded preset to rename it.');
}
function renderAll() {renderPaletteList();renderEditor();renderPreview();renderMatrix();renderAudit();renderLibrary();}

restoreWorkbench();setStorageNotice(storageMessage);syncControls();
$('#palette-search').addEventListener('input',renderPaletteList);
$('#font-select').addEventListener('change',e=>{pushHistory();state.font=e.target.value;rememberDraft();renderPreview()});
$('#template-select').addEventListener('change',e=>{pushHistory();state.template=e.target.value;rememberDraft();renderPreview()});
$('#feedback-select').addEventListener('change',e=>{state.feedback=e.target.value;renderPreview()});
$$('[data-view]').forEach(b=>b.addEventListener('click',()=>{state.view=b.dataset.view;rememberDraft();renderPreview()}));
$$('[data-size]').forEach(b=>b.addEventListener('click',()=>{state.size=b.dataset.size;rememberDraft();renderPreview()}));
$$('[data-edit-mode]').forEach(b=>b.addEventListener('click',()=>{state.editMode=b.dataset.editMode;rememberDraft();renderEditor();renderPreview();renderAudit()}));
$('#theme-name').addEventListener('input',e=>{draft.name=e.target.value;rememberDraft();$('#current-palette').textContent=draft.name||'Untitled theme'});
$('#undo-edit').addEventListener('click',undoEdit);
$('#reset-mode').addEventListener('click',()=>{pushHistory();draft[state.editMode]=clone(palettes[state.palette][state.editMode]);rememberDraft();renderAll();toast(state.editMode+' mode restored to its original recipe.')});
$('#audit-mode').addEventListener('change',renderAudit);$('#show-passing').addEventListener('change',renderAudit);
$('#save-preset').addEventListener('click',()=>saveCurrent(false));$('#update-preset').addEventListener('click',()=>saveCurrent(true));
$('#load-preset').addEventListener('click',()=>loadPreset($('#preset-select').value));
$('#delete-preset').addEventListener('click',()=>{pendingDelete=$('#preset-select').value;const preset=library.find(p=>p.id===pendingDelete);if(!preset){setPresetMessage('Choose a saved preset first.',true);return;}$('#delete-description').textContent='Delete “'+preset.name+'” from this browser? The current working draft will remain.';$('#delete-confirm').hidden=false;$('#cancel-delete').focus()});
$('#cancel-delete').addEventListener('click',()=>{$('#delete-confirm').hidden=true;pendingDelete=null});
$('#confirm-delete').addEventListener('click',()=>{const deleted=pendingDelete;const persisted=savePresets(library.filter(p=>p.id!==deleted));if(state.activePresetId===deleted){state.activePresetId=null;delete draft.id;}$('#delete-confirm').hidden=true;pendingDelete=null;rememberDraft();renderLibrary();setPresetMessage(persisted?'Saved preset deleted.':'Preset removed in this tab; browser storage could not be updated.',!persisted)});
$('#export-preset').addEventListener('click',()=>{try{download('chromatic-theme.preset.json',JSON.stringify(currentPreset(),null,2),'application/json')}catch(error){setPresetMessage(error.message,true)}});
$('#export-library').addEventListener('click',()=>download('chromatic-presets.json',JSON.stringify({version:1,presets:library},null,2),'application/json'));
$('#import-preset').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>AtlasCore.MAX_IMPORT_BYTES)throw Error('Choose a preset JSON file smaller than 250 KB.');const incoming=AtlasCore.parseImport(await file.text()).map(p=>({...p,id:uniqueId()}));const persisted=savePresets([...library,...incoming]);setPresetMessage(`Imported ${incoming.length} preset(s)${persisted?' into this browser.':' into this tab only; export a backup.'}`)}catch(error){setPresetMessage(error.message,true)}finally{e.target.value=''}});
$$('[data-tab]').forEach(b=>b.addEventListener('click',()=>selectTab(b.dataset.tab)));
$('.tabs').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const tabs=$$('[data-tab]').map(b=>b.dataset.tab),i=tabs.indexOf(state.tab),n=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length;selectTab(tabs[n],true)});
$$('[data-jump]').forEach(a=>a.addEventListener('click',()=>selectTab(a.dataset.jump)));
$('#inspect-tokens').addEventListener('click',()=>selectTab('lab',true));
['fg','bg'].forEach(id=>{$('#'+id+'-hex').addEventListener('input',updateChecker);$('#'+id+'-color').addEventListener('input',e=>{$('#'+id+'-hex').value=e.target.value.toUpperCase();updateChecker()})});
$('#swap-colors').addEventListener('click',()=>setChecker($('#bg-hex').value,$('#fg-hex').value));
$('#copy-css').addEventListener('click',()=>copy(cssExport(),'Theme CSS copied'));
$('#download-css').addEventListener('click',()=>download(palettes[state.palette].id+'.css',cssExport(),'text/css'));
$('#download-json').addEventListener('click',()=>download(palettes[state.palette].id+'.tokens.json',JSON.stringify(buildTokenExport(),null,2),'application/json'));
$('#cancel-dialog').addEventListener('click',()=>$('#project-dialog').close());
$('#project-form').addEventListener('submit',e=>{e.preventDefault();const name=$('#project-name').value.trim();if(!name){$('#project-name').setCustomValidity('Enter a project name.');$('#project-name').reportValidity();return;}state.project=name;state.activity.unshift('Created '+name);$('#project-dialog').close();$('#project-form').reset();renderPreview();toast('Sample project created: '+name)});
$('#project-name').addEventListener('input',e=>e.target.setCustomValidity(''));
$('#all-colors').innerHTML=palettes.flatMap(p=>paletteColors(p).map((c,i)=>`<option value="${c}" label="${escapeHTML(p.name)} · ${i+1}"></option>`)).join('');
renderAll();renderFontGuide();setChecker(paletteColors(palettes[state.palette])[0],paletteColors(palettes[state.palette])[5]);

if(typeof AtlasSelects!=='undefined')AtlasSelects.enhanceAll();
