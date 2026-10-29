(function(){
'use strict';
let latest=null,location=null,pending=null;
const panel=document.getElementById('itemContext'),inventory=document.getElementById('inventoryPanel');
if(!panel||!inventory)return;
const picker=panel.querySelector('select');
const button=document.createElement('button');button.type='button';button.hidden=true;
const status=document.createElement('p');status.setAttribute('role','status');panel.append(button,status);
const epoch=d=>String(d.respawnSettings?.token||'original');
const count=n=>Number.isFinite(Number(n))?Math.max(0,Math.floor(Number(n))):0;
const catalog=()=>window.GulchItemCatalog?.items||{};
function pack(){const v=latest.gameState.itemEcosystem;return v?.epoch===epoch(latest.gameState)?v:{epoch:epoch(latest.gameState),bag:{},equipment:{},known:[],crafted:[],log:[]};}
function adjacent(e){const p=latest.player;return e.map===p.map&&Math.abs(e.x-p.x)+Math.abs(e.y-p.y)<=1;}
function choices(){
 if(!latest||!location||location.map!==latest.mapId||location.epoch!==epoch(latest.gameState))return [];
 const result=[];
 for(const e of latest.seed.entities){
  if(e.id==='player'||e.map!==location.map||e.x!==location.x||e.y!==location.y)continue;
  if(e.ecosystemLoot){for(const [id,n] of Object.entries(e.contents||{}))if(count(n))result.push({entity:e,id,kind:'loot',name:catalog()[id]?.name||id});}
  else if(e.outsideResource||e.livingResource||e.regionFood||e.itemId||/^(item|weapon|armor|consumable|quest-relic)$/.test(e.kind||'')){
   const kind=e.swordQuestLandmark||e.kind==='quest-relic'?'quest':e.regionFood?'food':e.livingResource==='herb'?'herb':e.outsideResource||e.livingResource?'resource':'item';
   const id=e.outsideResource||e.livingResource||e.itemId||e.id;
   result.push({entity:e,id,kind,name:catalog()[id]?.name||e.name||id});
  }
 }
 return result;
}
function selected(){return choices()[Number(picker?.value)||0]||null;}
function ready(){return latest&&latest.player.hp>0&&!latest.gameState.gulchPermanentGameOver?.ended&&!pending&&!window.GulchMovementState?.inFlight&&window.GulchMovementState?.focused;}
function say(text){status.textContent=text;const n=document.getElementById('packStatus');if(n)n.textContent=text;}
function remember(event){
 if(panel.contains(event.target))return;
 location=null;
 if(event.target!==document.getElementById('board')||!latest)return;
 const rect=event.target.getBoundingClientRect(),p=latest.player,v=window.GulchMovementState?.visual,camera=v?.map===p.map?v:p,ts=Math.max(20,Math.min(64,Number(latest.seed.meta?.tileSize)||32));
 location={map:p.map,epoch:epoch(latest.gameState),x:Math.round(camera.x+(event.clientX-rect.left-rect.width/2)/ts),y:Math.round(camera.y+(event.clientY-rect.top-rect.height/2)/ts)};
}
window.addEventListener('pointerdown',remember,true);
window.addEventListener('pointerup',()=>queueMicrotask(render),true);
function render(){
 const target=selected();button.hidden=panel.hidden||!target;
 if(button.hidden)return;
 button.textContent=target.kind==='quest'?'Recover quest relic':'Collect '+target.name;
 button.disabled=!ready()||!adjacent(target.entity);
 status.textContent=pending?'Waiting for room confirmation…':!adjacent(target.entity)?'Stand on or directly beside this item to collect it.':target.kind==='quest'?'Recover this relic into the shared quest pouch.':'Collect this item into your shared inventory.';
}
function nativeItem(e,amount){
 let definition=null;
 for(const source of [latest.seed.items,latest.seed.itemDefinitions,latest.gameState.items]){
  const found=Array.isArray(source)?source.find(v=>v?.id===(e.itemId||e.id)):source?.[e.itemId||e.id];
  if(found&&typeof found==='object')definition=found;
 }
 const item={...definition,...e,id:e.itemId||e.id,quantity:amount};
 for(const key of ['map','x','y','ai','faction','populationEntity','landscapeEntity'])delete item[key];
 return item;
}
function appendNative(player,items){
 const raw=player.inventory??latest.gameState.inventory??latest.seed.inventory??[];
 if(Array.isArray(raw))return {...player,inventory:[...raw,...items]};
 if(raw&&typeof raw==='object'){
  if(Array.isArray(raw.items))return {...player,inventory:{...raw,items:[...raw.items,...items]}};
  const wrapped=raw.items&&typeof raw.items==='object',contents={...(wrapped?raw.items:raw)};
  for(const item of items){let key=String(item.id);while(Object.prototype.hasOwnProperty.call(contents,key))key+='-pickup';contents[key]=item;}
  return {...player,inventory:wrapped?{...raw,items:contents}:contents};
 }
 return {...player,inventory:items};
}
function collect(target){
 if(!ready()){say('Wait for game focus and the current room update, then try again.');return;}
 const data=latest.gameState,tokenEpoch=epoch(data);
 const requests=target?[target]:latest.seed.entities.filter(e=>e.ecosystemLoot&&adjacent(e)).flatMap(e=>Object.entries(e.contents||{}).filter(([,n])=>count(n)).map(([id])=>({entity:e,id,kind:'loot',name:catalog()[id]?.name||id})));
 if(!requests.length){say('Stand on or directly beside a loot cache.');return;}
 if(requests.some(r=>!adjacent(r.entity))){say('Move directly beside the item first.');return;}
 const old=pack(),bag={...old.bag},known=Array.isArray(old.known)?old.known.slice():[],updates=new Map(),native=[],awards={},names=[];
 let next={...data},firstKey=null;
 function remove(e,amount,total){updates.set(e.id,total>amount?{...e,quantity:total-amount}:null);}
 for(const r of requests){
  const e=r.entity,total=count(e.quantity??1);
  if(r.kind==='quest'){
   const q=next.legendarySwordQuest,key=e.swordQuestLandmark;
   if(!q||q.epoch!==tokenEpoch||!['blade','guard','hilt'].includes(key)||q.pieces.includes(key)){say('This quest relic is not currently recoverable.');return;}
   next.legendarySwordQuest={...q,pieces:[...q.pieces,key]};updates.set(e.id,null);names.push(e.name);firstKey='quest:'+key;continue;
  }
  if(r.kind==='loot'||(r.kind==='item'&&catalog()[r.id])){
   const current=updates.has(e.id)?updates.get(e.id):e;
   if(!current)continue;
   const available=r.kind==='loot'?count(current.contents?.[r.id]):total;
   const taken=Math.min(available,Math.max(0,999-count(bag[r.id])));if(!taken)continue;
   bag[r.id]=count(bag[r.id])+taken;awards[r.id]=(awards[r.id]||0)+taken;
   if(!known.includes(r.id))known.push(r.id);
   if(r.kind==='loot'){const contents={...current.contents};if(available>taken)contents[r.id]=available-taken;else delete contents[r.id];updates.set(e.id,Object.keys(contents).length?{...current,contents}:null);}
   else remove(e,taken,total);
   firstKey=firstKey||'field:'+r.id;names.push(taken+' × '+r.name);
  }else if(r.kind==='resource'){
   const world=next.outsideWorld||{},resources={...world.resources},taken=Math.min(total,Math.max(0,9999-count(resources[r.id])));if(!taken)continue;
   resources[r.id]=count(resources[r.id])+taken;next.outsideWorld={...world,resources};remove(e,taken,total);firstKey=firstKey||'resource:'+r.id;names.push(taken+' × '+r.name);
  }else if(r.kind==='food'||r.kind==='herb'){
   const key=r.kind==='food'?'regionSupplies':'livingWorld',field=r.kind==='food'?'food':'herbs';
   const previous=next[key]?.epoch===tokenEpoch?next[key]:r.kind==='food'?{epoch:tokenEpoch,food:0,rested:[]}:{epoch:tokenEpoch,age:0,wave:0,forge:0,camp:0,herbs:0,visits:[],claims:[],log:[]};
   const taken=Math.min(total,Math.max(0,99-count(previous[field])));if(!taken)continue;
   next[key]={...previous,[field]:count(previous[field])+taken};remove(e,taken,total);names.push(taken+' × '+r.name);
  }else if(r.kind==='item'&&total){native.push(nativeItem(e,total));updates.set(e.id,null);names.push(total+' × '+r.name);}
 }
 if(!updates.size){say('These stacks are full. Use or craft items to make room.');return;}
 const text='Collected '+names.join(', ')+'.';
 let entities=latest.seed.entities.flatMap(e=>updates.has(e.id)?updates.get(e.id)?[updates.get(e.id)]:[]:[e]);
 if(native.length)entities=entities.map(e=>e.id==='player'?appendNative(e,native):e);
 const token=String(latest.stateRevision)+':'+Date.now().toString(36)+':'+Math.random().toString(36).slice(2);
 next={...next,seed:{...latest.seed,entities},itemEcosystem:{...old,bag,known,log:[text,...(Array.isArray(old.log)?old.log:[])].slice(0,12)},inventoryPickup:{token,epoch:tokenEpoch,items:awards}};
 if(new TextEncoder().encode(JSON.stringify(next)).length>350000){say('The shared world is too large to save this pickup. Nothing was removed.');return;}
 pending={base:latest.stateRevision,epoch:tokenEpoch,token,key:firstKey,text};say('Collecting… waiting for room confirmation.');
 try{Gulch.commit(next,text);}catch(error){pending=null;say('Pickup failed: '+String(error.message||error));return;}
 if(!window.GulchMovementState?.inFlight){pending=null;say('Pickup was not submitted. Please try again.');}
 render();
}
button.addEventListener('click',()=>{const target=selected();if(target)collect(target);});
window.addEventListener('click',event=>{
 const target=event.target instanceof Element?event.target.closest('button'):null;
 if(!target)return;
 const workshop=document.querySelector('#itemWorkshop > .item-tools button');
 if(target!==workshop&&!target.matches('#inventoryPanel .new-loot-shortcut'))return;
 event.preventDefault();event.stopImmediatePropagation();collect(null);
},true);
function reveal(receipt){
 if(!latest||latest.player.hp<=0||epoch(latest.gameState)!==receipt.epoch)return;
 panel.hidden=true;
 if(inventory.hidden)document.getElementById('inventoryToggle')?.click();
 if(inventory.hidden)return;
 inventory.querySelector('.new-inventory-nav button')?.click();
 const search=document.getElementById('inventorySearch');if(search){search.value='';search.dispatchEvent(new Event('input'));}
 const filter=inventory.querySelector('.pack-tools select');if(filter){filter.value='all';filter.dispatchEvent(new Event('change'));}
 const row=Array.from(inventory.querySelectorAll('.inventory-item[data-pack-key]')).find(n=>n.dataset.packKey===receipt.key);
 if(row){row.click();row.focus({preventScroll:true});row.scrollIntoView({block:'nearest'});}
 say(receipt.text);
}
const supplies=document.createElement('p');supplies.style.cssText='margin:4px 10px;font:11px/1.5 monospace;color:#cbdaca';
inventory.querySelector('.new-inventory-nav')?.after(supplies);
picker?.addEventListener('change',render);
new MutationObserver(render).observe(panel,{attributes:true,attributeFilter:['hidden']});
Gulch.register('context-item-collection',{snapshot(s){
 latest=s;
 const food=s.gameState.regionSupplies,herbs=s.gameState.livingWorld;
 supplies.textContent='Shared supplies · Food: '+(food?.epoch===epoch(s.gameState)?count(food.food):0)+' · Healing herbs: '+(herbs?.epoch===epoch(s.gameState)?count(herbs.herbs):0)+' · Use food from Details; herbs from Living world.';
 if(pending&&s.stateRevision!==pending.base){
  const receipt=pending;pending=null;
  if(epoch(s.gameState)===receipt.epoch&&s.gameState.inventoryPickup?.token===receipt.token)queueMicrotask(()=>reveal(receipt));
  else say('Another room update arrived before pickup was confirmed. Check the ground and collect again.');
 }
 render();
},action(a){if(a?.type==='collect-loot'&&!window.GulchMovementState?.inFlight)collect(null);}});
setInterval(()=>{if(!document.hidden&&!panel.hidden)render();},250);
})();
