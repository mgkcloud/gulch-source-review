const Gulch=(()=>{
'use strict';
const nativeFrame=window.requestAnimationFrame.bind(window),nativeCancel=window.cancelAnimationFrame.bind(window);
const modules=new Map(),held=new Set(),errors=new Map();
const STEP=50;
const frameInstance=typeof crypto.randomUUID==='function'?crypto.randomUUID():'frame-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
const vectors={w:[0,-1],ArrowUp:[0,-1],s:[0,1],ArrowDown:[0,1],a:[-1,0],ArrowLeft:[-1,0],d:[1,0],ArrowRight:[1,0]};
const animated=new Set(['renderer','small-cave-encounter','outside-world','ground-catalog-art','landscape-life','enemy-variety','ground-hazards','block-settlements','village-daily-life','world-construction-crews','village-harvest-and-homes','fox-companions','keeper-quest-journal','merchant-barter','dynamic-regions','ranked-treasure','sinking-ground','s-tier-radiance']);
const modals=['inventoryPanel','workBoard','characterPanel','questBoard','livingPanel','respawnScreen','interfaceMenu'];
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
let confirmed=null,derived=null,pending=null,focused=false,loaded=false,dispatching=false,presenting=false,refreshQueued=false;
let presentedKey=null,refreshNeeded=false,forceQueued=false;
let target=null,visual=null,frameId=0,lastFrame=0,nextMove=0,generation=0,activeIntent=null,buffered=null;
let queuedMove=null,moveFrame=0,moveTimer=null;
const intents=[];const INTENT_LIMIT=64;
let predicted=null,replayTimer=null,queueNotice='',replaying=false;
let heldGeneration=0,heldCancelled=0,heldVector='0,0';
let receiptProtocol=false,bridgeAcknowledged=false;
let inventoryIntent=null,inventoryCloseTimer=null;
let acceptedHeadTimer=null,acceptedHeadOwner=null,recoverySuspended=false;
let stick={dx:0,dy:0,interval:STEP},visibility=null,lastSync=-Infinity,syncing=false,syncLabel=null,resumeQueued=false,serial=0;
let maintenance=null,maintenanceTimer=null,idleAfter=0;
const epoch=d=>String(d?.respawnSettings?.token||'original');
const post=m=>parent.postMessage(m,'*');
const typing=n=>n instanceof HTMLElement&&(n.matches('input,textarea,select')||n.isContentEditable);
function blocked(){return typing(document.activeElement)||Boolean(document.querySelector('dialog[open]'))||modals.some(id=>{const n=document.getElementById(id);return n&&!n.hidden;});}
function cancelInventoryIntent(){inventoryIntent=null;clearTimeout(inventoryCloseTimer);inventoryCloseTimer=null;}
function inventoryIntentContext(gate){return loaded&&focused&&!document.hidden&&gate?.isConnected&&document.getElementById('roomStartGate')===gate&&confirmed&&derived?.player.hp>0&&!derived.gameState.gulchPermanentGameOver?.ended&&!pending&&!queuedMove&&!intents.length;}
function retainInventoryKey(event){
 const gate=document.getElementById('roomStartGate'),panel=document.getElementById('inventoryPanel');
 if(String(event.key).toLowerCase()!=='i'||!gate?.open)return false;
 if(!event.isTrusted||event.isComposing||event.ctrlKey||event.altKey||event.metaKey||event.shiftKey||event.defaultPrevented||typing(event.target))return false;
 if(event.repeat)return Boolean(inventoryIntent&&inventoryIntent.gate===gate);
 if(!panel?.hidden||!inventoryIntentContext(gate))return false;
 if(!inventoryIntent)inventoryIntent={gate,source:confirmed.revision,epoch:epoch(confirmed.gameState),frame:frameInstance};
 return true;
}
function consumeInventoryIntent(gate){
 const intent=inventoryIntent;if(!intent||intent.gate!==gate)return;
 inventoryIntent=null;
 const panel=document.getElementById('inventoryPanel'),toggle=document.getElementById('inventoryToggle'),board=document.getElementById('board');
 const rect=board?.getBoundingClientRect(),stream=window.GulchRenderStream?.report();
 if(gate.open||!inventoryIntentContext(gate)||intent.frame!==frameInstance||intent.source!==confirmed.revision||intent.epoch!==epoch(confirmed.gameState)||blocked()||!panel?.hidden||!toggle?.isConnected||toggle.disabled||!board?.width||!board.height||!rect?.width||!rect.height||stream&&stream.paints<=0)return;
 toggle.click();
}
window.addEventListener('close',event=>{const gate=event.target,intent=inventoryIntent;if(!intent||intent.gate!==gate||inventoryCloseTimer!==null)return;inventoryCloseTimer=setTimeout(()=>{inventoryCloseTimer=null;if(inventoryIntent===intent)consumeInventoryIntent(gate);},0);},true);
document.addEventListener('click',event=>{if(event.target instanceof Element&&event.target.closest('#inventoryToggle,#inventoryClose'))cancelInventoryIntent();},true);
function activate(){window.GulchFrameBudget?.activate?.();}
function report(name,e){const message=String(e?.message||e).slice(0,300),key=name+':'+message,now=performance.now();if(now-(errors.get(key)||-Infinity)<5000)return;errors.set(key,now);if(errors.size>40)errors.delete(errors.keys().next().value);const box=document.getElementById('moduleErrors');if(box)box.textContent='Module '+name+': '+message;post({type:'gulch:module-error',module:name,message});}
function invoke(name,callbacks,method,value){try{if(typeof callbacks[method]==='function')callbacks[method](value);}catch(e){report(name,e);}}
function clearConflict(){const n=document.getElementById('moduleErrors');if(n&&/^(?:Module commit: )?(?:State changed; action rejected\.|World changed before submission;)/i.test(n.textContent))n.textContent='';}
function syncStatus(value){syncing=value;if(!syncLabel){const host=document.getElementById('left');if(!host)return;syncLabel=document.createElement('div');syncLabel.id='roomSyncStatus';syncLabel.setAttribute('role','status');syncLabel.style.cssText='position:absolute;left:50%;top:48px;transform:translateX(-50%);z-index:8;padding:5px 9px;background:#10252be8;color:#d5dec9;border-radius:5px;pointer-events:none;font:11px monospace';host.append(syncLabel);}syncLabel.hidden=!value&&!queueNotice;syncLabel.textContent=queueNotice||'Syncing room…';}
function requestSync(force){if(!loaded||document.hidden)return;const now=performance.now();if(now-lastSync<(force?300:1200))return;lastSync=now;if(pending)pending.refreshRequestedAt=now;else if(force||syncing)refreshNeeded=true;post({type:'gulch:ready'});}
function cancelQueuedMove(){
 if(moveFrame)nativeCancel(moveFrame);
 moveFrame=0;clearTimeout(moveTimer);moveTimer=null;
 const had=Boolean(queuedMove);queuedMove=null;
 if(had&&derived){const p=derived.player;target={map:p.map,x:p.x,y:p.y};visual={...target};drawMovement();}
}
function discardIntents(reason){if(intents.length){queueNotice=reason+' Unsent movement cancelled ('+intents.length+').';intents.length=0;syncStatus(Boolean(pending));}predicted=null;clearTimeout(replayTimer);replayTimer=null;}
function clear(){cancelAcceptedHead();held.clear();stick={dx:0,dy:0,interval:STEP};heldGeneration++;heldVector='0,0';buffered=null;nextMove=0;generation++;cancelQueuedMove();discardIntents('Movement paused.');}
function sliding(){return visual&&target&&visual.map===target.map&&(Math.abs(visual.x-target.x)>.001||Math.abs(visual.y-target.y)>.001);}
function interactive(){return dispatching||Boolean(queuedMove)||held.size>0||Boolean(stick.dx||stick.dy)||sliding()||performance.now()<idleAfter;}
function scheduleMaintenance(){
 if(maintenanceTimer!==null||!maintenance||document.hidden)return;
 maintenanceTimer=setTimeout(()=>{
  maintenanceTimer=null;
  const task=maintenance;if(!task)return;
  if(!confirmed||confirmed.revision!==task.source||confirmed.stateRevision!==task.base){maintenance=null;return;}
  if(pending||presenting||interactive()){scheduleMaintenance();return;}
  maintenance=null;
  try{task.run();}catch(error){report('setup',error);}
 },180);
}
function presentationCamera(){
 const local=window.GulchLocalMovementQueue?.camera?.();
 const p=derived?.player;
 if(local&&p&&p.hp>0&&!derived.gameState.gulchPermanentGameOver?.ended&&local.source===confirmed.revision&&local.base===confirmed.stateRevision&&local.epoch===epoch(confirmed.gameState)&&local.map===p.map&&Number.isFinite(local.x)&&Number.isFinite(local.y))return {map:local.map,x:local.x,y:local.y};
 return visual?{...visual}:null;
}
Object.defineProperty(window,'GulchMovementState',{configurable:false,get(){const camera=presentationCamera();return Object.freeze({heldKeys:Object.freeze([...held,...(stick.dx||stick.dy?['joystick']:[])]),inFlight:Boolean(pending||queuedMove||(!replaying&&intents.length)),queuedIntents:intents.length,queueLimit:INTENT_LIMIT,heldGeneration,cancelledHeldIntents:heldCancelled,heldVector,pendingHeldGeneration:pending?.intent?.heldGeneration??null,transportOutcome:pending?.outcome||null,receiptProtocol:receiptProtocol?'v2':'legacy',focused,visual:camera?Object.freeze(camera):null});}});
function version(s){if(!Number.isSafeInteger(s?.revision)||s.revision<0||!Number.isSafeInteger(s?.stateRevision)||s.stateRevision<0)throw new Error('Snapshot is missing valid source and state revisions.');}
function compare(a,b){return a.revision===b.revision?Math.sign(a.stateRevision-b.stateRevision):Math.sign(a.revision-b.revision);}
function view(s){
 const data=s?.gameState,seed=data?.seed;if(!seed||!Array.isArray(seed.entities)||!Array.isArray(seed.maps)||!seed.legend||typeof seed.legend!=='object')throw new Error('Incomplete world snapshot.');
 const p=seed.entities.find(e=>e&&e.id==='player'),map=seed.maps.find(m=>m&&m.id===p?.map);
 if(!p||!Number.isInteger(p.x)||!Number.isInteger(p.y)||!map||!Array.isArray(map.ascii)||!map.ascii.length||!map.ascii.every(r=>typeof r==='string')||!map.ascii[p.y]?.[p.x])throw new Error('Snapshot contains an invalid player or map.');
 const supplied=Number(seed.meta?.fov?.radius),radius=Number.isFinite(supplied)&&supplied>0?Math.min(128,supplied):8;
 const same=visibility&&visibility.map===map.id&&visibility.x===p.x&&visibility.y===p.y&&visibility.radius===radius&&visibility.rows.length===map.ascii.length&&map.ascii.every((r,i)=>r.length===visibility.rows[i]);
 if(!same){const lit=map.ascii.map(r=>new Array(r.length).fill(0)),reach=radius+.5;for(let y=Math.max(0,Math.ceil(p.y-reach));y<=Math.min(map.ascii.length-1,Math.floor(p.y+reach));y++){const span=Math.sqrt(Math.max(0,reach*reach-(y-p.y)**2));for(let x=Math.max(0,Math.ceil(p.x-span));x<=Math.min(map.ascii[y].length-1,Math.floor(p.x+span));x++)lit[y][x]=1;}visibility={map:map.id,x:p.x,y:p.y,radius,rows:map.ascii.map(r=>r.length),lit};}
 return {...s,seed,player:p,mapId:p.map,turn:data.turn,lit:visibility.lit};
}
function drawMovement(){for(const name of animated){const mod=modules.get(name);if(mod)invoke(name,mod,'resize');}}
let cameraRefreshQueued=false;
window.addEventListener('gulch:local-camera',()=>{
 if(document.hidden)return;
 if(presenting){
  if(cameraRefreshQueued)return;
  cameraRefreshQueued=true;
  queueMicrotask(()=>{cameraRefreshQueued=false;if(!document.hidden)drawMovement();});
 }else drawMovement();
});
function wake(){if(!frameId&&!document.hidden)frameId=nativeFrame(frame);}
function release(){cancelAcceptedHead();pending=null;if(bridgeAcknowledged&&!queuedMove&&!intents.length)receiptProtocol=true;queueNotice='';syncStatus(false);clearConflict();window.dispatchEvent(new Event('gulch:recovered'));scheduleMaintenance();}
function accept(s){
 version(s);if(confirmed&&compare(s,confirmed)<0)return false;
 const next={...confirmed,...s},d=view(next),reset=confirmed&&(confirmed.revision!==next.revision||epoch(confirmed.gameState)!==epoch(next.gameState));
 if(maintenance&&(maintenance.source!==next.revision||maintenance.base!==next.stateRevision))maintenance=null;
 confirmed=next;derived=d;
 if(reset){cancelInventoryIntent();cancelAcceptedHead();clear();if(!receiptProtocol&&!bridgeAcknowledged)release();if(pending){pending.preview=null;pending.contextChanged=true;}visual=null;target=null;maintenance=null;}
 else if(queuedMove&&queuedMove.base!==next.stateRevision){queuedMove.preview=null;visual={map:d.player.map,x:d.player.x,y:d.player.y};target={...visual};drawMovement();}
 rebuildPrediction();return true;
}
function presentationKey(){const envelope=Object.keys(confirmed).filter(key=>key!=='gameState').sort().map(key=>[key,confirmed[key]]);return JSON.stringify([epoch(confirmed.gameState),envelope]);}
function present(force=false){
 if(!derived)return;
 if(presenting){forceQueued=forceQueued||force;if(!refreshQueued){refreshQueued=true;queueMicrotask(()=>{const forced=forceQueued;refreshQueued=false;forceQueued=false;present(forced);});}return;}
 presenting=true;
 try{
  const p=derived.player;
  // Authoritative movement remains separate from the local presentation camera.
  target={map:p.map,x:p.x,y:p.y};visual={...target};
  if(p.hp<=0)clear();
  const key=presentationKey();
  if(force||key!==presentedKey){presentedKey=key;for(const [name,mod] of modules)invoke(name,mod,'snapshot',derived);}
 }finally{presenting=false;}
 if(sliding()||held.size||stick.dx||stick.dy){activate();wake();}
}
function direction(){let dx=0,dy=0;if(held.has('a')||held.has('ArrowLeft'))dx--;if(held.has('d')||held.has('ArrowRight'))dx++;if(held.has('w')||held.has('ArrowUp'))dy--;if(held.has('s')||held.has('ArrowDown'))dy++;return dx||dy?{dx,dy,interval:STEP}:stick;}
function changeHeldControl(){
 const d=direction(),key=d.dx+','+d.dy;if(key===heldVector)return;
 heldVector=key;heldGeneration++;
 let cancelled=0;
 for(let i=intents.length-1;i>=0;i--)if(intents[i].intent.heldGeneration!==undefined&&intents[i].intent.heldGeneration!==heldGeneration){intents.splice(i,1);cancelled++;}
 if(queuedMove?.intent.heldGeneration!==undefined&&queuedMove.intent.heldGeneration!==heldGeneration){cancelQueuedMove();cancelled++;}
 if(pending?.intent?.heldGeneration!==undefined&&pending.intent.heldGeneration!==heldGeneration)pending.preview=null;
 if(cancelled){heldCancelled+=cancelled;queueNotice='Superseded unsent held movement cancelled ('+cancelled+').';post({type:'gulch:held-cancelled',frameInstance,generation:heldGeneration,count:cancelled,total:heldCancelled,reason:'effective held vector changed',pendingOp:pending?.request.clientOpId||null});}
 clearTimeout(replayTimer);replayTimer=null;
 if(derived){rebuildPrediction();present(true);drawMovement();}
}
function resume(){
 if(resumeQueued)return;resumeQueued=true;
 queueMicrotask(()=>{resumeQueued=false;if(pending||queuedMove||!focused||document.hidden||blocked()||presenting||dispatching)return;
  if(intents.length){
   const item=intents[0];
   if(item.source!==confirmed.revision||item.epoch!==epoch(confirmed.gameState)||!movementPreview(item.intent)){discardIntents('World changed.');present(true);drawMovement();return;}
   const wait=nextMove-performance.now();
   if(wait>0){if(replayTimer===null)replayTimer=setTimeout(()=>{replayTimer=null;resume();},wait);return;}
   intents.shift();replaying=true;try{action(item.intent,false,true);}finally{replaying=false;}nextMove=performance.now()+STEP;rebuildPrediction();present();
   if(!pending)resume();return;
  }
  const d=direction();
  if(d.dx||d.dy){buffered=null;moveHeld(performance.now());}
  else if(buffered){const b=buffered;buffered=null;if(b.source===confirmed?.revision&&b.epoch===epoch(confirmed.gameState)&&b.generation===generation&&performance.now()<b.expires)action(b.intent,false);}
  if(sliding()||held.size||stick.dx||stick.dy)wake();
 });
}
function settle(record){
 if(pending!==record||!confirmed)return false;
 const receipt=record.receipt;
 if(record.outcome==='accepted'&&receipt?.ok===true&&receipt.stateRevision===record.request.base+1&&confirmed.stateRevision>=receipt.stateRevision){release();rebuildPrediction();return true;}
 if(record.outcome==='rejected'&&record.headReceived){
  const retry=record.status===409&&!record.contextChanged&&record.intent?.type==='move'&&(record.intent.heldGeneration===undefined||record.intent.heldGeneration===heldGeneration)&&record.request.revision===confirmed.revision&&record.epoch===epoch(confirmed.gameState);
  release();
  const replay=retry&&movementPreview(record.intent);
  if(replay)intents.unshift({intent:record.intent,source:confirmed.revision,epoch:epoch(confirmed.gameState)});
  else if(record.status!==409||record.contextChanged)discardIntents('Action rejected.');
  // A safe retry must not wait for the peer's next held tick; ordinary input still uses STEP.
  nextMove=replay?performance.now():performance.now()+STEP;rebuildPrediction();return true;
 }
 return false;
}
function snapshot(s){
 const record=pending;if(!accept(s))return;
 let restore=refreshNeeded;refreshNeeded=false;
 if(record&&pending===record){
  if(!receiptProtocol&&!bridgeAcknowledged){const advanced=confirmed.revision!==record.request.revision||confirmed.stateRevision>record.request.base,refreshed=record.refreshRequestedAt!==null&&performance.now()-record.started>=7000;if(advanced||record.rejected||refreshed){restore=restore||Boolean(record.rejected)||(!advanced&&refreshed);release();}}
  else{if(record.outcome==='rejected')record.headReceived=true;restore=settle(record)||restore;}
 }
 if(!pending)syncStatus(false);present(restore);resume();
}
function legacyResult(m){
 const record=pending,matching=Boolean(record&&m.clientOpId===record.request.clientOpId);
 let received=false,restore=false;
 try{if(m.snapshot?.gameState)received=accept(m.snapshot);}catch(e){report('state',e);}
 if(matching&&pending===record){
  if(m.ok===false){
   if(received){release();restore=true;nextMove=performance.now()+STEP;}
   else{record.rejected=true;syncStatus(true);requestSync(true);}
   if(!/^(?:State changed; action rejected\.|World changed before submission;)/i.test(String(m.error||'')))report('commit',m.error||'Action rejected.');
  }else if(m.ok===true){if(received&&confirmed.stateRevision>record.request.base)release();else{syncStatus(true);requestSync(true);}}
 }
 if(received||matching)present(restore);
 if(!pending){clearConflict();resume();}
}
function result(m){
 if(!receiptProtocol&&!bridgeAcknowledged){legacyResult(m);return;}
 if(m.frameInstance!==frameInstance)return;
 const record=pending,matching=Boolean(record&&m.clientOpId===record.request.clientOpId);
 let received=false;
 try{if(m.snapshot?.gameState)received=accept(m.snapshot);}catch(e){report('state',e);}
 if(matching&&pending===record){
  if(m.outcome==='accepted'&&m.receipt?.ok===true&&m.receipt.stateRevision===record.request.base+1){record.outcome='accepted';record.receipt=m.receipt;record.paused=m.paused===true;if(record.paused){queueNotice='Action accepted; authoritative world recovery scheduled.';syncStatus(true);}}
  else if(m.outcome==='rejected'){record.outcome='rejected';record.status=m.status;record.headReceived=received;}
  else{record.outcome='unknown';record.paused=m.paused===true;if(record.paused)queueNotice='Operation unresolved; click map to retry the original action.';syncStatus(true);requestSync(true);}
  record.autoHeadInFlight=false;
  if(m.status===401||m.status===403)record.autoHeadStopped=true;
  const retired=settle(record);
  if(!retired&&record.outcome==='accepted')scheduleAcceptedHead(record);
  else cancelAcceptedHead();
  if(!retired&&record.outcome!=='accepted')syncStatus(true);
  if(m.outcome==='rejected'&&!/^(?:State changed; action rejected\.|World changed before submission;)/i.test(String(m.error||'')))report('commit',m.error||'Action rejected.');
 }
 if(received||matching){rebuildPrediction();present();}
 if(!pending){clearConflict();resume();}
}
function send(record){
 if(pending!==record)return;
 if(confirmed.revision!==record.request.revision||confirmed.stateRevision!==record.request.base){const retry=record.intent?.type==='move'&&(record.intent.heldGeneration===undefined||record.intent.heldGeneration===heldGeneration)&&confirmed.revision===record.request.revision&&record.epoch===epoch(confirmed.gameState);release();if(retry)intents.unshift({intent:record.intent,source:confirmed.revision,epoch:epoch(confirmed.gameState)});rebuildPrediction();present(true);resume();return;}
 try{record.sentAt=performance.now();post(record.request);}
 catch(e){record.rejected=true;syncStatus(true);requestSync(true);report('commit',e);}
}
function movementPreview(a,from=derived?.player){
 if(a.type!=='move'||!derived)return null;
 const {seed}=derived,p=from,map=seed.maps.find(m=>m.id===p.map);
 const floor=(x,y)=>{const c=map?.ascii[y]?.[x];return Boolean(c)&&!['#','~'].includes(c)&&!['wall','water'].includes(seed.legend[c]?.[0]);};
 const rat=e=>[e.id,e.name,e.species,e.type,e.kind].some(v=>typeof v==='string'&&/(^|[^a-z])rats?([^a-z]|$)/i.test(v));
 const occupied=(x,y)=>seed.entities.some(e=>e.id!=='player'&&e.map===p.map&&e.x===x&&e.y===y&&!rat(e));
 const x=p.x+a.dx,y=p.y+a.dy;
 if(!floor(x,y)||occupied(x,y))return null;
 if(a.dx&&a.dy&&(!floor(x,p.y)||!floor(p.x,y)||occupied(x,p.y)||occupied(p.x,y)))return null;
 return {map:p.map,x,y};
}
function rebuildPrediction(){predicted=null;}
function action(a,buffer=true,afterPreview=false){
 if(!a||typeof a!=='object'||a.scope&&a.scope!=='gameplay'||!focused||document.hidden||blocked()||!derived||derived.player.hp<=0||derived.gameState.gulchPermanentGameOver?.ended)return false;
 if(a.type==='move'&&(!Number.isInteger(a.dx)||!Number.isInteger(a.dy)||Math.abs(a.dx)>1||Math.abs(a.dy)>1||(!a.dx&&!a.dy)))return false;
 if(pending||queuedMove){
  // Held input resumes after confirmation; do not let its camera outrun damage.
  if(a.type==='move'&&!buffer)return false;
  queueNotice='Waiting for the current turn to confirm.';syncStatus(true);
  if(buffer&&['move','attack','descend'].includes(a.type))buffered={intent:{...a},source:confirmed.revision,epoch:epoch(confirmed.gameState),generation,expires:performance.now()+350};
  return false;
 }
 if(dispatching||presenting)return false;if(intents.length&&!replaying){queueNotice='Movement is queued; waiting for shared confirmation.';syncStatus(Boolean(pending));return false;}
 idleAfter=performance.now()+240;activate();
 dispatching=true;activeIntent=a.type==='move'?{type:'move',dx:a.dx,dy:a.dy,...(a.heldGeneration===undefined?{}:{heldGeneration:a.heldGeneration})}:a.type==='attack'?{type:'attack'}:null;
 try{for(const [name,mod] of modules)invoke(name,mod,'action',a);}finally{dispatching=false;activeIntent=null;}
 return true;
}
function moveHeld(now,initial=false){if(queuedMove||now<nextMove)return;if(!pending&&intents.length){resume();return;}const d=direction();if((d.dx||d.dy)&&action({type:'move',dx:d.dx,dy:d.dy,...(initial?{}:{heldGeneration})},false))nextMove=now+d.interval*Math.hypot(d.dx,d.dy);}
function frame(now){
 frameId=0;
 if(document.hidden||!focused||blocked())clear();else moveHeld(now);
 if(sliding()){visual={...target};drawMovement();}
 lastFrame=now;
 if(sliding()||held.size||stick.dx||stick.dy)wake();else{lastFrame=0;scheduleMaintenance();}
}
function cancelAcceptedHead(){clearTimeout(acceptedHeadTimer);acceptedHeadTimer=null;acceptedHeadOwner=null;}
function eligibleAcceptedHead(record){
 return record&&pending===record&&record.outcome==='accepted'&&record.receipt?.ok===true&&record.receipt.stateRevision===record.request.base+1&&(receiptProtocol||bridgeAcknowledged)&&loaded&&focused&&!blocked()&&!document.hidden&&!recoverySuspended&&!record.contextChanged&&!record.autoHeadStopped&&confirmed?.revision===record.request.revision&&epoch(confirmed.gameState)===record.epoch&&derived?.player.hp>0&&!derived.gameState.gulchPermanentGameOver?.ended;
}
function scheduleAcceptedHead(record){
 if(!eligibleAcceptedHead(record)||!record.paused||record.autoHeadInFlight)return;
 if((record.autoHeadAttempts||0)>=4){cancelAcceptedHead();queueNotice='Action accepted; automatic authority recovery paused after bounded attempts. Reconnect or sign in before retrying.';syncStatus(true);return;}
 if(acceptedHeadTimer!==null){if(acceptedHeadOwner===record)return;cancelAcceptedHead();}
 acceptedHeadOwner=record;
 const delay=Math.min(15000,1000*2**Math.min(record.autoHeadAttempts||0,4));
 acceptedHeadTimer=setTimeout(()=>{
  acceptedHeadTimer=null;acceptedHeadOwner=null;
  if(!eligibleAcceptedHead(record)||!record.paused||record.autoHeadInFlight)return;
  record.autoHeadAttempts=(record.autoHeadAttempts||0)+1;record.autoHeadInFlight=true;record.paused=false;
  queueNotice='Action accepted; refreshing authoritative world automatically…';syncStatus(true);
  try{post({...record.request,type:'gulch:commit-recover'});}
  catch{record.autoHeadInFlight=false;record.paused=true;scheduleAcceptedHead(record);}
 },delay);
}
function retryPaused(){
 if(!pending?.paused)return;
 cancelAcceptedHead();pending.autoHeadStopped=false;pending.autoHeadAttempts=0;pending.autoHeadInFlight=true;pending.paused=false;queueNotice=pending.outcome==='accepted'?'Refreshing accepted action authority…':'Retrying the exact original action…';syncStatus(true);post(pending.outcome==='accepted'?{...pending.request,type:'gulch:commit-recover'}:pending.request);
}
window.addEventListener('message',e=>{
 if(e.source!==parent||!e.data||typeof e.data!=='object')return;const m=e.data;
 if(m.type==='gulch:capabilities'&&m.protocol===2&&m.frameInstance===frameInstance){bridgeAcknowledged=true;if(!pending&&!queuedMove&&!intents.length)receiptProtocol=true;}
 if(m.type==='gulch:snapshot'&&m.snapshot?.gameState){try{snapshot(m.snapshot);}catch(err){syncStatus(true);requestSync(true);report('state',err);}}
 if(m.type==='gulch:commit-result')result(m);
 if(m.type==='gulch:focus'&&typeof m.granted==='boolean'){focused=m.granted;if(!focused){cancelInventoryIntent();clear();}const n=document.getElementById('focusHint');if(n)n.textContent=focused?'hold WASD / arrows — diagonal pairs supported — Esc to chat':'click map for keys';if(focused){requestSync(false);resume();}}
 if(m.type==='gulch:action')action(m.action);
});
window.addEventListener('keydown',e=>{
 if(e.key==='Escape'){cancelInventoryIntent();clear();const n=document.getElementById('characterPanel');if(n&&!n.hidden){e.preventDefault();e.stopImmediatePropagation();document.getElementById('characterClose')?.click();return;}if(blocked())return;focused=false;post({type:'gulch:focus-chat'});return;}
 const key=e.key.length===1?e.key.toLowerCase():e.key;
 if(key==='i'&&!document.getElementById('roomStartGate')?.open)cancelInventoryIntent();
 if(retainInventoryKey(e))return;
 if(typing(e.target))cancelInventoryIntent();
 if(typing(e.target)||blocked()||!focused||e.ctrlKey||e.metaKey||e.altKey||e.isComposing){clear();return;}
 if(vectors[key]){e.preventDefault();retryPaused();if(!held.has(key)){held.add(key);generation++;buffered=null;nextMove=0;changeHeldControl();moveHeld(performance.now(),true);resume();}activate();wake();}
},true);
window.addEventListener('keyup',e=>{const key=e.key.length===1?e.key.toLowerCase():e.key;if(held.delete(key)){generation++;if(buffered?.intent.type==='move')buffered=null;nextMove=0;changeHeldControl();resume();scheduleMaintenance();}},true);
window.addEventListener('blur',()=>{cancelInventoryIntent();clear();focused=false;});
document.addEventListener('focusin',e=>{if(typing(e.target)||blocked())clear();});
document.addEventListener('pointerdown',()=>{retryPaused();generation++;buffered=null;focused=true;post({type:'gulch:request-focus'});if(syncing)requestSync(true);});
document.addEventListener('keydown',e=>{if(e.key==='>'&&!e.repeat&&!typing(e.target)){if(focused&&!blocked())e.preventDefault();action({type:'descend'});}});
document.addEventListener('visibilitychange',()=>{
 clear();
 if(document.hidden){cancelInventoryIntent();cancelAcceptedHead();focused=false;if(frameId)nativeCancel(frameId);frameId=0;lastFrame=0;clearTimeout(maintenanceTimer);maintenanceTimer=null;}
 else{requestSync(true);present(true);drawMovement();scheduleMaintenance();scheduleAcceptedHead(pending);}
});
window.addEventListener('online',()=>{retryPaused();requestSync(true);});
window.addEventListener('pagehide',()=>{cancelInventoryIntent();recoverySuspended=true;cancelAcceptedHead();});
window.addEventListener('pageshow',()=>{recoverySuspended=false;requestSync(true);scheduleAcceptedHead(pending);});
const pad=document.getElementById('controls');
if(pad){const corners=[[-1,-1,'↖'],[1,-1,'↗'],[-1,1,'↙'],[1,1,'↘']];Array.from(pad.querySelectorAll('span')).slice(0,4).forEach((span,i)=>{const [dx,dy,label]=corners[i],b=document.createElement('button');b.type='button';b.dataset.move=dx+','+dy;b.textContent=label;b.setAttribute('aria-label','Move '+(dy<0?'north':'south')+(dx<0?'west':'east'));span.replaceWith(b);});pad.querySelectorAll('[data-move]').forEach(b=>b.addEventListener('click',()=>{const [dx,dy]=b.dataset.move.split(',').map(Number);action({type:'move',dx,dy});}));}
document.getElementById('descendBtn')?.addEventListener('click',()=>action({type:'descend'}));
let resizeQueued=false;window.addEventListener('resize',()=>{if(resizeQueued)return;resizeQueued=true;nativeFrame(()=>{resizeQueued=false;for(const [name,mod] of modules)invoke(name,mod,'resize');});});
window.addEventListener('error',e=>report('script',e.error||e.message));window.addEventListener('unhandledrejection',e=>report('promise',e.reason));
window.addEventListener('load',()=>{loaded=true;post({type:'gulch:capabilities',frameInstance});requestSync(true);},{once:true});
setInterval(()=>{if(document.hidden||!loaded)return;if(!confirmed){syncStatus(true);requestSync();return;}if(pending?.outcome==='accepted'&&pending.paused)scheduleAcceptedHead(pending);if(pending&&performance.now()-pending.started>=1800){syncStatus(true);requestSync();}else if(syncing)requestSync();else if(!pending)resume();},400);
reduced.addEventListener('change',()=>{if(reduced.matches&&target){visual={...target};drawMovement();}});
const api={
 register(name,callbacks){if(typeof name!=='string'||!callbacks||typeof callbacks!=='object')return;modules.set(name,callbacks);if(derived)queueMicrotask(()=>{if(modules.get(name)!==callbacks)return;const old=presenting;presenting=true;try{invoke(name,callbacks,'snapshot',derived);}finally{presenting=old;}});},
 setMovement(dx,dy,interval=STEP){
  if(!Number.isInteger(dx)||!Number.isInteger(dy)||Math.abs(dx)>1||Math.abs(dy)>1)return;
  const changed=dx!==stick.dx||dy!==stick.dy;
  if(!dx&&!dy){stick={dx:0,dy:0,interval:STEP};if(changed){generation++;buffered=null;changeHeldControl();}nextMove=0;scheduleMaintenance();return;}
  if(!focused||blocked()||document.hidden)return;
  stick={dx,dy,interval:Math.max(STEP,Math.min(220,Number(interval)||STEP))};
  if(changed){generation++;buffered=null;nextMove=0;changeHeldControl();moveHeld(performance.now(),true);resume();}activate();wake();
 },
 commit(data,activity='',options={}){
  if(!confirmed||pending||queuedMove||(!replaying&&intents.length)||!data||typeof data!=='object'||options?.scope&&options.scope!=='gameplay')return;
  let request;
  try{
   const isolated=structuredClone(data);view({...confirmed,gameState:isolated});
   request={type:'gulch:commit',frameInstance,clientOpId:typeof crypto.randomUUID==='function'?crypto.randomUUID():'gulch-'+Date.now().toString(36)+'-'+(++serial)+'-'+Math.random().toString(36).slice(2),base:confirmed.stateRevision,revision:confirmed.revision,data:isolated,activity:typeof activity==='string'?activity:'',intent:activeIntent?{type:activeIntent.type,dx:activeIntent.dx,dy:activeIntent.dy}:null};
  }catch(e){report('commit',e);return;}
  const from=derived.player;
  const record={request,preview:null,intent:activeIntent?{...activeIntent}:null,epoch:epoch(confirmed.gameState),outcome:'unknown',started:performance.now(),sentAt:null,refreshRequestedAt:null,rejected:false};pending=record;rebuildPrediction();
  if(visual&&(visual.map!==from.map||visual.x!==from.x||visual.y!==from.y)){target={map:from.map,x:from.x,y:from.y};visual={...target};drawMovement();}
  queueMicrotask(()=>send(record));
 }
};
const scoped=fn=>function(data,activity,options){
 if(options?.scope&&options.scope!=='gameplay'||queuedMove)return;
 if(presenting){
  const source=confirmed?.revision,base=confirmed?.stateRevision;
  const before=derived?.player,after=data?.seed?.entities?.find(e=>e.id==='player');
  const lethal=after&&Number(after.hp)<=0||data?.gulchPermanentGameOver?.ended;
  const setup=before&&after&&!lethal&&epoch(data)===epoch(confirmed.gameState)&&data.turn===confirmed.gameState.turn&&before.map===after.map&&before.x===after.x&&before.y===after.y&&before.hp===after.hp;
  const run=()=>{if(pending||queuedMove||confirmed?.revision!==source||confirmed?.stateRevision!==base)return;fn.call(this,data,activity,options);};
  if(setup){if(!maintenance)maintenance={source,base,run};scheduleMaintenance();}
  else queueMicrotask(run);
  return;
 }
 return fn.call(this,data,activity,options);
};
let commit=scoped(api.commit);
Object.defineProperty(api,'commit',{enumerable:true,configurable:false,get(){return commit;},set(fn){if(typeof fn!=='function')throw new TypeError('Commit extension must be a function');commit=scoped(fn);}});
return api;
})();
