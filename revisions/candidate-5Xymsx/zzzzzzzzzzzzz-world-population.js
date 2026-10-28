(function(){
'use strict';
const baseCommit=Gulch.commit;
let snapshot=null,pending=null,attempt=null;
const host=document.getElementById('left');
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
function hash(text){let h=2166136261;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
function random(text){let h=hash(text);return ()=>{h=(h+0x6d2b79f5)|0;let t=Math.imul(h^(h>>>15),h|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
function epoch(data){return String(data.respawnSettings?.token||'original');}
function floor(seed,map,x,y){const c=map.ascii[y]?.[x];return Boolean(c)&&!['#','~'].includes(c)&&!['wall','water'].includes(seed.legend[c]?.[0]);}
function accessible(seed,map,p){const queue=[{x:p.x,y:p.y}],seen=new Set([p.x+','+p.y]);for(let i=0;i<queue.length&&queue.length<12000;i++){const q=queue[i];for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=q.x+dx,y=q.y+dy,k=x+','+y;if(!seen.has(k)&&floor(seed,map,x,y)){seen.add(k);queue.push({x,y});}}}return queue;}
function populate(data){
 const seed=data.seed,p=seed?.entities?.find(e=>e.id==='player'),map=seed?.maps?.find(m=>m.id===p?.map);
 if(!map||map.worldPopulation?.version===1||p.hp<=0)return data;
 const cell=map.infiniteCell;
 const key=String(data.respawnSettings?.generationSeed||seed.meta?.seed||'gulch')+':'+(cell?cell.realm+':'+cell.x+':'+cell.y:map.id);
 const rng=random(key),roll=hash(key+':climate')%4;
 const wild=roll===0||roll===2,dangerous=roll===1||roll===3;
 const region=wild?(roll===0?'Orchard wilds':'Hunters’ grasslands'):(roll===1?'The ravaged marches':'Wisp-haunted frontier');
 const reachable=accessible(seed,map,p),seen=new Set(reachable.map(q=>q.x+','+q.y));
 let entities=seed.entities.slice();
 const occupied=new Set(entities.filter(e=>e.map===map.id).map(e=>e.x+','+e.y)),ids=new Set(entities.map(e=>e.id));
 const exits=map.exits||[],towns=[];
 const safe=q=>Math.hypot(q.x-p.x,q.y-p.y)>8&&exits.every(e=>Math.hypot(q.x-e.x,q.y-e.y)>3);
 const free=(x,y)=>seen.has(x+','+y)&&!occupied.has(x+','+y)&&!exits.some(e=>e.x===x&&e.y===y)&&map.ascii[y]?.[x]!=='>';
 const candidates=reachable.filter(q=>safe(q)&&free(q.x,q.y)&&[[1,0],[-1,0],[0,1],[0,-1]].every(([dx,dy])=>free(q.x+dx,q.y+dy)));
 for(let i=candidates.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
 let serial=0;
 function add(q,values){let id='population:'+map.id+':'+serial++;while(ids.has(id))id+='x';ids.add(id);occupied.add(q.x+','+q.y);const e={id,map:map.id,x:q.x,y:q.y,populationEntity:true,...values};entities.push(e);return e;}
 const townCount=reachable.length>2200?3:reachable.length>650?2:1;
 const first=['Birch','Amber','Thorn','Silver','Ash','Willow','Copper','Moss'],last=['haven','ford','watch','hollow','rest','wick'];
 for(const q of candidates){
  if(towns.length>=townCount)break;
  if(towns.some(t=>Math.hypot(t.x-q.x,t.y-q.y)<14))continue;
  if(!free(q.x,q.y))continue;
  const name=first[Math.floor(rng()*first.length)]+last[Math.floor(rng()*last.length)];
  const t={name,x:q.x,y:q.y};towns.push(t);
  add(q,{name:name+' refuge',kind:'prop',glyph:'⌂',color:'#ffe1a0',townRefuge:true,dialogue:'A sheltered town square. Stand beside the refuge and use the region panel to rest once for free.'});
  const jobs=[['keeper','Our refuge offers one free rest each expedition. The wilderness beyond our lanterns is dangerous.'],['scout',dangerous?'This is a death march. Beetles, crawlers and wisps hunt in large packs. Stock food and improve your weapon before exploring.':'Wild animals live beyond town. Look for berries, mushrooms and abandoned provision baskets.'],['farmer','Food restores health, but eating takes a turn. Carry supplies before leaving shelter.']];
  const around=reachable.filter(v=>Math.hypot(v.x-q.x,v.y-q.y)>=2&&Math.hypot(v.x-q.x,v.y-q.y)<=4&&free(v.x,v.y)).sort((a,b)=>a.y-b.y||a.x-b.x);
  for(let i=0;i<jobs.length&&around.length;i++){
   const index=Math.floor(rng()*around.length),site=around.splice(index,1)[0];
   const [job,dialogue]=jobs[i];add(site,{name:name+' '+job,kind:'villager',faction:'friendly',outsideNPC:true,dialogue});
  }
  for(let i=0;i<2&&around.length;i++){
   const site=around.splice(Math.floor(rng()*around.length),1)[0];
   add(site,{name:name+(i?' storehouse':' cottages'),kind:'prop',glyph:i?'▤':'⌂',color:i?'#cba978':'#e4c89b',dialogue:'Timber shelters surround the lantern-lit town square.'});
  }
 }
 const reserve=q=>towns.some(t=>Math.hypot(t.x-q.x,t.y-q.y)<7);
 let spots=reachable.filter(q=>safe(q)&&free(q.x,q.y)&&!reserve(q));
 for(let i=spots.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[spots[i],spots[j]]=[spots[j],spots[i]];}
 const take=()=>{while(spots.length){const q=spots.pop();if(free(q.x,q.y))return q;}return null;};
 let enemies=0,animals=0,food=0;
 const mode=data.respawnSettings?.difficulty||'hard';
 const baseHp={easy:4,normal:6,hard:8,nightmare:12}[mode]||8;
 const existing=entities.filter(e=>e.map===map.id&&e.faction==='hostile'&&e.hp>0).length;
 const globalCount=entities.filter(e=>e.populationEntity&&e.faction==='hostile').length;
 const desired=dangerous?34:10;
 const amount=Math.max(0,Math.min(desired-existing,180-globalCount,Math.floor(spots.length/7)));
 for(let i=0;i<amount;i++){
  const q=take();if(!q)break;
  const type=['beetle','crawler','wisp'][Math.floor(rng()*3)],elite=dangerous&&i%5===0;
  const hp=baseHp+(elite?6:dangerous?2:0);
  add(q,{name:(elite?'Dread ':dangerous?'Ravenous ':'Wild ')+type,kind:'cave-creature',faction:'hostile',caveEncounter:1,caveSprite:type,hp,maxHp:hp,glyph:' '});enemies++;
 }
 if(wild)for(let i=0;i<12;i++){
  const q=take();if(!q)break;
  const species=['deer','rabbit','sheep','fox'][Math.floor(rng()*4)];
  add(q,{name:'Wild '+species,kind:'animal',species,outsideAnimal:species,faction:'friendly',glyph:' ',dialogue:'The '+species+' watches you peacefully from the grass.'});animals++;
 }
 const foodNames=[['Sunberries','●','#ec9b8e'],['Edible mushrooms','♣','#e5c28e'],['Trail provisions','▣','#d5c88b']];
 const foodSpots=reachable.filter(q=>free(q.x,q.y)&&Math.hypot(q.x-p.x,q.y-p.y)>2);
 for(let i=0;i<(wild?18:6)&&foodSpots.length;i++){
  const q=foodSpots.splice(Math.floor(rng()*foodSpots.length),1)[0];if(!free(q.x,q.y))continue;
  const f=foodNames[i%3];add(q,{name:f[0],kind:'resource',regionFood:true,quantity:1+Math.floor(rng()*3),glyph:f[1],color:f[2]});food++;
 }
 const report={version:1,region,dangerous,wild,towns,enemies,animals,food};
 const updated={...map,worldPopulation:report};
 return {...data,seed:{...seed,maps:seed.maps.map(m=>m.id===map.id?updated:m),entities}};
}
function withinBudget(data){return new TextEncoder().encode(JSON.stringify(data)).length<=345000;}
Gulch.commit=function(data,activity){
 if(!data?.seed)return baseCommit(data,activity);
 const next=populate(data);
 return baseCommit(next!==data&&withinBudget(next)?next:data,activity);
};
const style=el('style');style.textContent='#regionPanel{position:absolute;left:18px;top:140px;z-index:4;width:min(255px,calc(100% - 180px));max-height:210px;overflow:auto;background:#102721f2;border:1px solid #87996b;border-radius:7px;color:#e6dfbd;padding:10px;font:11px/1.5 monospace}#regionPanel summary{cursor:pointer;color:#f5d49d;font-weight:bold}#regionPanel p{margin:6px 0}#regionPanel button{display:block;width:100%;min-height:38px;margin-top:6px;padding:7px;background:#2b4132;color:#fff0c5;border:1px solid #829475;border-radius:4px;font:inherit}#regionPanel button:disabled{opacity:.5}#regionPanel button:focus-visible{outline:2px solid #ffd98b;outline-offset:2px}#regionPanel[data-danger=true]{border-color:#d08b71}#outsideTools{top:365px;max-height:130px;overflow:auto}@media(max-width:700px){#regionPanel{left:10px;top:140px;width:calc(100% - 165px);max-height:190px;font-size:10px}#outsideTools{top:340px;max-height:100px}}@media(max-height:650px){#regionPanel{max-height:155px}#outsideTools{display:none}}';document.head.append(style);
const panel=el('details');panel.id='regionPanel';panel.open=true;
const title=el('summary','Settlements & wilderness'),description=el('p'),townInfo=el('p'),pack=el('p'),status=el('p');status.setAttribute('role','status');
function button(text,fn){const n=el('button',text);n.type='button';n.addEventListener('click',fn);return n;}
const gather=button('Gather nearby food',()=>act('gather')),eat=button('Eat food · restore 6 HP',()=>act('eat')),rest=button('Rest at town refuge',()=>act('rest'));
panel.append(title,description,townInfo,pack,gather,eat,rest,status);host.append(panel);
function store(data){const v=data.regionSupplies;return v?.epoch===epoch(data)?{epoch:v.epoch,food:Math.max(0,Math.min(99,Number(v.food)||0)),rested:Array.isArray(v.rested)?v.rested.slice(-64):[]}:{epoch:epoch(data),food:0,rested:[]};}
function near(predicate){if(!snapshot)return null;const p=snapshot.player;return snapshot.seed.entities.find(e=>e.map===p.map&&predicate(e)&&Math.abs(e.x-p.x)+Math.abs(e.y-p.y)<=1);}
function ready(){const m=window.GulchMovementState;return snapshot&&snapshot.player.hp>0&&m?.focused&&!m.inFlight&&!pending&&!['inventoryPanel','characterPanel','questBoard','workBoard','respawnScreen','interfaceMenu','livingPanel'].some(id=>{const n=document.getElementById(id);return n&&!n.hidden;});}
function threatened(){const p=snapshot.player;return snapshot.seed.entities.some(e=>e.map===p.map&&e.faction==='hostile'&&e.hp>0&&Math.hypot(e.x-p.x,e.y-p.y)<=5);}
function act(kind){
 if(!ready())return;
 const data=snapshot.gameState,p=snapshot.player,v=store(data);let seed=snapshot.seed,note='';
 if(kind==='gather'){
  const e=near(e=>e.regionFood);if(!e||v.food>=99)return;
  const amount=Math.min(99-v.food,e.quantity||1);v.food+=amount;
  seed={...seed,entities:seed.entities.flatMap(n=>n.id!==e.id?[n]:(e.quantity||1)>amount?[{...e,quantity:e.quantity-amount}]:[])};note='Gathered '+amount+' food from '+e.name+'.';
 }else if(kind==='eat'){
  if(v.food<1||!Number.isFinite(p.maxHp)||p.hp>=p.maxHp)return;v.food--;
  seed={...seed,entities:seed.entities.map(e=>e.id==='player'?{...e,hp:Math.min(e.maxHp,e.hp+6)}:e)};note='Ate a provision and restored up to 6 HP.';
 }else{
  const refuge=near(e=>e.townRefuge);if(!refuge||v.rested.includes(refuge.id)||threatened()||p.hp>=p.maxHp)return;
  if(v.rested.length>=64){status.textContent='You have used all 64 refuge rests for this expedition. Use food or herbs to recover.';return;}
  v.rested.push(refuge.id);seed={...seed,entities:seed.entities.map(e=>e.id==='player'?{...e,hp:e.maxHp}:e)};note='Recovered at '+refuge.name+'. This refuge’s free rest is now used.';
 }
 if(window.GulchCaveEnemies)seed=window.GulchCaveEnemies.advance(seed);
 const next={...data,seed,turn:(Number(data.turn)||0)+1,regionSupplies:v};
 if(!withinBudget(next)){status.textContent='The shared world is full; this action was not submitted.';return;}
 pending=snapshot.stateRevision;status.textContent='Waiting for the room…';Gulch.commit(next,note);render();
}
function setup(){
 if(!snapshot||snapshot.player.hp<=0||window.GulchMovementState?.inFlight||attempt===snapshot.stateRevision)return;
 const data=populate(snapshot.gameState);if(data===snapshot.gameState)return;
 attempt=snapshot.stateRevision;
 if(!withinBudget(data)){status.textContent='This region needs more shared-state space before towns can be added.';return;}
 Gulch.commit(data,'Discovered settlements and wilderness encounters in this region.');
}
function render(){
 if(!snapshot)return;
 const map=snapshot.seed.maps.find(m=>m.id===snapshot.mapId),r=map?.worldPopulation,v=store(snapshot.gameState),food=near(e=>e.regionFood),refuge=near(e=>e.townRefuge);
 title.textContent=r?(r.dangerous?'DANGER · ':'WILDLIFE · ')+r.region:'Settlements & wilderness';panel.dataset.danger=String(Boolean(r?.dangerous));
 const enemies=snapshot.seed.entities.filter(e=>e.map===snapshot.mapId&&e.faction==='hostile'&&e.hp>0).length;
 description.textContent=r?(r.dangerous?'Heavy enemy presence. Expect tough packs. ':'Animals and food grow here; predators still roam. ')+enemies+' enemies remain.':'Surveying reachable settlement sites…';
 townInfo.textContent=r?.towns.length?r.towns.map(t=>t.name+' ('+t.x+', '+t.y+')').join(' · '):'No suitable town sites in this region.';
 pack.textContent='Shared provisions: '+v.food+'/99 · Food heals 6 HP. Gathering, eating and rest take a turn.';
 const enabled=ready();gather.disabled=!enabled||!food||v.food>=99;gather.textContent=food?'Gather '+food.name:'Stand beside food to gather';
 eat.disabled=!enabled||v.food<1||snapshot.player.hp>=snapshot.player.maxHp;
 rest.disabled=!enabled||!refuge||v.rested.includes(refuge.id)||v.rested.length>=64||threatened()||snapshot.player.hp>=snapshot.player.maxHp;
 rest.textContent=refuge?(v.rested.includes(refuge.id)?'Refuge rest already used':threatened()?'Clear nearby enemies to rest':'Free refuge rest · full health'):'Find a town refuge to rest';
}
Gulch.register('world-population',{snapshot(s){snapshot=s;if(pending!==null&&pending!==s.stateRevision){pending=null;status.textContent='Room updated. Check provisions and health to confirm your action.';}setup();render();},action(a){if(a?.type==='gather-food')act('gather');if(a?.type==='eat-food')act('eat');if(a?.type==='town-rest')act('rest');}});
setInterval(()=>{if(!document.hidden){setup();render();}},700);
})();
