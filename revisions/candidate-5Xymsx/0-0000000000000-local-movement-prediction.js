(function(){
'use strict';
const register=Gulch.register;
const raf=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window);
const host=document.getElementById('left');if(!host)return;
const canvas=document.createElement('canvas');canvas.id='predictedAdventurer';canvas.setAttribute('aria-hidden','true');canvas.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:3';host.append(canvas);
const notice=document.createElement('div');notice.setAttribute('role','status');notice.style.cssText='position:absolute;left:12px;bottom:112px;z-index:5;color:#c5dfd0;background:#102329dd;padding:4px 7px;font:10px monospace;pointer-events:none';notice.hidden=true;host.append(notice);
const LIMIT=256,HOLD_INTERVAL=80;
const vectors={w:[0,-1],ArrowUp:[0,-1],s:[0,1],ArrowDown:[0,1],a:[-1,0],ArrowLeft:[-1,0],d:[1,0],ArrowRight:[1,0]};
const dialogs=['inventoryPanel','workBoard','characterPanel','questBoard','livingPanel','respawnScreen','interfaceMenu','tradePanel','travelMapPanel','pilgrimJournal','itemContext','enemyInspectCard','atlasPanel','keyHelp','lorePanel'];
const keys=new Set(),queue=[];
let stick={dx:0,dy:0},snap=null,current=null,driver=null,inflight=null,sending=false,scheduled=false;
let serial=0,nextInput=0,frame=0,cameraKey='',invalidated=0,capacityRefusals=0;
const epoch=d=>String(d?.respawnSettings?.token||'original');
const point=p=>({map:p.map,x:p.x,y:p.y});
const equal=(a,b)=>a&&b&&a.map===b.map&&a.x===b.x&&a.y===b.y;
function typing(n){return n instanceof HTMLElement&&(n.matches('input,textarea,select')||n.isContentEditable);}
function blocked(){return document.hidden||host.inert||Boolean(document.querySelector('dialog[open]'))||dialogs.some(id=>{const n=document.getElementById(id);return n&&!n.hidden;})||typing(document.activeElement);}
function alive(){return snap&&snap.player.hp>0&&!snap.gameState.gulchPermanentGameOver?.ended;}
function usable(){return alive()&&!blocked()&&window.GulchMovementState?.focused;}
function valid(a){return a?.type==='move'&&Number.isInteger(a.dx)&&Number.isInteger(a.dy)&&Math.abs(a.dx)<=1&&Math.abs(a.dy)<=1&&Boolean(a.dx||a.dy);}
function status(text){notice.textContent=text||((queue.length||inflight)?'Local movement · '+(queue.length+(inflight?1:0))+' / '+LIMIT+' steps awaiting room confirmation':'');notice.hidden=!notice.textContent;}
function preview(from,a){
 if(!snap||!from)return null;
 const map=snap.seed.maps.find(m=>m.id===from.map);if(!map)return null;
 const floor=(x,y)=>{const c=map.ascii[y]?.[x];return Boolean(c)&&!['#','~'].includes(c)&&!['wall','water'].includes(snap.seed.legend[c]?.[0]);};
 const occupied=(x,y)=>snap.seed.entities.some(e=>e.id!=='player'&&e.map===from.map&&e.x===x&&e.y===y);
 const hazard=(x,y)=>(map.groundHazards?.cells||[]).some(q=>q.x===x&&q.y===y)||(map.sinkingGround?.cells||[]).some(q=>q.x===x&&q.y===y)||(map.dynamicRegion?.sites||[]).some(q=>q.kind==='trap'&&!q.spent&&q.x===x&&q.y===y);
 const x=from.x+a.dx,y=from.y+a.dy;
 if(!floor(x,y)||occupied(x,y)||hazard(x,y))return null;
 if(a.dx&&a.dy&&(!floor(x,from.y)||!floor(from.x,y)||occupied(x,from.y)||occupied(from.x,y)||hazard(x,from.y)||hazard(from.x,y)))return null;
 return {map:from.map,x,y};
}
function projected(){return current?point(current):snap?point(snap.player):null;}
function draw(){
 const w=host.clientWidth,h=host.clientHeight,dpr=Math.min(window.devicePixelRatio||1,2),cw=Math.max(1,Math.round(w*dpr)),ch=Math.max(1,Math.round(h*dpr));
 if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;canvas.style.width=w+'px';canvas.style.height=h+'px';}
 const c=canvas.getContext('2d');if(!c)return;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
 if(!snap||!current||document.hidden||!window.GulchPlayerSprite||current.map!==snap.player.map)return;
 const p=snap.player,v=window.GulchMovementState?.visual,cam=v?.map===p.map?v:p,ts=Math.max(20,Math.min(64,Number(snap.seed.meta?.tileSize)||32));
 window.GulchPlayerSprite(c,p,w/2+(current.x-cam.x)*ts,h/2+(current.y-cam.y)*ts,ts);
}
function refresh(){
 const key=JSON.stringify([snap?.revision,snap?.stateRevision,snap?epoch(snap.gameState):null,current?.map,current?.x,current?.y]);
 if(key!==cameraKey){cameraKey=key;window.dispatchEvent(new Event('gulch:local-camera'));}
 draw();status();
}
function replay(){
 if(!snap)return;
 let p=point(snap.player);
 for(let i=0;i<queue.length;i++){
  const command=queue[i],next=preview(p,command);
  if(command.source!==snap.revision||command.epoch!==epoch(snap.gameState)||command.map!==p.map||!next){
   if(i===0&&!command.optimistic){invalidated+=queue.length-1;queue.splice(1);break;}
   invalidated+=queue.length-i;queue.splice(i);break;
  }
  p=next;
 }
 current=p;
}
function discard(text){
 invalidated+=queue.length;queue.length=0;
 current=inflight?.expected?point(inflight.expected):snap?point(snap.player):null;
 refresh();if(text)status(text);
}
function stopInput(){keys.clear();stick={dx:0,dy:0};nextInput=0;}
function settle(){
 if(!inflight||window.GulchMovementState?.inFlight)return false;
 const record=inflight;inflight=null;
 // Only runtime retirement releases the submitted step. A peer snapshot alone does not.
 const matched=equal(snap?.player,record.expected);
 replay();
 if(record.expected&&!matched)status('Movement reconciled with the shared world.');
 return true;
}
function drain(){
 scheduled=false;
 if(settle())refresh();
 if(!queue.length||inflight||sending||!driver||!usable()||window.GulchMovementState?.inFlight)return;
 const command=queue[0];
 if(command.source!==snap.revision||command.epoch!==epoch(snap.gameState)||command.map!==snap.mapId){discard('World changed; unsent movement cancelled.');return;}
 const expected=preview(snap.player,command);
 if(command.optimistic&&!expected){discard('The route changed; local movement reconciled.');return;}
 queue.shift();
 const record={command,base:snap.stateRevision,expected,from:point(snap.player)};
 sending=true;
 let failed=false;
 try{driver(command);}catch(error){failed=true;discard('Movement failed: '+String(error.message||error).slice(0,140));}
 finally{sending=false;}
 if(window.GulchMovementState?.inFlight)inflight=record;
 else{replay();if(queue.length&&!failed)schedule();}
 // Submission never replaces the local endpoint with the submitted step.
 refresh();
}
function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(drain);}
function enqueue(a){
 if(!valid(a)||!usable()||!driver)return false;
 if(settle())refresh();
 if(queue.length+(inflight?1:0)>=LIMIT){capacityRefusals++;status('Local movement queue full (256 steps) · waiting for room confirmation.');schedule();return false;}
 const busy=Boolean(inflight||queue.length||window.GulchMovementState?.inFlight),next=preview(projected(),a);
 if(busy&&!next){status('Local movement stopped at an obstacle, hazard or map boundary.');schedule();return false;}
 queue.push({type:'move',dx:a.dx,dy:a.dy,id:++serial,source:snap.revision,epoch:epoch(snap.gameState),map:snap.mapId,optimistic:Boolean(next)});
 if(next)current=next;
 window.GulchFrameBudget?.activate();refresh();schedule();return true;
}
Gulch.register=function(name,callbacks){
 if(name==='world'&&typeof callbacks?.action==='function'){
  driver=a=>callbacks.action.call(callbacks,a);
  return register(name,{...callbacks,action(a){if(!valid(a))return callbacks.action.call(callbacks,a);}});
 }
 if(name==='renderer'&&typeof callbacks?.snapshot==='function')return register(name,{...callbacks,snapshot(s){const result=callbacks.snapshot.call(callbacks,{...s,seed:{...s.seed,entities:s.seed.entities.filter(e=>e.id!=='player')}});draw();return result;},resize(){const result=callbacks.resize?.call(callbacks);draw();return result;}});
 return register(name,callbacks);
};
register('local-movement-presentation',{snapshot(s){
 const old=snap;snap=s;
 const reset=old&&(old.revision!==s.revision||epoch(old.gameState)!==epoch(s.gameState)||old.mapId!==s.mapId);
 if(reset||!alive()){
  invalidated+=queue.length;queue.length=0;inflight=null;current=point(s.player);stopInput();
 }else if(!old)current=point(s.player);
 else if(!settle()&&!inflight)replay();
 refresh();schedule();
},resize:draw});
window.addEventListener('gulch:recovered',schedule);
function direction(){
 let dx=0,dy=0;
 if(keys.has('a')||keys.has('ArrowLeft'))dx--;
 if(keys.has('d')||keys.has('ArrowRight'))dx++;
 if(keys.has('w')||keys.has('ArrowUp'))dy--;
 if(keys.has('s')||keys.has('ArrowDown'))dy++;
 return {type:'move',...(keys.size?{dx,dy}:stick)};
}
function inputChanged(before){
 const a=direction();
 if(before.dx===a.dx&&before.dy===a.dy)return;
 if(valid(a)){enqueue(a);nextInput=performance.now()+HOLD_INTERVAL;wake();}
 else nextInput=0;
}
window.addEventListener('keydown',event=>{
 const key=event.key.length===1?event.key.toLowerCase():event.key;
 if(!vectors[key]||event.isComposing||event.ctrlKey||event.altKey||event.metaKey||typing(event.target)||!usable())return;
 event.preventDefault();
 if(keys.has(key))return;
 const before=direction();keys.add(key);inputChanged(before);
},true);
window.addEventListener('keyup',event=>{
 const key=event.key.length===1?event.key.toLowerCase():event.key;
 if(!keys.has(key))return;
 keys.delete(key);
 // Releasing a diagonal key changes the next cadence step without adding a tap.
 if(!valid(direction()))nextInput=0;
},true);
document.getElementById('controls')?.addEventListener('click',event=>{
 const b=event.target instanceof Element?event.target.closest('[data-move]'):null;if(!b)return;
 event.preventDefault();event.stopImmediatePropagation();
 const [dx,dy]=b.dataset.move.split(',').map(Number);enqueue({type:'move',dx,dy});
},true);
window.addEventListener('message',event=>{
 if(event.source!==parent)return;
 if(event.data?.type==='gulch:action'&&(!event.data.action?.scope||event.data.action.scope==='gameplay')&&valid(event.data.action))enqueue(event.data.action);
 if(event.data?.type==='gulch:focus'&&event.data.granted===false){stopInput();discard();}
});
const setMovement=Gulch.setMovement;
Gulch.setMovement=function(dx,dy,interval){
 const before=direction(),result=setMovement.call(this,dx,dy,interval);
 if(Number.isInteger(dx)&&Number.isInteger(dy)&&Math.abs(dx)<=1&&Math.abs(dy)<=1){
  stick=usable()?{dx,dy}:{dx:0,dy:0};inputChanged(before);
 }
 return result;
};
function wake(){if(!frame&&!document.hidden)frame=raf(tick);}
function tick(now){
 frame=0;
 if(!usable()){stopInput();if(queue.length)discard();}
 else{
  if(settle())refresh();
  const a=direction();
  if(valid(a)&&now>=nextInput){nextInput=now+HOLD_INTERVAL;enqueue(a);}
  if(queue.length||inflight)schedule();
 }
 if(valid(direction())||queue.length||inflight)wake();
}
function pause(){stopInput();discard();}
window.addEventListener('blur',pause);
document.addEventListener('focusin',()=>{if(blocked())pause();});
new MutationObserver(()=>{if(blocked()&&(keys.size||stick.dx||stick.dy||queue.length))pause();}).observe(host,{subtree:true,attributes:true,attributeFilter:['hidden','inert','open']});
document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();if(frame)cancel(frame);frame=0;}else{refresh();schedule();wake();}});
window.GulchLocalMovementQueue=Object.freeze({
 enqueue,cadence:HOLD_INTERVAL,
 report(){return {queued:queue.length,inFlight:inflight?{id:inflight.command.id,base:inflight.base}:null,limit:LIMIT,expiredUnsent:0,invalidatedUnsent:invalidated,capacityRefusals,predicted:projected()};},
 camera(){return snap&&current?{...current,source:snap.revision,base:snap.stateRevision,epoch:epoch(snap.gameState)}:null;},
 cancel(){stopInput();discard('Unsent movement cancelled.');}
});
})();
