(function(){
'use strict';
const host=document.getElementById('left');
if(!host)return;
const baseCommit=Gulch.commit;
let latest=null,attempt=null,lastPaint=0;
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
const {epoch,hash,floor,protectedSite,build,routines,apply}=globalThis.GulchVillageLifeEffects;
Gulch.commit=function(data,activity){
 return baseCommit(apply(data,latest),activity);
};
const canvas=document.createElement('canvas');canvas.id='villageDailyLife';canvas.setAttribute('aria-hidden','true');canvas.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:1';host.append(canvas);
function paint(now){
 const w=host.clientWidth,h=host.clientHeight,dpr=Math.min(window.devicePixelRatio||1,2);
 if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));canvas.style.width=w+'px';canvas.style.height=h+'px';}
 const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);if(!latest)return;
 const p=latest.player,map=latest.seed.maps.find(m=>m.id===p.map),v=window.GulchMovementState?.visual,camera=v?.map===p.map?v:p,ts=Math.max(20,Math.min(64,Number(latest.seed.meta?.tileSize)||32));
 const phase=reduced.matches?0:Math.floor(now/550)%2;
 const point=(x,y)=>({x:w/2+(x-camera.x)*ts,y:h/2+(y-camera.y)*ts});
 const visible=(x,y)=>latest.lit[y]?.[x]===1;
 function rect(x,y,dx,dy,ww,hh,color){const q=point(x,y);ctx.fillStyle=color;ctx.fillRect(Math.round(q.x+dx*ts),Math.round(q.y+dy*ts),Math.ceil(ww*ts),Math.ceil(hh*ts));}
 for(const d of map?.villageLife?.districts||[]){
  for(const g of d.garden){
   if(!visible(g.x,g.y))continue;
   const occupied=latest.seed.entities.some(e=>e.map===p.map&&e.x===g.x&&e.y===g.y);
   if(occupied)continue;
   rect(g.x,g.y,-.44,-.38,.88,.76,'#644f35');
   for(let i=0;i<3;i++){
    rect(g.x,g.y,-.35,-.28+i*.23,.7,.04,'#362f26');
    const growth=(Math.floor((Number(latest.turn)||0)/8)+i)%4;
    for(let j=0;j<3;j++){const x=-.28+j*.27,y=-.24+i*.23;rect(g.x,g.y,x,y,.05,.13,'#9aaf64');rect(g.x,g.y,x-.05,y,.14,.04,'#638846');if(growth===3)rect(g.x,g.y,x,y-.04,.07,.06,'#d8bb72');}
   }
  }
  const a=d.well;
  if(visible(a.x,a.y)){
   rect(a.x,a.y,-.4,-.14,.8,.46,'#596c6a');rect(a.x,a.y,-.3,-.21,.6,.23,'#a4aba0');rect(a.x,a.y,-.22,-.17,.44,.2,'#284f60');
   rect(a.x,a.y,-.4,-.6,.08,.74,'#a18254');rect(a.x,a.y,.32,-.6,.08,.74,'#a18254');rect(a.x,a.y,-.45,-.63,.9,.12,'#8b6646');
   rect(a.x,a.y,-.02,-.5,.025,.36,'#d8c18c');rect(a.x,a.y,-.1,-.16,.2,.15,'#be9a67');
  }
 }
 for(const d of map?.blockSettlements?.designs||[]){
  if(d.kind!=='house')continue;
  for(const [x,y] of [[d.x+1,d.y],[d.x+d.w-2,d.y]])if(visible(x,y)){
   rect(x,y,-.34,.22,.68,.16,'#654b32');
   for(let k=0;k<3;k++){rect(x,y,-.24+k*.2,.12,.1,.14,'#789653');rect(x,y,-.24+k*.2,.08,.1,.07,k%2?'#e2c077':'#c08483');}
  }
  const x=d.x+d.w-2,y=d.y;
  if(visible(x,y)){
   rect(x,y,.13,-.62,.3,.46,'#64615a');rect(x,y,.08,-.65,.4,.1,'#aca38a');
   if(!reduced.matches){const q=point(x,y);ctx.globalAlpha=.19;ctx.fillStyle='#d5d2bd';for(let k=0;k<3;k++)ctx.fillRect(Math.round(q.x+ts*(.18+(k%2)*.12+phase*.04)),Math.round(q.y-ts*(.9+k*.22+phase*.07)),ts*.18,ts*.13);ctx.globalAlpha=1;}
  }
 }
 for(const e of latest.seed.entities){
  if(!e.villageResident||e.map!==p.map||!visible(e.x,e.y))continue;
  const v=e.villageResident,q=point(e.x,e.y),u=ts/32;
  if(v.task==='water'||v.task==='carry'){
   ctx.fillStyle='#b39062';ctx.fillRect(q.x+9*u,q.y+3*u,7*u,7*u);ctx.fillStyle='#83c3c9';ctx.fillRect(q.x+10*u,q.y+3*u,5*u,2*u);
   if(v.working&&v.task==='water'){ctx.strokeStyle='#a9d8df';ctx.beginPath();ctx.moveTo(q.x+12*u,q.y);ctx.lineTo(q.x+(12+phase)*u,q.y+3*u);ctx.stroke();}
  }
  if(v.task==='farm'&&v.working){
   ctx.strokeStyle='#c6a26a';ctx.lineWidth=2*u;ctx.beginPath();ctx.moveTo(q.x+7*u,q.y);ctx.lineTo(q.x+(12+phase*3)*u,q.y+(10-phase*4)*u);ctx.stroke();ctx.fillStyle='#9caaa0';ctx.fillRect(q.x+(9+phase*3)*u,q.y+(10-phase*4)*u,7*u,2*u);
  }
  if(Math.hypot(e.x-p.x,e.y-p.y)<=3){
   ctx.font='10px monospace';ctx.textAlign='center';const text=v.task==='farm'?'Tending crops':v.task==='water'?'Fetching water':v.task==='carry'?'Watering rounds':v.task==='shelter'?'Heading home':'Taking a break';
   const width=ctx.measureText(text).width;ctx.fillStyle='#112221e8';ctx.fillRect(q.x-width/2-4,q.y-ts*.8-10,width+8,15);ctx.fillStyle='#ead7a8';ctx.fillText(text,q.x,q.y-ts*.8+1);
  }
 }
}
function setup(){
 if(!latest||document.hidden||window.GulchMovementState?.inFlight||attempt===latest.stateRevision)return;
 const next=build(latest.gameState);if(next===latest.gameState)return;
 attempt=latest.stateRevision;
 if(new TextEncoder().encode(JSON.stringify(next)).length<350000)Gulch.commit(next,'Village life awakens: residents tend gardens and carry water from their well. Click a villager to hear their thoughts.');
}
Gulch.register('village-daily-life',{snapshot(s){latest=s;setup();paint(performance.now());},resize(){paint(performance.now());}});
function frame(now){if(!document.hidden&&latest&&now-lastPaint>=125){lastPaint=now;paint(now);}requestAnimationFrame(frame);}requestAnimationFrame(frame);
setInterval(setup,1800);
const help=document.getElementById('keyHelp');if(help){const text=document.createElement('p');text.textContent='Village life: residents walk between wells, gardens and home as you play turns. Nearby labels show their chores. Click a friendly villager, or choose them under Lore / Nearby NPCs, to read their current thoughts. Gardens are decorative village crops; existing food gathering still works.';help.append(text);}
})();
