(function(){
'use strict';
const host=document.getElementById('left');
if(!host)return;
const originalCommit=Gulch.commit,KEY='groundHazards',STATUS='groundPoison';
let latest=null,attempt=null,lastCamera='',lastPaint=0;
const {epoch,random,floor,poison,generate,apply}=globalThis.GulchGroundHazardEffects;
Gulch.commit=function(data,activity){
 const result=apply(data,activity,latest);
 return originalCommit(result.data,result.activity);
};
const canvas=document.createElement('canvas');canvas.id='groundHazardArt';canvas.setAttribute('aria-hidden','true');canvas.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:1';host.append(canvas);
const status=document.createElement('div');status.id='groundHazardStatus';status.hidden=true;status.setAttribute('role','status');status.setAttribute('aria-live','polite');host.append(status);
const style=document.createElement('style');style.textContent='#groundHazardStatus{position:absolute;left:50%;bottom:150px;transform:translateX(-50%);z-index:5;max-width:calc(100% - 32px);padding:7px 12px;border:1px solid #abb56a;border-radius:6px;background:#142523ee;color:#e6efba;pointer-events:none;font:11px/1.5 monospace;text-align:center}#groundHazardStatus[hidden]{display:none!important}';document.head.append(style);
function update(){
 if(!latest)return;
 const p=latest.player,map=latest.seed.maps.find(m=>m.id===p.map),cell=map?.[KEY]?.cells?.find(c=>c.x===p.x&&c.y===p.y),turns=poison(latest.gameState);
 const parts=[];
 if(cell?.kind==='lava')parts.push('LAVA · move off the puddle · 3 base damage per turn');
 if(cell?.kind==='poison')parts.push('TOXIC GROUND · leave to stop refreshing poison');
 if(turns)parts.push('POISONED · '+turns+' turns remaining · 1 base damage per turn');
 const text=parts.join(' | ');if(status.textContent!==text)status.textContent=text;
 status.hidden=p.hp<=0||!parts.length;
}
function paint(){
 const w=host.clientWidth,h=host.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
 if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));canvas.style.width=w+'px';canvas.style.height=h+'px';}
 const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 if(!latest)return;
 const p=latest.player,map=latest.seed.maps.find(m=>m.id===p.map),v=window.GulchMovementState?.visual,camera=v?.map===p.map?v:p,ts=Math.max(20,Math.min(64,Number(latest.seed.meta?.tileSize)||32));
 for(const c of map?.[KEY]?.cells||[]){
  if(latest.lit[c.y]?.[c.x]!==1)continue;
  const x=Math.round(w/2+(c.x-camera.x)*ts),y=Math.round(h/2+(c.y-camera.y)*ts),u=ts/16;
  if(x<-ts||x>w+ts||y<-ts||y>h+ts)continue;
  const lava=c.kind==='lava';ctx.globalAlpha=.72;
  ctx.fillStyle=lava?'#692d24':'#314c29';ctx.fillRect(x-7*u,y-5*u,14*u,10*u);ctx.fillRect(x-5*u,y-7*u,10*u,14*u);
  ctx.fillStyle=lava?'#e57235':'#87aa43';ctx.fillRect(x-6*u,y-4*u,12*u,8*u);ctx.fillRect(x-4*u,y-6*u,8*u,12*u);
  ctx.fillStyle=lava?'#ffe39b':'#d7e88d';
  if(lava){ctx.fillRect(x-4*u,y-3*u,5*u,u);ctx.fillRect(x,y-2*u,u,5*u);ctx.fillRect(x,y+2*u,4*u,u);}
  else{ctx.strokeStyle='#e0ed9d';ctx.lineWidth=Math.max(1,u);for(const [dx,dy] of [[-3,-2],[3,2]]){ctx.beginPath();ctx.arc(x+dx*u,y+dy*u,1.5*u,0,Math.PI*2);ctx.stroke();}}
  ctx.globalAlpha=1;
 }
}
function setup(){if(!latest||document.hidden||window.GulchMovementState?.inFlight||attempt===latest.stateRevision)return;const next=generate(latest.gameState);if(next===latest.gameState)return;attempt=latest.stateRevision;Gulch.commit(next,'Toxic pools and lava puddles appear in the wilderness. Watch your footing.');}
Gulch.register('ground-hazards',{snapshot(s){latest=s;setup();update();paint();},resize:paint});
function frame(now){
 if(!document.hidden&&latest&&now-lastPaint>=50){lastPaint=now;const v=window.GulchMovementState?.visual,key=JSON.stringify([v?.map,v?.x,v?.y]);if(key!==lastCamera){lastCamera=key;paint();}}
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
setInterval(()=>{if(!document.hidden)setup();},1500);
const help=document.getElementById('keyHelp');if(help){const p=document.createElement('p');p.textContent='Ground hazards: green bubbling pools poison you for five played turns (1 base damage each turn). Standing in poison refreshes the duration. Orange cracked lava deals 3 base damage each turn you occupy it. Move out, then heal while poison wears off. Existing armor, difficulty and hardcore death rules apply. Menu time does not advance poison.';help.append(p);}
})();
