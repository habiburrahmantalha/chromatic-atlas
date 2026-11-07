// Accessible select-only comboboxes; hidden selects remain the app's data source.
const AtlasSelects = (() => {
 const instances = new Map();
 let opened = null;
 const ids = ['template-select','font-select','feedback-select','audit-mode','preset-select'];
 const arrow = '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="m2 4 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
 const descriptions = {
  dashboard:'Projects, metrics and everyday work.',shopping:'Product cards, categories and a sample bag.',
  reading:'Editorial type, long text and reading controls.',mobile:'A compact daily planner and habit tracker.'
 };
 function create(select) {
  const widget = document.createElement('span');
  widget.className='atlas-select';widget.dataset.select=select.id;
  const trigger=document.createElement('button');
  trigger.type='button';trigger.className='atlas-select-trigger';trigger.id=select.id+'-trigger';
  trigger.setAttribute('role','combobox');trigger.setAttribute('aria-haspopup','listbox');
  trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls',select.id+'-listbox');
  const value=document.createElement('span');value.className='atlas-select-value';
  const chevron=document.createElement('span');chevron.className='atlas-select-chevron';chevron.innerHTML=arrow;
  trigger.append(value,chevron);
  const labelIds=[];
  Array.from(select.labels||[]).forEach((label,index)=>{
   let name=label;
   if(label.contains(select)){
    name=document.createElement('span');
    const text=Array.from(label.childNodes).filter(n=>n.nodeType===3);
    name.textContent=text.map(n=>n.textContent).join(' ').trim();
    text.forEach(n=>n.remove());label.insertBefore(name,label.firstChild);
   }
   if(!name.id)name.id=select.id+'-label-'+index;
   label.htmlFor=trigger.id;labelIds.push(name.id);
  });
  if(labelIds.length)trigger.setAttribute('aria-labelledby',labelIds.join(' '));
  else trigger.setAttribute('aria-label',select.getAttribute('aria-label')||select.id.replace(/-/g,' '));
  const popup=document.createElement('div');popup.id=select.id+'-listbox';popup.className='atlas-select-popup';
  popup.setAttribute('role','listbox');popup.hidden=true;
  if(labelIds.length)popup.setAttribute('aria-labelledby',labelIds.join(' '));
  else popup.setAttribute('aria-label',trigger.getAttribute('aria-label'));
  select.before(widget);widget.append(select,trigger);document.body.append(popup);
  select.hidden=true;select.tabIndex=-1;select.setAttribute('aria-hidden','true');
  const item={select,widget,trigger,value,popup,active:-1,options:[],search:'',searchTimer:null};
  instances.set(select,item);
  trigger.addEventListener('click',()=>opened===item?close():open(item));
  trigger.addEventListener('keydown',event=>keydown(item,event));
  trigger.addEventListener('blur',()=>{if(opened===item)close()});
  select.addEventListener('change',()=>refresh(item));
  popup.addEventListener('pointerdown',event=>event.preventDefault());
  popup.addEventListener('click',event=>{
   const option=event.target.closest('[role="option"]');
   if(option&&popup.contains(option))commit(item,Number(option.dataset.index));
  });
  popup.addEventListener('pointermove',event=>{
   const option=event.target.closest('[role="option"]');
   if(option&&popup.contains(option)&&option.getAttribute('aria-disabled')!=='true')activate(item,Number(option.dataset.index),false);
  });
  new MutationObserver(()=>refresh(item)).observe(select,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','label','value','selected']});
  refresh(item);
 }
 function refresh(item) {
  const {select,trigger,value,popup}=item;
  value.textContent=select.selectedOptions[0]?.label||'Choose an option';
  trigger.disabled=select.disabled||!Array.from(select.options).some(option=>!option.disabled&&!option.parentElement?.disabled);
  trigger.title=value.textContent;
  const previous=item.active;
  item.options=Array.from(select.options);
  popup.replaceChildren();
  item.options.forEach((source,index)=>{
   const option=document.createElement('div');option.className='atlas-select-option';
   option.id=select.id+'-option-'+index;option.dataset.index=String(index);option.setAttribute('role','option');
   option.setAttribute('aria-selected',String(source.selected));
   option.setAttribute('aria-disabled',String(source.disabled||source.parentElement?.disabled||false));
   const copy=document.createElement('span');copy.className='atlas-select-copy';
   const title=document.createElement('span');title.className='atlas-select-option-title';
   const parts=source.label.split(' — ');title.textContent=parts[0];copy.append(title);
   const description=select.id==='template-select'?descriptions[source.value]:parts.slice(1).join(' — ');
   if(description){const detail=document.createElement('span');detail.className='atlas-select-option-detail';detail.textContent=description;copy.append(detail);}
   const mark=document.createElement('span');mark.className='atlas-select-check';mark.setAttribute('aria-hidden','true');mark.textContent=source.selected?'✓':'';
   option.append(copy,mark);popup.append(option);
  });
  if(opened===item){
   if(select.disabled||!item.options.length){close();return;}
   activate(item,isEnabled(item,previous)?previous:nearest(item,select.selectedIndex),false);
   position(item);
  }
 }
 function isEnabled(item,index){const option=item.options[index];return Boolean(option&&!option.disabled&&!option.parentElement?.disabled);}
 function nearest(item,index){return isEnabled(item,index)?index:item.options.findIndex((_,i)=>isEnabled(item,i));}
 function activate(item,index,scroll=true){
  if(!isEnabled(item,index))return;
  item.active=index;
  Array.from(item.popup.children).forEach((option,i)=>option.classList.toggle('is-active',i===index));
  item.trigger.setAttribute('aria-activedescendant',item.select.id+'-option-'+index);
  const option=item.popup.children[index];
  if(scroll&&option){
   const top=option.offsetTop,bottom=top+option.offsetHeight;
   if(top<item.popup.scrollTop)item.popup.scrollTop=top;
   else if(bottom>item.popup.scrollTop+item.popup.clientHeight)item.popup.scrollTop=bottom-item.popup.clientHeight;
  }
 }
 function position(item){
  const rect=item.trigger.getBoundingClientRect(),margin=8,gap=7;
  const width=Math.min(Math.max(rect.width,item.select.id==='font-select'?340:270),window.innerWidth-margin*2);
  item.popup.style.width=width+'px';
  item.popup.style.left=Math.max(margin,Math.min(rect.left,window.innerWidth-width-margin))+'px';
  const below=window.innerHeight-rect.bottom-gap-margin,above=rect.top-gap-margin;
  const useAbove=below<180&&above>below;
  const available=Math.max(60,useAbove?above:below);
  item.popup.style.maxHeight=Math.min(380,available)+'px';
  item.popup.style.top=(useAbove?Math.max(margin,rect.top-gap-Math.min(item.popup.scrollHeight,380,available)):rect.bottom+gap)+'px';
 }
 function open(item){
  if(item.trigger.disabled||!item.options.length)return;
  if(opened)close();
  refresh(item);opened=item;item.popup.hidden=false;
  item.trigger.setAttribute('aria-expanded','true');position(item);
  activate(item,nearest(item,item.select.selectedIndex));
 }
 function close(){
  if(!opened)return;
  const item=opened;opened=null;item.popup.hidden=true;
  item.trigger.setAttribute('aria-expanded','false');item.trigger.removeAttribute('aria-activedescendant');
  item.search='';clearTimeout(item.searchTimer);
 }
 function commit(item,index){
  if(!isEnabled(item,index))return;
  const changed=item.select.selectedIndex!==index;
  item.select.selectedIndex=index;close();refresh(item);item.trigger.focus();
  if(changed)item.select.dispatchEvent(new Event('change',{bubbles:true}));
 }
 function move(item,delta){
  let index=item.active;
  for(let step=0;step<item.options.length;step++){
   index=(index+delta+item.options.length)%item.options.length;
   if(isEnabled(item,index)){activate(item,index);return;}
  }
 }
 function keydown(item,event){
  if(item.trigger.disabled)return;
  const key=event.key;
  if(key==='Tab'){if(opened===item)close();return;}
  if(event.altKey&&key==='ArrowUp'&&opened===item){event.preventDefault();close();return;}
  if(key==='Escape'){if(opened===item){event.preventDefault();event.stopPropagation();close();}return;}
  if(key==='ArrowDown'||key==='ArrowUp'){
   event.preventDefault();if(opened!==item)open(item);else move(item,key==='ArrowDown'?1:-1);return;
  }
  if(key==='Home'||key==='End'){
   event.preventDefault();if(opened!==item)open(item);
   const indexes=item.options.map((_,i)=>i).filter(i=>isEnabled(item,i));
   activate(item,key==='Home'?indexes[0]:indexes[indexes.length-1]);return;
  }
  if(key==='Enter'||(key===' '&&!item.search)){
   event.preventDefault();if(opened===item)commit(item,item.active);else open(item);return;
  }
  if(key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
   event.preventDefault();if(opened!==item)open(item);
   const lower=key.toLocaleLowerCase();item.search+=lower;clearTimeout(item.searchTimer);
   item.searchTimer=setTimeout(()=>{item.search=''},700);
   const query=Array.from(item.search).every(c=>c===lower)?lower:item.search;
   for(let step=1;step<=item.options.length;step++){
    const index=(item.active+step+item.options.length)%item.options.length;
    if(isEnabled(item,index)&&item.options[index].label.trim().toLocaleLowerCase().startsWith(query)){activate(item,index);break;}
   }
  }
 }
 document.addEventListener('pointerdown',event=>{if(opened&&!opened.widget.contains(event.target)&&!opened.popup.contains(event.target))close()});
 window.addEventListener('resize',close);
 document.addEventListener('scroll',event=>{if(opened&&event.target!==opened.popup&&!opened.popup.contains(event.target))close()},true);
 return {
  enhanceAll(){ids.forEach(id=>{const select=document.getElementById(id);if(select&&!instances.has(select))create(select)});},
  refreshAll(){instances.forEach(refresh);},
  close
 };
})();
