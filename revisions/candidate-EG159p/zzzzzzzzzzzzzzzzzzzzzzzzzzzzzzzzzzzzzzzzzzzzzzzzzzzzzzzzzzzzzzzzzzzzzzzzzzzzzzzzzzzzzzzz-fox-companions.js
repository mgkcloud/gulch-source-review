(function(){
'use strict';
const host=document.getElementById('left'),board=document.getElementById('board');
if(!host||!board)return;
const commit=Gulch.commit,KEY='foxCompanions';
let latest=null,target=null,pending=null,returnFocus=null,lastFrame=0;
const epoch=d=>String(d?.respawnSettings?.token||'original');
const count=n=>Number.isFinite(Number(n))?Math.max(0,Math.floor(Number(n))):0;
const fox=e=>e&&e.id!=='player'&&e.faction!=='hostile'&&(e.outsideAnimal==='fox'||e.species==='fox')&&!(e.hp!=null&&Number(e.hp)<=0);
function state(d){const v=d[KEY];return v?.epoch===epoch(d)?v:{epoch:epoch(d),ids:[],receipt:null};}
function distance(a,b){return Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));}
function floor(seed,map,x,y){const c=map?.ascii[y]?.[x];return Boolean(c)&&!['#','~','>'].includes(c)&&!['wall','water'].includes(seed.legend[c]?.[0])&&!map.exits?.some(e=>e.x===x&&e.y===y)&&!map.groundHazards?.cells?.some(e=>e.x===x&&e.y===y)&&!map.dynamicRegion?.sites?.some(e=>e.kind==='trap'&&!e.spent&&e.x===x&&e.y===y);}
function visible(e){return fox(e)&&!e.foxWaiting&&e.map===latest?.mapId&&latest.lit[e.y]?.[e.x]===1;}
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
const style=el('style');style.textContent='#foxPatDialog{width:min(390px,calc(100% - 24px));max-height:85vh;overflow:auto;padding:20px;background:#152c29;color:#e3e8d3;border:3px double #c49c68;border-radius:9px;font:13px/1.6 monospace}#foxPatDialog::backdrop{background:#04101588}#foxPatDialog h2{color:#f7d49b;margin:0}#foxPatDialog button{min-height:44px;padding:10px 16px;margin:6px 8px 0 0;background:#354e37;color:#ffe5b4;border:1px solid #bba477;border-radius:5px;font:inherit}#foxPatDialog button:disabled{opacity:.5}#foxPatDialog :focus-visible{outline:2px solid #ffe5b4;outline-offset:3px}#foxPatStatus{min-height:42px;color:#e6ce93}';document.head.append(style);
const dialog=el('dialog');dialog.id='foxPatDialog';dialog.setAttribute('aria-labelledby','foxPatTitle');
const title=el('h2','Woodland fox');title.id='foxPatTitle';
const info=el('p'),status=el('p');status.id='foxPatStatus';status.setAttribute('role','status');
const pat=el('button','Pat'),close=el('button','Close');pat.type=close.type='button';dialog.append(title,info,status,pat,close);document.body.append(dialog);
function blocked(){return ['inventoryPanel','characterPanel','questBoard','workBoard','livingPanel','respawnScreen','interfaceMenu','tradePanel','travelMapPanel','pilgrimJournal'].some(id=>{const n=document.getElementById(id);return n&&!n.hidden;})||Array.from(document.querySelectorAll('dialog[open]')).some(n=>n!==dialog);}
function ready(){const m=window.GulchMovementState;return latest&&latest.player.hp>0&&!latest.gameState.gulchPermanentGameOver?.ended&&m?.focused&&!m.inFlight&&!pending&&!blocked();}
function adjacent(e){const p=latest.player,map=latest.seed.maps.find(m=>m.id===p.map);return e.map===p.map&&Math.abs(e.x-p.x)+Math.abs(e.y-p.y)<=1&&floor(latest.seed,map,e.x,e.y);}
function render(){
 if(!dialog.open)return;
 const e=latest?.seed.entities.find(e=>e.id===target);
 if(!visible(e)||latest.player.hp<=0){dialog.close();return;}
 const tame=state(latest.gameState).ids.includes(e.id);
 title.textContent=e.name||'Woodland fox';
 info.textContent=tame?'Your '+(e.foxPersonality||'curious')+' companion keeps at least three tiles of space, explores nearby trails, plays and collects supplies. “'+(e.foxThought||'What is that interesting smell?')+'”':'Stand directly beside this fox and pat it. Each pat has a 30% chance to tame it. Patting takes no turn. Up to eight foxes can accompany the shared adventurer.';
 pat.textContent=tame?'Already your companion':'Pat · 30% tame chance';
 pat.disabled=tame||!ready()||!adjacent(e)||state(latest.gameState).ids.length>=8;
 if(!pending&&!tame&&!adjacent(e))status.textContent='Move directly beside the fox, then right-click it again.';
}
close.addEventListener('click',()=>dialog.close());
dialog.addEventListener('cancel',e=>{e.preventDefault();dialog.close();});
dialog.addEventListener('close',()=>{target=null;const n=returnFocus?.isConnected&&!returnFocus.closest('[hidden],[inert]')?returnFocus:board;board.tabIndex=-1;n.focus({preventScroll:true});});
window.addEventListener('keydown',e=>{if(!dialog.open)return;if(e.key==='Escape'){e.preventDefault();dialog.close();}if(e.key!=='Tab')e.stopImmediatePropagation();},true);
window.addEventListener('contextmenu',e=>{
 if(e.target!==board||!latest||latest.player.hp<=0||blocked())return;
 const r=board.getBoundingClientRect(),p=latest.player,v=window.GulchMovementState?.visual,camera=v?.map===p.map?v:p,ts=Math.max(20,Math.min(64,Number(latest.seed.meta?.tileSize)||32));
 const x=Math.round(camera.x+(e.clientX-r.left-r.width/2)/ts),y=Math.round(camera.y+(e.clientY-r.top-r.height/2)/ts);
 const animal=latest.seed.entities.find(a=>visible(a)&&a.x===x&&a.y===y);if(!animal)return;
 e.preventDefault();e.stopImmediatePropagation();target=animal.id;returnFocus=document.activeElement;status.textContent='';dialog.showModal();render();close.focus();
},true);
function hash(text){let h=2166136261;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
function random(text){let h=hash(text);return ()=>{h=(Math.imul(h,1664525)+1013904223)|0;return (h>>>0)/4294967296;};}
const personalities=['curious','playful','watchful'];
const thoughts={sniff:['Something interesting passed this way.','A new smell! I must investigate.','Is that a beetle under the leaves?'],play:['Catch the leaf! Catch the leaf!','My tail is following me again.','This patch of grass needs a good pounce.'],rest:['A little sunshine, a little stretch.','I can watch my friend from here.','These paws deserve a moment.'],follow:['There goes my friend. This way!','Room to wander, but never too far.','I know a lovely trail over here.'],gather:['A present for my friend!','Something useful among the leaves.','My nose found treasure!'],retreat:['A little space, please!','Let me scoot out of your way.','Three paw-lengths? Better make it three tiles.']};
function collectible(e,catalog){return e.id!=='player'&&!e.swordQuestLandmark&&!e.atlasChart&&!e.isPlayer&&!e.playerId&&!e.clientId&&!e.ownerId&&e.faction!=='hostile'&&(e.ecosystemLoot||e.outsideResource||e.livingResource||e.regionFood||e.itemId&&catalog[e.itemId]||/^(item|weapon|armor|armour|consumable|material|relic)$/.test(e.kind||'')&&catalog[e.id]);}
function advance(data,force){
 if(!latest||!data?.seed||epoch(data)!==epoch(latest.gameState))return data;
 const s=state(data),p=data.seed.entities.find(e=>e.id==='player');
 if(!s.ids.length||!p||p.hp<=0||data.gulchPermanentGameOver?.ended)return data;
 const turnAdvanced=Number(data.turn)>Number(latest.turn),moved=p.map!==latest.player.map||p.x!==latest.player.x||p.y!==latest.player.y;
 if(!force&&!turnAdvanced&&!moved)return data;
 const seed=data.seed,map=seed.maps.find(m=>m.id===p.map);if(!map)return data;
 const catalog=window.GulchItemCatalog?.items||{};
 let entities=seed.entities.slice();
 const terrain=new Map(),threats=new Set(),hostiles=entities.filter(e=>e.map===p.map&&e.faction==='hostile'&&e.hp>0);
 const excludedTerrain=new Set();
 function excludeTerrain(e){
  if(Number.isSafeInteger(e.x)&&Number.isSafeInteger(e.y))excludedTerrain.add(e.x+','+e.y);
 }
 for(const e of map.exits||[])excludeTerrain(e);
 for(const e of map.groundHazards?.cells||[])excludeTerrain(e);
 for(const e of map.dynamicRegion?.sites||[])if(e.kind==='trap'&&!e.spent)excludeTerrain(e);
 let occupancy=new Map(),safeMemo=new Map();
 function cachedFloor(x,y){
  if(!Number.isSafeInteger(x)||!Number.isSafeInteger(y))return floor(seed,map,x,y);
  const key=x+','+y;
  if(!terrain.has(key)){
   const c=map.ascii[y]?.[x];
   terrain.set(key,Boolean(c)&&!['#','~','>'].includes(c)&&!['wall','water'].includes(seed.legend[c]?.[0])&&!excludedTerrain.has(key));
  }
  return terrain.get(key);
 }
 const indexedThreats=hostiles.every(e=>Number.isSafeInteger(e.x)&&Number.isSafeInteger(e.y)&&Math.abs(e.x)<=Number.MAX_SAFE_INTEGER-2&&Math.abs(e.y)<=Number.MAX_SAFE_INTEGER-2);
 if(indexedThreats)for(const e of hostiles)for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)threats.add((e.x+dx)+','+(e.y+dy));
 function rebuildOccupancy(){
  occupancy=new Map();safeMemo=new Map();
  for(const e of entities){
   if(e.map!==p.map)continue;
   const key=e.x+','+e.y;
   let occupants=occupancy.get(key);
   if(!occupants){occupants=[];occupancy.set(key,occupants);}
   occupants.push(e);
  }
 }
 const oldAnimals=new Map(latest.seed.entities.filter(fox).map(e=>[e.id,e]));
 const oldPack=data.itemEcosystem;
 const pack=oldPack?.epoch===epoch(data)?{...oldPack,bag:{...oldPack.bag},known:[...(oldPack.known||[])],log:[...(oldPack.log||[])]}:{epoch:epoch(data),bag:{},equipment:{},known:[],crafted:[],log:[]};
 const resources={...data.outsideWorld?.resources};
 const food=data.regionSupplies?.epoch===epoch(data)?{...data.regionSupplies}:{epoch:epoch(data),food:0,rested:[]};
 const living=data.livingWorld?.epoch===epoch(data)?{...data.livingWorld}:{epoch:epoch(data),age:0,wave:0,forge:0,camp:0,herbs:0,visits:[],claims:[],log:[]};
 let total=0,packChanged=false,resourceChanged=false,foodChanged=false,herbsChanged=false;
 const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
 let reachable=null;
 function reachableSpots(){
  if(reachable)return reachable;
  reachable=[];
  const seen=new Set([p.x+','+p.y]),queue=[{x:p.x,y:p.y}];
  for(let i=0;i<queue.length&&i<12000;i++){
   const q=queue[i];if(cachedFloor(q.x,q.y)&&distance(q,p)>=3)reachable.push(q);
   for(const [dx,dy] of dirs){const x=q.x+dx,y=q.y+dy,k=x+','+y;if(!seen.has(k)&&cachedFloor(x,y)){seen.add(k);queue.push({x,y});}}
  }
  return reachable;
 }
 function free(q,id){
  return cachedFloor(q.x,q.y)&&!occupancy.get(q.x+','+q.y)?.some(e=>e.id!==id&&e.x===q.x&&e.y===q.y&&!collectible(e,catalog))&&!(indexedThreats&&Number.isSafeInteger(q.x)&&Number.isSafeInteger(q.y)?threats.has(q.x+','+q.y):hostiles.some(e=>distance(e,q)<=2));
 }
 function safe(q,id){
  let row=safeMemo.get(q.y);
  if(!row){row=new Map();safeMemo.set(q.y,row);}
  if(!row.has(q.x))row.set(q.x,distance(q,p)>=3&&free(q,id));
  return row.get(q.x);
 }
 for(const id of s.ids.slice(0,8)){
  let pet=entities.find(e=>e.id===id)||oldAnimals.get(id);if(!fox(pet))continue;
  rebuildOccupancy();
  const rng=random(epoch(data)+':'+id+':'+data.turn+':'+latest.stateRevision),personality=pet.foxPersonality||personalities[hash(id)%personalities.length];
  let mood=pet.foxMood||'sniff',goal=pet.foxGoal,wait=Math.min(3,count(pet.foxPause)),placed=false;
  const needsSpace=pet.map!==p.map||pet.foxWaiting||!safe(pet,id);
  if(needsSpace){
   // Move aside without spending extra player turns; never leave a companion inside the three-tile boundary.
   const spots=reachableSpots().filter(q=>safe(q,id)).sort((a,b)=>{
    const score=q=>Math.abs(distance(q,p)-4)*4+(pet.map===p.map?Math.abs(q.x-pet.x)+Math.abs(q.y-pet.y):0);
    return score(a)-score(b)||a.y-b.y||a.x-b.x;
   });
   if(!spots.length){
    // In a cramped region the fox waits off-map until a safe connected tile exists.
    pet={...pet,map:p.map,x:-1,y:-1,foxWaiting:true,foxMood:'rest',foxThought:'I will wait for a wider trail.',foxCompanion:true,foxPersonality:personality};
    entities=entities.filter(e=>e.id!==id);entities.push(pet);continue;
   }
   const top=spots.slice(0,Math.min(4,spots.length));
   const landing=top[Math.floor(rng()*top.length)];
   pet={...pet,map:p.map,...landing,foxWaiting:false};goal=null;wait=0;mood='retreat';placed=true;
  }
  if(turnAdvanced&&!placed){
   const far=distance(pet,p)>8;
   if(wait&&!far){wait--;}
   else{
    const root={x:pet.x,y:pet.y,first:null,d:0};
    root.safe=safe(root,id);
    const q=[root],visited=new Set([pet.x+','+pet.y]),options=[];
    for(let i=0;i<q.length&&i<1600;i++){
     const n=q[i];if(n.safe)options.push(n);
     for(const [dx,dy] of dirs){const x=n.x+dx,y=n.y+dy,k=x+','+y,next={x,y};if(visited.has(k)||n.d>=24)continue;const isSafe=safe(next,id);if(!isSafe)continue;visited.add(k);q.push({...next,first:n.first||next,d:n.d+1,safe:isSafe});}
    }
    let destination=goal&&distance(goal,p)<=7?options.find(n=>n.x===goal.x&&n.y===goal.y):null;
    if(destination&&!destination.first)destination=null;
    if(!destination){
     const nearby=options.filter(n=>n.first&&distance(n,p)<=7);
     const loot=entities.filter(e=>e.map===p.map&&collectible(e,catalog));
     const huntingCells=new Set(),unindexedLoot=[];
     const indexable=n=>Number.isSafeInteger(n.x)&&Number.isSafeInteger(n.y)&&Math.abs(n.x)<=Number.MAX_SAFE_INTEGER-2&&Math.abs(n.y)<=Number.MAX_SAFE_INTEGER-2;
     for(const e of loot){
      if(!indexable(e)){unindexedLoot.push(e);continue;}
      huntingCells.add(e.x+','+e.y);
      huntingCells.add((e.x-1)+','+e.y);
      huntingCells.add((e.x+1)+','+e.y);
      huntingCells.add(e.x+','+(e.y-1));
      huntingCells.add(e.x+','+(e.y+1));
     }
     const hunting=nearby.filter(n=>indexable(n)?huntingCells.has(n.x+','+n.y)||unindexedLoot.some(e=>Math.abs(e.x-n.x)+Math.abs(e.y-n.y)<=1):loot.some(e=>Math.abs(e.x-n.x)+Math.abs(e.y-n.y)<=1));
     if(hunting.length&&rng()<.7){destination=hunting[Math.floor(rng()*hunting.length)];mood='gather';}
     else if(far){destination=options.filter(n=>n.first).sort((a,b)=>distance(a,p)-distance(b,p)||a.d-b.d)[0];mood='follow';}
     else{
      const roll=rng();mood=roll<(personality==='playful'?.5:.28)?'play':roll>.82?'rest':'sniff';
      const pool=nearby.length?nearby:options.filter(n=>n.first);
      destination=pool[Math.floor(rng()*pool.length)];
      if(mood==='rest')wait=1+Math.floor(rng()*2);
     }
     goal=destination?{x:destination.x,y:destination.y}:null;
    }
    if(destination?.first&&!wait)pet={...pet,...destination.first};
    if(goal&&pet.x===goal.x&&pet.y===goal.y){goal=null;wait=mood==='play'?1:Math.floor(rng()*3);}
   }
  }
  const lines=thoughts[mood]||thoughts.sniff;
  const changed=mood!==pet.foxMood||!pet.foxThought||Number(data.turn)%5===hash(id)%5;
  const thought=changed?lines[Math.floor(rng()*lines.length)]:pet.foxThought;
  pet={...pet,foxCompanion:true,foxWaiting:false,foxPersonality:personality,foxMood:mood,foxGoal:goal||null,foxPause:wait,foxThought:thought,dialogue:'Your '+personality+' fox '+({play:'is playing',rest:'is resting',sniff:'is exploring a scent',follow:'is keeping you in sight',gather:'is looking for supplies',retreat:'is making room'}[mood]||'is exploring')+'. “'+thought+'”'};
  entities=entities.filter(e=>e.id!==id);entities.push(pet);
  if(!turnAdvanced)continue;
  entities=entities.flatMap(e=>{
   if(e.id===id||e.map!==p.map||!collectible(e,catalog)||Math.abs(e.x-pet.x)+Math.abs(e.y-pet.y)>1||!cachedFloor(e.x,e.y))return [e];
   if(e.ecosystemLoot){
    const contents={...e.contents};
    for(const [item,n] of Object.entries(contents)){if(!catalog[item])continue;const taken=Math.min(count(n),Math.max(0,999-count(pack.bag[item])));if(!taken)continue;pack.bag[item]=count(pack.bag[item])+taken;if(!pack.known.includes(item))pack.known.push(item);contents[item]=count(n)-taken;if(!contents[item])delete contents[item];total+=taken;packChanged=true;}
    return Object.keys(contents).length?[{...e,contents}]:[];
   }
   const amount=count(e.quantity??1);let taken=0;
   if(e.regionFood){taken=Math.min(amount,Math.max(0,99-count(food.food)));food.food=count(food.food)+taken;foodChanged=foodChanged||taken>0;}
   else if(e.livingResource==='herb'){taken=Math.min(amount,Math.max(0,99-count(living.herbs)));living.herbs=count(living.herbs)+taken;herbsChanged=herbsChanged||taken>0;}
   else if(e.outsideResource||e.livingResource){const key=e.outsideResource||e.livingResource;taken=Math.min(amount,Math.max(0,9999-count(resources[key])));resources[key]=count(resources[key])+taken;resourceChanged=resourceChanged||taken>0;}
   else{const key=e.itemId||e.id;if(catalog[key]){taken=Math.min(amount,Math.max(0,999-count(pack.bag[key])));pack.bag[key]=count(pack.bag[key])+taken;if(taken&&!pack.known.includes(key))pack.known.push(key);packChanged=packChanged||taken>0;}}
   total+=taken;return taken?(taken<amount?[{...e,quantity:amount-taken}]:[]):[e];
  });
 }
 const next={...data,seed:{...seed,entities}};
 if(packChanged){pack.log=['Fox companions gathered nearby supplies.',...pack.log].slice(0,12);next.itemEcosystem=pack;}
 if(resourceChanged)next.outsideWorld={...data.outsideWorld,resources};
 if(foodChanged)next.regionSupplies=food;if(herbsChanged)next.livingWorld=living;
 if(total)next[KEY]={...s,pickup:{token:String(latest.stateRevision)+':'+data.turn,amount:total}};
 return next;
}
pat.addEventListener('click',()=>{
 const e=latest?.seed.entities.find(e=>e.id===target);if(!ready()||!visible(e)||!adjacent(e))return;
 const data=latest.gameState,s=state(data);if(s.ids.includes(e.id)||s.ids.length>=8)return;
 const success=Math.random()<.3,token=String(latest.stateRevision)+':'+Date.now()+':'+Math.random().toString(36).slice(2);
 const text=success?(e.name||'The fox')+' trusts you! It bounds away to explore beside your trail.':'The fox accepts your pat, but stays wild. You can try again.';
 let next={...data,[KEY]:{...s,ids:success?[...s.ids,e.id]:s.ids,receipt:{token,text}},seed:success?{...data.seed,entities:data.seed.entities.map(a=>a.id===e.id?{...a,foxCompanion:true,faction:'friendly'}:a)}:data.seed};
 if(success)next=advance(next,true);
 if(new TextEncoder().encode(JSON.stringify(next)).length>350000){status.textContent='The shared world is full. No pat was submitted.';return;}
 pending={base:latest.stateRevision,token};status.textContent='Waiting for the room…';
 try{Gulch.commit(next,text);}catch(error){pending=null;status.textContent=String(error.message||error);}
 if(pending&&!window.GulchMovementState?.inFlight){pending=null;status.textContent='Pat was not submitted. Wait for the current room update.';}render();
});
Gulch.commit=function(data,activity){
 const next=advance(data,false);
 if(new TextEncoder().encode(JSON.stringify(next)).length>350000)return commit(data,activity);
 const collected=next?.[KEY]?.pickup?.token!==data?.[KEY]?.pickup?.token?next[KEY]?.pickup?.amount:0;
 return commit(next,(activity||'')+(collected?' Fox companions collected '+collected+' supply units.':''));
};
const canvas=el('canvas');canvas.setAttribute('aria-hidden','true');canvas.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:2';host.append(canvas);
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
function paint(now){
 const w=host.clientWidth,h=host.clientHeight,dpr=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));canvas.style.width=w+'px';canvas.style.height=h+'px';}
 const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);if(!latest)return;
 const p=latest.player,v=window.GulchMovementState?.visual,camera=v?.map===p.map?v:p,ts=Math.max(20,Math.min(64,Number(latest.seed.meta?.tileSize)||32)),ids=new Set(state(latest.gameState).ids);
 const showThoughts=!blocked()&&!dialog.open;
 for(const e of latest.seed.entities){
  if(!ids.has(e.id)||!visible(e))continue;
  const x=w/2+(e.x-camera.x)*ts,y=h/2+(e.y-camera.y)*ts,phase=reduced.matches?0:Math.sin(now/240+hash(e.id)%12);
  c.font='12px monospace';c.textAlign='center';c.fillStyle='#ffe0a0';c.fillText('♥',x,y-ts*.57);
  if(e.foxMood==='play'){
   c.fillStyle='#dfa35d';c.fillRect(Math.round(x+ts*.32+phase*3),Math.round(y+ts*.15-Math.abs(phase)*6),4,2);
   c.strokeStyle='#c8d89088';c.beginPath();c.arc(x,y+ts*.28,ts*.34,0,Math.PI);c.stroke();
  }else if(e.foxMood==='sniff'||e.foxMood==='gather'){
   c.fillStyle='#d2c7a0';for(let i=0;i<3;i++)c.fillRect(Math.round(x+ts*.3+i*4),Math.round(y-ts*.1-i*3+phase),1,1);
  }else if(e.foxMood==='rest'){c.font='10px monospace';c.fillStyle='#c7d9cb';c.fillText('z',x+ts*.3,y-ts*.25-phase*2);}
  if(showThoughts&&distance(e,p)<=7){
   const text=e.foxThought||'What is that smell?';c.font='9px monospace';const width=Math.min(220,c.measureText(text).width+12);
   c.fillStyle='#112922eb';c.fillRect(x-width/2,y-ts*.9-15,width,15);c.fillStyle='#e3dab7';c.fillText(text,x,y-ts*.9-4,width-8);
  }
 }
}
// Waiting companions remain shared entities but are excluded from derived render snapshots.
const register=Gulch.register;
// Existing renderers already ignore out-of-bounds, unlit waiting coordinates.
register('fox-companions',{snapshot(s){const reset=latest&&epoch(latest.gameState)!==epoch(s.gameState);latest=s;if(reset){pending=null;if(dialog.open)dialog.close();}if(pending&&pending.base!==s.stateRevision){const r=pending;pending=null;status.textContent=state(s.gameState).receipt?.token===r.token?state(s.gameState).receipt.text:'Another room update won. This pat was not confirmed; try again.';}render();paint(performance.now());},resize(){paint(performance.now());}});
function frame(now){if(!document.hidden&&latest&&now-lastFrame>=125){lastFrame=now;paint(now);}requestAnimationFrame(frame);}requestAnimationFrame(frame);
setInterval(()=>{if(!document.hidden&&dialog.open)render();},300);
const help=document.getElementById('keyHelp');if(help)help.append(el('p','Fox friends: right-click a wild fox and Pat from directly beside it (30% chance). Tamed foxes explore, sniff, play and rest around you, keeping at least three tiles away including diagonals. They collect nearby ordinary supplies on played turns and follow between regions. When you approach too closely they move aside; in cramped passages they wait out of sight until a safe connected spot opens. Hearts and thought bubbles reveal their personalities. Menus do not advance their roaming or collection.'));
})();
