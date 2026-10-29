(function(){
'use strict';
const KEY='freeformForge';
let latest=null,refresh=()=>{};
const epoch=d=>String(d?.respawnSettings?.token||'original');
const count=n=>Number.isFinite(Number(n))?Math.max(0,Math.min(999,Math.floor(Number(n)))):0;
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
function state(d){const v=d?.[KEY];return v?.epoch===epoch(d)?{...v,grid:Array.from({length:9},(_,i)=>typeof v.grid?.[i]==='string'?v.grid[i]:null)}:{epoch:epoch(d),definitions:{},grid:Array(9).fill(null),active:null,receipt:null};}
function catalog(){return window.GulchItemCatalog?.items||{};}
function pack(d){return d.itemEcosystem?.epoch===epoch(d)?d.itemEcosystem:{epoch:epoch(d),bag:{},equipment:{},known:[],crafted:[],log:[]};}
function validGrid(d){const f=state(d),p=pack(d),used={};return f.grid.map(id=>{if(!id||!f.definitions?.[id]||count(p.bag?.[id])<=(used[id]||0))return null;used[id]=(used[id]||0)+1;return id;});}
function publish(d){const base=window.GulchItemCatalog;if(!base)return;const items={};for(const [id,item] of Object.entries(base.items))if(!item.freeformFusion)items[id]=item;for(const [id,item] of Object.entries(state(d).definitions||{}))items[id]=item;window.GulchItemCatalog=Object.freeze({...base,items:Object.freeze(items)});}
Gulch.register('merge-items',{snapshot(s){latest=s;publish(s.gameState);refresh();}});
function mount(){
 const panel=document.getElementById('inventoryPanel'),nav=panel?.querySelector('.new-inventory-nav');if(!panel||!nav)return;
 let first='',second='',pending=null,context='',signature='',selectedSlot=null;
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const button=(text,fn)=>{const b=el('button',text);b.type='button';b.addEventListener('click',fn);return b;};
 const style=el('style');style.textContent=`
#inventoryPanel[data-inventory-page=merge] .inventory-body,#inventoryPanel[data-inventory-page=merge] #itemWorkshop{display:none!important}
#mergeForge[hidden],#mergeForge [hidden]{display:none!important}
#mergeForge{flex:1;min-height:0;overflow:auto;padding:16px;background:#102127;color:#e3e8d4;font:12px/1.6 monospace}
#mergeForge h2{color:#ffe0a0;margin:0;font:24px Georgia,serif}
#mergeForge .fusion-slots{display:grid;grid-template-columns:1fr 1fr;gap:12px}
#mergeForge label{display:block;margin:10px 0}
#mergeForge select{width:100%;min-height:44px;background:#09201d;color:#eee5cf;border:1px solid #799582;font:inherit;padding:8px}
#mergeForge button{min-height:44px;margin:5px 5px 5px 0;touch-action:manipulation}
#mergeForge button:disabled{opacity:.5;cursor:default}
#mergeForge article{padding:12px;border:1px solid #718675;background:#172e2e;margin:12px 0;white-space:pre-line;overflow-wrap:anywhere}
#mergeForge progress{width:100%;accent-color:#d9be7b}
#mergeForgeStatus{min-height:24px;color:#ffe0a0}
#mergeForge :focus-visible{outline:2px solid #ffe0a0;outline-offset:3px}
#fusionPowerGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;max-width:540px;margin:12px auto}
#mergeForge .fusion-grid-slot{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;min-height:122px;width:100%;margin:0;padding:10px 5px;border:2px solid #587b6b;background:#0a1d22;color:#e3e8d4;overflow-wrap:anywhere;font:11px/1.5 monospace}
#mergeForge .fusion-grid-slot[data-filled=true]{background:#243c32;border-color:#b9b378}
#mergeForge .fusion-grid-slot[aria-expanded=true]{outline:3px solid #ffe0a0;outline-offset:2px}
.fusion-grid-art{display:grid;place-items:center;width:40px;height:40px;font-size:28px}
.fusion-grid-art canvas{width:40px;height:40px;image-rendering:pixelated}
#fusionSlotPicker{padding:14px;margin:16px 0;border:1px solid #dec88c;border-radius:10px;background:#172e30;scroll-margin:12px}
#fusionSlotPicker h3{margin:0;color:#ffe7b1}
#fusionSlotChoices{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;max-height:300px;overflow:auto;padding:4px}
#mergeForge .fusion-picker-choice{display:flex;flex-direction:column;align-items:center;gap:7px;margin:0;padding:12px;background:#263d33;border:1px solid #bca475;border-radius:8px;overflow-wrap:anywhere}
#fusionWaitingBox{position:relative;margin:26px 0 8px;padding:18px;border:2px solid #dbbc78;border-radius:14px;background:radial-gradient(ellipse at top,#66573355,transparent 70%),linear-gradient(135deg,#273831,#101f26);box-shadow:inset 0 0 24px #e7c66d12,0 0 18px #e7c66d20;color:#eee5c6}
#fusionWaitingBox:before{content:'';position:absolute;left:18px;right:18px;top:-2px;height:2px;background:linear-gradient(90deg,transparent,#fff3bd,transparent);pointer-events:none}
#fusionWaitingBox h3{margin:0;color:#ffe7a9;font:21px Georgia,serif}
#fusionWaitingItems{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}
#mergeForge #fusionWaitingItems article{position:relative;margin:0;padding:14px;border:1px solid #c6a768;border-radius:10px;background:linear-gradient(145deg,#4c4930aa,#182c2a);box-shadow:inset 0 1px #fff0b64d,0 3px 14px #0003;white-space:normal}
#fusionWaitingItems article:after{content:'✦';position:absolute;top:5px;right:9px;color:#ffeab1;text-shadow:0 0 8px #ffd576;pointer-events:none;animation:fusion-box-glimmer 3s ease-in-out infinite}
#fusionWaitingItems article:nth-child(2n):after{animation-delay:1.2s}
#fusionWaitingItems strong{display:block;color:#fff0c5;overflow-wrap:anywhere}
#fusionWaitingItems p{font-size:11px;margin:8px 0}
#fusionWaitingItems .fusion-waiting-art{display:grid;place-items:center;min-height:60px;margin:0 0 10px;font-size:36px}
#fusionWaitingItems .fusion-waiting-art canvas{width:56px;height:56px;image-rendering:pixelated}
#fusionWaitingCount{color:#d7c591;font-size:11px}
@keyframes fusion-box-glimmer{0%,100%{opacity:.5}50%{opacity:1;text-shadow:0 0 12px #ffe8a0}}
@media(prefers-reduced-motion:reduce){#fusionWaitingItems article:after{animation:none}}
@media(max-width:500px){#mergeForge .fusion-slots{grid-template-columns:1fr}#mergeForge .fusion-grid-slot{min-height:110px;font-size:10px}#fusionWaitingBox{padding:12px}#fusionWaitingItems{grid-template-columns:repeat(auto-fill,minmax(120px,1fr))}}
`;document.head.append(style);
 const root=el('section');root.id='mergeForge';root.hidden=true;root.setAttribute('aria-label','Freeform item forge');
 const tab=button('Merge Items',()=>{panel.dataset.inventoryPage='merge';for(const b of nav.querySelectorAll('[aria-pressed]'))b.setAttribute('aria-pressed',String(b===tab));sync();});tab.setAttribute('aria-pressed','false');tab.setAttribute('aria-controls',root.id);nav.append(tab);
 const slots=el('div');slots.className='fusion-slots';
 function slot(label,id){const wrap=el('label',label),select=el('select');select.id=id;wrap.htmlFor=id;wrap.append(select);slots.append(wrap);return select;}
 const a=slot('Place first item','fusionFirst'),b=slot('Place second item','fusionSecond');
 const travelLabel=el('p'),travel=el('progress'),huntLabel=el('p'),hunt=el('progress');travel.max=20;hunt.max=3;travel.setAttribute('aria-label','Movement charge');hunt.setAttribute('aria-label','Defeat charge');
 const preview=el('article');preview.setAttribute('aria-live','polite');
 const merge=button('Merge into waiting box',submit),clear=button('Clear ingredients',()=>{first=second='';signature='';render();});
 const status=el('p');status.id='mergeForgeStatus';status.setAttribute('role','status');
 const gridTitle=el('h3','POWER GRID · 3 × 3');gridTitle.id='fusionGridTitle';
 const grid=el('div');grid.id='fusionPowerGrid';grid.setAttribute('role','group');grid.setAttribute('aria-labelledby',gridTitle.id);
 const picker=el('section');picker.id='fusionSlotPicker';picker.hidden=true;picker.setAttribute('aria-labelledby','fusionSlotPickerTitle');
 const pickerTitle=el('h3');pickerTitle.id='fusionSlotPickerTitle';pickerTitle.tabIndex=-1;
 const pickerHint=el('p'),pickerChoices=el('div');pickerChoices.id='fusionSlotChoices';
 const returnItem=button('Return to waiting box',removeSelected),cancel=button('Close selection',()=>closePicker(true));
 picker.append(pickerTitle,pickerHint,pickerChoices,returnItem,cancel);
 const waitingBox=el('section');waitingBox.id='fusionWaitingBox';waitingBox.setAttribute('aria-labelledby','fusionWaitingTitle');
 const waitingTitle=el('h3','✦ MERGED ITEMS');waitingTitle.id='fusionWaitingTitle';
 const waitingCount=el('p');waitingCount.id='fusionWaitingCount';waitingCount.setAttribute('aria-live','polite');
 const creations=el('div');creations.id='fusionWaitingItems';
 waitingBox.append(waitingTitle,el('p','Every new merge waits here until you choose a power-grid slot. Only available creations in this box can be added to the grid.'),waitingCount,creations);
 root.append(el('h2','The Unbound Forge'),el('p','Combine any two available carried items, including earlier creations. Equipped items, active grid copies and quest relics are reserved. The new item appears in the waiting box after the room confirms the merge.'),travelLabel,travel,huntLabel,hunt,slots,preview,merge,clear,status,gridTitle,el('p','Click an empty slot, then choose a creation from the waiting box. Click an occupied slot to replace its creation or return it to the box. Only slotted creations activate powers.'),grid,picker,el('p','Merging costs 20 movement charge and 3 enemy defeats. Adding, replacing and returning grid items costs nothing. A replacement returns the old item to the waiting box. Powers recharge on played turns and cannot revive you. All nine slots are shared. Up to 96 creation definitions are retained per expedition.'),waitingBox);
 panel.querySelector('.inventory-footer').before(root);
 const gridButtons=[];
 for(let i=0;i<9;i++){
  const btn=button('',()=>{if(!ready())return;selectedSlot=i;render();pickerTitle.focus({preventScroll:true});picker.scrollIntoView({block:'nearest'});});
  btn.className='fusion-grid-slot';btn.dataset.fusionGridSlot=String(i);btn.setAttribute('aria-controls',picker.id);btn.setAttribute('aria-expanded','false');grid.append(btn);gridButtons.push(btn);
 }
 function definition(id,d){if(catalog()[id])return catalog()[id];for(const source of [d.seed.items,d.seed.itemDefinitions,d.items]){const found=Array.isArray(source)?source.find(v=>v?.id===id):source?.[id];if(object(found))return found;}return {};}
 function inventory(d){const p=d.seed.entities.find(e=>e.id==='player'),raw=p.inventory??d.inventory??d.seed.inventory??[];return {p,raw,contents:object(raw)&&Object.hasOwn(raw,'items')?raw.items:raw};}
 function entries(d){
  const out=[],p=pack(d),worn=window.GulchEquipmentSlots?.equipment(p)||p.equipment||{},board=validGrid(d);
  for(const [id,n] of Object.entries(p.bag||{})){
   const item=catalog()[id]||{id,name:id,type:'Material'},reserved=Object.values(worn).filter(v=>v===id).length+board.filter(v=>v===id).length,free=Math.max(0,count(n)-reserved);
   if(free&&!/quest/i.test([item.type,item.category,item.kind].join(' '))&&id!=='legendary-sword-first-light')out.push({key:'field:'+id,id,item,free,source:'field'});
  }
  for(const [id,n] of Object.entries(d.outsideWorld?.resources||{}))if(count(n))out.push({key:'resource:'+id,id:'$'+id,item:{id:'$'+id,name:id,type:'Material',craftValue:window.GulchRecipeBook?.value('$'+id)||2},free:count(n),source:'resource',rawKey:id});
  for(const [key,field,id,name] of [['livingWorld','herbs','@herb','Healing herbs'],['regionSupplies','food','@food','Provisions']])if(d[key]?.epoch===epoch(d)&&count(d[key][field]))out.push({key:'supply:'+id,id,item:{id,name,type:'Consumable',craftValue:9},free:count(d[key][field]),source:'supply',stateKey:key,field});
  const inv=inventory(d),equipment=inv.p.equipment??inv.p.equipped??inv.raw?.equipment??d.equipment??d.seed.equipment??{},reserved=new Set(Object.values(equipment).map(v=>typeof v==='string'?v:v?.itemId||v?.id||v?.item));
  for(const [key,value] of Object.entries(inv.contents||{})){
   if(value==null||value===false)continue;
   const record=object(value)?value:{},id=String(record.itemId||record.id||(typeof value==='string'?value:key)),item={...definition(id,d),...(object(record.item)?record.item:{}),...record,id};item.name=String(item.name||id);
   const n=count(record.quantity??record.count??(typeof value==='number'?value:1));
   if(!n||reserved.has(id)||id==='legendary-sword-first-light'||/quest/i.test([item.type,item.category,item.kind].join(' ')))continue;
   out.push({key:'legacy:'+key,id,item,free:n,source:'legacy',rawKey:key});
  }
  return out;
 }
 function waiting(d){const definitions=state(d).definitions||{};return entries(d).filter(r=>r.source==='field'&&Object.hasOwn(definitions,r.id));}
 function value(item){return Math.max(1,Math.min(100000,Number(item.craftValue)||Number(item.letterTier?.value)||((Number(item.bonus)||Number(item.damage)||0)*18)||((Number(item.heal)||0)*2)||2));}
 function hash(s){let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
 function blueprint(x,y){
  const generation=Math.min(99,1+Math.max(Number(x.item.fusionGeneration)||0,Number(y.item.fusionGeneration)||0)),baseValue=Math.min(100000,Math.ceil((value(x.item)+value(y.item))*1.2));
  const tier=window.GulchItemTiers?.info({craftValue:baseValue})||{letter:'Z',index:0,color:'#c6d5b8',value:baseValue,baseValue};
  const index=tier.index||0,h=hash([x.id,y.id].sort().join('|')+':'+generation),themes=['Ember','Moon','Thorn','Storm','Dawn','Frost'],forms=['Reliquary','Heart','Prism','Sigil','Crown','Echo'];
  const parentStrength=Math.max(Number(x.item.fusionPower?.strength)||0,Number(y.item.fusionPower?.strength)||0);
  const power=['flare','mend','ward'][h%3],strength=Math.min(100,Math.max(parentStrength+2,2+Math.floor(index/3)+generation)),cooldown=Math.max(2,6-Math.floor(index/8));
  const name=themes[h%6]+' '+forms[(h>>>8)%6]+' · '+generation;
  const lore='Born from '+String(x.item.name).slice(0,70)+' and '+String(y.item.name).slice(0,70)+', this '+name.toLowerCase()+' carries both journeys forward.';
  const skill=power==='flare'?'On a nearby melee hit: +'+strength+' damage to that hostile.':power==='mend'?'On a nearby melee hit: restore up to '+strength+' HP after surviving retaliation.':'When damaged and still alive: prevent up to '+strength+' damage, leaving at least 1 base damage.';
  return {name,type:'Relic',glyph:'✦',freeformFusion:true,fusionGeneration:generation,craftValue:Math.min(300000,tier.value),letterTier:{...tier,value:Math.min(300000,tier.value),skill},fusionPower:{kind:power,strength,cooldown},lore,description:lore+'\nTier '+tier.letter+' · Value '+Math.min(300000,tier.value)+' · Generation '+generation+'\n'+skill+' '+cooldown+' played-turn recharge. Active only in the 3 × 3 power grid. Maximum power: 100; maximum generation: 99. Cannot revive you.'};
 }
 function ready(){const m=window.GulchMovementState;return latest&&latest.player.hp>0&&!latest.gameState.gulchPermanentGameOver?.ended&&m?.focused&&!m.inFlight&&!pending&&!document.hidden&&!panel.hidden&&panel.dataset.inventoryPage==='merge'&&!panel.closest('[inert]')&&!document.querySelector('dialog[open]');}
 function charge(){return window.GulchMergeCharge?.state(latest?.gameState)||{steps:0,kills:0};}
 function choose(select,rows,key){select.replaceChildren();const blank=el('option','Choose an item…');blank.value='';select.append(blank);for(const r of rows){const o=el('option',r.item.name+' ×'+r.free+' · '+r.source);o.value=r.key;o.title=r.item.description||r.item.name;select.append(o);}select.value=rows.some(r=>r.key===key)?key:'';}
 function artwork(item,cls){const art=el('span');art.className=cls;art.setAttribute('aria-hidden','true');window.GulchFusionArt?.icon(art,item);if(!art.childNodes.length)art.textContent='✦';return art;}
 function closePicker(restore){const index=selectedSlot;selectedSlot=null;picker.hidden=true;gridButtons.forEach(n=>n.setAttribute('aria-expanded','false'));if(restore&&index!==null)gridButtons[index]?.focus({preventScroll:true});}
 function render(){
  if(root.hidden||panel.hidden)return;
  const rows=latest?entries(latest.gameState):[],x=rows.find(r=>r.key===first),y=rows.find(r=>r.key===second),c=charge();
  const key=JSON.stringify([rows.map(r=>[r.key,r.free]),first,second]);if(signature!==key){signature=key;choose(a,rows,first);choose(b,rows,second);}
  travel.value=c.steps;hunt.value=c.kills;travelLabel.textContent='Movement charge · '+c.steps+' / 20';huntLabel.textContent='Enemy defeats · '+c.kills+' / 3';
  const enough=x&&y&&(x.key!==y.key||x.free>=2),item=enough?blueprint(x,y):null;
  const previewText=item?item.name+'\n'+item.description:x&&y?'This combination needs two free copies.':'Place two items to preview their biography, power, tier and value.';
  const existing=Array.from(preview.childNodes).filter(n=>!n.classList?.contains('fusion-outcome-preview')).map(n=>n.textContent).join('');
  if(existing!==previewText)preview.textContent=previewText;
  merge.disabled=!ready()||!enough||c.steps<20||c.kills<3||Object.keys(state(latest?.gameState).definitions||{}).length>=96;
  a.disabled=b.disabled=clear.disabled=Boolean(pending);
  if(!latest)return;
  const d=latest.gameState,f=state(d),g=validGrid(d),available=waiting(d),can=Boolean(ready());
  const focused=document.activeElement,focusChoice=pickerChoices.contains(focused)?focused.dataset.fusionPick:null;
  gridButtons.forEach((btn,i)=>{
   const id=g[i],it=f.definitions?.[id];btn.disabled=!can;btn.dataset.filled=String(Boolean(it));btn.setAttribute('aria-expanded',String(selectedSlot===i));
   btn.setAttribute('aria-label','Power slot '+(i+1)+': '+(it?it.name:'empty')+'. Click to choose a waiting creation.');
   btn.replaceChildren(el('small','SLOT '+(i+1)),it?artwork(it,'fusion-grid-art'):el('span','+'),el('span',it?it.name:'Choose from box'));
   if(it){const wait=Math.max(0,Math.max(Number(f.gridReady?.[id])||0,Number(f.readyTurn)||0)-(Number(d.turn)||0));btn.append(el('small',it.fusionPower.kind+' '+it.fusionPower.strength+' · '+(wait?wait+' turns':'Ready')));}
  });
  picker.hidden=selectedSlot===null;
  if(selectedSlot!==null){
   const current=f.definitions?.[g[selectedSlot]];
   pickerTitle.textContent='Choose for slot '+(selectedSlot+1);
   pickerHint.textContent=current?'Replacing '+current.name+' returns it to the waiting box. Choose an available creation below.':'Choose an available creation from the shiny waiting box below.';
   pickerChoices.replaceChildren();
   for(const row of available){const pick=button('',()=>assign(row.id));pick.className='fusion-picker-choice';pick.dataset.fusionPick=row.id;pick.dataset.fusionItem=row.id;pick.disabled=!can;pick.append(artwork(row.item,'fusion-grid-art'),el('strong',row.item.name),el('small',row.free+' waiting · '+row.item.fusionPower.kind+' '+row.item.fusionPower.strength));pickerChoices.append(pick);}
   if(!available.length)pickerChoices.append(el('p','No creations are waiting. Merge two ingredients above, or return an occupied grid item to the box.'));
   returnItem.hidden=!current;returnItem.disabled=!can||!current;
   if(focusChoice){const replacement=Array.from(pickerChoices.children).find(n=>n.dataset.fusionPick===focusChoice);(replacement||cancel).focus({preventScroll:true});}
  }
  waitingCount.textContent=available.reduce((n,r)=>n+r.free,0)+' waiting · '+g.filter(Boolean).length+' / 9 active grid slots';
  const traySignature=JSON.stringify([available.map(r=>[r.id,r.free,r.item]),latest.revision]);
  if(creations.dataset.signature!==traySignature){
   creations.dataset.signature=traySignature;creations.replaceChildren();
   for(const row of available){const card=el('article');card.dataset.fusionItem=row.id;card.tabIndex=0;card.append(artwork(row.item,'fusion-waiting-art'),el('strong',row.item.name),el('p',row.free+' waiting · Tier '+(row.item.letterTier?.letter||'Z')),el('p',row.item.description),el('small','Click a grid slot above to activate.'));creations.append(card);}
   if(!available.length)creations.append(el('p','Your next merged item will shine here. Items already in the grid can be returned by clicking their slot.'));
  }
 }
 function spend(d,requests){
  const p=pack(d);d.itemEcosystem={...p,bag:{...p.bag}};const legacy=new Map();
  for(const r of requests){if(r.source==='field')d.itemEcosystem.bag[r.id]=count(d.itemEcosystem.bag[r.id])-1;else if(r.source==='resource')d.outsideWorld={...d.outsideWorld,resources:{...d.outsideWorld.resources,[r.rawKey]:Number(d.outsideWorld.resources[r.rawKey])-1}};else if(r.source==='supply')d[r.stateKey]={...d[r.stateKey],[r.field]:Number(d[r.stateKey][r.field])-1};else legacy.set(r.rawKey,(legacy.get(r.rawKey)||0)+1);}
  if(legacy.size){const inv=inventory(d),changed=Array.isArray(inv.contents)?[]:{};for(const [key,v] of Object.entries(inv.contents||{})){const used=legacy.get(key)||0,record=object(v)?v:{},n=count(record.quantity??record.count??(typeof v==='number'?v:1))-used;if(used&&n<=0)continue;let val=v;if(used)val=typeof v==='number'?n:object(v)?{...v,quantity:n,...(Object.hasOwn(v,'count')?{count:n}:{})}:{id:typeof v==='string'?v:key,quantity:n};if(Array.isArray(changed))changed.push(val);else changed[key]=val;}const inventoryValue=object(inv.raw)&&Object.hasOwn(inv.raw,'items')?{...inv.raw,items:changed}:changed;d.seed={...d.seed,entities:d.seed.entities.map(e=>e.id==='player'?{...e,inventory:inventoryValue}:e)};}
  return d;
 }
 function token(){return typeof crypto.randomUUID==='function'?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);}
 function send(d,text,receipt,kind){
  d[KEY]={...state(d),active:null,receipt};
  if(new TextEncoder().encode(JSON.stringify(d)).length>340000){status.textContent='Not enough shared world space. Nothing was spent.';return;}
  pending={base:latest.stateRevision,source:latest.revision,epoch:epoch(d),token:receipt,text,kind,slot:selectedSlot};status.textContent='Awaiting room confirmation…';
  try{Gulch.commit(d,text);}catch(e){pending=null;status.textContent=String(e.message||e);}
  if(pending&&!window.GulchMovementState?.inFlight){pending=null;status.textContent='Not submitted. Your items remain unchanged.';}render();
 }
 function submit(){
  if(!ready())return;const rows=entries(latest.gameState),x=rows.find(r=>r.key===first),y=rows.find(r=>r.key===second),c=charge(),f=state(latest.gameState);
  if(!x||!y||x.key===y.key&&x.free<2||c.steps<20||c.kills<3||Object.keys(f.definitions||{}).length>=96)return;
  const receipt=token(),id='fusion_'+receipt,item={...blueprint(x,y),id};item.name+=' · '+receipt.slice(-5);
  const d=spend(structuredClone(latest.gameState),[x,y]),p=d.itemEcosystem;
  d.itemEcosystem={...p,bag:{...p.bag,[id]:1},known:Array.from(new Set([...(p.known||[]),id])),log:['Created '+item.name+'.',...(p.log||[])].slice(0,12)};
  d[KEY]={...f,grid:validGrid(latest.gameState),definitions:{...f.definitions,[id]:item}};d.mergeCharge={epoch:epoch(d),steps:0,kills:0};
  send(d,'Created '+item.name+'. It is waiting in the merged-items box.',receipt,'merge');
 }
 function assign(id){
  if(!ready()||!Number.isInteger(selectedSlot)||selectedSlot<0||selectedSlot>=9)return;
  const row=waiting(latest.gameState).find(r=>r.id===id);if(!row)return;
  const d=structuredClone(latest.gameState),f=state(d),g=validGrid(d),old=f.definitions?.[g[selectedSlot]];
  g[selectedSlot]=id;d[KEY]={...f,grid:g};
  send(d,'Placed '+row.item.name+' in power slot '+(selectedSlot+1)+'.'+(old?' '+old.name+' returned to the waiting box.':''),token(),'grid');
 }
 function removeSelected(){
  if(!ready()||!Number.isInteger(selectedSlot))return;
  const d=structuredClone(latest.gameState),f=state(d),g=validGrid(d),id=g[selectedSlot];if(!id)return;
  g[selectedSlot]=null;d[KEY]={...f,grid:g};send(d,'Returned '+f.definitions[id].name+' to the waiting box. Its power is inactive.',token(),'grid');
 }
 function complete(request,ok){
  status.textContent=ok?request.text:'No matching confirmation. Review the shared items before retrying.';
  if(ok){first=second='';signature='';closePicker(false);}
  render();
  if(ok&&!root.hidden&&!panel.hidden){
   if(request.kind==='merge')waitingBox.scrollIntoView({block:'nearest',behavior:'auto'});
   else if(request.slot!==null&&!gridButtons[request.slot]?.disabled)gridButtons[request.slot]?.focus({preventScroll:true});
  }
 }
 a.addEventListener('change',()=>{first=a.value;render();});b.addEventListener('change',()=>{second=b.value;render();});
 function sync(){root.hidden=panel.dataset.inventoryPage!=='merge';tab.setAttribute('aria-pressed',String(!root.hidden));if(root.hidden||panel.hidden)closePicker(false);render();}
 refresh=()=>{
  const next=latest.revision+':'+epoch(latest.gameState);
  if(context&&context!==next){pending=null;first=second='';closePicker(false);signature='';status.textContent='New expedition or source. Review your ingredients.';}
  context=next;
  if(pending&&latest.stateRevision!==pending.base){const request=pending;pending=null;complete(request,state(latest.gameState).receipt===request.token);}
  else render();
 };
 window.addEventListener('gulch:recovered',()=>queueMicrotask(()=>{if(pending&&!window.GulchMovementState?.inFlight){const request=pending;pending=null;complete(request,state(latest?.gameState).receipt===request.token);}else render();}));
 new MutationObserver(sync).observe(panel,{attributes:true,attributeFilter:['hidden','data-inventory-page']});
 let availability='';setInterval(()=>{if(root.hidden||panel.hidden||document.hidden)return;const k=String(ready());if(k!==availability){availability=k;render();}},300);
 const commit=Gulch.commit;
 Gulch.commit=function(data,activity,options){
  if(!latest||!data?.seed||epoch(data)!==epoch(latest.gameState)||!(Number(data.turn)>Number(latest.turn)))return commit.call(this,data,activity,options);
  const f=state(latest.gameState),g=validGrid(latest.gameState),before=latest.player,after=data.seed.entities.find(e=>e.id==='player');
  if(!after||after.hp<=0||data.gulchPermanentGameOver?.ended)return commit.call(this,data,activity,options);
  let entities=data.seed.entities,used=[],readyTurns={...f.gridReady};const turn=Number(data.turn);
  const hostile=e=>e.id!=='player'&&e.faction==='hostile'&&e.hp>0&&!e.practiceTarget&&!e.isPlayer&&!e.playerId&&!e.ownerId&&!e.clientId&&!e.loreSpeaker&&!e.ecosystemLoot&&e.itemId==null;
  const proposed=new Map(entities.map(e=>[e.id,e])),map=data.seed.maps.find(m=>m.id===before.map);
  const clear=e=>window.GulchEnemyVarietyEffects?.line(data.seed,map,before,e)??false;
  const target=latest.seed.entities.find(e=>hostile(e)&&e.map===before.map&&Math.max(Math.abs(e.x-before.x),Math.abs(e.y-before.y))<=1&&clear(e)&&(!proposed.has(e.id)||proposed.get(e.id).hp<e.hp));
  for(const id of new Set(g.filter(Boolean))){
   const item=f.definitions[id],power=item?.fusionPower;if(!power||Math.max(Number(readyTurns[id])||0,Number(f.readyTurn)||0)>turn)continue;
   let applied=false;const player=entities.find(e=>e.id==='player'),strength=Math.max(0,Math.min(100,Number(power.strength)||0));
   if(power.kind==='ward'&&player.hp<before.hp){const saved=Math.min(strength,Math.max(0,before.hp-player.hp-1));if(saved>0){entities=entities.map(e=>e.id==='player'?{...e,hp:e.hp+saved}:e);applied=true;}}
   else if(target&&power.kind==='flare'&&entities.some(e=>e.id===target.id&&e.hp>0)){entities=entities.map(e=>e.id===target.id?{...e,hp:Math.max(0,e.hp-strength)}:e);applied=true;}
   else if(target&&power.kind==='mend'&&player.hp<player.maxHp){entities=entities.map(e=>e.id==='player'?{...e,hp:Math.min(e.maxHp,e.hp+strength)}:e);applied=true;}
   if(applied){used.push(item.name);readyTurns[id]=turn+Math.max(2,Number(power.cooldown)||6);}
  }
  if(used.length)data={...data,seed:{...data.seed,entities},[KEY]:{...state(data),active:null,gridReady:readyTurns}};
  return commit.call(this,data,(activity||'')+(used.length?' Grid powers: '+used.join(', ')+'.':''),options);
 };
 if(latest)refresh();sync();
}
if(document.readyState==='complete')mount();else window.addEventListener('load',mount,{once:true});
})();
