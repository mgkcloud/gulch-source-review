(function(){
'use strict';
const KEY='frontierArchitecture',VERSION=1;
const host=document.getElementById('left');if(!host)return;
let latest=null,installed=false,attempt='',scene=0,lastPaint='';
const epoch=d=>String(d?.respawnSettings?.token||'original');
const types=[
 {id:'cistern',name:'Raincatcher cistern',color:'#81b6bd',lore:'Ceramic gutters gather dew beneath a cracked turquoise reservoir.',loot:{glass:2,wire:1}},
 {id:'shrine',name:'Spore oracle shrine',color:'#b6a1d2',lore:'Fungal lamps surround a silent machine that once answered questions in dreams.',loot:{spore:3,spark:1}},
 {id:'workshop',name:'Scrapwright workshop',color:'#d6a16a',lore:'A salvager rebuilds forgotten tools beneath a canopy of hammered copper.',loot:{scrap:3,wire:2}},
 {id:'shelter',name:'Caravan windbreak',color:'#cbbd83',lore:'Woven awnings offer a resting place along an older, half-forgotten trade route.',loot:{fiber:3,hide:1}},
 {id:'tower',name:'Broken signal tower',color:'#b8c4ac',lore:'A fractured antenna points toward a sky its builders may never have seen.',loot:{scrap:2,spark:2}},
 {id:'archive',name:'Buried memory vault',color:'#8ebda0',lore:'Rows of weathered tablets preserve fragments of a vanished settlement.',loot:{relic:1,glass:2}}
];
function hash(text){let n=2166136261;for(const c of String(text))n=Math.imul(n^c.charCodeAt(0),16777619);n^=n>>>16;n=Math.imul(n,0x7feb352d);return (n^(n>>>15))>>>0;}
function floor(seed,map,x,y){const c=map.ascii[y]?.[x];return Boolean(c)&&!['#','~','>'].includes(c)&&!['wall','water'].includes(seed.legend[c]?.[0])&&!map.exits?.some(e=>e.x===x&&e.y===y);}
function bounded(data){return new TextEncoder().encode(JSON.stringify(data)).length<325000;}
function populate(data){
 const seed=data?.seed,p=seed?.entities?.find(e=>e.id==='player'),map=seed?.maps?.find(m=>m.id===p?.map);
 if(!map||p.hp<=0||data.gulchPermanentGameOver?.ended||map[KEY]?.version===VERSION)return data;
 const area=map.ascii.reduce((n,r)=>n+r.length,0);if(area>16000)return data;
 const reserved=new Set();
 function reserve(x,y,r){if(!Number.isFinite(x)||!Number.isFinite(y))return;for(let yy=y-r;yy<=y+r;yy++)for(let xx=x-r;xx<=x+r;xx++)reserved.add(xx+','+yy);}
 function rectangle(x,y,w,h){for(let yy=y-1;yy<=y+h;yy++)for(let xx=x-1;xx<=x+w;xx++)reserve(xx,yy,0);}
 reserve(p.x,p.y,4);
 for(const e of seed.entities)if(e.map===map.id)reserve(e.x,e.y,1);
 for(const q of [...(map.exits||[]),...(map.landmarks||[]),...(map.dynamicRegion?.sites||[]),...(map.groundHazards?.cells||[]),...(map.sinkingGround?.cells||[]),...(map.wildPlantGarden?.plants||[]).filter(q=>q.harvest)])reserve(q.x,q.y,1);
 for(const d of map.blockSettlements?.designs||[])rectangle(d.kind==='great-tree'?d.x-2:d.x,d.kind==='great-tree'?d.y-2:d.y,d.kind==='great-tree'?5:d.w,d.kind==='great-tree'?5:d.h);
 for(const d of map.npcConstruction?.sites||[])rectangle(d.x,d.y,d.w,d.h);
 for(const d of map.villageLife?.districts||[]){reserve(d.well.x,d.well.y,1);for(const q of d.garden)reserve(q.x,q.y,1);}
 for(const list of [data.legendarySwordQuest?.sites,data.wayfarerPilgrimage?.sites,data.npcConversations?.treasures])for(const q of list||[])if(q.map===map.id)reserve(q.x,q.y,2);
 const queue=[{x:p.x,y:p.y}],seen=new Set([p.x+','+p.y]);
 for(let i=0;i<queue.length&&queue.length<16000;i++)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=queue[i].x+dx,y=queue[i].y+dy,k=x+','+y;if(!seen.has(k)&&floor(seed,map,x,y)){seen.add(k);queue.push({x,y});}}
 const salt=String(data.respawnSettings?.generationSeed||seed.meta?.seed||'gulch')+':architecture:'+map.id;
 const candidates=queue.map(q=>({...q,roll:hash(salt+':'+q.x+','+q.y)})).sort((a,b)=>a.roll-b.roll||a.y-b.y||a.x-b.x);
 const sites=[],maximum=Math.min(8,Math.max(2,Math.floor(queue.length/280)));
 const cave=/cave|cavern|mine|underground|grotto|dungeon/i.test([map.name,map.biome].join(' '));
 for(const q of candidates){
  if(sites.length>=maximum)break;
  const w=q.roll%3===0?5:3,h=3;
  let safe=true;
  for(let y=q.y-1;y<=q.y+h&&safe;y++)for(let x=q.x-1;x<=q.x+w;x++){
   const material=seed.legend[map.ascii[y]?.[x]]?.[1];
   if(!seen.has(x+','+y)||reserved.has(x+','+y)||!floor(seed,map,x,y)||['wood','plank'].includes(material)){safe=false;break;}
  }
  if(!safe||sites.some(s=>Math.hypot(s.x-q.x,s.y-q.y)<8))continue;
  let type=q.roll%types.length;if(cave&&type===3)type=1;
  const ancient=type===4||type===5;
  sites.push({id:'frontier-site:'+map.id+':'+sites.length,x:q.x,y:q.y,w,h,type,variant:(q.roll>>>8)%3,progress:ancient?24:0,total:24,rewardPlaced:false,ancient});
  rectangle(q.x,q.y,w,h);
 }
 const next={...data,seed:{...seed,maps:seed.maps.map(m=>m.id===map.id?{...m,[KEY]:{version:VERSION,sites}}:m)}};
 return bounded(next)?next:data;
}
function evolve(data,before){
 if(!before||epoch(data)!==epoch(before)||Number(data.turn)<=Number(before.turn))return data;
 const seed=data.seed,p=seed.entities.find(e=>e.id==='player');if(!p||p.hp<=0||data.gulchPermanentGameOver?.ended)return data;
 let changed=false,entities=seed.entities.slice();
 const ids=new Set(entities.map(e=>e.id));let capacity=Math.max(0,32-entities.filter(e=>e.frontierSalvage).length);
 const maps=seed.maps.map(map=>{
  if(map.id!==p.map||!map[KEY]?.sites?.length)return map;
  const sites=map[KEY].sites.map(site=>{
   const threatened=entities.some(e=>e.map===map.id&&e.faction==='hostile'&&e.hp>0&&Math.hypot(e.x-(site.x+site.w/2),e.y-(site.y+1))<5);
   let next=site;
   if(!threatened&&site.progress<site.total){next={...site,progress:site.progress+1};changed=true;}
   if(next.progress>=next.total&&!next.rewardPlaced&&capacity>0&&!threatened){
    const x=site.x+Math.floor(site.w/2),y=site.y+1;
    if(floor(seed,map,x,y)&&!entities.some(e=>e.map===map.id&&e.x===x&&e.y===y)&&!map.groundHazards?.cells?.some(c=>c.x===x&&c.y===y)&&!map.sinkingGround?.cells?.some(c=>c.x===x&&c.y===y)){
     const type=types[site.type];let id=site.id+':salvage';while(ids.has(id))id+='x';ids.add(id);
     entities.push({id,map:map.id,x,y,name:type.name+' salvage',kind:'loot',ecosystemLoot:true,frontierSalvage:true,contents:{...type.loot},glyph:'▣',color:type.color});
     next={...next,rewardPlaced:true};capacity--;changed=true;
    }
   }
   return next;
  });
  return {...map,[KEY]:{...map[KEY],sites}};
 });
 if(!changed)return data;
 const next={...data,seed:{...seed,maps,entities}};return bounded(next)?next:data;
}
const canvas=document.createElement('canvas');canvas.id='frontierArchitectureArt';canvas.setAttribute('aria-hidden','true');canvas.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:1';host.append(canvas);
function paint(){
 if(!latest||document.hidden)return;
 const p=latest.player,v=window.GulchMovementState?.visual,cam=v?.map===p.map?v:p,w=host.clientWidth,h=host.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
 const key=[scene,w,h,dpr,cam.map,cam.x,cam.y].join('|');if(key===lastPaint)return;lastPaint=key;
 const cw=Math.max(1,Math.round(w*dpr)),ch=Math.max(1,Math.round(h*dpr));if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;canvas.style.width=w+'px';canvas.style.height=h+'px';}
 const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);c.imageSmoothingEnabled=false;
 const map=latest.seed.maps.find(m=>m.id===p.map),ts=Math.max(20,Math.min(64,Number(latest.seed.meta?.tileSize)||32));
 const occupied=new Set(latest.seed.entities.filter(e=>e.map===p.map).map(e=>e.x+','+e.y));
 for(const site of map?.[KEY]?.sites||[]){
  const stage=Math.min(4,Math.floor(site.progress/site.total*4)),type=types[site.type];
  for(let dy=0;dy<site.h;dy++)for(let dx=0;dx<site.w;dx++){
   const tx=site.x+dx,ty=site.y+dy;
   if(latest.lit[ty]?.[tx]!==1||!floor(latest.seed,map,tx,ty)||map.groundHazards?.cells?.some(q=>q.x===tx&&q.y===ty)||map.sinkingGround?.cells?.some(q=>q.x===tx&&q.y===ty))continue;
   const x=Math.round(w/2+(tx-cam.x)*ts),y=Math.round(h/2+(ty-cam.y)*ts),u=ts/16;
   if(x<-ts||y<-ts||x>w+ts||y>h+ts)continue;
   c.globalAlpha=occupied.has(tx+','+ty)?.18:.88;
   const box=(a,b,ww,hh,color)=>{c.fillStyle=color;c.fillRect(Math.round(x+a*u),Math.round(y+b*u),Math.ceil(ww*u),Math.ceil(hh*u));};
   const edge=dx===0||dx===site.w-1||dy===0||dy===site.h-1,door=dx===Math.floor(site.w/2);
   box(-7,-7,14,14,site.ancient?'#444e46':'#554b3c');box(-6,5,12,1,'#9a9273');
   if(stage===0){if(edge){box(-6,-5,1,10,'#c4a372');box(-6,-5,12,1,'#bdaa80');}continue;}
   if(edge&&!door){box(-6,-6,3,12,'#788073');box(3,-6,3,12,'#899184');if(stage>=2){box(-7,-7,14,3,'#b2ad8c');box(-4,-5,8,1,type.color);}}
   if(stage<2)continue;
   if(site.type===0){if(dy===0&&!door){box(-5,-3,10,7,'#355e66');box(-4,-2,8,2,'#8ed0cd');box(-6,4,12,2,'#bcb898');}if(dx===0)box(-1,-5,2,10,'#9eafac');}
   if(site.type===1){if(!door){box(-1,-3,2,8,'#bbaad0');box(-5,-4,10,3,'#866f9f');box(-3,-6,6,2,type.color);box(-3,-3,1,1,'#f0e2c0');}}
   if(site.type===2&&dy===0){box(-6,0,12,3,'#a9764e');box(-5,3,2,4,'#604b39');box(3,3,2,4,'#604b39');box(-3,-3,5,3,'#b3c0bd');box(3,-4,1,5,type.color);}
   if(site.type===3&&dy===0&&stage>=3){box(-7,-6,14,6,site.variant===1?'#9a795e':'#697e69');box(-7,-6,14,1,'#d7c49a');box(-4,-5,2,5,'#bfaa75');box(3,-5,2,5,'#bfaa75');}
   if(site.type===4&&!door){box(-3,-6,6,12,'#6a7976');box(-2,-5,1,9,'#c1c9a9');box(-5,-4,10,1,type.color);box(-4,3,5,2,'#454e4e');}
   if(site.type===5&&dy!==1){for(let k=0;k<3;k++){box(-5+k*4,-4,3,8,'#b1ac88');box(-4+k*4,-2,1,4,'#537168');}}
   if(stage>=3&&edge&&!door){box(-6,5,2,2,type.color);box(4,5,2,2,type.color);}
  }
  c.globalAlpha=1;
  const cx=site.x+Math.floor(site.w/2),cy=site.y;
  if(latest.lit[cy]?.[cx]===1&&Math.hypot(p.x-cx,p.y-cy)<5){
   const x=w/2+(cx-cam.x)*ts,y=h/2+(cy-cam.y)*ts-ts*.65;
   const label=type.name+(stage<4?' · '+Math.floor(site.progress/site.total*100)+'%':'');c.font='10px monospace';c.textAlign='center';
   const tw=c.measureText(label).width;c.fillStyle='#102324ed';c.fillRect(x-tw/2-4,y-12,tw+8,16);c.fillStyle=type.color;c.fillText(label,x,y);
  }
 }
 c.globalAlpha=1;
}
const register=Gulch.register;
Gulch.register=function(name,callbacks){
 if(name!=='renderer'||typeof callbacks?.resize!=='function')return register(name,callbacks);
 return register(name,{...callbacks,resize(){try{return callbacks.resize.apply(callbacks,arguments);}finally{paint();}}});
};
function setup(){
 if(!installed||!latest||document.hidden||window.GulchMovementState?.inFlight)return;
 const key=latest.revision+':'+latest.stateRevision+':'+epoch(latest.gameState);if(attempt===key)return;
 const next=populate(latest.gameState);if(next===latest.gameState)return;attempt=key;
 Gulch.commit(next,'Discovered frontier architecture: forgotten machines, shelters and salvage sites. Active sites develop as you play.');
}
register('frontier-architecture',{snapshot(s){latest=s;scene++;paint();setup();},resize(){lastPaint='';paint();}});
function install(){
 if(installed)return;installed=true;
 const commit=Gulch.commit;
 Gulch.commit=function(data,activity,options){
  if(!data?.seed||window.GulchMovementState?.inFlight)return commit.call(this,data,activity,options);
  return commit.call(this,evolve(populate(data),latest?.gameState),activity,options);
 };
 const living=document.getElementById('livingPanel');
 if(living){
  const section=document.createElement('details'),title=document.createElement('summary'),text=document.createElement('p');title.textContent='Frontier architecture';
  text.textContent='Explore for raincatcher cisterns, spore shrines, scrap workshops, caravan windbreaks, signal towers and memory vaults. New projects develop through four stages over 24 played turns in the current region; nearby hostiles interrupt work. Ancient ruins begin complete. Completed sites provide one salvage cache when the center is clear. Collect it with E. Decorative structures remain walkable. Evicted frontier regions may regenerate on a later visit.';
  section.append(title,text);
  for(const type of types){const p=document.createElement('p');p.textContent=type.name+' — '+type.lore;section.append(p);}
  living.append(section);
 }
 setup();
}
if(document.readyState==='complete')install();else window.addEventListener('load',install,{once:true});
setInterval(setup,2100);
document.addEventListener('visibilitychange',()=>{lastPaint='';if(!document.hidden)paint();});
})();
