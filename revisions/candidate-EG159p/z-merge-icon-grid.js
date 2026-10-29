(function(){
'use strict';
let latest=null;
const views=[];
function el(tag,text){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;}
function itemFor(key,label){
 const split=key.indexOf(':'),source=key.slice(0,split),id=key.slice(split+1),items=window.GulchItemCatalog?.items||{};
 if(source==='field')return items[id]||{id,name:label,glyph:'✦'};
 if(source==='resource')return {id,name:label,type:'Material',glyph:'◆'};
 if(source==='supply')return {id,name:label,type:'Consumable',glyph:'✚'};
 if(source==='legacy'&&latest){
  const d=latest.gameState,raw=latest.player.inventory??d.inventory??latest.seed.inventory??[],value=(raw.items||raw)[id];
  const record=value&&typeof value==='object'?value:{},ref=record.itemId||record.id||(typeof value==='string'?value:id);
  let definition=items[ref]||{};
  for(const source of [latest.seed.items,latest.seed.itemDefinitions,d.items]){
   const found=Array.isArray(source)?source.find(v=>v?.id===ref):source?.[ref];
   if(found&&typeof found==='object')definition={...definition,...found};
  }
  return {...definition,...(record.item&&typeof record.item==='object'?record.item:{}),...record,id:ref,name:record.name||definition.name||label};
 }
 return {id,name:label,glyph:'◇'};
}
function render(view){
 const {select,grid,clear,summary}=view;
 const options=Array.from(select.options).filter(o=>o.value);
 const signature=JSON.stringify([select.value,select.disabled,options.map(o=>[o.value,o.textContent,o.disabled]),latest?.revision,latest?.stateRevision]);
 if(signature===view.signature)return;
 view.signature=signature;
 const focused=grid.contains(document.activeElement)?document.activeElement?.dataset.mergeChoice:null,scroll=grid.scrollTop;
 const fragment=document.createDocumentFragment();
 for(const option of options){
  const match=option.textContent.match(/^(.*) ×(\d+) · (.*)$/),name=match?match[1]:option.textContent,item=itemFor(option.value,name);
  const button=el('button');button.type='button';button.className='merge-choice';button.dataset.mergeChoice=option.value;
  if(option.value.startsWith('field:'))button.dataset.fusionItem=option.value.slice(6);
  button.disabled=select.disabled||option.disabled;
  button.setAttribute('aria-pressed',String(select.value===option.value));
  button.setAttribute('aria-label',name+(match?' · '+match[2]+' available':'')+' · '+view.label);
  button.title=item.description||item.desc||name;
  const art=el('span');art.className='merge-choice-art';art.setAttribute('aria-hidden','true');
  if(Number.isInteger(item.referenceSword)&&window.GulchReferenceSwordArt?.icon)window.GulchReferenceSwordArt.icon(art,item);
  else window.GulchItemPresentation?.icon(art,item);
  if(!art.childNodes.length)art.textContent=item.glyph||'◇';
  const text=el('span',name);text.className='merge-choice-name';
  button.append(art,text,el('small',match?match[2]+' available · '+match[3]:'Available'));
  if(item.letterTier)button.append(el('small','Tier '+item.letterTier.letter));
  button.addEventListener('click',()=>{
   if(select.disabled||!Array.from(select.options).some(o=>o.value===option.value&&!o.disabled))return;
   select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));refresh();
  });
  fragment.append(button);
 }
 if(!options.length)fragment.append(el('p','No available ingredients. Gather items or unequip reserved copies.'));
 grid.replaceChildren(fragment);grid.scrollTop=scroll;
 clear.disabled=select.disabled||!select.value;
 summary.textContent=select.value?'Selected: '+(select.selectedOptions[0]?.textContent||'item'):'Choose an ingredient below.';
 if(focused){const replacement=Array.from(grid.children).find(n=>n.dataset.mergeChoice===focused);if(replacement&&!replacement.disabled)replacement.focus({preventScroll:true});else{summary.tabIndex=-1;summary.focus({preventScroll:true});}}
}
function refresh(){for(const view of views)render(view);}
function mount(){
 const root=document.getElementById('mergeForge');if(!root)return;
 const style=el('style');style.textContent=`
#mergeForge .fusion-slots{align-items:start}
#mergeForge .merge-native-choice{display:none!important}
#mergeForge .merge-choice-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(95px,1fr));gap:7px;max-height:340px;overflow:auto;padding:4px;align-content:start;scrollbar-gutter:stable}
#mergeForge .merge-choice{display:flex;flex-direction:column;align-items:center;gap:5px;width:100%;min-width:0;min-height:132px;margin:0;padding:9px 6px;background:#132d2d;border:1px solid #60796d;border-radius:6px;text-align:center;overflow-wrap:anywhere}
#mergeForge .merge-choice:hover:not(:disabled){background:#29443a;border-color:#e5cd91}
#mergeForge .merge-choice[aria-pressed=true]{background:#3a5039;border:2px solid #ffe0a0;padding:8px 5px;box-shadow:inset 0 0 0 1px #b9a16c}
#mergeForge .merge-choice-art{display:grid;place-items:center;width:48px;height:48px;background:#091b21;border-radius:4px;font-size:28px;color:#f2d79a}
#mergeForge .merge-choice-art canvas,#mergeForge .merge-choice-art img{width:44px;height:44px;object-fit:contain;image-rendering:pixelated}
#mergeForge .merge-choice-name{flex:1;font-size:11px;color:#f0dfb7}
#mergeForge .merge-choice small{font-size:10px;color:#b8cdbb}
#mergeForge .merge-choice-summary{font-size:11px;min-height:36px;margin:4px 0;overflow-wrap:anywhere}
#mergeForge .merge-choice-heading{font-size:13px;color:#ffe0a0;margin:8px 0}
#mergeForge .merge-choice-grid>p{grid-column:1/-1}
@media(max-width:500px){#mergeForge .merge-choice-grid{max-height:240px;grid-template-columns:repeat(auto-fill,minmax(90px,1fr))}}
`;
 document.head.append(style);
 for(const [id,label] of [['fusionFirst','First ingredient'],['fusionSecond','Second ingredient']]){
  const select=document.getElementById(id);if(!select)continue;
  const original=select.parentElement,section=el('section'),heading=el('h3',label),summary=el('p'),grid=el('div'),clear=el('button','Clear this slot');
  heading.id=id+'GridTitle';heading.className='merge-choice-heading';summary.className='merge-choice-summary';summary.setAttribute('aria-live','polite');grid.className='merge-choice-grid';grid.setAttribute('role','group');grid.setAttribute('aria-labelledby',heading.id);clear.type='button';
  original.before(section);section.append(heading,summary,grid,clear,original);original.hidden=true;original.classList.add('merge-native-choice');
  const view={select,grid,clear,summary,label,signature:null};views.push(view);
  clear.addEventListener('click',()=>{if(select.disabled)return;select.value='';select.dispatchEvent(new Event('change',{bubbles:true}));refresh();});
  select.addEventListener('change',refresh);
  new MutationObserver(()=>render(view)).observe(select,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['disabled','selected']});
 }
 refresh();
 setTimeout(()=>{for(const view of views)view.signature=null;refresh();},0);
}
Gulch.register('merge-ingredient-icon-grids',{snapshot(s){latest=s;refresh();}});
if(document.readyState==='complete')mount();else window.addEventListener('load',mount,{once:true});
})();

(function(){
'use strict';
let latest=null,root=null,panel=null,summary=null,totals=null,list=null,signature='';
const epoch=d=>String(d?.respawnSettings?.token||'original');
const count=n=>Number.isFinite(Number(n))?Math.max(0,Math.min(999,Math.floor(Number(n)))):0;
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);return n;}
function stat(dl,label,value){dl.append(el('dt',label),el('dd',value));}
function render(){
 if(!root||!latest||panel.hidden||root.hidden)return;
 const d=latest.gameState,token=epoch(d),f=d.freeformForge?.epoch===token?d.freeformForge:{},pack=d.itemEcosystem?.epoch===token?d.itemEcosystem:{},used=new Map(),active=[];
 for(let slot=0;slot<9;slot++){
  const id=f.grid?.[slot],item=typeof id==='string'?f.definitions?.[id]:null,n=used.get(id)||0;
  if(!item||count(pack.bag?.[id])<=n)continue;
  used.set(id,n+1);
  const power=item.fusionPower,kind=power?.kind;
  const strength=Number.isFinite(Number(power?.strength))?Math.max(0,Math.min(100,Number(power.strength))):0;
  const recharge=Math.max(2,Number(power?.cooldown)||6);
  const remaining=Math.max(0,Math.max(Number(f.gridReady?.[id])||0,Number(f.readyTurn)||0)-(Number(d.turn)||0));
  active.push({slot,id,item,kind,strength,recharge,remaining,duplicate:n>0});
 }
 const key=JSON.stringify([token,latest.player.hp,d.gulchPermanentGameOver?.ended,active]);
 if(signature===key)return;signature=key;
 const scroll=list.scrollTop;
 const sums={flare:0,mend:0,ward:0},ready={flare:0,mend:0,ward:0};let unique=0,available=0;
 for(const row of active){
  if(row.duplicate||!Object.hasOwn(sums,row.kind))continue;
  unique++;sums[row.kind]+=row.strength;
  if(!row.remaining){available++;ready[row.kind]+=row.strength;}
 }
 const dead=latest.player.hp<=0||d.gulchPermanentGameOver?.ended;
 summary.textContent=active.length+' / 9 slots filled · '+unique+' distinct powers · '+(dead?'inactive after death':available+' ready');
 totals.replaceChildren();
 stat(totals,'Flare damage','+'+sums.flare);
 stat(totals,'Mend healing','Up to '+sums.mend+' HP');
 stat(totals,'Ward protection','Up to '+sums.ward+' damage');
 stat(totals,'Ready now',dead?'Inactive':'Flare +'+ready.flare+' · Mend '+ready.mend+' · Ward '+ready.ward);
 list.replaceChildren();
 if(!active.length)list.append(el('li','No merged powers equipped. Choose a grid slot and add a creation from the waiting box to see its stats here.'));
 for(const row of active){
  const li=el('li'),name=el('h4','Slot '+(row.slot+1)+' · '+String(row.item.name||row.id)),dl=el('dl');
  const tier=row.item.letterTier||window.GulchItemTiers?.info(row.item);
  stat(dl,'Tier',tier?.letter||'Unrated');
  stat(dl,'Value',tier?.value??row.item.craftValue??'—');
  stat(dl,'Generation',row.item.fusionGeneration??1);
  const label=row.kind==='flare'?'Flare · +'+row.strength+' damage':row.kind==='mend'?'Mend · up to '+row.strength+' HP':row.kind==='ward'?'Ward · up to '+row.strength+' prevented':'No recognized power';
  stat(dl,'Power',label);
  stat(dl,'Recharge',row.recharge+' played turns');
  stat(dl,'Status',dead?'Inactive':row.remaining?row.remaining+' turns remaining':'Ready');
  const trigger=row.kind==='flare'?'Adds damage to the surviving nearby hostile struck by melee.':row.kind==='mend'?'Heals after a nearby melee hit if you survive retaliation.':row.kind==='ward'?'Reduces incoming health loss if you survive, leaving at least 1 base damage.':'This creation has no supported grid power.';
  li.append(name,dl,el('p',trigger));
  if(row.duplicate)li.append(el('p','Duplicate copy: shares this creation’s power and cooldown; does not add another activation.'));
  list.append(li);
 }
 list.scrollTop=scroll;
}
function mount(){
 root=document.getElementById('mergeForge');panel=document.getElementById('inventoryPanel');
 const grid=document.getElementById('fusionPowerGrid');
 if(!root||!panel||!grid)return;
 const style=el('style');style.textContent=`
#mergeForge .fusion-grid-and-stats{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(190px,1fr);gap:14px;align-items:start;margin:12px 0}
#mergeForge .fusion-grid-and-stats #fusionPowerGrid{width:100%;min-width:0;margin:0;max-width:none}
#mergeForge #fusionPowerStats{min-width:0;padding:12px;border:1px solid #879477;border-radius:8px;background:#0b1c22;color:#dae5d5;font:11px/1.6 monospace}
#fusionPowerStats h3{margin:0 0 8px;color:#ffe0a0;font-size:13px;letter-spacing:1px}
#fusionPowerStats h4{margin:0 0 7px;color:#f0dcae;font-size:12px;overflow-wrap:anywhere}
#fusionPowerStats p{margin:7px 0;overflow-wrap:anywhere}
#fusionPowerStats dl{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:4px 9px;margin:8px 0;font-variant-numeric:tabular-nums}
#fusionPowerStats dt{color:#adc3b3}
#fusionPowerStats dd{margin:0;text-align:right;color:#f1e3c0;overflow-wrap:anywhere}
#fusionPowerStatsList{list-style:none;margin:12px 0 0;padding:0;max-height:430px;overflow:auto;scrollbar-gutter:stable}
#fusionPowerStatsList li{padding:12px 0;border-top:1px solid #3d574e;overflow-wrap:anywhere}
#fusionPowerStatsList li p{color:#b9cbbd;font-size:10px}
#fusionPowerStats .fusion-stats-note{color:#afc3b7;font-size:10px}
@media(max-width:560px){#mergeForge .fusion-grid-and-stats{grid-template-columns:minmax(0,1fr)}#fusionPowerStatsList{max-height:300px}}
`;document.head.append(style);
 const layout=el('div');layout.className='fusion-grid-and-stats';grid.before(layout);layout.append(grid);
 const aside=el('aside');aside.id='fusionPowerStats';aside.setAttribute('aria-labelledby','fusionPowerStatsTitle');
 const title=el('h3','MERGED ITEM STATS');title.id='fusionPowerStatsTitle';
 summary=el('p');summary.setAttribute('role','status');
 totals=el('dl');totals.setAttribute('aria-label','Combined slotted power strengths');
 list=el('ul');list.id='fusionPowerStatsList';list.setAttribute('aria-label','Stats for each slotted merged item');list.tabIndex=0;
 const note=el('p','Totals are conditional power strengths, not base attack or armor. Each distinct creation activates once per recharge, even with multiple copies slotted. Healing cannot exceed maximum HP; powers cannot revive you. Waiting-box items grant no powers.');note.className='fusion-stats-note';
 aside.append(title,summary,totals,note,list);layout.append(aside);
 new MutationObserver(render).observe(panel,{attributes:true,attributeFilter:['hidden','data-inventory-page']});
 new MutationObserver(render).observe(root,{attributes:true,attributeFilter:['hidden']});
 render();
}
Gulch.register('merged-grid-statistics',{snapshot(s){latest=s;render();}});
if(document.readyState==='complete')mount();else window.addEventListener('load',mount,{once:true});
})();
