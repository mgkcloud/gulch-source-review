(function(){
'use strict';
const register=Gulch.register,host=document.getElementById('left');
if(!host)return;
let latest=null,pending=null,serial=0,scheduled=false;
const painters=new Map();
const epoch=d=>String(d?.respawnSettings?.token||'original');
const catalog=()=>window.GulchItemCatalog?.items||{};
const count=n=>Number.isFinite(Number(n))?Math.max(0,Math.floor(Number(n))):0;
const style=document.createElement('style');
style.textContent='#optimisticPickupNotice{position:absolute;left:50%;bottom:160px;transform:translateX(-50%);z-index:9;max-width:85%;padding:10px 14px;background:#102c29ed;border:1px solid #c6bd83;border-radius:7px;color:#f4e3b8;font:12px monospace;pointer-events:none}#optimisticPickupNotice[hidden],#optimisticPickupPreview[hidden]{display:none!important}#optimisticPickupPreview{padding:10px 14px;border-bottom:1px dashed #b8bd87;background:#23372d;color:#f4e3b8;font:12px/1.5 monospace}#optimisticPickupNotice.pickup-pulse{animation:optimistic-pickup-rise 220ms ease-out}@keyframes optimistic-pickup-rise{from{opacity:0;translate:0 12px}to{opacity:1;translate:0 0}}@media(prefers-reduced-motion:reduce){#optimisticPickupNotice.pickup-pulse{animation:none}}';
document.head.append(style);
const notice=document.createElement('div');notice.id='optimisticPickupNotice';notice.hidden=true;notice.setAttribute('role','status');host.append(notice);
const preview=document.createElement('div');preview.id='optimisticPickupPreview';preview.hidden=true;preview.setAttribute('role','status');
document.getElementById('inventoryPanel')?.querySelector('.inventory-header')?.after(preview);
let noticeTimer=null;
function say(text,pulse){
 clearTimeout(noticeTimer);notice.textContent=text;notice.hidden=false;notice.classList.toggle('pickup-pulse',Boolean(pulse));
 if(!pending)noticeTimer=setTimeout(()=>{notice.hidden=true;},3000);
}
function visual(s){
 if(!pending||pending.epoch!==epoch(s.gameState)||pending.source!==s.revision)return s;
 const entities=s.seed.entities.filter(e=>e.id!==pending.entity.id);
 return {...s,seed:{...s.seed,entities}};
}
Gulch.register=function(name,callbacks){
 if(!['renderer','ground-catalog-art','landscape-life','outside-world','wild-plant-gardens'].includes(name)||typeof callbacks?.snapshot!=='function')return register(name,callbacks);
 const entry={callbacks,snapshot:null};painters.set(name,entry);
 return register(name,{...callbacks,snapshot(s){entry.snapshot=s;return callbacks.snapshot.call(callbacks,visual(s));}});
};
function redraw(){
 for(const entry of painters.values())if(entry.snapshot){try{entry.callbacks.snapshot.call(entry.callbacks,visual(entry.snapshot));}catch(error){const box=document.getElementById('moduleErrors');if(box)box.textContent='Pickup presentation: '+String(error.message||error);}}
}
function finish(ok,reason){
 if(!pending)return;
 const text=pending.label;pending=null;preview.hidden=true;preview.textContent='';redraw();
 say(ok?'Collected '+text:reason+' Local pickup preview reverted.',false);
}
function blocked(){
 return document.hidden||host.inert||Boolean(document.querySelector('dialog[open]'))||['inventoryPanel','characterPanel','workBoard','questBoard','livingPanel','respawnScreen','interfaceMenu','tradePanel','travelMapPanel','pilgrimJournal','itemContext','enemyInspectCard','atlasPanel'].some(id=>{const n=document.getElementById(id);return n&&!n.hidden;});
}
function point(){
 const q=window.GulchLocalMovementQueue?.report(),p=q?.predicted;
 return p&&Number.isInteger(p.x)&&Number.isInteger(p.y)?p:latest?.player;
}
function supported(e){
 if(e.kind==='quest-relic'||e.swordQuestLandmark)return false;
 if(e.ecosystemLoot)return Object.keys(e.contents||{}).length>0&&Object.entries(e.contents).every(([id,n])=>catalog()[id]&&count(n)>0);
 return Boolean(e.outsideResource||e.livingResource||e.regionFood||(catalog()[e.itemId||e.id]&&/^(item|weapon|armor|armour|consumable|material|relic)$/.test(e.kind||'')));
}
function candidate(p){
 return latest.seed.entities.filter(e=>e.id!=='player'&&e.map===p.map&&latest.lit[e.y]?.[e.x]===1&&Math.abs(e.x-p.x)+Math.abs(e.y-p.y)<=1&&supported(e)).sort((a,b)=>Math.abs(a.x-p.x)+Math.abs(a.y-p.y)-Math.abs(b.x-p.x)-Math.abs(b.y-p.y)||String(a.id).localeCompare(String(b.id)))[0];
}
function proposal(e,token){
 const d=latest.gameState,t=epoch(d),old=d.itemEcosystem;
 const pack=old?.epoch===t?{...old,bag:{...old.bag},known:[...(old.known||[])],log:[...(old.log||[])]}:{epoch:t,bag:{},equipment:{},known:[],crafted:[],log:[]};
 let next={...d},awards={},labels=[];
 if(e.ecosystemLoot||catalog()[e.itemId||e.id]&&!e.outsideResource&&!e.livingResource&&!e.regionFood){
  awards=e.ecosystemLoot?{...e.contents}:{[e.itemId||e.id]:count(e.quantity??1)};
  for(const [id,n] of Object.entries(awards)){
   if(!catalog()[id]||!count(n)||count(pack.bag[id])+count(n)>999)return null;
   pack.bag[id]=count(pack.bag[id])+count(n);
   if(!pack.known.includes(id))pack.known.push(id);
   labels.push(catalog()[id].name+' ×'+count(n));
  }
 }else if(e.regionFood||e.livingResource==='herb'){
  const food=Boolean(e.regionFood),key=food?'regionSupplies':'livingWorld',field=food?'food':'herbs',n=count(e.quantity??1);
  const v=d[key]?.epoch===t?d[key]:food?{epoch:t,food:0,rested:[]}:{epoch:t,age:0,wave:0,forge:0,camp:0,herbs:0,visits:[],claims:[],log:[]};
  if(!n||count(v[field])+n>99)return null;
  next[key]={...v,[field]:count(v[field])+n};labels.push((food?'Provisions':'Healing herbs')+' ×'+n);
 }else{
  const id=e.outsideResource||e.livingResource,n=count(e.quantity??1),world=d.outsideWorld||{},resources={...world.resources};
  if(!id||!n||count(resources[id])+n>9999)return null;
  resources[id]=count(resources[id])+n;next.outsideWorld={...world,resources};labels.push(id+' ×'+n);
 }
 const label=labels.join(', '),text='Collected '+label+'.';
 pack.log=[text,...pack.log].slice(0,12);
 next={...next,itemEcosystem:pack,seed:{...d.seed,entities:d.seed.entities.filter(v=>v.id!==e.id)},inventoryPickup:{epoch:t,token,items:awards}};
 if(new TextEncoder().encode(JSON.stringify(next)).length>340000)return null;
 return {data:next,label,text};
}
function receipt(){return latest?.gameState.inventoryPickup?.epoch===pending?.epoch&&latest?.gameState.inventoryPickup?.token===pending?.token;}
function attempt(){
 scheduled=false;if(!pending||!latest)return;
 const r=pending,m=window.GulchMovementState;
 if(latest.revision!==r.source||epoch(latest.gameState)!==r.epoch||latest.player.hp<=0||latest.gameState.gulchPermanentGameOver?.ended){finish(false,'Expedition changed.');return;}
 if(receipt()){finish(true);return;}
 if(r.sent){
  if(!m?.inFlight)finish(false,'The room did not confirm this pickup.');
  return;
 }
 if(document.hidden||!m?.focused){finish(false,'Pickup cancelled while unfocused.');return;}
 const entity=latest.seed.entities.find(e=>e.id===r.entity.id);
 if(!entity||JSON.stringify(entity)!==r.signature){finish(false,'The item changed or was collected.');return;}
 const p=latest.player,q=window.GulchLocalMovementQueue?.report();
 if(m.inFlight||q?.inFlight||q?.queued)return;
 if(p.map!==r.destination.map||p.x!==r.destination.x||p.y!==r.destination.y){finish(false,'Movement resolved at a different tile.');return;}
 if(entity.map!==p.map||Math.abs(entity.x-p.x)+Math.abs(entity.y-p.y)>1){finish(false,'The item is out of reach.');return;}
 if(blocked())return;
 const next=proposal(entity,r.token);
 if(!next){finish(false,'Inventory capacity changed.');return;}
 r.sent=true;
 try{Gulch.commit(next.data,next.text);}catch(error){finish(false,'Pickup submission failed.');return;}
 if(!window.GulchMovementState?.inFlight){finish(false,'Pickup was not submitted.');return;}
 preview.textContent='Pending inventory: '+r.label+' · awaiting room confirmation; unavailable for use.';
}
function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(attempt);}
window.addEventListener('keydown',event=>{
 if(String(event.key).toLowerCase()!=='e'||event.ctrlKey||event.altKey||event.metaKey||event.isComposing||event.defaultPrevented)return;
 if(event.target instanceof HTMLElement&&(event.target.matches('input,textarea,select')||event.target.isContentEditable))return;
 if(blocked()||!latest||!window.GulchMovementState?.focused||latest.player.hp<=0)return;
 if(pending){event.preventDefault();event.stopImmediatePropagation();return;}
 const p=point(),entity=p&&candidate(p);if(!entity)return;
 const token='optimistic-pickup:'+(typeof crypto.randomUUID==='function'?crypto.randomUUID():Date.now().toString(36)+':'+(++serial)+':'+Math.random().toString(36).slice(2));
 const next=proposal(entity,token);if(!next)return;
 event.preventDefault();event.stopImmediatePropagation();if(event.repeat)return;
 pending={token,source:latest.revision,epoch:epoch(latest.gameState),entity,signature:JSON.stringify(entity),destination:{map:p.map,x:p.x,y:p.y},label:next.label,sent:false,created:performance.now()};
 preview.hidden=false;preview.textContent='Pending inventory: '+next.label+' · waiting for movement; unavailable for use.';
 redraw();say('Picked up '+next.label+' · pending',true);schedule();
},true);
register('optimistic-local-pickups',{snapshot(s){latest=s;schedule();}});
window.addEventListener('gulch:recovered',schedule);
window.addEventListener('blur',()=>{if(pending&&!pending.sent)finish(false,'Pickup cancelled while unfocused.');});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&pending&&!pending.sent)finish(false,'Pickup cancelled while hidden.');else schedule();});
setInterval(()=>{
 if(!pending)return;
 if(!pending.sent&&performance.now()-pending.created>15000){finish(false,'Movement did not reach the pickup tile in time.');return;}
 schedule();
},100);
})();
