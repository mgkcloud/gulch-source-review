(function(){
'use strict';
const host=document.getElementById('left');if(!host)return;
const commit=Gulch.commit,KEY='wildPlantGarden';
let latest=null,attempt=null,cameraKey='',frame=0;
function hash(text){let h=2166136261;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
function floor(seed,map,x,y){const c=map.ascii[y]?.[x];return Boolean(c)&&!['#','~','>'].includes(c)&&!['wall','water'].includes(seed.legend[c]?.[0]);}
function enrich(data){
 const seed=data?.seed,p=seed?.entities?.find(e=>e.id==='player'),map=seed?.maps?.find(m=>m.id===p?.map);
 if(!map||p.hp<=0||data.gulchPermanentGameOver?.ended||map[KEY])return data;
 if(map.ascii.reduce((n,r)=>n+r.length,0)>16000)return data;
 const underground=/cave|cavern|mine|underground|grotto|dungeon/i.test([map.biome,map.name].join(' '));
 const reserved=new Set();
 function reserve(x,y,r){for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)reserved.add((x+dx)+','+(y+dy));}
 seed.entities.filter(e=>e.map===map.id).forEach(e=>reserve(e.x,e.y,0));
 reserve(p.x,p.y,2);
 const sites=[...(map.exits||[]),...(map.landmarks||[]),...(map.groundHazards?.cells||[]),...(map.dynamicRegion?.sites||[]),...(data.legendarySwordQuest?.sites||[]).filter(e=>e.map===map.id),...(data.wayfarerPilgrimage?.sites||[]).filter(e=>e.map===map.id)];
 sites.forEach(e=>reserve(e.x,e.y,1));
 for(const d of map.blockSettlements?.designs||[])if(d.kind!=='great-tree')for(let y=d.y-1;y<=d.y+d.h;y++)for(let x=d.x-1;x<=d.x+d.w;x++)reserve(x,y,0);
 for(const d of map.npcConstruction?.sites||[])for(let y=d.y-1;y<=d.y+d.h;y++)for(let x=d.x-1;x<=d.x+d.w;x++)reserve(x,y,0);
 for(const d of map.villageLife?.districts||[]){reserve(d.well.x,d.well.y,1);d.garden.forEach(e=>reserve(e.x,e.y,0));}
 const queue=[{x:p.x,y:p.y}],seen=new Set([p.x+','+p.y]);
 for(let i=0;i<queue.length;i++)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=queue[i].x+dx,y=queue[i].y+dy,k=x+','+y;if(!seen.has(k)&&floor(seed,map,x,y)){seen.add(k);queue.push({x,y});}}
 const salt=String(data.respawnSettings?.generationSeed||seed.meta?.seed||'gulch')+':plants:'+map.id;
 const candidates=queue.filter(q=>!reserved.has(q.x+','+q.y)&&!['wood','plank','soil'].includes(seed.legend[map.ascii[q.y][q.x]]?.[1])).map(q=>({...q,n:hash(salt+':'+q.x+','+q.y)})).sort((a,b)=>a.n-b.n);
 const plants=candidates.slice(0,Math.min(180,Math.ceil(queue.length*.14))).map(q=>({x:q.x,y:q.y,kind:underground?q.n%2===0?'mushroom':'fern':['flower','fern','grass','bush'][q.n%4],variant:(q.n>>>4)%3}));
 const entities=seed.entities.slice(),ids=new Set(entities.map(e=>e.id));
 let added=0;
 const capacity=Math.max(0,36-entities.filter(e=>e.wildPlantPickup).length);
 for(const q of candidates){
  if(added>=Math.min(6,capacity))break;
  if(Math.hypot(q.x-p.x,q.y-p.y)<4||plants.some(v=>v.harvest&&Math.hypot(q.x-v.x,q.y-v.y)<5))continue;
  if(![[1,0],[-1,0],[0,1],[0,-1]].every(([dx,dy])=>floor(seed,map,q.x+dx,q.y+dy)&&!reserved.has((q.x+dx)+','+(q.y+dy))))continue;
  const herb=added%2===0;
  let id='wild-plant:'+map.id+':'+added;while(ids.has(id))id+='x';ids.add(id);
  entities.push({id,map:map.id,x:q.x,y:q.y,name:herb?'Silverleaf healing herbs':underground?'Edible lantern mushrooms':'Ripe woodland berries',kind:'resource',wildPlantPickup:true,...(herb?{livingResource:'herb'}:{regionFood:true}),quantity:herb?1:2,glyph:herb?'✿':'♣',color:herb?'#b6dba0':'#df9eae'});
  let plant=plants.find(v=>v.x===q.x&&v.y===q.y);
  if(!plant){plant={x:q.x,y:q.y,variant:added%3};plants.push(plant);}
  plant.kind=herb?'herb':underground?'mushroom':'berries';plant.harvest=id;
  reserve(q.x,q.y,1);added++;
 }
 const next={...data,seed:{...seed,entities,maps:seed.maps.map(m=>m.id===map.id?{...m,[KEY]:{version:1,plants}}:m)}};
 return new TextEncoder().encode(JSON.stringify(next)).length<340000?next:data;
}
Gulch.commit=function(data,activity){return commit(data?.seed?enrich(data):data,activity);};
const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');canvas.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:1';host.append(canvas);
function paint(){
 const w=host.clientWidth,h=host.clientHeight,dpr=Math.min(devicePixelRatio||1,2),cw=Math.max(1,Math.round(w*dpr)),ch=Math.max(1,Math.round(h*dpr));
 if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;canvas.style.width=w+'px';canvas.style.height=h+'px';}
 const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);if(!latest)return;
 const p=latest.player,v=window.GulchMovementState?.visual,cam=v?.map===p.map?v:p,map=latest.seed.maps.find(m=>m.id===p.map),ts=Math.max(20,Math.min(64,Number(latest.seed.meta?.tileSize)||32));
 const occupied=new Set(latest.seed.entities.filter(e=>e.map===p.map&&!e.wildPlantPickup).map(e=>e.x+','+e.y)),ids=new Set(latest.seed.entities.map(e=>e.id));
 for(const plant of map?.[KEY]?.plants||[]){
  if(latest.lit[plant.y]?.[plant.x]!==1||occupied.has(plant.x+','+plant.y)||!floor(latest.seed,map,plant.x,plant.y)||plant.harvest&&!ids.has(plant.harvest))continue;
  const x=Math.round(w/2+(plant.x-cam.x)*ts),y=Math.round(h/2+(plant.y-cam.y)*ts),u=Math.max(1,Math.floor(ts/20));
  if(x<-ts||x>w+ts||y<-ts||y>h+ts)continue;
  function box(a,b,ww,hh,color){c.fillStyle=color;c.fillRect(x+a*u,y+b*u,ww*u,hh*u);}
  const kind=plant.kind;
  box(-6,5,12,2,'#20392b');
  if(kind==='bush'||kind==='berries'){
   box(-6,-2,12,7,'#31583b');box(-4,-5,8,9,'#56804a');box(-2,-5,5,2,'#8eaa62');
   if(kind==='berries')for(const [a,b] of [[-4,0],[2,-2],[3,2],[-1,3]])box(a,b,2,2,'#d88ca2');
  }else if(kind==='mushroom'){
   box(-1,0,2,6,'#d6c9a5');box(-5,-3,10,4,'#8e9cbb');box(-3,-5,6,2,'#bbcbd1');box(-3,-2,2,1,'#ecddb7');box(2,-2,1,1,'#ecddb7');
  }else{
   box(0,-5,1,11,'#8ca66c');
   for(const side of [-1,1])for(let i=0;i<3;i++)box(side<0?-5+i:1,-2+i*3,4-i,2,kind==='herb'?'#a3c598':'#557c4a');
   if(kind==='flower'||kind==='herb'){
    const color=kind==='herb'?'#e4e8bb':['#d7a3bd','#edcf85','#b4bee4'][plant.variant||0];
    box(-2,-7,5,2,color);box(-1,-8,3,4,color);box(0,-7,1,1,'#fff0b0');
   }
   if(kind==='grass'){box(-4,1,1,5,'#91a16a');box(4,-1,1,7,'#748e50');}
  }
 }
}
function setup(){if(!latest||document.hidden||window.GulchMovementState?.inFlight||attempt===latest.stateRevision)return;const next=enrich(latest.gameState);if(next===latest.gameState)return;attempt=latest.stateRevision;Gulch.commit(next,'Wildflowers, ferns and useful plants flourish along the frontier. Collect berries and silverleaf herbs with E.');}
function follow(){frame=0;if(document.hidden)return;const v=window.GulchMovementState?.visual,key=JSON.stringify(v);if(key!==cameraKey){cameraKey=key;paint();}const p=latest?.player;if(p&&v&&v.map===p.map&&(Math.abs(v.x-p.x)>.001||Math.abs(v.y-p.y)>.001))frame=requestAnimationFrame(follow);}
function redraw(){paint();if(!frame&&!document.hidden)frame=requestAnimationFrame(follow);}
Gulch.register('wild-plant-gardens',{snapshot(s){latest=s;setup();redraw();},resize:redraw});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(frame)cancelAnimationFrame(frame);frame=0;}else redraw();});
setInterval(setup,1600);
const help=document.getElementById('keyHelp');if(help){const text=document.createElement('p');text.textContent='Wild plants: flowers, grasses and ferns decorate open ground. Ripe berry bushes and edible mushrooms supply food; silverleaf herbs supply healing herbs. Stand directly beside them and press E to harvest. Use food through Show details and herbs through Living world.';help.append(text);}
})();
