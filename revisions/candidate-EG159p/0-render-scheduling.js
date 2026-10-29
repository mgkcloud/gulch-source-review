(function(){
'use strict';
const register=Gulch.register;
let renderer=null,latest=null,dirty=false,frame=null,watchdog=null;
let enabled=true,ready=false,queuedAt=null,previousPaint=0,painting=false;
let requests=0,paints=0,coalesced=0,fallbacks=0,lastDelay=0,lastCost=0;
let output=null,toggle=null,reason='Immediate movement rendering; idle redraws coalesce.';
let paintedView='',visibilityKey='',renderedVisibility=null;
function camera(){
 const p=latest?.player,v=window.GulchMovementState?.visual;
 return v&&v.map===p?.map?v:p;
}
function viewKey(){
 const host=document.getElementById('left'),v=camera();
 return JSON.stringify([host?.clientWidth,host?.clientHeight,window.devicePixelRatio||1,v?.map,v?.x,v?.y]);
}
function renderSnapshot(){
 const p=latest.player,v=camera();
 if(!v||v.map!==p.map||(Math.abs(v.x-p.x)<.001&&Math.abs(v.y-p.y)<.001))return latest;
 const map=latest.seed.maps.find(m=>m.id===p.map);
 if(!map)return latest;
 const supplied=Number(latest.seed.meta?.fov?.radius);
 const radius=Number.isFinite(supplied)&&supplied>0?Math.min(128,supplied):8;
 const x=Math.round(v.x),y=Math.round(v.y);
 const key=JSON.stringify([latest.revision,latest.stateRevision,map.id,x,y,radius]);
 if(key!==visibilityKey){
  const lit=map.ascii.map(row=>new Array(row.length).fill(0)),reach=radius+.5;
  for(let yy=Math.max(0,Math.ceil(y-reach));yy<=Math.min(map.ascii.length-1,Math.floor(y+reach));yy++){
   const span=Math.sqrt(Math.max(0,reach*reach-(yy-y)**2));
   for(let xx=Math.max(0,Math.ceil(x-span));xx<=Math.min(map.ascii[yy].length-1,Math.floor(x+span));xx++)lit[yy][xx]=1;
  }
  renderedVisibility=lit;visibilityKey=key;
 }
 // Camera prediction needs terrain at its current position. Keep entity
 // visibility authoritative and never send this presentation view to gameplay.
 const entities=latest.seed.entities.filter(e=>e.id==='player'||latest.lit[e.y]?.[e.x]);
 return {...latest,lit:renderedVisibility,seed:{...latest.seed,entities}};
}
function interactive(){
 const m=window.GulchMovementState;
 return Boolean(m?.heldKeys?.length||m?.inFlight||window.GulchFrameBudget?.isActive());
}
function report(error){
 const box=document.getElementById('moduleErrors');
 if(box)box.textContent='Module renderer: '+String(error?.message||error).slice(0,300);
}
function cancel(){
 if(frame!==null)window.cancelAnimationFrame(frame);
 frame=null;clearTimeout(watchdog);watchdog=null;
}
function paint(){
 if(!renderer||!latest||document.hidden||painting)return;
 painting=true;
 const start=performance.now(),key=viewKey();
 lastDelay=queuedAt===null?0:start-queuedAt;queuedAt=null;
 try{
  // Resize alone retains the renderer's previous snapshot and visibility mask.
  // Refresh its presentation snapshot whenever the predicted camera changes.
  if(dirty||!ready||key!==paintedView){renderer.snapshot(renderSnapshot());ready=true;dirty=false;}
  else renderer.resize?.();
  paintedView=key;paints++;previousPaint=performance.now();
 }catch(error){
  enabled=false;ready=false;dirty=true;fallbacks++;
  reason='Immediate rendering restored after a renderer error.';
  report(error);
 }finally{lastCost=performance.now()-start;painting=false;}
}
function flush(){frame=null;clearTimeout(watchdog);watchdog=null;paint();}
function immediate(){cancel();queuedAt=null;paint();}
function schedule(){
 requests++;
 if(document.hidden)return;
 if(!enabled||interactive()||viewKey()!==paintedView){immediate();return;}
 if(frame!==null){coalesced++;return;}
 queuedAt=performance.now();frame=window.requestAnimationFrame(flush);
 watchdog=setTimeout(()=>{
  watchdog=null;
  if(document.hidden){cancel();return;}
  if(frame===null)return;
  cancel();fallbacks++;
  reason='Delayed idle redraw painted immediately; movement remains immediate.';
  paint();drawReport();
 },400);
}
Gulch.register=function(name,callbacks){
 if(name!=='renderer'||typeof callbacks?.snapshot!=='function')return register(name,callbacks);
 cancel();renderer=callbacks;latest=null;ready=false;dirty=false;paintedView='';visibilityKey='';renderedVisibility=null;
 return register(name,{...callbacks,
  snapshot(s){
   const old=latest;
   const reset=old&&(old.revision!==s.revision||old.mapId!==s.mapId||String(old.gameState.respawnSettings?.token||'original')!==String(s.gameState.respawnSettings?.token||'original'));
   const changed=old&&(old.stateRevision!==s.stateRevision||old.turn!==s.turn);
   latest=s;dirty=true;visibilityKey='';
   if(document.hidden)return;
   if(!ready||reset||changed||s.player.hp<=0){requests++;immediate();return;}
   schedule();
  },
  resize(){
   if(document.hidden)return;
   if(!dirty&&viewKey()===paintedView&&performance.now()-previousPaint<2){coalesced++;return;}
   schedule();
  }
 });
};
function setEnabled(value){
 cancel();enabled=Boolean(value);queuedAt=null;
 reason=enabled?'Immediate movement rendering; idle redraws coalesce.':'Immediate rendering selected for all redraws.';
 if(latest){dirty=true;paint();}drawReport();
}
function metrics(){return {enabled,requests,paints,coalesced,fallbacks,lastQueueDelayMs:lastDelay,lastRenderCostMs:lastCost,reason};}
window.GulchRenderStream=Object.freeze({setEnabled,report:metrics});
document.addEventListener('visibilitychange',()=>{
 cancel();queuedAt=null;paintedView='';visibilityKey='';
 if(document.hidden){dirty=true;return;}
 if(latest){dirty=true;paint();}
});
function drawReport(){
 if(!output)return;
 const r=metrics();
 toggle.textContent=r.enabled?'Render all redraws immediately':'Coalesce idle redraws';
 toggle.setAttribute('aria-pressed',String(r.enabled));
 output.textContent=r.reason+'\nRequests: '+r.requests+' · paints: '+r.paints+'\nCoalesced: '+r.coalesced+' · fallback paints: '+r.fallbacks+'\nLatest scheduling delay: '+r.lastQueueDelayMs.toFixed(1)+' ms\nLatest renderer cost: '+r.lastRenderCostMs.toFixed(1)+' ms';
}
function mount(){
 const host=document.getElementById('livingPanel');if(!host)return;
 const section=document.createElement('details');section.id='renderStreamControls';
 const heading=document.createElement('summary');heading.textContent='Rendering delivery';
 const explanation=document.createElement('p');explanation.textContent='Camera movement refreshes the terrain view immediately, including during unconfirmed movement. Entity visibility follows the shared world. Repeated idle redraws share an animation frame; delayed idle frames receive a fallback paint.';
 toggle=document.createElement('button');toggle.type='button';toggle.addEventListener('click',()=>setEnabled(!enabled));
 const refresh=document.createElement('button');refresh.type='button';refresh.textContent='Refresh counters';refresh.addEventListener('click',drawReport);
 output=document.createElement('pre');output.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;font:11px/1.6 monospace';
 const limits=document.createElement('p');limits.textContent='These counters measure client rendering. Shared confirmation timing is separate. Browser verification has not been performed for this change.';
 section.append(heading,explanation,toggle,refresh,output,limits);host.append(section);
 section.addEventListener('toggle',()=>{if(section.open)drawReport();});drawReport();
}
if(document.readyState==='complete')mount();else window.addEventListener('load',mount,{once:true});
})();
