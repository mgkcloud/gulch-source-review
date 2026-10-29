(function(){
'use strict';
const KEY='npcConstruction';
const epoch=d=>String(d.respawnSettings?.token||'original');
function walk(seed,map,x,y){const c=map.ascii[y]?.[x];return Boolean(c)&&!['#','~','>'].includes(c)&&!['wall','water'].includes(seed.legend[c]?.[0])&&!map.exits?.some(e=>e.x===x&&e.y===y);}
function hash(s){let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
function symbol(legend,material){const old=Object.keys(legend).find(c=>c.length===1&&!['#','~','>'].includes(c)&&legend[c]?.[0]==='floor'&&legend[c]?.[1]===material);if(old)return old;for(let n=0xea00;n<0xf800;n++){const c=String.fromCharCode(n);if(!legend[c]){legend[c]=['floor',material];return c;}}return null;}
function prepare(data){
 const seed=data.seed,p=seed.entities.find(e=>e.id==='player'),map=seed.maps.find(m=>m.id===p?.map);
 if(!map||p.hp<=0||data.gulchPermanentGameOver?.ended||map[KEY])return data;
 if(seed.entities.filter(e=>e.constructionWorker).length>=32)return data;
 const area=map.ascii.reduce((n,r)=>n+r.length,0);if(area>16000)return data;
 const occupied=new Set(seed.entities.filter(e=>e.map===map.id).map(e=>e.x+','+e.y));
 const reserved=new Set();
 function reserve(x,y,r){for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)reserved.add((x+dx)+','+(y+dy));}
 reserve(p.x,p.y,4);
 for(const e of seed.entities.filter(e=>e.map===map.id))reserve(e.x,e.y,1);
 for(const s of [...(map.exits||[]),...(map.dynamicRegion?.sites||[]),...(map.groundHazards?.cells||[]),...(map.landmarks||[]),...(data.legendarySwordQuest?.sites||[]).filter(s=>s.map===map.id),...(data.wayfarerPilgrimage?.sites||[]).filter(s=>s.map===map.id)])reserve(s.x,s.y,2);
 for(const d of map.blockSettlements?.designs||[])for(let y=d.y-2;y<=d.y+d.h+1;y++)for(let x=d.x-2;x<=d.x+d.w+1;x++)reserved.add(x+','+y);
 for(const d of map.villageLife?.districts||[]){reserve(d.well.x,d.well.y,2);for(const q of d.garden)reserve(q.x,q.y,1);}
 const queue=[{x:p.x,y:p.y}],seen=new Set([p.x+','+p.y]);
 for(let i=0;i<queue.length&&queue.length<16000;i++)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=queue[i].x+dx,y=queue[i].y+dy,k=x+','+y;if(!seen.has(k)&&walk(seed,map,x,y)&&!occupied.has(k)){seen.add(k);queue.push({x,y});}}
 const salt=String(data.respawnSettings?.generationSeed||seed.meta?.seed||'gulch')+map.id;
 const candidates=queue.slice().sort((a,b)=>hash(salt+a.x+','+a.y)-hash(salt+b.x+','+b.y));
 const sites=[],entities=seed.entities.slice();
 for(const kind of ['house','farm']){
  const w=kind==='house'?5:4,h=kind==='house'?4:3;
  const q=candidates.find(q=>{
   for(let y=q.y-1;y<=q.y+h;y++)for(let x=q.x-1;x<=q.x+w;x++){
    const k=x+','+y,mat=seed.legend[map.ascii[y]?.[x]]?.[1];
    if(!seen.has(k)||reserved.has(k)||['wood','plank'].includes(mat))return false;
   }return true;
  });
  if(!q)continue;
  const id='crew:'+map.id+':'+kind;let worker=id;while(entities.some(e=>e.id===worker))worker+='x';
  const home={x:q.x-1,y:q.y+h},work={x:q.x+w,y:q.y+h};
  sites.push({id,kind,x:q.x,y:q.y,w,h,home,work,worker,progress:0,total:kind==='house'?24:18});
  entities.push({id:worker,map:map.id,...home,name:kind==='house'?'Rowan the carpenter':'Ada the field builder',kind:'villager',faction:'friendly',outsideNPC:true,constructionWorker:id,constructionTask:'Collecting local materials',dialogue:kind==='house'?'I am raising a timber house here. Watch the foundations, framing and roof take shape as you travel.':'I am preparing a farm: first the beds, then irrigation, fences and planting.'});
  for(let y=q.y-1;y<=q.y+h+1;y++)for(let x=q.x-1;x<=q.x+w+1;x++)reserved.add(x+','+y);
 }
 return {...data,seed:{...seed,entities,maps:seed.maps.map(m=>m.id===map.id?{...m,[KEY]:{version:1,sites}}:m)}};
}
function stepWorker(seed,map,entities,e,goal){
 const blocked=new Set(entities.filter(v=>v.map===map.id&&v.id!==e.id).map(v=>v.x+','+v.y));
 // Typed coordinate keys preserve the original strict comparisons. Rebuild for
 // each worker so every search observes the preceding workers' entity updates.
 const excluded=new Map();
 function exclude(q){
  let row=excluded.get(q.y);
  if(!row){row=new Set();excluded.set(q.y,row);}
  row.add(q.x);
 }
 for(const q of map.exits||[])exclude(q);
 for(const q of map.groundHazards?.cells||[])exclude(q);
 for(const q of map.dynamicRegion?.sites||[])if(q.kind==='trap'&&!q.spent)exclude(q);
 const queue=[{x:e.x,y:e.y,first:null}],seen=new Set([e.x+','+e.y]);
 for(let i=0;i<queue.length&&i<160;i++){
  const q=queue[i];if(q.x===goal.x&&q.y===goal.y)return q.first?{...e,...q.first}:e;
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const x=q.x+dx,y=q.y+dy,k=x+','+y;
   if(seen.has(k)||blocked.has(k))continue;
   const c=map.ascii[y]?.[x],kind=seed.legend[c]?.[0];
   if(!c||c==='#'||c==='~'||c==='>'||kind==='wall'||kind==='water'||Math.hypot(x-goal.x,y-goal.y)>12)continue;
   if(excluded.get(y)?.has(x))continue;
   seen.add(k);queue.push({x,y,first:q.first||{x,y}});
  }
 }return e;
}
function advance(data,previousSnapshot){
 if(!previousSnapshot||epoch(data)!==epoch(previousSnapshot.gameState)||!(Number(data.turn)>Number(previousSnapshot.turn)))return data;
 const seed=data.seed,p=seed.entities.find(e=>e.id==='player');if(!p||p.hp<=0||data.gulchPermanentGameOver?.ended)return data;
 let entities=seed.entities.slice(),legend={...seed.legend};
 const maps=seed.maps.map(map=>{
  if(!map[KEY]?.sites?.length)return map;
  let grid=null;
  const sites=map[KEY].sites.map(site=>{
   let e=entities.find(e=>e.id===site.worker);if(!e)return site;
   const danger=entities.some(v=>v.map===map.id&&v.faction==='hostile'&&v.hp>0&&Math.hypot(v.x-e.x,v.y-e.y)<5);
   const complete=site.progress>=site.total,carrying=site.progress%6===0&&e.constructionDelivery!==site.progress;
   const goal=danger?site.home:complete?((Math.floor(Number(data.turn)/8)%2)?site.home:site.work):carrying?site.home:site.work;
   e=stepWorker(seed,map,entities,e,goal);
   let progress=site.progress,delivery=e.constructionDelivery;
   let task=danger?'Sheltering from enemies':complete?(site.kind==='farm'?'Tending the finished farm':'Maintaining the finished house'):carrying?'Collecting timber and stone':'Carrying materials to the site';
   if(!danger&&e.x===goal.x&&e.y===goal.y&&!complete){
    if(carrying){delivery=progress;task='Loading a bundle of supplies';}
    else{progress=Math.min(site.total,progress+1);task=site.kind==='farm'?'Digging and planting':'Hammering timber joints';}
   }
   if(progress===site.total&&!complete){
    const material=symbol(legend,site.kind==='farm'?'soil':'plank');
    if(material){grid=grid||map.ascii.map(r=>r.split(''));for(let y=site.y;y<site.y+site.h;y++)for(let x=site.x;x<site.x+site.w;x++)grid[y][x]=material;}
   }
   e={...e,constructionDelivery:delivery??-1,constructionTask:task,dialogue:task+'. '+(progress>=site.total?'Our new '+site.kind+' is finished. Travelers are welcome here.':'The '+site.kind+' is '+Math.floor(progress/site.total*100)+'% complete. We gather our own supplies; your pack is untouched.')};
   entities=entities.map(v=>v.id===e.id?e:v);
   return {...site,progress};
  });
  return {...map,...(grid?{ascii:grid.map(r=>r.join(''))}:{}),[KEY]:{...map[KEY],sites}};
 });
 return {...data,seed:{...seed,legend,maps,entities}};
}
function utf8Bytes(text){
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
 const next=advance(prepare(data),previousSnapshot);
 return utf8Bytes(JSON.stringify(next))<350000?next:data;
}
globalThis.GulchConstructionEffects=Object.freeze({epoch,walk,hash,symbol,prepare,stepWorker,advance,apply});
})();
