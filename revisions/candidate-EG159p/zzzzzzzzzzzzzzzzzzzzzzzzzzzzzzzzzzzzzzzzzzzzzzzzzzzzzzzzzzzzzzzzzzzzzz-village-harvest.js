(function(){
'use strict';
const host=document.getElementById('left');
if(!host)return;
const commit=Gulch.commit,KEY='villageHarvest';
let latest=null,lastFrame=0;
const epoch=d=>String(d.respawnSettings?.token||'original');
const number=n=>Number.isFinite(n)?Math.max(0,Math.floor(n)):0;
function walk(seed,map,x,y){const c=map.ascii[y]?.[x];return Boolean(c)&&!['#','~','>'].includes(c)&&!['wall','water'].includes(seed.legend[c]?.[0])&&!map.exits?.some(e=>e.x===x&&e.y===y);}
function thoughts(task,season){
 const lines={farm:['These rows need patient hands. The harvest will be worth it.','I will leave a basket for travelers when these crops ripen.','A few more days of tending, and we can share supper.'],water:['The seedlings drink before I do.','I like the sound of the bucket coming back full.','The well is where everyone brings their news.'],carry:['I hope I can reach the beans without spilling this.','Water for the garden, then a moment in the shade.','A full bucket makes a surprisingly long walk.'],rest:['I wonder what lies beyond the next village.','There should always be a spare place at the table.','Tomorrow I might plant flowers beside the door.'],shelter:['The fields can wait. Everyone needs to get home.']};
 const pool=lines[task]||lines.rest;return pool[season%pool.length];
}
function evolve(data){
 if(!latest||epoch(data)!==epoch(latest.gameState)||!(Number(data.turn)>Number(latest.turn)))return data;
 const seed=data.seed,p=seed.entities.find(e=>e.id==='player');
 if(!p||p.hp<=0||data.gulchPermanentGameOver?.ended)return data;
 const old=data[KEY],state=old?.epoch===epoch(data)?old:{epoch:epoch(data),plots:{}};
 const plots={},ids=new Set(seed.entities.map(e=>e.id));let entities=seed.entities.slice();
 for(const map of seed.maps){
  const districts=map.villageLife?.districts||[];
  for(const district of districts){
   const prior=state.plots?.[district.id]||{},plot={work:Math.min(11,number(prior.work)),harvests:Math.min(9999,number(prior.harvests)),ready:Boolean(prior.ready)};
   plots[district.id]=plot;
   if(map.id!==p.map)continue;
   const workers=entities.filter(e=>e.map===map.id&&e.villageResident?.district===district.id);
   const tending=workers.filter(e=>e.villageResident.task==='farm'&&e.villageResident.working);
   if(tending.length&&!plot.ready){plot.work=Math.min(12,plot.work+tending.length);if(plot.work>=12)plot.ready=true;}
   const baskets=entities.filter(e=>e.villageHarvestBasket===district.id);
   if(plot.ready&&tending.length&&baskets.length<2&&entities.filter(e=>e.villageHarvestBasket).length<32){
    const occupied=new Set(entities.filter(e=>e.map===map.id).map(e=>e.x+','+e.y));
    const reserved=[...(map.groundHazards?.cells||[]),...(map.dynamicRegion?.sites||[]),...(data.wayfarerPilgrimage?.sites||[]).filter(s=>s.map===map.id),...(data.legendarySwordQuest?.sites||[]).filter(s=>s.map===map.id)];
    const candidates=[];
    for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
     const x=district.well.x+dx,y=district.well.y+dy;
     if(Math.abs(dx)+Math.abs(dy)<2||!walk(seed,map,x,y)||occupied.has(x+','+y)||reserved.some(s=>s.x===x&&s.y===y)||district.garden.some(s=>s.x===x&&s.y===y))continue;
     if(![[1,0],[-1,0],[0,1],[0,-1]].every(([a,b])=>walk(seed,map,x+a,y+b)&&!occupied.has((x+a)+','+(y+b))))continue;
     candidates.push({x,y,d:Math.abs(dx)+Math.abs(dy)});
    }
    candidates.sort((a,b)=>a.d-b.d||a.y-b.y||a.x-b.x);
    const spot=candidates[0];
    if(spot){
     let id='village-harvest:'+district.id+':'+plot.harvests;while(ids.has(id))id+='x';ids.add(id);
     entities.push({id,map:map.id,x:spot.x,y:spot.y,name:district.name+' harvest basket',kind:'resource',regionFood:true,quantity:3,glyph:'▤',color:'#e6c17f',villageHarvestBasket:district.id});
     plot.work=0;plot.ready=false;plot.harvests=Math.min(9999,plot.harvests+1);
    }
   }
   entities=entities.map(e=>{
    if(e.map!==map.id||e.villageResident?.district!==district.id)return e;
    const v=e.villageResident,thought=plot.ready&&v.task==='farm'?'The crops are ready. We need a clear place near the well for another basket.':thoughts(v.task,(Math.floor(Number(data.turn)/24)+number(v.offset))%3);
    return {...e,villageResident:{...v,thought},dialogue:'I am the '+v.job+' of '+district.name+'. '+thought+' Our garden has provided '+plot.harvests+' harvests. Travelers may take food from the baskets beside the well.'};
   });
  }
 }
 return {...data,seed:{...seed,entities},[KEY]:{epoch:epoch(data),plots}};
}
Gulch.commit=function(data,activity){
 if(!data?.seed)return commit(data,activity);
 const next=evolve(data);
 return commit(new TextEncoder().encode(JSON.stringify(next)).length<350000?next:data,activity);
};
const canvas=document.createElement('canvas');canvas.id='villageFinishingDetails';canvas.setAttribute('aria-hidden','true');canvas.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:1';host.append(canvas);
const bubble=document.createElement('div');bubble.hidden=true;bubble.style.cssText='position:absolute;left:50%;bottom:235px;transform:translateX(-50%);z-index:3;max-width:min(350px,70%);padding:9px 12px;border:1px solid #9eaa86;border-radius:10px;background:#132823ed;color:#e2dfc2;font:11px/1.5 monospace;pointer-events:none';host.append(bubble);
function paint(){
 const w=host.clientWidth,h=host.clientHeight,dpr=Math.min(window.devicePixelRatio||1,2);
 if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));canvas.style.width=w+'px';canvas.style.height=h+'px';}
 const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 if(!latest)return;
 const p=latest.player,map=latest.seed.maps.find(m=>m.id===p.map);if(!map)return;
 const v=window.GulchMovementState?.visual,camera=v?.map===p.map?v:p,ts=Math.max(20,Math.min(64,Number(latest.seed.meta?.tileSize)||32));
 const visible=(x,y)=>latest.lit[y]?.[x]===1;
 const occupied=new Set(latest.seed.entities.filter(e=>e.map===p.map).map(e=>e.x+','+e.y));
 function box(x,y,a,b,c,d,color){if(!visible(x,y)||occupied.has(x+','+y))return;ctx.fillStyle=color;ctx.fillRect(Math.round(w/2+(x-camera.x+a)*ts),Math.round(h/2+(y-camera.y+b)*ts),Math.ceil(c*ts),Math.ceil(d*ts));}
 for(const house of map.blockSettlements?.designs||[]){
  if(house.kind!=='house')continue;
  const x=house.door,y=house.y+house.h-1;
  box(x,y,-.46,-.48,.12,.96,'#5b4433');box(x,y,.34,-.48,.12,.96,'#5b4433');box(x,y,-.46,-.48,.92,.12,'#d5b47b');
  box(x,y,-.3,.27,.6,.12,'#c3b18a');
  const mat=latest.seed.legend[map.ascii[y+1]?.[x]]?.[0];
  if(mat==='floor'){box(x,y+1,-.3,-.35,.6,.2,'#9e9479');box(x,y+1,-.25,.02,.5,.2,'#b1a68a');}
  for(const side of [house.x,house.x+house.w-1]){
   const yy=house.y+2;
   box(side,yy,-.24,-.17,.48,.38,'#ead292');box(side,yy,-.04,-.17,.08,.38,'#5d503d');box(side,yy,-.24,-.02,.48,.07,'#5d503d');
   box(side,yy,-.35,-.22,.09,.5,'#617060');box(side,yy,.26,-.22,.09,.5,'#617060');
  }
  box(house.x+1,y,-.27,-.13,.54,.32,'#815638');box(house.x+1,y,-.22,-.08,.44,.05,'#c6a270');box(house.x+1,y,-.04,.19,.08,.22,'#59432f');
 }
 const harvest=latest.gameState[KEY];
 for(const d of map.villageLife?.districts||[]){
  const plot=harvest?.epoch===epoch(latest.gameState)?harvest.plots?.[d.id]:null;
  const growth=plot?.ready?3:Math.min(3,Math.floor(number(plot?.work)/3));
  for(const g of d.garden){
   for(let i=0;i<3;i++){
    const x=-.28+i*.25;
    box(g.x,g.y,x,-.1,.04,.12+growth*.05,'#acc37b');
    if(growth>=2)box(g.x,g.y,x-.05,-.13,.14,.05,'#689247');
    if(growth===3)box(g.x,g.y,x-.03,-.2,.1,.12,'#edcb77');
   }
  }
 }
 const modal=['inventoryPanel','workBoard','characterPanel','questBoard','livingPanel','respawnScreen','travelMapPanel','pilgrimJournal'].some(id=>{const n=document.getElementById(id);return n&&!n.hidden;});
 const residents=latest.seed.entities.filter(e=>e.villageResident&&e.map===p.map&&visible(e.x,e.y)&&Math.hypot(e.x-p.x,e.y-p.y)<=3).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));
 const speaker=residents[0];bubble.hidden=modal||p.hp<=0||!speaker;
 if(speaker){const text=speaker.name+' thinks: “'+speaker.villageResident.thought+'”';if(bubble.textContent!==text)bubble.textContent=text;}
}
Gulch.register('village-harvest-and-homes',{snapshot(s){latest=s;paint();},resize:paint});
function frame(now){if(!document.hidden&&latest&&now-lastFrame>=125){lastFrame=now;paint();}requestAnimationFrame(frame);}requestAnimationFrame(frame);
const help=document.getElementById('keyHelp');
if(help){const text=document.createElement('p');text.textContent='Village farming: residents fetch water, carry it to the gardens, tend crops and rest. Twelve working farmer-turns produce a basket of three food near the well. Each village keeps at most two baskets waiting. Stand beside one and right-click to collect, or use Show details → Gather food. Food restores 6 HP through the region panel. Harvests pause when farmers shelter from enemies, and menu time does not grow crops. Nearby thought bubbles and villager conversations reveal what residents are thinking.';help.append(text);}
})();
