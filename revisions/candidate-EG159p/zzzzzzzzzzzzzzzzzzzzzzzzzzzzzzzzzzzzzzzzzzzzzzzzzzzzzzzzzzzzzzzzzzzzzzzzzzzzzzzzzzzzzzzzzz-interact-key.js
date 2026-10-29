(function(){
'use strict';
const host=document.getElementById('left');
if(!host)return;
let latest=null,pending=null;
const epoch=d=>String(d?.respawnSettings?.token||'original');
const count=n=>Number.isFinite(Number(n))?Math.max(0,Math.floor(Number(n))):0;
const catalog=()=>window.GulchItemCatalog?.items||{};
const button=document.createElement('button');button.type='button';button.id='interactKeyButton';button.textContent='Interact [E]';button.setAttribute('aria-keyshortcuts','E');
const status=document.createElement('div');status.id='interactKeyStatus';status.setAttribute('role','status');
const style=document.createElement('style');style.textContent='#interactKeyButton{position:absolute;right:18px;bottom:318px;z-index:5;min-height:44px;max-width:230px;padding:9px 12px;background:#19332e;color:#ffe2a5;border:1px solid #a9956e;border-radius:6px;font:12px monospace}#interactKeyButton:disabled{opacity:.5}#interactKeyButton:focus-visible{outline:2px solid #ffe2a5;outline-offset:3px}#interactKeyStatus{position:absolute;left:50%;bottom:280px;transform:translateX(-50%);z-index:6;max-width:60%;padding:6px 9px;background:#102523ee;color:#e4ddbc;border-radius:5px;font:11px/1.5 monospace;pointer-events:none}#interactKeyStatus:empty{display:none}@media(max-width:700px){#interactKeyButton{right:10px;bottom:298px;max-width:180px;font-size:11px}}';document.head.append(style);host.append(button,status);
function blocked(){return Boolean(document.querySelector('dialog[open]'))||['inventoryPanel','characterPanel','questBoard','workBoard','livingPanel','respawnScreen','interfaceMenu','travelMapPanel','pilgrimJournal','tradePanel','itemContext','enemyInspectCard'].some(id=>{const n=document.getElementById(id);return n&&!n.hidden;});}
function ready(){const m=window.GulchMovementState;return latest&&latest.player.hp>0&&!latest.gameState.gulchPermanentGameOver?.ended&&m?.focused&&!m.inFlight&&!pending&&!blocked();}
function nearby(e){const p=latest.player;return e.map===p.map&&Math.abs(e.x-p.x)+Math.abs(e.y-p.y)<=1;}
function pickup(e){return e.id!=='player'&&(e.ecosystemLoot||e.outsideResource||e.livingResource||e.regionFood||e.kind==='quest-relic'||e.itemId!=null||/^(item|weapon|armor|armour|consumable|material|relic)$/.test(e.kind||''));}
function target(){
 if(!latest)return null;
 const p=latest.player,f=latest.gameState.sword?.facing||{dx:0,dy:1};
 const entities=latest.seed.entities.filter(e=>nearby(e)&&pickup(e));
 entities.sort((a,b)=>Math.abs(a.x-p.x)+Math.abs(a.y-p.y)-Math.abs(b.x-p.x)-Math.abs(b.y-p.y)||Number(b.x===p.x+f.dx&&b.y===p.y+f.dy)-Number(a.x===p.x+f.dx&&a.y===p.y+f.dy)||String(a.id).localeCompare(String(b.id)));
 return entities[0]||null;
}
function collect(e){
 const data=latest.gameState,tokenEpoch=epoch(data),old=data.itemEcosystem;
 const pack=old?.epoch===tokenEpoch?{...old,bag:{...old.bag},known:[...(old.known||[])],log:[...(old.log||[])]}:{epoch:tokenEpoch,bag:{},equipment:{},known:[],crafted:[],log:[]};
 let next={...data},replacement=e,player=latest.player,amount=0;
 const awards={};
 function take(id,n){if(!catalog()[id])return 0;const taken=Math.min(count(n),Math.max(0,999-count(pack.bag[id])));if(taken){pack.bag[id]=count(pack.bag[id])+taken;awards[id]=(awards[id]||0)+taken;if(!pack.known.includes(id))pack.known.push(id);}return taken;}
 const total=count(e.quantity??1);
 if(e.ecosystemLoot){
  const contents={...e.contents};for(const [id,n] of Object.entries(contents)){const taken=take(id,n);amount+=taken;if(taken){contents[id]=count(n)-taken;if(!contents[id])delete contents[id];}}
  replacement=Object.keys(contents).length?{...e,contents}:null;
 }else if(e.kind==='quest-relic'||e.swordQuestLandmark){
  const q=data.legendarySwordQuest,key=e.swordQuestLandmark;
  if(q?.epoch!==tokenEpoch||!['blade','guard','hilt'].includes(key)||q.pieces.includes(key)){status.textContent='This relic cannot be recovered yet.';return;}
  next.legendarySwordQuest={...q,pieces:[...q.pieces,key]};amount=1;replacement=null;
 }else if(e.regionFood||e.livingResource==='herb'){
  const food=Boolean(e.regionFood),key=food?'regionSupplies':'livingWorld',field=food?'food':'herbs';
  const previous=data[key]?.epoch===tokenEpoch?data[key]:food?{epoch:tokenEpoch,food:0,rested:[]}:{epoch:tokenEpoch,age:0,wave:0,forge:0,camp:0,herbs:0,visits:[],claims:[],log:[]};
  amount=Math.min(total,Math.max(0,99-count(previous[field])));next[key]={...previous,[field]:count(previous[field])+amount};replacement=total>amount?{...e,quantity:total-amount}:null;
 }else if(e.outsideResource||e.livingResource){
  const id=e.outsideResource||e.livingResource,world=data.outsideWorld||{},resources={...world.resources};amount=Math.min(total,Math.max(0,9999-count(resources[id])));resources[id]=count(resources[id])+amount;next.outsideWorld={...world,resources};replacement=total>amount?{...e,quantity:total-amount}:null;
 }else{
  const id=e.itemId||e.id;
  if(catalog()[id]){amount=take(id,total);replacement=total>amount?{...e,quantity:total-amount}:null;}
  else{
   let definition={};for(const source of [latest.seed.items,latest.seed.itemDefinitions,data.items]){const found=Array.isArray(source)?source.find(i=>i?.id===id):source?.[id];if(found&&typeof found==='object')definition={...definition,...found};}
   const item={...definition,...e,id,quantity:total};for(const key of ['map','x','y','ai','faction','populationEntity','landscapeEntity'])delete item[key];
   const raw=player.inventory??data.inventory??latest.seed.inventory??[];let inventory;
   if(Array.isArray(raw))inventory=[...raw,item];
   else if(raw&&typeof raw==='object'&&Array.isArray(raw.items))inventory={...raw,items:[...raw.items,item]};
   else{const wrapped=raw&&typeof raw.items==='object'&&raw.items!==null,items={...(wrapped?raw.items:raw&&typeof raw==='object'?raw:{})};let key=String(id);while(Object.prototype.hasOwnProperty.call(items,key))key+='-pickup';items[key]=item;inventory=wrapped?{...raw,items}:items;}
   player={...player,inventory};amount=total;replacement=null;
  }
 }
 if(!amount){status.textContent='No room for this item, or its contents cannot be collected. Use the item context menu to inspect it.';return;}
 const text='Collected '+(e.name||'item')+' · '+amount+' unit'+(amount===1?'':'s')+'.';
 const token=String(latest.stateRevision)+':e:'+Date.now().toString(36)+':'+Math.random().toString(36).slice(2);
 pack.log=[text,...pack.log].slice(0,12);
 next={...next,seed:{...latest.seed,entities:latest.seed.entities.flatMap(v=>v.id===e.id?(replacement?[replacement]:[]):[v.id==='player'?player:v])},itemEcosystem:pack,inventoryPickup:{epoch:tokenEpoch,token,items:awards}};
 if(new TextEncoder().encode(JSON.stringify(next)).length>350000){status.textContent='The shared world is full. Nothing was collected.';return;}
 pending={base:latest.stateRevision,epoch:tokenEpoch,token,text};status.textContent='Collecting…';
 try{Gulch.commit(next,text);}catch(error){pending=null;status.textContent=String(error.message||error);}
 if(pending&&!window.GulchMovementState?.inFlight){pending=null;status.textContent='Pickup was not submitted. Try again when the room is ready.';}
 render();
}
function interact(){
 if(!ready())return;
 const e=target();if(e){collect(e);return;}
 const q=latest.gameState.legendarySwordQuest;
 const questButton=document.querySelector('#swordQuestTracker button');
 if(q?.epoch===epoch(latest.gameState)&&q.sites?.some(nearby)&&questButton&&!questButton.disabled){questButton.click();return;}
 const trader=document.getElementById('tradeToggle');if(trader&&!trader.hidden&&!trader.disabled){trader.click();return;}
 const speaker=latest.seed.entities.find(e=>nearby(e)&&e.id!=='player'&&e.faction!=='hostile'&&(e.outsideNPC||e.loreSpeaker||e.outsideAnimal==='fox'||/^(villager|traveler|merchant|guard|npc)$/.test(e.kind||'')));
 if(speaker){
  const board=document.getElementById('board'),rect=board.getBoundingClientRect(),p=latest.player,v=window.GulchMovementState?.visual,camera=v?.map===p.map?v:p,ts=Math.max(20,Math.min(64,Number(latest.seed.meta?.tileSize)||32));
  board.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:rect.left+rect.width/2+(speaker.x-camera.x)*ts,clientY:rect.top+rect.height/2+(speaker.y-camera.y)*ts}));return;
 }
 const map=latest.seed.maps.find(m=>m.id===latest.mapId),p=latest.player;
 if(map?.exits?.some(e=>e.x===p.x&&e.y===p.y)){document.getElementById('descendBtn')?.click();return;}
 status.textContent='Nothing to interact with here. Stand on or directly beside an item, NPC or quest relic; stand on an exit to use it.';
}
function render(){const e=target();button.textContent=e?'Pick up [E] · '+String(e.name||'item').slice(0,35):'Interact [E]';button.disabled=!ready();}
button.addEventListener('click',interact);
window.addEventListener('keydown',event=>{
 if(String(event.key).toLowerCase()!=='e'||event.ctrlKey||event.metaKey||event.altKey||event.isComposing)return;
 const node=event.target;if(node instanceof HTMLElement&&(node.matches('input,textarea,select')||node.isContentEditable))return;
 if(!window.GulchMovementState?.focused||blocked())return;
 event.preventDefault();event.stopImmediatePropagation();if(!event.repeat)interact();
},true);
Gulch.register('interact-key',{snapshot(s){latest=s;if(pending&&s.stateRevision!==pending.base){const request=pending;pending=null;status.textContent=epoch(s.gameState)===request.epoch&&s.gameState.inventoryPickup?.token===request.token?request.text:'Another room update arrived. Check the ground before retrying.';}if(s.player.hp<=0){pending=null;status.textContent='';}render();},action(a){if(a?.type==='interact')interact();}});
setInterval(()=>{if(!document.hidden)render();},250);
const help=document.getElementById('keyHelp');if(help){const p=document.createElement('p');p.textContent='E — pick up items and supplies on your tile or directly beside you. Press again for another nearby item. Also recover quest relics, talk to adjacent villagers, pat foxes, trade, or use an exit beneath you. Pickups stay in the shared pack without opening inventory.';help.append(p);}
})();
