(function(){
'use strict';
const epoch=d=>String(d.respawnSettings?.token||'original');
const directionOrders=Array.from({length:9},(_,index)=>{
 const sx=index%3-1,sy=Math.floor(index/3)-1;
 return [[1,0],[-1,0],[0,1],[0,-1]].sort((a,b)=>Math.abs(sx-a[0])+Math.abs(sy-a[1])-Math.abs(sx-b[0])-Math.abs(sy-b[1]));
});
function hash(text){let n=2166136261;for(const c of String(text))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
function floor(seed,map,x,y){const c=map?.ascii[y]?.[x];return Boolean(c)&&!['#','~','>'].includes(c)&&!['wall','water'].includes(seed.legend[c]?.[0])&&!map.exits?.some(e=>e.x===x&&e.y===y);}
function protectedSite(data,map,x,y){
 const sites=[...(map.dynamicRegion?.sites||[]),...(map.groundHazards?.cells||[]),...(data.legendarySwordQuest?.sites||[]).filter(s=>s.map===map.id),...(data.wayfarerPilgrimage?.sites||[]).filter(s=>s.map===map.id)];
 return sites.some(s=>Math.abs(s.x-x)+Math.abs(s.y-y)<=1);
}
function build(data){
 const seed=data?.seed,p=seed?.entities?.find(e=>e.id==='player'),map=seed?.maps?.find(m=>m.id===p?.map);
 if(!map||p.hp<=0||data.gulchPermanentGameOver?.ended||map.villageLife)return data;
 const houses=(map.blockSettlements?.designs||[]).filter(d=>d.kind==='house');
 const anchors=[...houses.map(d=>({x:d.door,y:d.y+d.h})),...(map.worldPopulation?.towns||[]),...(map.landmarks||[]).filter(s=>s.type==='settlement'),...(data.outsideWorld?.map===map.id?data.outsideWorld.villages||[]:[])];
 if(!anchors.length)return data;
 const entities=seed.entities.slice(),occupied=new Set(entities.filter(e=>e.map===map.id).map(e=>e.x+','+e.y));
 const clear=(x,y)=>floor(seed,map,x,y)&&!occupied.has(x+','+y)&&!protectedSite(data,map,x,y);
 const districts=[];
 for(const anchor of anchors){
  if(districts.length===2)break;
  if(districts.some(d=>Math.hypot(d.x-anchor.x,d.y-anchor.y)<12))continue;
  const cells=[],seen=new Set(),queue=[{x:anchor.x,y:anchor.y}];
  for(let i=0;i<queue.length&&i<220;i++){
   const q=queue[i],key=q.x+','+q.y;if(seen.has(key))continue;seen.add(key);
   if(!floor(seed,map,q.x,q.y)||Math.hypot(q.x-anchor.x,q.y-anchor.y)>9)continue;
   if(clear(q.x,q.y))cells.push(q);
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])queue.push({x:q.x+dx,y:q.y+dy});
  }
  const well=cells.find(q=>Math.hypot(q.x-p.x,q.y-p.y)>2&&[[1,0],[-1,0],[0,1],[0,-1]].every(([dx,dy])=>clear(q.x+dx,q.y+dy)));
  if(!well)continue;
  const garden=cells.filter(q=>Math.hypot(q.x-well.x,q.y-well.y)>=3&&Math.hypot(q.x-well.x,q.y-well.y)<=6).slice(0,6);
  if(garden.length<3)continue;
  const id=map.id+':hamlet:'+districts.length;
  districts.push({id,x:anchor.x,y:anchor.y,well,garden,name:(map.blockSettlements?.village?.name||'Lantern Hamlet')+(districts.length?' East':'')});
  occupied.add(well.x+','+well.y);
 }
 if(!districts.length)return data;
 let capacity=Math.max(0,48-entities.filter(e=>e.villageResident).length);
 const names=['Mara','Tobin','Elin','Bram','Nessa','Oren'];
 const jobs=['farmer','water keeper','gardener'];
 for(const district of districts){
  for(let i=0;i<3&&capacity>0;i++){
   const spots=[...district.garden,{x:district.well.x+1,y:district.well.y},{x:district.well.x-1,y:district.well.y}];
   const home=spots.find(q=>clear(q.x,q.y));if(!home)break;
   let id='village-resident:'+district.id+':'+i;while(entities.some(e=>e.id===id))id+='x';
   const name=names[hash(id)%names.length],job=jobs[i];
   entities.push({id,map:map.id,x:home.x,y:home.y,name:name+' the '+job,kind:'villager',faction:'friendly',outsideNPC:true,villageResident:{district:district.id,home,job,offset:i*5,task:'rest',thought:'A quiet morning. There is work to do.'},dialogue:'I am '+name+', the '+job+' of '+district.name+'. A quiet morning. There is work to do.'});
   occupied.add(home.x+','+home.y);capacity--;
  }
 }
 return {...data,seed:{...seed,entities,maps:seed.maps.map(m=>m.id===map.id?{...m,villageLife:{version:1,districts}}:m)}};
}
function routines(data,previousSnapshot){
 if(!previousSnapshot||epoch(data)!==epoch(previousSnapshot.gameState)||!(Number(data.turn)>Number(previousSnapshot.turn)))return data;
 const seed=data.seed,p=seed.entities.find(e=>e.id==='player');if(!p||p.hp<=0)return data;
 const map=seed.maps.find(m=>m.id===p.map),districts=map?.villageLife?.districts;if(!districts)return data;
 let entities=seed.entities.slice();
 const turn=Math.max(0,Number(data.turn)||0);
 const residents=seed.entities.filter(e=>e.villageResident&&e.map===p.map);
 const sites=[...(map.dynamicRegion?.sites||[]),...(map.groundHazards?.cells||[]),...(data.legendarySwordQuest?.sites||[]).filter(s=>s.map===map.id),...(data.wayfarerPilgrimage?.sites||[]).filter(s=>s.map===map.id)];
 const occupied=new Map(),indices=new Map(),staticCells=new Map(),threatCells=new Map();
 let hostiles=entities.filter(e=>e.map===p.map&&e.faction==='hostile'&&e.hp>0);
 function tileCoordinate(value){return Number.isSafeInteger(value)&&Math.abs(value)<=Number.MAX_SAFE_INTEGER-4;}
 function threatSet(){
  if(!hostiles.every(e=>tileCoordinate(e.x)&&tileCoordinate(e.y)))return null;
  const tiles=new Set();
  for(const e of hostiles)for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
   if(Math.hypot(dx,dy)<3)tiles.add((e.x+dx)+','+(e.y+dy));
  }
  return tiles;
 }
 let threatTiles=threatSet();
 function occupancy(e,delta){
  if(e.map!==p.map)return;
  const key=e.x+','+e.y;
  let ids=occupied.get(key);
  if(!ids){if(delta<0)return;ids=new Map();occupied.set(key,ids);}
  const n=(ids.get(e.id)||0)+delta;
  if(n>0)ids.set(e.id,n);else ids.delete(e.id);
  if(!ids.size)occupied.delete(key);
 }
 for(let i=0;i<entities.length;i++){
  const e=entities[i];occupancy(e,1);
  let list=indices.get(e.id);if(!list){list=[];indices.set(e.id,list);}list.push(i);
 }
 function lookup(cache,x,y,compute){
  let row=cache.get(y);if(!row){row=new Map();cache.set(y,row);}
  if(!row.has(x))row.set(x,compute());
  return row.get(x);
 }
 function staticPass(x,y){
  return lookup(staticCells,x,y,()=>floor(seed,map,x,y)&&!sites.some(s=>Math.abs(s.x-x)+Math.abs(s.y-y)<=1)&&!districts.some(t=>t.well.x===x&&t.well.y===y));
 }
 function threatened(x,y){
  if(threatTiles&&tileCoordinate(x)&&tileCoordinate(y))return threatTiles.has(x+','+y);
  return lookup(threatCells,x,y,()=>hostiles.some(e=>Math.hypot(e.x-x,e.y-y)<3));
 }
 // Cache only cells requested during this call, preserving exact coordinate and distance rules.
 for(const resident of residents){
  const v=resident.villageResident,d=districts.find(d=>d.id===v.district);if(!d)continue;
  const beat=(turn+v.offset)%24;
  const danger=hostiles.some(e=>Math.hypot(e.x-resident.x,e.y-resident.y)<5);
  const task=danger?'shelter':beat<5?'water':beat<10?'carry':beat<19?'farm':'rest';
  let goal=task==='water'?{x:d.well.x+1,y:d.well.y}:task==='farm'||task==='carry'?d.garden[hash(resident.id)%d.garden.length]:v.home;
  const pass=(x,y)=>{
   const ids=occupied.get(x+','+y);
   return (!ids||(ids.size===1&&ids.has(resident.id)))&&staticPass(x,y)&&!threatened(x,y);
  };
  if(!pass(goal.x,goal.y))goal=[goal,{x:goal.x-1,y:goal.y},{x:goal.x,y:goal.y+1},{x:goal.x,y:goal.y-1}].find(q=>pass(q.x,q.y))||{x:resident.x,y:resident.y};
  let position={x:resident.x,y:resident.y};
  if(turn%2===v.offset%2&&(position.x!==goal.x||position.y!==goal.y)){
   const queue=[{...position,first:null}],seen=new Set([position.x+','+position.y]);
   for(let i=0;i<queue.length&&i<180;i++){
    const q=queue[i];if(q.x===goal.x&&q.y===goal.y){position=q.first||position;break;}
    const directions=directionOrders[(Math.sign(goal.y-q.y)+1)*3+Math.sign(goal.x-q.x)+1];
    for(const [dx,dy] of directions){const x=q.x+dx,y=q.y+dy,k=x+','+y;if(seen.has(k)||!pass(x,y)||Math.hypot(x-d.x,y-d.y)>12)continue;seen.add(k);queue.push({x,y,first:q.first||{x,y}});}
   }
  }
  const arrived=position.x===goal.x&&position.y===goal.y;
  const thoughts={water:['The well sounds deeper after rain.','Fresh water first; the seedlings can wait a moment.'],carry:['Careful now. Every drop belongs to the garden.','I promised the neighbors a full watering can.'],farm:['These beans will feed the whole lane.','A little patience, a little soil, and another chance.'],rest:['I wonder who will pass through our village next.','Tomorrow I will mend the fence by the old road.'],shelter:['Something is moving beyond the fields. I should get home.']};
  const pool=thoughts[task],thought=pool[Math.floor(turn/24)%pool.length];
  let movedHostile=false;
  for(const i of indices.get(resident.id)||[]){
   const e=entities[i],next={...e,...position,villageResident:{...v,task,thought,working:arrived&&!danger},dialogue:'I tend '+d.name+' as its '+v.job+'. '+thought+(arrived&&task==='farm'?' Today I am tending our crops.':'')};
   if(e.x!==next.x||e.y!==next.y){
    occupancy(e,-1);occupancy(next,1);
    if(e.map===p.map&&e.faction==='hostile'&&e.hp>0)movedHostile=true;
   }
   entities[i]=next;
  }
  if(movedHostile){hostiles=entities.filter(e=>e.map===p.map&&e.faction==='hostile'&&e.hp>0);threatCells.clear();threatTiles=threatSet();}
 }
 return {...data,seed:{...seed,entities}};
}
function utf8Bytes(text){
 if(text===undefined)return 0;
 let bytes=0;
 for(let i=0;i<text.length;i++){
  const code=text.charCodeAt(i);
  if(code<128)bytes++;
  else if(code<2048)bytes+=2;
  else if(code>=55296&&code<=56319&&i+1<text.length&&text.charCodeAt(i+1)>=56320&&text.charCodeAt(i+1)<=57343){bytes+=4;i++;}
  else bytes+=3;
 }
 return bytes;
}
function apply(data,previousSnapshot){
 if(!data?.seed)return data;
 const populated=build(data),next=routines(populated,previousSnapshot);
 return utf8Bytes(JSON.stringify(next))<350000?next:data;
}
globalThis.GulchVillageLifeEffects=Object.freeze({epoch,hash,floor,protectedSite,build,routines,apply});
})();
