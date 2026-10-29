(function(){
'use strict';
const host=document.getElementById('left');if(!host)return;
const baseCommit=Gulch.commit;
let latest=null,pending=null,previousFocus=null,lastKey='',effect=null,frame=0;
const epoch=d=>String(d?.respawnSettings?.token||'original');
const count=n=>Number.isFinite(Number(n))?Math.max(0,Math.min(999,Math.floor(Number(n)))):0;
const items=()=>window.GulchItemCatalog?.items||{};
const usable=i=>i&&i.type==='Consumable'&&(Number(i.heal)>0||i.quickThrow);
function pack(data){const p=data?.itemEcosystem;return p?.epoch===epoch(data)?p:{epoch:epoch(data),bag:{},equipment:{},known:[],crafted:[],log:[]};}
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
function btn(text,fn){const n=el('button',text);n.type='button';n.addEventListener('click',fn);return n;}
const style=el('style');style.textContent=`
#quickConsumableDock{position:absolute;right:18px;bottom:370px;z-index:6;display:flex;gap:5px;max-width:260px;padding:5px;background:#10262bea;border:1px solid #aa976b;border-radius:7px;font:11px monospace}
#quickConsumableDock button{min-height:44px;background:#243e35;color:#ffe3aa;border:1px solid #819377;border-radius:4px;padding:7px;font:inherit}#quickConsumableDock button:disabled{opacity:.5}#quickConsumableUse{display:flex;align-items:center;gap:7px;min-width:0}#quickConsumableUse span:last-child{overflow-wrap:anywhere}#quickConsumableDock canvas{width:28px;height:28px;image-rendering:pixelated}
#quickConsumablePicker{width:min(480px,calc(100% - 20px));max-height:85vh;overflow:auto;padding:18px;background:#13282c;color:#e1e8d5;border:3px double #b49a70;border-radius:8px;font:12px/1.6 monospace}#quickConsumablePicker::backdrop{background:#04101599}#quickConsumablePicker h2{margin:0;color:#ffe0a1;font-size:19px}#quickConsumablePicker button{min-height:44px;padding:9px;background:#294438;color:#f8e5bb;border:1px solid #8e9d79;border-radius:5px;font:inherit}#quickConsumablePicker button:disabled{opacity:.5}#quickConsumableList{display:grid;gap:8px;margin:12px 0}#quickConsumableList button{display:grid;grid-template-columns:36px 1fr;gap:8px;text-align:left}#quickConsumableList button[aria-pressed=true]{border-color:#ffe1a0;background:#42553a}#quickConsumableList small{display:block;color:#c6d4ba}#quickConsumableList canvas{width:32px;height:32px;image-rendering:pixelated}.quick-slot-actions{display:flex;gap:8px;flex-wrap:wrap}#quickConsumablePicker :focus-visible,#quickConsumableDock :focus-visible{outline:2px solid #ffe1a0;outline-offset:3px}#quickConsumableStatus{position:absolute;left:50%;bottom:165px;transform:translateX(-50%);z-index:8;max-width:70%;padding:6px 9px;background:#10262bea;color:#f1dfb4;font:11px/1.5 monospace;pointer-events:none}#quickConsumableStatus:empty{display:none}
@media(max-width:700px){#quickConsumableDock{right:10px;bottom:350px;max-width:205px;font-size:10px}}@media(max-height:560px){#quickConsumableDock{right:160px;bottom:35px;max-width:230px}}
`;document.head.append(style);
const dock=el('div');dock.id='quickConsumableDock';dock.setAttribute('role','group');dock.setAttribute('aria-label','Equipped quick consumable');
const use=btn('',activate);use.id='quickConsumableUse';use.setAttribute('aria-keyshortcuts','Q');
const art=el('span'),label=el('span','Q · Empty');art.setAttribute('aria-hidden','true');use.append(art,label);
const change=btn('Switch',open);change.setAttribute('aria-haspopup','dialog');change.setAttribute('aria-controls','quickConsumablePicker');dock.append(use,change);
const status=el('div');status.id='quickConsumableStatus';status.setAttribute('role','status');host.append(dock,status);
const dialog=el('dialog');dialog.id='quickConsumablePicker';dialog.setAttribute('aria-labelledby','quickConsumableTitle');
const title=el('h2','Q · Consumable slot');title.id='quickConsumableTitle';
const intro=el('p','Equip an owned potion, dressing, ration, fire vial or bomb. Press Q or tap the slot to use it. Switch here at any time between room updates. One copy is reserved from crafting and trading while equipped.');
const list=el('div');list.id='quickConsumableList';const detail=el('p'),feedback=el('p');feedback.setAttribute('role','status');
const actions=el('div');actions.className='quick-slot-actions';actions.append(btn('Unequip',()=>equip(null)),btn('Recipes',recipes),btn('Close',()=>dialog.close()));
dialog.append(title,intro,list,detail,feedback,actions);document.body.append(dialog);
function icon(node,item){if(!item){node.textContent='◇';delete node.dataset.catalogIcon;return;}if(window.GulchItemPresentation?.icon)window.GulchItemPresentation.icon(node,item);else node.textContent=item.glyph||'✚';}
function selected(){const p=pack(latest?.gameState),i=items()[p.equipment?.quick];return usable(i)&&count(p.bag?.[i.id])?i:null;}
function blocked(){return Array.from(document.querySelectorAll('dialog[open]')).some(n=>n!==dialog)||['inventoryPanel','characterPanel','questBoard','workBoard','livingPanel','respawnScreen','interfaceMenu','tradePanel','travelMapPanel','pilgrimJournal','itemContext','enemyInspectCard','atlasPanel'].some(id=>{const n=document.getElementById(id);return n&&!n.hidden;});}
function ready(){const m=window.GulchMovementState;return latest&&latest.player.hp>0&&!latest.gameState.gulchPermanentGameOver?.ended&&m?.focused&&!m.inFlight&&!pending&&!blocked();}
let noticeTimer=null;
function say(text){status.textContent=text;feedback.textContent=text;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{status.textContent='';},4500);}
function open(){if(!latest||latest.player.hp<=0||blocked())return;previousFocus=document.activeElement;lastKey='';dialog.showModal();render();dialog.querySelector('button')?.focus();}
dialog.addEventListener('cancel',e=>{e.preventDefault();dialog.close();});
dialog.addEventListener('close',()=>{const n=previousFocus?.isConnected&&!previousFocus.closest('[hidden],[inert]')?previousFocus:change;n.focus({preventScroll:true});render();});
function recipes(){dialog.close();document.getElementById('inventoryToggle')?.click();const inv=document.getElementById('inventoryPanel');if(!inv||inv.hidden)return;inv.querySelectorAll('.new-inventory-nav button')[1]?.click();const s=document.getElementById('ecosystemRecipe');if(s){s.value='quick_fire_vial';s.dispatchEvent(new Event('change'));s.focus();s.scrollIntoView({block:'nearest'});}}
function submit(data,text){
 const token=String(latest.stateRevision)+':q:'+Date.now()+':'+Math.random().toString(36).slice(2);
 data.quickConsumableReceipt={epoch:epoch(data),token,text};
 if(new TextEncoder().encode(JSON.stringify(data)).length>350000){say('The shared world is full. Nothing was used.');return;}
 pending={base:latest.stateRevision,epoch:epoch(data),token};
 try{Gulch.commit(data,text);}catch(error){pending=null;say(String(error.message||error));}
 if(pending&&!window.GulchMovementState?.inFlight){pending=null;say('Update was not submitted. Wait for the room and try again.');}
 else if(pending)say('Waiting for room confirmation…');render();
}
function equip(id){
 if(!ready())return;
 const data=latest.gameState,p=pack(data),equipment={...p.equipment};
 if(id){const i=items()[id];if(!usable(i)||!count(p.bag?.[id]))return;const reserved=Object.entries(equipment).filter(([slot,v])=>slot!=='quick'&&v===id).length;if(count(p.bag[id])<=reserved){say('All copies are reserved in other equipment slots.');return;}equipment.quick=id;}else delete equipment.quick;
 submit({...data,itemEcosystem:{...p,equipment}},id?'Equipped '+items()[id].name+' in the Q slot.':'Cleared the Q slot.');
}
function floor(seed,map,x,y){const c=map?.ascii[y]?.[x];return Boolean(c)&&!['#','~'].includes(c)&&!['wall','water'].includes(seed.legend[c]?.[0]);}
function line(seed,map,a,b){let x=a.x,y=a.y,dx=Math.abs(b.x-x),dy=-Math.abs(b.y-y),sx=x<b.x?1:-1,sy=y<b.y?1:-1,err=dx+dy;for(let i=0;i<32;i++){if(x===b.x&&y===b.y)return true;const twice=2*err;let nx=x,ny=y;if(twice>=dy){err+=dy;nx+=sx;}if(twice<=dx){err+=dx;ny+=sy;}if(!floor(seed,map,nx,ny)||(nx!==x&&ny!==y&&(!floor(seed,map,nx,y)||!floor(seed,map,x,ny))))return false;x=nx;y=ny;}return false;}
function hostile(e){return e.id!=='player'&&e.faction==='hostile'&&!e.isPlayer&&!e.playerId&&!e.clientId&&!e.ownerId&&!e.loreSpeaker&&!e.itemId&&!e.ecosystemLoot&&!e.practiceTarget&&!/item|loot|prop|weapon|armor/i.test(e.kind||'')&&(!Number.isFinite(e.hp)||e.hp>0);}
function aim(item){
 const seed=latest.seed,p=latest.player,map=seed.maps.find(m=>m.id===p.map),f=latest.gameState.sword?.facing;
 const dx=Number.isInteger(f?.dx)&&Math.abs(f.dx)<=1?f.dx:0,dy=Number.isInteger(f?.dy)&&Math.abs(f.dy)<=1?f.dy:1;
 const direction=dx||dy?{dx,dy}:{dx:0,dy:1};let point={x:p.x,y:p.y};
 for(let n=1;n<=item.quickThrow.range;n++){const q={x:p.x+direction.dx*n,y:p.y+direction.dy*n};if(!line(seed,map,point,q))break;point=q;if(seed.entities.some(e=>hostile(e)&&e.map===p.map&&e.x===q.x&&e.y===q.y))break;}
 return point.x===p.x&&point.y===p.y?null:point;
}
function activate(){
 if(!ready()||dialog.open)return;
 const item=selected();if(!item){open();return;}
 const data=latest.gameState,p=latest.player,old=pack(data),bag={...old.bag},equipment={...old.equipment};let seed=latest.seed,text,turn=data.turn,event=null;
 if(item.heal){const healed=Math.min(item.heal,Math.max(0,Number(p.maxHp)-Number(p.hp)));if(!(healed>0)){say('Health is full. Nothing consumed.');return;}seed={...seed,entities:seed.entities.map(e=>e.id==='player'?{...e,hp:e.hp+healed}:e)};text='Used '+item.name+' · restored '+healed+' HP.';}
 else{
  const point=aim(item);if(!point){say('The throw is blocked. Face open ground. Nothing consumed.');return;}
  const map=seed.maps.find(m=>m.id===p.map),a=item.quickThrow;let hits=0;
  seed={...seed,entities:seed.entities.map(e=>{if(!hostile(e)||e.map!==p.map||Math.hypot(e.x-point.x,e.y-point.y)>a.radius||!line(seed,map,point,e))return e;hits++;return {...e,hp:Math.max(0,(Number.isFinite(e.hp)?e.hp:4)-a.damage)};}).filter(e=>!hostile(e)&&e.hp===0?e.id==='player'||e.faction!=='hostile':true)};
  if(window.GulchCaveEnemies)seed=window.GulchCaveEnemies.advance(seed);
  turn=(Number(data.turn)||0)+1;text='Threw '+item.name+' at '+point.x+', '+point.y+' · '+hits+' hostile target(s), '+a.damage+' base damage each.';
  event={id:String(latest.stateRevision)+':'+Date.now(),time:Date.now(),map:p.map,...point,radius:a.radius,color:a.color};
 }
 bag[item.id]=count(bag[item.id])-1;if(!bag[item.id])delete equipment.quick;
 submit({...data,seed,turn,itemEcosystem:{...old,bag,equipment,log:[text,...(old.log||[])].slice(0,12)},...(event?{quickThrowEffect:event}:{})},text);
}
function render(){
 const i=selected(),p=pack(latest?.gameState);label.textContent=i?'Q · '+i.name+' ×'+count(p.bag[i.id]):'Q · Equip item';icon(art,i);
 use.disabled=!ready()||dialog.open;change.disabled=!latest||latest.player.hp<=0||Boolean(pending)||blocked();
 use.title=i?.quickThrow?'Throw ahead in your facing direction; first enemy or last clear tile.':'Use equipped consumable [Q]';
 if(!dialog.open)return;
 const key=JSON.stringify([p.bag,p.equipment,Boolean(pending),ready()]);if(key===lastKey)return;lastKey=key;
 const focused=document.activeElement?.dataset.quickItem;
 list.replaceChildren();
 const owned=Object.values(items()).filter(i=>usable(i)&&count(p.bag?.[i.id])>0).sort((a,b)=>a.name.localeCompare(b.name));
 for(const item of owned){const b=btn('',()=>equip(item.id)),a=el('span'),t=el('span',item.name+' ×'+count(p.bag[item.id]));b.dataset.quickItem=item.id;icon(a,item);a.setAttribute('aria-hidden','true');t.append(el('small',item.heal?'Heal '+item.heal+' HP':item.quickThrow.damage+' damage · blast radius '+item.quickThrow.radius));b.append(a,t);b.setAttribute('aria-pressed',String(p.equipment?.quick===item.id));b.disabled=!ready();list.append(b);}
 if(!owned.length)list.append(el('p','No usable consumables owned. Collect potions from loot, buy them from merchants, or craft them in the recipe book. Fire vials and bombs can also drop from enemies.'));
 detail.textContent=i?i.description:'Healing does not advance time. Throws advance one turn, spare friendly characters and use the current facing direction. Items are consumed only by a confirmed room update.';
 actions.firstElementChild.disabled=!ready()||!p.equipment?.quick;
 if(focused)Array.from(list.children).find(n=>n.dataset.quickItem===focused)?.focus({preventScroll:true});
}
Gulch.commit=function(data,activity){
 if(!latest||!data?.seed||epoch(data)!==epoch(latest.gameState)||!(Number(data.turn)>Number(latest.turn)))return baseCommit(data,activity);
 const after=new Map(data.seed.entities.map(e=>[e.id,e])),entities=data.seed.entities.slice();let added=0;
 for(const e of latest.seed.entities){
  if(added>=3||entities.filter(v=>v.ecosystemLoot).length>=48)break;
  if(!hostile(e)||!Number.isFinite(e.hp)||e.map!==latest.mapId||!data.seed.maps.some(m=>m.id===e.map)||(after.has(e.id)&&after.get(e.id).hp>0))continue;
  let h=2166136261;for(const c of epoch(data)+':quick:'+e.id)h=Math.imul(h^c.charCodeAt(0),16777619);
  if((h>>>0)%4!==0)continue;
  const item=(h>>>0)%8===0?'field_bomb':'fire_vial';let id='quick-drop:'+e.id;while(entities.some(v=>v.id===id))id+='x';
  entities.push({id,map:e.map,x:e.x,y:e.y,name:'Alchemical supplies',kind:'loot',ecosystemLoot:true,contents:{[item]:1},glyph:'♦',color:'#edb76f'});added++;
 }
 if(!added)return baseCommit(data,activity);
 const next={...data,seed:{...data.seed,entities}};
 return baseCommit(new TextEncoder().encode(JSON.stringify(next)).length<=350000?next:data,activity);
};
const canvas=el('canvas');canvas.setAttribute('aria-hidden','true');canvas.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:3';host.append(canvas);
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
function paint(now){frame=0;const w=host.clientWidth,h=host.clientHeight,dpr=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));canvas.style.width=w+'px';canvas.style.height=h+'px';}const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);if(!effect||!latest||document.hidden)return;const t=(now-effect.start)/450;if(t>=1){effect=null;return;}const e=effect.event,p=latest.player,v=window.GulchMovementState?.visual,camera=v?.map===p.map?v:p,ts=Math.max(20,Math.min(64,Number(latest.seed.meta?.tileSize)||32));if(e.map===p.map&&latest.lit[e.y]?.[e.x]===1){c.globalAlpha=1-t;c.strokeStyle=e.color;c.lineWidth=3;c.beginPath();c.arc(w/2+(e.x-camera.x)*ts,h/2+(e.y-camera.y)*ts,ts*(e.radius+.5)*(reduced.matches?1:.3+t*.7),0,Math.PI*2);c.stroke();c.globalAlpha=1;}frame=requestAnimationFrame(paint);}
window.addEventListener('keydown',e=>{if(dialog.open){if(e.key==='Escape'){e.preventDefault();dialog.close();}if(e.key!=='Tab')e.stopImmediatePropagation();return;}if(e.key.toLowerCase()!=='q'||e.ctrlKey||e.altKey||e.metaKey||e.isComposing)return;const n=e.target;if(n instanceof HTMLElement&&(n.matches('input,textarea,select')||n.isContentEditable))return;if(!ready())return;e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)activate();},true);
Gulch.register('quick-consumable-slot',{snapshot(s){const old=latest,reset=old&&epoch(old.gameState)!==epoch(s.gameState);latest=s;if(reset||s.player.hp<=0){pending=null;effect=null;if(dialog.open)dialog.close();}if(pending&&s.stateRevision!==pending.base){const r=pending;pending=null;const receipt=s.gameState.quickConsumableReceipt;say(receipt?.epoch===r.epoch&&receipt.token===r.token?receipt.text:'Another room update won. Check the slot and item counts before retrying.');}const e=s.gameState.quickThrowEffect;if(!reset&&old&&e&&e.id!==old.gameState.quickThrowEffect?.id&&Date.now()-e.time<1500){effect={event:e,start:performance.now()};window.GulchFrameBudget?.activate();if(!frame)frame=requestAnimationFrame(paint);}render();},action(a){if(a?.type==='quick-use')activate();if(a?.type==='quick-switch')open();},resize(){if(!frame)paint(performance.now());}});
setInterval(()=>{if(!document.hidden)render();},300);
document.addEventListener('visibilitychange',()=>{if(document.hidden){effect=null;if(frame)cancelAnimationFrame(frame);frame=0;paint(performance.now());}});
function help(){const h=document.getElementById('keyHelp');if(h){for(const p of h.querySelectorAll('p'))if(p.textContent.includes('Q and F — unassigned'))p.textContent='Q — use your equipped consumable. F — unassigned.';h.append(el('p','Q slot: Switch lists owned healing consumables, fire vials and bombs. Tap an item to equip, then press Q or tap the slot to use it. Face a direction before throwing; throws stop at the first hostile or up to four clear tiles. Craft fire vials from glass, ichor and fiber; bombs from scrap, spark and gel. Some defeated enemies leave alchemical supplies.'));}const g=document.querySelector('.inventory-key-guide');if(g)g.textContent='Select to inspect · arrows browse · Q uses the equipped consumable outside menus';}
if(document.readyState==='complete')help();else window.addEventListener('load',help,{once:true});
})();
