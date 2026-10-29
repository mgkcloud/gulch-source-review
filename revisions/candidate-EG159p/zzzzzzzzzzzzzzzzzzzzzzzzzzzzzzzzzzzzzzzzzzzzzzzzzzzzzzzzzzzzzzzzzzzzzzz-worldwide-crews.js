(function(){
'use strict';
const baseCommit=Gulch.commit;
let latest=null,attempt=null;
const KEY='npcConstruction';
function hash(text){let h=2166136261;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
function walk(seed,map,x,y){const c=map.ascii[y]?.[x];return Boolean(c)&&!['#','~','>'].includes(c)&&!['wall','water'].includes(seed.legend[c]?.[0])&&!map.exits?.some(e=>e.x===x&&e.y===y);}
function expand(data){
 const seed=data?.seed,p=seed?.entities?.find(e=>e.id==='player');
 if(!p||p.hp<=0||data.gulchPermanentGameOver?.ended)return data;
 let entities=seed.entities.slice(),changed=false,processed=0;
 const ids=new Set(entities.map(e=>e.id));
 let capacity=Math.max(0,32-entities.filter(e=>e.constructionWorker).length);
 const maps=seed.maps.map(map=>{
  if(map.worldwideCrewsVersion===1||processed>=2||capacity<1)return map;
  const area=map.ascii.reduce((n,row)=>n+row.length,0);
  if(area>16000)return map;
  processed++;
  const existing=Array.isArray(map[KEY]?.sites)?map[KEY].sites:[];
  const sites=existing.slice(),reserved=new Set();
  function reserve(x,y,r){for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)reserved.add((x+dx)+','+(y+dy));}
  for(const e of entities)if(e.map===map.id)reserve(e.x,e.y,e.id==='player'?3:0);
  for(const q of [...(map.exits||[]),...(map.dynamicRegion?.sites||[]),...(map.groundHazards?.cells||[]),...(map.landmarks||[]),...(data.wayfarerPilgrimage?.sites||[]).filter(q=>q.map===map.id),...(data.legendarySwordQuest?.sites||[]).filter(q=>q.map===map.id)])reserve(q.x,q.y,1);
  for(const d of map.blockSettlements?.designs||[]){
   const tree=d.kind==='great-tree',x=tree?d.x-2:d.x,y=tree?d.y-2:d.y,w=tree?5:d.w,h=tree?4:d.h;
   for(let yy=y-1;yy<=y+h;yy++)for(let xx=x-1;xx<=x+w;xx++)reserved.add(xx+','+yy);
  }
  for(const d of map.villageLife?.districts||[]){reserve(d.well.x,d.well.y,1);for(const q of d.garden)reserve(q.x,q.y,0);}
  function reserveSite(s){for(let y=s.y-1;y<=s.y+s.h+1;y++)for(let x=s.x-1;x<=s.x+s.w+1;x++)reserved.add(x+','+y);}
  sites.forEach(reserveSite);
  const anchor=map.id===p.map?p:(map.exits||[]).map(e=>e.at&&e.to===map.id?e.at:e).find(q=>walk(seed,map,q.x,q.y))||entities.find(e=>e.map===map.id&&walk(seed,map,e.x,e.y));
  let start=anchor;
  if(!start){for(let y=1;y<map.ascii.length-1&&!start;y++)for(let x=1;x<map.ascii[y].length-1;x++)if(walk(seed,map,x,y)){start={x,y};break;}}
  const reachable=new Set(),queue=start?[start]:[];
  if(start)reachable.add(start.x+','+start.y);
  for(let i=0;i<queue.length;i++)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const x=queue[i].x+dx,y=queue[i].y+dy,key=x+','+y;
   if(!reachable.has(key)&&walk(seed,map,x,y)){reachable.add(key);queue.push({x,y});}
  }
  const salt=String(data.respawnSettings?.generationSeed||'gulch')+':builders:'+map.id;
  const candidates=queue.slice().sort((a,b)=>hash(salt+':'+a.x+','+a.y)-hash(salt+':'+b.x+','+b.y));
  for(const kind of ['house','farm']){
   if(!capacity||sites.some(s=>s.kind===kind))continue;
   const w=kind==='house'?4:3,h=3;
   const spot=candidates.find(q=>{
    for(let y=q.y-1;y<=q.y+h;y++)for(let x=q.x-1;x<=q.x+w;x++){
     const key=x+','+y,material=seed.legend[map.ascii[y]?.[x]]?.[1];
     if(!reachable.has(key)||reserved.has(key)||!walk(seed,map,x,y)||['wood','plank'].includes(material))return false;
    }
    return true;
   });
   if(!spot)continue;
   let worker='worldwide-crew:'+map.id+':'+kind;
   while(ids.has(worker))worker+='x';ids.add(worker);
   const home={x:spot.x-1,y:spot.y+h},work={x:spot.x+w,y:spot.y+h};
   const site={id:worker,kind,x:spot.x,y:spot.y,w,h,home,work,worker,progress:0,total:kind==='house'?24:18};
   sites.push(site);reserveSite(site);capacity--;
   entities.push({id:worker,map:map.id,...home,name:kind==='house'?'Traveling carpenter':'Traveling farmstead builder',kind:'villager',faction:'friendly',outsideNPC:true,constructionWorker:site.id,constructionTask:'Collecting local materials',dialogue:'We are building a '+kind+' here. Watch us carry materials and complete it in stages as you explore. We use local supplies, never your inventory.'});
  }
  changed=true;
  return {...map,worldwideCrewsVersion:1,[KEY]:{...map[KEY],version:1,sites}};
 });
 if(!changed)return data;
 const next={...data,seed:{...seed,maps,entities}};
 return new TextEncoder().encode(JSON.stringify(next)).length<345000?next:data;
}
Gulch.commit=function(data,activity){return baseCommit(data?.seed?expand(data):data,activity);};
function setup(){
 if(!latest||document.hidden||window.GulchMovementState?.inFlight||attempt===latest.stateRevision)return;
 const next=expand(latest.gameState);if(next===latest.gameState)return;
 attempt=latest.stateRevision;
 Gulch.commit(next,'Traveling construction crews establish house and farm projects across the explored world.');
}
const host=document.getElementById('left');
const panel=document.createElement('details');panel.id='worldwideConstruction';
const heading=document.createElement('summary');heading.textContent='World construction';
const text=document.createElement('p');
const list=document.createElement('ul');panel.append(heading,text,list);
const style=document.createElement('style');style.textContent='#worldwideConstruction{margin:14px 0;padding:12px;border:1px solid #718c73;border-radius:5px;font:12px/1.6 monospace}#worldwideConstruction summary{cursor:pointer;font-weight:bold}#worldwideConstruction li{margin:7px 0}';document.head.append(style);
(document.getElementById('livingPanel')||host).append(panel);
function render(){
 if(!latest||!panel.open)return;
 const rows=[];
 for(const map of latest.seed.maps)for(const site of map[KEY]?.sites||[]){
  const worker=latest.seed.entities.find(e=>e.id===site.worker);
  if(!worker)continue;
  const progress=Math.min(100,Math.floor(site.progress/site.total*100));
  rows.push((map.name||map.id)+' · '+site.kind+' at '+site.x+', '+site.y+' · '+progress+'% · '+(worker.constructionTask||'Preparing the site'));
 }
 text.textContent='Crews work on played turns across retained regions. Visit the coordinates to watch construction. Nearby enemies interrupt work. Finished buildings remain walkable; crews maintain them afterward.';
 list.replaceChildren(...rows.map(value=>{const li=document.createElement('li');li.textContent=value;return li;}));
 if(!rows.length){const li=document.createElement('li');li.textContent='Exploring for clear building sites. New regions can host more crews.';list.append(li);}
}
panel.addEventListener('toggle',render);
Gulch.register('worldwide-construction',{snapshot(s){latest=s;setup();render();}});
setInterval(setup,1700);
})();
