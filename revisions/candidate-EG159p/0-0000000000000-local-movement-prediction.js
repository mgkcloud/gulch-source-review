(function(){
'use strict';
const register=Gulch.register;
const raf=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window);
const host=document.getElementById('left');if(!host)return;
const canvas=document.createElement('canvas');canvas.id='predictedAdventurer';canvas.setAttribute('aria-hidden','true');canvas.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:3';host.append(canvas);
const notice=document.createElement('div');notice.setAttribute('role','status');notice.style.cssText='position:absolute;left:12px;bottom:112px;z-index:5;color:#c5dfd0;background:#102329dd;padding:4px 7px;font:10px monospace;pointer-events:none';notice.hidden=true;host.append(notice);
const LIMIT=32,HOLD_INTERVAL=80;
const vectors={w:[0,-1],ArrowUp:[0,-1],s:[0,1],ArrowDown:[0,1],a:[-1,0],ArrowLeft:[-1,0],d:[1,0],ArrowRight:[1,0]};
const dialogs=['inventoryPanel','workBoard','characterPanel','questBoard','livingPanel','respawnScreen','interfaceMenu','tradePanel','travelMapPanel','pilgrimJournal','itemContext','enemyInspectCard','atlasPanel','keyHelp','lorePanel'];
const keys=new Set(),queue=[],trace=[];
let stick={dx:0,dy:0,interval:HOLD_INTERVAL},snap=null,current=null,driver=null,inflight=null,sending=false,scheduled=false;
let serial=0,nextInput=0,frame=0,cameraKey='',invalidated=0,capacityRefusals=0,controlGeneration=0,traceOutput=null;
const epoch=d=>String(d?.respawnSettings?.token||'original');
const point=p=>({map:p.map,x:p.x,y:p.y});
const equal=(a,b)=>Boolean(a&&b&&a.map===b.map&&a.x===b.x&&a.y===b.y);
function log(kind,details){
 trace.push({ms:Math.round(performance.now()*100)/100,kind,source:snap?.revision??null,base:snap?.stateRevision??null,...details});
 if(trace.length>400)trace.shift();
}
function typing(n){return n instanceof HTMLElement&&(n.matches('input,textarea,select')||n.isContentEditable);}
function blocked(){return document.hidden||host.inert||Boolean(document.querySelector('dialog[open]'))||dialogs.some(id=>{const n=document.getElementById(id);return n&&!n.hidden;})||typing(document.activeElement);}
function alive(){return snap&&snap.player.hp>0&&!snap.gameState.gulchPermanentGameOver?.ended;}
function usable(){return alive()&&!blocked()&&window.GulchMovementState?.focused;}
function valid(a){return a?.type==='move'&&Number.isInteger(a.dx)&&Number.isInteger(a.dy)&&Math.abs(a.dx)<=1&&Math.abs(a.dy)<=1&&Boolean(a.dx||a.dy);}
function status(text){notice.textContent=text||((queue.length||inflight)?'Local movement · '+(queue.length+(inflight?1:0))+' steps awaiting room confirmation':'');notice.hidden=!notice.textContent;}
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
function project(authority,submitted,commands,step){
 // The submitted command has left the queue but still owns its preview.
 let p=point(submitted?.expected||authority);
 let kept=0;
 for(const command of commands){
  const next=step(p,command);
  if(!next)break;
  p=next;kept++;
 }
 return {position:p,kept};
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
 const result=project(snap.player,inflight,queue,(p,command)=>{
  if(command.source!==snap.revision||command.epoch!==epoch(snap.gameState)||command.map!==p.map)return null;
  return preview(p,command);
 });
 // A nonoptimistic head is still a valid bump, exit or hazard interaction.
 const keep=result.kept===0&&queue[0]&&!queue[0].optimistic?1:result.kept;
 if(keep<queue.length){const n=queue.length-keep;invalidated+=n;queue.splice(keep);log('route-invalidated',{count:n});}
 current=result.position;
}
function discard(text){
 const n=queue.length;invalidated+=n;queue.length=0;
 current=inflight?.expected?point(inflight.expected):snap?point(snap.player):null;
 if(n)log('unsent-cancelled',{count:n,reason:text||'paused'});
 refresh();if(text)status(text);
}
function stopInput(){keys.clear();stick={dx:0,dy:0,interval:HOLD_INTERVAL};nextInput=0;controlGeneration++;}
function settle(){
 if(!inflight||window.GulchMovementState?.inFlight)return false;
 const record=inflight;inflight=null;
 const matched=record.expected?equal(snap?.player,record.expected):null;
 log('pending-retired',{inputId:record.command.id,waitMs:Math.round((performance.now()-record.started)*100)/100,expected:record.expected,authority:snap?point(snap.player):null,positionMatched:matched,acceptance:'Position agreement is not an acceptance receipt.'});
 // A divergent authority invalidates the route, rather than steering a peer's
 // new position through a route planned from our old position.
 if(record.expected&&!matched){
  const n=queue.length;invalidated+=n;queue.length=0;
  log('reconcile',{inputId:record.command.id,cancelled:n,from:projected(),to:snap?point(snap.player):null});
 }
 replay();return true;
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
 const record={command,base:snap.stateRevision,expected,from:point(snap.player),started:performance.now()};
 sending=true;
 try{driver(command);}catch(error){discard('Movement failed: '+String(error.message||error).slice(0,140));log('driver-error',{inputId:command.id,message:String(error.message||error).slice(0,140)});}
 finally{sending=false;}
 if(window.GulchMovementState?.inFlight){
  inflight=record;log('pending-start',{inputId:command.id,expected,from:record.from});
 }else{
  log('not-submitted',{inputId:command.id});
  if(queue.length){invalidated+=queue.length;queue.length=0;}
 }
 replay();refresh();
}
function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(drain);}
function enqueue(a,held=false){
 if(!valid(a)||!usable()||!driver)return false;
 if(settle())refresh();
 // Held input represents the current direction, not hundreds of future turns.
 // Permit one submitted step and one replaceable held step under latency.
 if(held&&queue.some(q=>q.held))return false;
 if(queue.length+(inflight?1:0)>=LIMIT){capacityRefusals++;status('Movement queue full · waiting for room confirmation.');log('capacity-refused',{});return false;}
 const busy=Boolean(inflight||queue.length||window.GulchMovementState?.inFlight);
 const next=preview(projected(),a);
 if(busy&&!next){schedule();return false;}
 // Do not predict around unrelated saves: their effects may change this tile.
 if(!inflight&&window.GulchMovementState?.inFlight)return false;
 const command={type:'move',dx:a.dx,dy:a.dy,id:++serial,source:snap.revision,epoch:epoch(snap.gameState),map:snap.mapId,optimistic:Boolean(next),held,generation:controlGeneration};
 queue.push(command);
 if(next)current=next;
 log('input-queued',{inputId:command.id,dx:a.dx,dy:a.dy,held,queued:queue.length,predicted:projected()});
 window.GulchFrameBudget?.activate();refresh();schedule();wake();return true;
}
Gulch.register=function(name,callbacks){
 if(name==='world'&&typeof callbacks?.action==='function'){
  driver=a=>callbacks.action.call(callbacks,a);
  return register(name,{...callbacks,action(a){return callbacks.action.call(callbacks,a);}});
 }
 if(name==='renderer'&&typeof callbacks?.snapshot==='function')return register(name,{...callbacks,snapshot(s){const result=callbacks.snapshot.call(callbacks,{...s,seed:{...s.seed,entities:s.seed.entities.filter(e=>e.id!=='player')}});draw();return result;},resize(){const result=callbacks.resize?.call(callbacks);draw();return result;}});
 return register(name,callbacks);
};
register('local-movement-presentation',{snapshot(s){
 const old=snap;snap=s;
 const reset=old&&(old.revision!==s.revision||epoch(old.gameState)!==epoch(s.gameState)||old.mapId!==s.mapId);
 log('snapshot',{position:point(s.player),pendingInput:inflight?.command.id??null,runtimePending:Boolean(window.GulchMovementState?.inFlight)});
 if(reset||!alive()){
  invalidated+=queue.length;queue.length=0;inflight=null;current=point(s.player);stopInput();log('context-reset',{});
 }else if(!old)current=point(s.player);
 else if(!settle()&&!inflight)replay();
 // While the runtime still owns the operation, a peer snapshot cannot retire
 // its preview. Runtime retirement is observed after all snapshot callbacks.
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
function cancelHeld(){
 let n=0;
 for(let i=queue.length-1;i>=0;i--)if(queue[i].held){queue.splice(i,1);n++;}
 invalidated+=n;
 if(n){log('held-superseded',{count:n,generation:controlGeneration});replay();refresh();}
}
function inputChanged(before,immediate){
 const a=direction();
 if(before.dx===a.dx&&before.dy===a.dy)return;
 controlGeneration++;cancelHeld();
 log('direction',{dx:a.dx,dy:a.dy,generation:controlGeneration});
 if(valid(a)){
  if(immediate)enqueue(a,true);
  nextInput=performance.now()+(keys.size?HOLD_INTERVAL:stick.interval)*Math.hypot(a.dx,a.dy);wake();
 }else nextInput=0;
}
window.addEventListener('keydown',event=>{
 const key=event.key.length===1?event.key.toLowerCase():event.key;
 if(!vectors[key]||event.isComposing||event.ctrlKey||event.altKey||event.metaKey||typing(event.target)||!usable())return;
 event.preventDefault();
 if(keys.has(key))return;
 const before=direction();keys.add(key);inputChanged(before,true);
},true);
window.addEventListener('keyup',event=>{
 const key=event.key.length===1?event.key.toLowerCase():event.key;
 if(!keys.has(key))return;
 const before=direction();keys.delete(key);inputChanged(before,false);
},true);
document.getElementById('controls')?.addEventListener('click',event=>{
 const b=event.target instanceof Element?event.target.closest('[data-move]'):null;if(!b)return;
 event.preventDefault();event.stopImmediatePropagation();
 const [dx,dy]=b.dataset.move.split(',').map(Number);enqueue({type:'move',dx,dy});
},true);
window.addEventListener('message',event=>{
 if(event.source!==parent)return;
 const message=event.data;
 if(message?.type==='gulch:commit-result'){
  log('ack-observed',{clientOpId:typeof message.clientOpId==='string'?message.clientOpId.slice(0,128):null,outcome:message.outcome||(message.ok===true?'accepted':message.ok===false?'rejected':'unknown'),status:message.status??null,receiptRevision:message.receipt?.stateRevision??null,snapshotRevision:message.snapshot?.stateRevision??null,pendingInput:inflight?.command.id??null,correlated:false,runtimeOutcome:window.GulchMovementState?.transportOutcome??null});
  schedule();
 }
 if(message?.type==='gulch:action'&&(!message.action?.scope||message.action.scope==='gameplay')&&valid(message.action))enqueue(message.action);
 if(message?.type==='gulch:focus'&&message.granted===false){stopInput();discard();}
});
const setMovement=Gulch.setMovement;
Gulch.setMovement=function(dx,dy,interval){
 const before=direction(),result=setMovement.call(this,dx,dy,interval);
 if(Number.isInteger(dx)&&Number.isInteger(dy)&&Math.abs(dx)<=1&&Math.abs(dy)<=1){
  stick=usable()?{dx,dy,interval:Math.max(50,Math.min(220,Number(interval)||HOLD_INTERVAL))}:{dx:0,dy:0,interval:HOLD_INTERVAL};inputChanged(before,true);
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
  if(valid(a)&&now>=nextInput){nextInput=now+(keys.size?HOLD_INTERVAL:stick.interval)*Math.hypot(a.dx,a.dy);enqueue(a,true);}
  if(queue.length)schedule();
 }
 // Pending transport recovery belongs to runtime, not a perpetual paint loop.
 if(valid(direction())||queue.length&&usable())wake();
}
function pause(){stopInput();discard();}
window.addEventListener('blur',pause);
document.addEventListener('focusin',()=>{if(blocked())pause();});
new MutationObserver(()=>{if(blocked()&&(keys.size||stick.dx||stick.dy||queue.length))pause();}).observe(host,{subtree:true,attributes:true,attributeFilter:['hidden','inert','open']});
document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();if(frame)cancel(frame);frame=0;}else{refresh();schedule();if(valid(direction()))wake();}});
function selfTest(){
 const results=[];
 const p={map:'test',x:0,y:0},a={type:'move',dx:1,dy:0};
 const step=(from,command)=>({map:from.map,x:from.x+command.dx,y:from.y+command.dy});
 const sent={expected:step(p,a)};
 function check(name,ok){results.push({name,pass:Boolean(ok)});}
 check('Submitted step is retained before acknowledgement',project(p,sent,[],step).position.x===1);
 check('Unsent step replays after submitted step',project(p,sent,[a],step).position.x===2);
 for(const delay of [80,250,1000]){
  let unsent=[];
  for(let t=0;t<delay;t+=80)if(!unsent.some(q=>q.held))unsent.push({...a,held:true});
  check('Held preview bounded during '+delay+' ms simulated wait',unsent.length===1&&project(p,sent,unsent,step).position.x===2);
  const prior=project(p,sent,unsent,step).position;
  const acknowledged=project(sent.expected,null,unsent,step).position;
  check('No backwards jump on matching retirement after '+delay+' ms',equal(prior,acknowledged));
  unsent=unsent.filter(q=>!q.held);
  check('Release cancels unsent held input at '+delay+' ms',unsent.length===0&&project(p,sent,unsent,step).position.x===1);
 }
 check('Blocked replay truncates at the obstacle',project(p,null,[a,a],(from,command)=>from.x===1?null:step(from,command)).kept===1);
 check('Divergent authority is used once pending is retired',project({map:'test',x:5,y:0},null,[],step).position.x===5);
 return {scope:'Pure projection and held-capacity checks only; no browser input, transport, combat or two-client integration exercised.',results,pass:results.every(r=>r.pass)};
}
window.GulchLocalMovementQueue=Object.freeze({
 enqueue,cadence:HOLD_INTERVAL,
 report(){return {queued:queue.length,inFlight:inflight?{id:inflight.command.id,base:inflight.base}:null,limit:LIMIT,heldLookahead:1,expiredUnsent:0,invalidatedUnsent:invalidated,capacityRefusals,predicted:projected()};},
 camera(){return snap&&current?{...current,source:snap.revision,base:snap.stateRevision,epoch:epoch(snap.gameState)}:null;},
 cancel(){stopInput();discard('Unsent movement cancelled.');},
 trace(){return structuredClone(trace);},
 selfTest
});
function mountDiagnostics(){
 const help=document.getElementById('keyHelp');if(!help)return;
 const section=document.createElement('details'),title=document.createElement('summary');title.textContent='Movement reconciliation trace';
 const explanation=document.createElement('p');explanation.textContent='Held movement previews at most one submitted step plus one unsent held step. Releasing or changing direction cancels unsent held movement. Submitted movement must still resolve. Peer snapshots do not retire its preview; runtime pending retirement does. Divergent authority cancels the remaining route.';
 const limits=document.createElement('p');limits.textContent='Last 400 local records, using this browser’s monotonic clock. Acknowledgement operation IDs are recorded as uncorrelated: the public commit API does not expose the outgoing ID. Pending duration includes processing and recovery, and is not network ping. Do not subtract clocks from different browsers without alignment.';
 const instructions=document.createElement('p');instructions.textContent='Live verification still required: use two ordinary game browsers in a disposable room, capture the same source/save and real held input from A, B, then both. Record input, authoritative tiles, rejected acknowledgements and video separately. Test delayed acknowledgements using an authorized external harness. Check that local movement never builds a long held backlog, matching retirement preserves the endpoint, release stops unsent steps, and conflicts reconcile without replaying a stale route. This component does not inject network delay.';
 traceOutput=document.createElement('textarea');traceOutput.readOnly=true;traceOutput.rows=12;traceOutput.setAttribute('aria-label','Movement trace and check results');traceOutput.style.cssText='width:100%;font:10px monospace;user-select:text!important;-webkit-user-select:text!important';
 const refreshButton=document.createElement('button');refreshButton.type='button';refreshButton.textContent='Show local trace';refreshButton.addEventListener('click',()=>{traceOutput.value=trace.map(row=>JSON.stringify(row)).join('\n');});
 const testButton=document.createElement('button');testButton.type='button';testButton.textContent='Run deterministic reconciliation checks';testButton.addEventListener('click',()=>{traceOutput.value=JSON.stringify(selfTest(),null,2);});
 section.append(title,explanation,limits,instructions,refreshButton,testButton,traceOutput);help.append(section);
}
if(document.readyState==='complete')mountDiagnostics();else window.addEventListener('load',mountDiagnostics,{once:true});
})();
