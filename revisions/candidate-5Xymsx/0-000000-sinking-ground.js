(function(){
'use strict';
const directCommit=Gulch.commit,KEY='sinkingGround',TRAP='quicksandEscape',SECONDS=5;
let latest=null,attempt='',installed=false,lastPaint='',lastAnnouncement='';
const epoch=d=>String(d?.respawnSettings?.token||'original');
function hash(text){let h=2166136261;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
function walk(seed,map,x,y){const c=map?.ascii[y]?.[x];return Boolean(c)&&!['#','~','>'].includes(c)&&!['wall','water'].includes(seed.legend[c]?.[0])&&!map.exits?.some(e=>e.x===x&&e.y===y);}
function cell(data,p){return data.seed.maps.find(m=>m.id===p.map)?.[KEY]?.cells?.find(c=>c.x===p.x&&c.y===p.y);}
function trapped(data){const t=data?.[TRAP];return t?.epoch===epoch(data)&&Number.isFinite(t.deadline)?t:null;}
function kill(data,reason){return {...data,[TRAP]:null,gulchPermanentGameOver:{...data.gulchPermanentGameOver,ended:true,sinkingCause:reason},seed:{...data.seed,entities:data.seed.entities.map(e=>e.id==='player'?{...e,hp:0}:e)}};}
function generate(data){
 const seed=data?.seed,p=seed?.entities?.find(e=>e.id==='player'),map=seed?.maps?.find(m=>m.id===p?.map);
 if(!map||p.hp<=0||data.gulchPermanentGameOver?.ended||map[KEY])return data;
 const area=map.ascii.reduce((n,r)=>n+r.length,0);if(area>20000)return data;
 const reserved=new Set(),occupied=new Set(seed.entities.filter(e=>e.map===map.id).map(e=>e.x+','+e.y));
 function reserve(x,y,r){for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)reserved.add((x+dx)+','+(y+dy));}
 reserve(p.x,p.y,7);
 for(const e of seed.entities)if(e.map===map.id)reserve(e.x,e.y,2);
 const sites=[...(map.exits||[]),...(map.landmarks||[]),...(map.dynamicRegion?.sites||[]),...(map.groundHazards?.cells||[]),...(data.legendarySwordQuest?.sites||[]).filter(e=>e.map===map.id),...(data.wayfarerPilgrimage?.sites||[]).filter(e=>e.map===map.id),...(data.npcConversations?.treasures||[]).filter(e=>e.map===map.id)];
 sites.forEach(e=>reserve(e.x,e.y,2));
 for(const d of [...(map.blockSettlements?.designs||[]),...(map.npcConstruction?.sites||[])])for(let y=d.y-2;y<=d.y+(d.h||3)+1;y++)for(let x=d.x-2;x<=d.x+(d.w||3)+1;x++)reserve(x,y,0);
 for(const d of map.villageLife?.districts||[]){reserve(d.well.x,d.well.y,2);for(const g of d.garden)reserve(g.x,g.y,1);}
 const queue=[{x:p.x,y:p.y}],seen=new Set([p.x+','+p.y]),dirs=[[1,0],[-1,0],[0,1],[0,-1]];
 for(let i=0;i<queue.length&&i<20000;i++)for(const [dx,dy] of dirs){const x=queue[i].x+dx,y=queue[i].y+dy,k=x+','+y;if(!seen.has(k)&&walk(seed,map,x,y)&&!occupied.has(k)){seen.add(k);queue.push({x,y});}}
 const salt=epoch(data)+':'+String(data.respawnSettings?.generationSeed||seed.meta?.seed||'gulch')+':sinking:'+map.id;
 const candidates=queue.filter(q=>!reserved.has(q.x+','+q.y)&&!['wood','plank'].includes(seed.legend[map.ascii[q.y][q.x]]?.[1])&&dirs.every(([dx,dy])=>seen.has((q.x+dx)+','+(q.y+dy))&&!occupied.has((q.x+dx)+','+(q.y+dy)))).sort((a,b)=>hash(salt+a.x+','+a.y)-hash(salt+b.x+','+b.y));
 const cells=[],target=Math.min(20,Math.max(4,Math.floor(queue.length/100)));
 for(const q of candidates){if(cells.length>=target)break;if(cells.some(c=>Math.hypot(c.x-q.x,c.y-q.y)<4))continue;cells.push({x:q.x,y:q.y,kind:cells.length%2===0?'sinkhole':'quicksand'});}
 const next={...data,seed:{...seed,maps:seed.maps.map(m=>m.id===map.id?{...m,[KEY]:{version:1,cells}}:m)}};
 return new TextEncoder().encode(JSON.stringify(next)).length<340000?next:data;
}
function apply(data,activity){
 if(!latest||!data?.seed)return {data,activity};
 if(epoch(data)!==epoch(latest.gameState))return {data:generate({...data,[TRAP]:null}),activity};
 const before=latest.player,p=data.seed.entities.find(e=>e.id==='player');if(!p||p.hp<=0||data.gulchPermanentGameOver?.ended)return {data,activity};
 const old=trapped(latest.gameState);
 if(old&&Date.now()>=old.deadline)return {data:kill(data,'quicksand'),activity:'The quicksand closes over you. Your expedition has ended.'};
 let next=generate(data),note=activity||'';
 const moved=p.map!==before.map||p.x!==before.x||p.y!==before.y,c=cell(next,p);
 if(moved&&c?.kind==='sinkhole')return {data:kill(next,'sinkhole'),activity:note+' The ground collapses into a bottomless sinkhole. You fall to your death.'};
 if(c?.kind==='quicksand'&&(moved||old)){
  next={...next,[TRAP]:old||{epoch:epoch(next),deadline:Date.now()+SECONDS*1000,map:p.map,x:p.x,y:p.y}};
  if(!old)note+=' Quicksand! Move onto firm ground within five seconds!';
 }else if(old){next={...next,[TRAP]:null};note+=' You escape the quicksand.';}
 return {data:next,activity:note};
}
function install(){if(installed)return;installed=true;const commit=Gulch.commit;Gulch.commit=function(data,activity,options){if(window.GulchMovementState?.inFlight)return;const result=apply(data,activity);return commit.call(this,result.data,result.activity,options);};}
const host=document.getElementById('left');if(!host)return;
const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');canvas.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:2';host.append(canvas);
const warning=document.createElement('div');warning.id='sinkingWarning';warning.hidden=true;warning.style.cssText='position:absolute;left:50%;top:20%;transform:translateX(-50%);z-index:2147483646;max-width:90%;padding:12px 16px;background:#35281af2;border:2px solid #eac47d;border-radius:6px;color:#fff0bd;text-align:center;font:bold 14px/1.5 monospace;pointer-events:none';
const title=document.createElement('strong');title.textContent='QUICKSAND — MOVE TO FIRM GROUND';
const countdown=document.createElement('div');const announcement=document.createElement('span');announcement.setAttribute('role','alert');announcement.style.cssText='position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)';warning.append(title,countdown,announcement);host.append(warning);
function paint(){
 if(!latest||document.hidden)return;
 const p=latest.player,v=window.GulchMovementState?.visual,cam=v?.map===p.map?v:p,w=host.clientWidth,h=host.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
 const key=[latest.revision,latest.stateRevision,w,h,dpr,cam.map,cam.x,cam.y].join('|');if(key===lastPaint)return;lastPaint=key;
 const cw=Math.max(1,Math.round(w*dpr)),ch=Math.max(1,Math.round(h*dpr));if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;canvas.style.width=w+'px';canvas.style.height=h+'px';}
 const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 const map=latest.seed.maps.find(m=>m.id===p.map),ts=Math.max(20,Math.min(64,Number(latest.seed.meta?.tileSize)||32));
 for(const c of map?.[KEY]?.cells||[]){
  if(latest.lit[c.y]?.[c.x]!==1||!walk(latest.seed,map,c.x,c.y))continue;
  const x=w/2+(c.x-cam.x)*ts,y=h/2+(c.y-cam.y)*ts;
  if(x<-ts||y<-ts||x>w+ts||y>h+ts)continue;
  ctx.save();
  if(c.kind==='sinkhole'){
   ctx.fillStyle='#554633';ctx.beginPath();ctx.ellipse(x,y,ts*.39,ts*.3,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#090e12';ctx.beginPath();ctx.ellipse(x,y+1,ts*.29,ts*.22,0,0,Math.PI*2);ctx.fill();
   ctx.strokeStyle='#a58b62';ctx.lineWidth=1;for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ctx.beginPath();ctx.moveTo(x+Math.cos(a)*ts*.3,y+Math.sin(a)*ts*.23);ctx.lineTo(x+Math.cos(a)*ts*.47,y+Math.sin(a)*ts*.39);ctx.stroke();}
  }else{
   ctx.fillStyle='#c7a76e38';ctx.beginPath();ctx.ellipse(x,y,ts*.44,ts*.37,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#d4b47788';ctx.lineWidth=1;
   for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(x+(i-1)*ts*.06,y+(i-1)*ts*.08,ts*(.12+i*.08),ts*(.04+i*.04),-.2,.2,Math.PI*1.7);ctx.stroke();}
  }
  ctx.restore();
 }
}
function update(){
 const t=trapped(latest?.gameState),alive=latest?.player.hp>0&&!latest?.gameState.gulchPermanentGameOver?.ended;
 warning.hidden=!t||!alive;
 if(t&&alive){const left=Math.max(0,t.deadline-Date.now());countdown.textContent=left>0?(left/1000).toFixed(1)+' seconds · WASD / arrows / touch drag':'Sinking…';const second=Math.ceil(left/1000),key=t.deadline+':'+second;if(key!==lastAnnouncement){lastAnnouncement=key;announcement.textContent='Quicksand. '+second+' seconds to escape onto firm ground.';}
  if(left<=0&&!window.GulchMovementState?.inFlight){
   // Expiry is an environmental event, including while a menu is open. Use the
   // original CAS boundary so menu-specific action guards cannot pause death.
   directCommit(kill(latest.gameState,'quicksand'),'You failed to escape the quicksand in time. Your expedition has ended.');
  }
 }
 paint();
}
function setup(){
 if(!installed||!latest||document.hidden||window.GulchMovementState?.inFlight)return;
 const key=latest.revision+':'+latest.stateRevision+':'+epoch(latest.gameState);if(attempt===key)return;
 const next=generate(latest.gameState);if(next===latest.gameState)return;attempt=key;Gulch.commit(next,'Unstable ground: watch for dark sinkholes and faint sandy ripples. Sinkholes are fatal; quicksand gives five seconds to escape.');
}
Gulch.register('sinking-ground',{snapshot(s){latest=s;lastPaint='';update();queueMicrotask(setup);},resize(){lastPaint='';paint();}});
function mount(){install();const help=document.getElementById('keyHelp');if(help){const p=document.createElement('p');p.textContent='Unstable ground: dark cracked sinkholes kill instantly on entry. Faint tan ripples mark quicksand. You have five real seconds to move onto a non-quicksand tile; attacking, menus and switching to another quicksand tile do not reset the countdown. Shared room confirmation determines your escape. Armor does not prevent sinking death.';help.append(p);}setup();}
if(document.readyState==='complete')mount();else window.addEventListener('load',mount,{once:true});
setInterval(()=>{update();setup();},100);
document.addEventListener('visibilitychange',()=>{lastPaint='';update();});
})();
