(function(){
'use strict';
const host=document.getElementById('left'),originalCommit=Gulch.commit;
if(!host)return;
const KEY='npcConstruction';
let latest=null,attempt=null;
const {epoch,walk,hash,symbol,prepare,stepWorker,advance,apply}=globalThis.GulchConstructionEffects;
Gulch.commit=function(data,activity){
 return originalCommit(apply(data,latest),activity);
};
const canvas=document.createElement('canvas');canvas.id='worldConstructionArt';canvas.setAttribute('aria-hidden','true');canvas.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:1';host.append(canvas);
const stages={house:['Surveying','Laying foundations','Raising frames','Fitting the roof','House complete'],farm:['Surveying','Preparing beds','Digging irrigation','Planting crops','Farm complete']};
function paint(){
 const w=host.clientWidth,h=host.clientHeight,dpr=Math.min(window.devicePixelRatio||1,2);
 if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));canvas.style.width=w+'px';canvas.style.height=h+'px';}
 const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);if(!latest)return;
 const p=latest.player,map=latest.seed.maps.find(m=>m.id===p.map),v=window.GulchMovementState?.visual,camera=v?.map===p.map?v:p,ts=Math.max(20,Math.min(64,Number(latest.seed.meta?.tileSize)||32));
 const point=(x,y)=>({x:w/2+(x-camera.x)*ts,y:h/2+(y-camera.y)*ts});
 const occupied=new Set(latest.seed.entities.filter(e=>e.map===p.map).map(e=>e.x+','+e.y));
 for(const site of map?.[KEY]?.sites||[]){
  const stage=Math.min(4,Math.floor(site.progress/site.total*4));let visible=false;
  for(let y=0;y<site.h;y++)for(let x=0;x<site.w;x++){
   const tx=site.x+x,ty=site.y+y;if(latest.lit[ty]?.[tx]!==1)continue;visible=true;
   const q=point(tx,ty);if(q.x<-ts||q.x>w+ts||q.y<-ts||q.y>h+ts)continue;
   const edge=x===0||y===0||x===site.w-1||y===site.h-1,door=x===Math.floor(site.w/2)&&(y===0||y===site.h-1);
   ctx.globalAlpha=occupied.has(tx+','+ty)?.25:1;
   const box=(a,b,c,d,color)=>{ctx.fillStyle=color;ctx.fillRect(Math.round(q.x+a*ts),Math.round(q.y+b*ts),Math.ceil(c*ts),Math.ceil(d*ts));};
   if(stage===0){if(edge){box(-.4,-.4,.08,.22,'#d9b476');box(-.4,-.4,.75,.03,'#c4ba94');}continue;}
   if(site.kind==='farm'){
    box(-.47,-.45,.94,.9,'#604630');
    for(let k=0;k<3;k++)box(-.4,-.28+k*.25,.8,.05,'#322c24');
    if(stage>=2)box(.3,-.45,.08,.9,'#669b9e');
    if(stage>=3)for(let k=0;k<3;k++){box(-.3+k*.22,-.13,.05,.32,'#91af62');box(-.35+k*.22,-.12,.16,.06,'#668548');if(stage===4)box(-.33+k*.22,-.23,.12,.13,'#dfc078');}
   }else{
    box(-.46,-.43,.92,.86,edge?'#818579':'#9a7951');
    if(stage>=2&&edge&&!door){box(-.42,-.43,.13,.86,'#604731');box(.3,-.43,.13,.86,'#604731');box(-.42,-.3,.85,.09,'#c9a36c');}
    if(stage>=3&&edge&&!door){box(-.47,-.48,.94,.57,'#985b40');for(let k=0;k<3;k++)box(-.4,-.4+k*.16,.8,.04,'#c18b5e');if(stage===4){box(-.2,.13,.4,.22,'#84b9bd');box(-.03,.13,.06,.22,'#e3c58f');}}
    if(door&&stage>=2)box(-.24,-.4,.48,.8,'#c9a36c');
   }
   ctx.globalAlpha=1;
  }
  ctx.globalAlpha=1;if(!visible)continue;
  const worker=latest.seed.entities.find(e=>e.id===site.worker);
  if(worker&&latest.lit[worker.y]?.[worker.x]===1){const q=point(worker.x,worker.y),phase=window.GulchLifeAnimation?.phase()||0;ctx.fillStyle='#c5a06b';ctx.fillRect(q.x+ts*.24,q.y+ts*.05,ts*.23,ts*.16);if(site.progress<site.total){ctx.strokeStyle='#d8c490';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(q.x+ts*.25,q.y);ctx.lineTo(q.x+ts*.42,q.y-ts*(.15+phase*.05));ctx.stroke();ctx.fillStyle='#aab8b2';ctx.fillRect(q.x+ts*.33,q.y-ts*(.2+phase*.05),ts*.2,ts*.1);}}
  const labelTile={x:site.x+Math.floor(site.w/2),y:site.y};
  if(latest.lit[labelTile.y]?.[labelTile.x]===1){const q=point(labelTile.x,labelTile.y),text=stages[site.kind][stage]+(stage<4?' · '+Math.floor(site.progress/site.total*100)+'%':'');ctx.font='10px monospace';ctx.textAlign='center';const width=ctx.measureText(text).width;ctx.fillStyle='#102421ed';ctx.fillRect(q.x-width/2-5,q.y-ts*.85,width+10,17);ctx.fillStyle='#f1d7a3';ctx.fillText(text,q.x,q.y-ts*.85+12);}
 }
}
function setup(){if(!latest||document.hidden||window.GulchMovementState?.inFlight||attempt===latest.stateRevision)return;const next=prepare(latest.gameState);if(next===latest.gameState)return;attempt=latest.stateRevision;if(new TextEncoder().encode(JSON.stringify(next)).length<350000)Gulch.commit(next,'Local builders survey sites for new houses and farms. Their work progresses as you play turns.');}
Gulch.register('world-construction-crews',{snapshot(s){latest=s;setup();paint();},resize:paint});
let last=0;function frame(now){if(!document.hidden&&latest&&now-last>=125){last=now;paint();}requestAnimationFrame(frame);}requestAnimationFrame(frame);
setInterval(setup,1900);
const help=document.getElementById('keyHelp');if(help){const p=document.createElement('p');p.textContent='Construction crews: explored regions with enough clear space gain a carpenter and farm builder. They carry local supplies, build in stages, and maintain finished sites. Work advances on played turns, including in retained regions while you travel. Nearby enemies interrupt work. Buildings use walkable floors and decorative frames, preserving routes. Click builders through Lore / Nearby NPCs to hear their progress.';help.append(p);}
})();
