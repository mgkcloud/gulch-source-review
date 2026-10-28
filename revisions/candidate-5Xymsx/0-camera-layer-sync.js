(function(){
'use strict';
const register=Gulch.register;
const request=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window);
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
const layers=new Map();
const names=new Set(['renderer','small-cave-encounter','outside-world','ground-catalog-art','landscape-life','enemy-variety','ground-hazards','block-settlements','village-daily-life','world-construction-crews','village-harvest-and-homes','fox-companions','keeper-quest-journal','merchant-barter','dynamic-regions','ranked-treasure','sinking-ground','s-tier-radiance','wild-plant-gardens','sword-combat','combat-impact-effects','confirmed-hit-feedback','sword-magic','quick-consumable-slot','frontier-architecture']);
const movement=window.GulchLocalMovementQueue;
const rawCamera=typeof movement?.camera==='function'?movement.camera.bind(movement):null;
const host=document.getElementById('left');
let latest=null,current=null,target=null,origin=null,started=0;
let frame=null,painting=false,notifying=false,refreshQueued=false;
let tracks=new Map(),attack=null,attackUntil=0,spriteInstalled=false;
let predictionReset=false,lastSourceKind='unavailable';
const DURATION=80,ENEMY_DURATION=45,MAX_GLIDE=3,EPSILON=.0001;
const heldKeys=new Set();
let stickHeld=false;
const vectors={w:[0,-1],ArrowUp:[0,-1],s:[0,1],ArrowDown:[0,1],a:[-1,0],ArrowLeft:[-1,0],d:[1,0],ArrowRight:[1,0]};
const attackCanvas=document.createElement('canvas');
attackCanvas.id='immediateCombatPresentation';attackCanvas.setAttribute('aria-hidden','true');
attackCanvas.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:4';
if(host)host.append(attackCanvas);
const style=document.createElement('style');
style.textContent='#left[data-immediate-combat=true] #localAttackFeedback{visibility:hidden!important}#localFeedbackHero{transition:none!important}#left,#board,#predictedAdventurer,#left>canvas[aria-hidden="true"]{transition:none!important}';
document.head.append(style);
if(host)host.dataset.instantCamera='false';
function initialized(s){return Boolean(s?.gameState?.seed&&s.seed&&s.player&&s.lit&&s.mapId!=null);}
function epoch(s){return String(s?.gameState?.respawnSettings?.token||'original');}
function point(p){return {map:p.map,x:p.x,y:p.y};}
function valid(p){return p&&p.map!=null&&Number.isFinite(p.x)&&Number.isFinite(p.y);}
function same(a,b){return a&&b&&a.map===b.map&&Math.abs(a.x-b.x)<EPSILON&&Math.abs(a.y-b.y)<EPSILON;}
function heldMovement(){
 let dx=0,dy=0;
 for(const key of heldKeys){const v=vectors[key];dx+=v[0];dy+=v[1];}
 return Boolean(dx||dy||stickHeld);
}
function source(){
 if(!initialized(latest))return null;
 const p=latest.player;
 const authoritative={...point(p),source:latest.revision,base:latest.stateRevision,epoch:epoch(latest)};
 lastSourceKind='authoritative';
 if(p.hp<=0||latest.gameState.gulchPermanentGameOver?.ended||predictionReset)return authoritative;
 // The public movement-state getter calls camera(). Reading it here recurses.
 // The queue report is the live endpoint; the captured camera supplies only
 // expedition identity and a fallback endpoint, never a revision gate.
 const local=window.GulchLocalMovementQueue?.report?.();
 const context=rawCamera?.();
 if(context?.epoch!=null&&context.epoch!==epoch(latest))return authoritative;
 const map=latest.seed.maps.find(m=>m.id===p.map);
 const usable=q=>valid(q)&&q.map===p.map&&Boolean(map?.ascii[Math.round(q.y)]?.[Math.round(q.x)]);
 const predicted=usable(local?.predicted)?local.predicted:usable(context)?context:null;
 if(!predicted)return authoritative;
 lastSourceKind=predicted===local?.predicted?'local-prediction':'local-camera';
 // Runtime checks this envelope against its current snapshot. Coordinates are
 // presentation-only and may lead that snapshot by multiple queued steps.
 return {...authoritative,...point(predicted)};
}
function stop(){if(frame!==null)cancel(frame);frame=null;}
function syncHero(){
 if(!host||!current)return;
 const hero=document.getElementById('localFeedbackHero');
 if(!hero)return;
 hero.style.setProperty('transition','none','important');
 hero.style.transform='translate('+(host.clientWidth/2-64)+'px,'+(host.clientHeight/2-64)+'px)';
}
function snap(q){
 current=point(q);target=point(q);origin=point(q);started=performance.now();
 syncHero();
}
function cameraMoving(){return Boolean(current&&target&&!same(current,target));}
function advanceCamera(now){
 if(!current||!target||!origin)return;
 const t=reduced.matches?1:Math.max(0,Math.min(1,(now-started)/DURATION));
 const eased=t*(2-t);
 current=t>=1?point(target):{map:target.map,x:origin.x+(target.x-origin.x)*eased,y:origin.y+(target.y-origin.y)*eased};
}
function sample(){
 const q=source();if(!q)return null;
 const now=performance.now();
 advanceCamera(now);
 if(!current||current.map!==q.map||reduced.matches){snap(q);}
 else if(!same(target,q)){
  const destinationJump=target&&Math.hypot(q.x-target.x,q.y-target.y)>MAX_GLIDE;
  if(destinationJump||Math.hypot(q.x-current.x,q.y-current.y)>MAX_GLIDE)snap(q);
  else{origin=point(current);target=point(q);started=now;}
 }
 syncHero();wake();return q;
}
function camera(){const q=sample();return q&&current?{...q,...current}:null;}
if(rawCamera)window.GulchLocalMovementQueue=Object.freeze({...movement,camera});
function animatedEntity(e){return e.id!=='player'&&valid(e)&&(e.caveEncounter===1||Boolean(e.outsideAnimal))&&!(Number.isFinite(e.hp)&&e.hp<=0);}
function trackPoint(track,now){
 const t=reduced.matches?1:Math.max(0,Math.min(1,(now-track.started)/ENEMY_DURATION));
 return {map:track.to.map,x:track.from.x+(track.to.x-track.from.x)*t,y:track.from.y+(track.to.y-track.from.y)*t};
}
function entityPosition(e,now=performance.now()){
 const track=tracks.get(e.id);
 if(!track||!same(track.to,e)||document.hidden||reduced.matches)return point(e);
 return trackPoint(track,now);
}
function updateTracks(s,reset){
 const now=performance.now(),next=new Map();
 for(const e of s.seed.entities){
  if(!animatedEntity(e)||e.map!==s.mapId||s.lit[e.y]?.[e.x]!==1)continue;
  const old=tracks.get(e.id);
  if(!reset&&old&&same(old.to,e)){next.set(e.id,old);continue;}
  let from=point(e);
  if(!reset&&old&&old.to.map===e.map){
   const q=trackPoint(old,now);
   if(Math.hypot(q.x-e.x,q.y-e.y)<=MAX_GLIDE)from=q;
  }
  next.set(e.id,{from,to:point(e),started:now});
 }
 tracks=next;
}
function enemiesMoving(now){return !reduced.matches&&Array.from(tracks.values()).some(t=>!same(t.from,t.to)&&now-t.started<ENEMY_DURATION);}
function matching(s){return initialized(s)&&initialized(latest)&&s.revision===latest.revision&&s.stateRevision===latest.stateRevision&&s.mapId===latest.mapId&&epoch(s)===epoch(latest);}
function report(name,error){const box=document.getElementById('moduleErrors');if(box)box.textContent='Module '+name+': '+String(error?.message||error).slice(0,300);}
function paintLayers(includeRenderer){
 if(painting||document.hidden||!initialized(latest))return;
 painting=true;
 try{for(const [name,entry] of layers){
  if(name==='renderer'&&!includeRenderer||!matching(entry.latest))continue;
  try{entry.callbacks.resize.call(entry.callbacks);}catch(error){report(name,error);}
 }}finally{painting=false;syncHero();}
}
function notifyCamera(){
 if(notifying||document.hidden||!initialized(latest))return;
 notifying=true;try{window.dispatchEvent(new Event('gulch:local-camera'));}finally{notifying=false;syncHero();}
}
function typing(n){return n instanceof HTMLElement&&(n.matches('input,textarea,select')||n.isContentEditable);}
function blocked(){return !host||host.inert||typing(document.activeElement)||Boolean(document.querySelector('dialog[open]'))||['inventoryPanel','workBoard','characterPanel','questBoard','livingPanel','respawnScreen','interfaceMenu','tradePanel','travelMapPanel','pilgrimJournal','itemContext','enemyInspectCard','atlasPanel','keyHelp','lorePanel'].some(id=>{const n=document.getElementById(id);return n&&!n.hidden;});}
function presentLocalPrediction(){
 if(document.hidden||!initialized(latest)||!sample())return;
 window.GulchFrameBudget?.activate();
 notifyCamera();paintLayers(true);paintAttack(performance.now());syncHero();wake();
}
function recenterOnRapidInput(event){
 const key=event.key.length===1?event.key.toLowerCase():event.key;
 if(!vectors[key]||event.isComposing||event.ctrlKey||event.altKey||event.metaKey||typing(event.target))return;
 if(!initialized(latest)||document.hidden||blocked()||latest.player.hp<=0||latest.gameState.gulchPermanentGameOver?.ended)return;
 if(!window.GulchMovementState?.focused)return;
 heldKeys.add(key);
 presentLocalPrediction();refresh();
}
const setMovement=Gulch.setMovement;
Gulch.setMovement=function(dx,dy,interval){
 if(Number.isInteger(dx)&&Number.isInteger(dy)&&Math.abs(dx)<=1&&Math.abs(dy)<=1){
  stickHeld=Boolean(dx||dy)&&!document.hidden&&!blocked()&&Boolean(window.GulchMovementState?.focused);
 }
 const result=setMovement.call(this,dx,dy,interval);
 if(stickHeld){presentLocalPrediction();refresh();}
 return result;
};
window.addEventListener('keyup',event=>{
 const key=event.key.length===1?event.key.toLowerCase():event.key;
 if(heldKeys.delete(key))refresh();
},true);
function clearHeld(){heldKeys.clear();stickHeld=false;}
document.addEventListener('focusin',()=>{if(blocked())clearHeld();});
function hostile(e){return e.id!=='player'&&!e.isPlayer&&!e.playerId&&!e.clientId&&!e.ownerId&&!e.loreSpeaker&&e.itemId==null&&e.faction==='hostile'&&(!Number.isFinite(e.hp)||e.hp>0)&&!/player|item|weapon|armor|armour|equipment|consumable|loot|object|prop/i.test([e.kind,e.type,e.species].join(' '));}
function clearAttack(){attack=null;if(host)delete host.dataset.immediateCombat;paintAttack(performance.now());}
function previewAttack(){
 const m=window.GulchMovementState,now=performance.now();
 if(!initialized(latest)||document.hidden||blocked()||!m?.focused||m.inFlight||latest.player.hp<=0||latest.gameState.gulchPermanentGameOver?.ended||now<attackUntil)return;
 const last=latest.gameState.sword?.lastAttack?.time;
 if(Number.isFinite(last)&&Math.min(350,last+350-Date.now())>0)return;
 const p=latest.player,map=latest.seed.maps.find(v=>v.id===p.map),f=latest.gameState.sword?.facing;
 let facing=f&&Number.isInteger(f.dx)&&Number.isInteger(f.dy)&&Math.abs(f.dx)<=1&&Math.abs(f.dy)<=1&&(f.dx||f.dy)?{dx:f.dx,dy:f.dy}:{dx:0,dy:1};
 const floor=(x,y)=>{const c=map?.ascii[y]?.[x];return Boolean(c)&&!['#','~'].includes(c)&&!['wall','water'].includes(latest.seed.legend[c]?.[0]);};
 const angle=Math.atan2(facing.dy,facing.dx),targets=[];
 for(const e of latest.seed.entities){
  if(!hostile(e)||e.map!==p.map)continue;
  const dx=e.x-p.x,dy=e.y-p.y;
  if(!Number.isInteger(dx)||!Number.isInteger(dy)||Math.max(Math.abs(dx),Math.abs(dy))!==1||!floor(e.x,e.y)||dx&&dy&&(!floor(e.x,p.y)||!floor(p.x,e.y)))continue;
  const delta=Math.abs(Math.atan2(Math.sin(Math.atan2(dy,dx)-angle),Math.cos(Math.atan2(dy,dx)-angle)));
  if(delta<=Math.PI/4+.000001)targets.push({e,dx,dy,delta});
 }
 targets.sort((a,b)=>a.delta-b.delta||String(a.e.id).localeCompare(String(b.e.id)));
 const chosen=targets[0];if(chosen)facing={dx:chosen.dx,dy:chosen.dy};
 attack={born:now,map:p.map,x:p.x,y:p.y,...facing,target:chosen&&latest.lit[chosen.e.y]?.[chosen.e.x]===1?{id:chosen.e.id,...point(chosen.e)}:null};
 attackUntil=now+350;host.dataset.immediateCombat='true';
 paintAttack(now);wake();
}
function paintAttack(now){
 if(!host)return;
 const w=host.clientWidth,h=host.clientHeight,dpr=Math.min(window.devicePixelRatio||1,2),cw=Math.max(1,Math.round(w*dpr)),ch=Math.max(1,Math.round(h*dpr));
 if(attackCanvas.width!==cw||attackCanvas.height!==ch){attackCanvas.width=cw;attackCanvas.height=ch;attackCanvas.style.width=w+'px';attackCanvas.style.height=h+'px';}
 const c=attackCanvas.getContext('2d');if(!c)return;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
 if(!attack)return;
 const t=(now-attack.born)/180;
 if(t>=1||document.hidden||!latest||latest.mapId!==attack.map){attack=null;delete host.dataset.immediateCombat;return;}
 const cam=window.GulchMovementState?.visual||latest.player,ts=Math.max(20,Math.min(64,Number(latest.seed.meta?.tileSize)||32));
 const x=w/2+(attack.x-cam.x)*ts,y=h/2+(attack.y-cam.y)*ts,angle=Math.atan2(attack.dy,attack.dx);
 c.save();c.translate(x,y);c.rotate(angle);c.globalAlpha=(1-t)*.85;
 c.fillStyle='#ffe6ad';c.beginPath();c.arc(0,0,ts*.96,-.67,.67);c.arc(0,0,ts*.62,.67,-.67,true);c.closePath();c.fill();
 c.rotate(reduced.matches?0:-.67+1.34*Math.min(1,t*2));c.strokeStyle='#fff8dc';c.lineWidth=3;c.beginPath();c.moveTo(ts*.3,0);c.lineTo(ts*1.08,0);c.stroke();c.restore();
 const hit=attack.target,entity=hit&&latest.seed.entities.find(e=>e.id===hit.id);
 if(entity&&hostile(entity)&&entity.map===latest.mapId&&latest.lit[entity.y]?.[entity.x]===1){
  const q=entityPosition(entity,now),xx=w/2+(q.x-cam.x)*ts,yy=h/2+(q.y-cam.y)*ts;
  c.save();c.globalAlpha=(1-t)*.45;c.fillStyle='#fff0bd';c.fillRect(xx-ts*.32,yy-ts*.36,ts*.64,ts*.72);
  if(!reduced.matches){c.globalAlpha=1-t;c.fillStyle='#ffe0a0';for(let i=0;i<5;i++){const a=i*Math.PI*2/5,r=ts*(.18+t*.35);c.fillRect(Math.round(xx+Math.cos(a)*r),Math.round(yy+Math.sin(a)*r),2,2);}}
  c.restore();
 }
}
function tick(now){
 frame=null;if(document.hidden||!initialized(latest))return;
 sample();notifyCamera();paintLayers(true);paintAttack(now);syncHero();
 if(cameraMoving()||enemiesMoving(now)||attack)wake();
}
function wake(){if(frame===null&&!document.hidden&&(cameraMoving()||enemiesMoving(performance.now())||attack))frame=request(tick);}
function refresh(){
 if(refreshQueued)return;refreshQueued=true;
 queueMicrotask(()=>{refreshQueued=false;if(document.hidden||!initialized(latest))return;sample();notifyCamera();paintLayers(true);paintAttack(performance.now());syncHero();wake();});
}
register('camera-interpolation',{snapshot(s){
 if(!initialized(s)){clearHeld();latest=null;current=null;target=null;origin=null;tracks.clear();clearAttack();stop();return;}
 const old=latest,reset=!old||old.revision!==s.revision||epoch(old)!==epoch(s)||old.mapId!==s.mapId||s.player.hp<=0||s.gameState.gulchPermanentGameOver?.ended;
 latest=s;updateTracks(s,reset);
 if(reset){
  clearHeld();attackUntil=0;
  predictionReset=true;
  try{const q=source();if(q)snap(q);}finally{predictionReset=false;}
  clearAttack();
 }
 else if(attack&&s.gameState.sword?.lastAttack?.id!==old.gameState.sword?.lastAttack?.id)clearAttack();
 sample();refresh();
},resize(){sample();refresh();}});
Gulch.register=function(name,callbacks){
 if(!callbacks||typeof callbacks!=='object')return register(name,callbacks);
 if(!names.has(name)||typeof callbacks.resize!=='function')return register(name,callbacks);
 const entry={latest:null,callbacks};layers.set(name,entry);
 const wrapped={...callbacks,resize(){
  if(!matching(entry.latest)||document.hidden)return;
  sample();
  try{return callbacks.resize.apply(callbacks,arguments);}finally{if(name==='renderer')paintLayers(false);syncHero();}
 }};
 if(typeof callbacks.snapshot==='function')wrapped.snapshot=function(s){
  entry.latest=null;if(!initialized(s))return;
  const result=callbacks.snapshot.apply(callbacks,arguments);entry.latest=s;
  syncHero();if(name==='renderer')refresh();return result;
 };
 return register(name,wrapped);
};
function installSprite(){
 const api=window.GulchCaveEnemies;if(spriteInstalled||typeof api?.sprite!=='function')return;spriteInstalled=true;
 window.GulchCaveEnemies=Object.freeze({...api,sprite(ctx,e,x,y,ts,alpha){
  const worldCanvas=ctx.canvas.parentElement===host&&ctx.canvas.getAttribute('aria-hidden')==='true';
  if(!worldCanvas||!latest||e.map!==latest.mapId||!animatedEntity(e))return api.sprite.apply(this,arguments);
  const q=entityPosition(e),tile=Math.max(20,Math.min(64,Number(latest.seed.meta?.tileSize)||32));
  return api.sprite.call(this,ctx,e,x+(q.x-e.x)*tile,y+(q.y-e.y)*tile,ts,alpha);
 }});
}
window.addEventListener('keydown',recenterOnRapidInput,true);
window.addEventListener('keydown',e=>{if((e.code==='Space'||e.key===' ')&&!e.repeat&&!e.defaultPrevented&&!e.isComposing&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&!typing(e.target))previewAttack();},true);
document.addEventListener('click',e=>{const b=e.target instanceof Element?e.target.closest('#swordControls button'):null;if(b&&!b.disabled&&b===document.querySelector('#swordControls button'))previewAttack();},true);
window.addEventListener('message',e=>{if(e.source!==parent)return;const m=e.data;if(m?.type==='gulch:action'&&m.action?.type==='attack'&&(!m.action.scope||m.action.scope==='gameplay'))previewAttack();if(m?.type==='gulch:focus'&&m.granted===false){clearHeld();clearAttack();}if(m?.type==='gulch:commit-result'&&(m.ok===false||m.outcome==='rejected'))clearAttack();},true);
window.addEventListener('gulch:local-camera',()=>{if(notifying||document.hidden||!initialized(latest))return;sample();paintLayers(true);paintAttack(performance.now());syncHero();wake();});
// Runtime retirement lets the prediction queue reconcile and replay first.
// Resample afterward instead of treating an unrelated rejection as our failure.
window.addEventListener('gulch:recovered',()=>queueMicrotask(refresh));
function resetMotion(){clearHeld();stop();tracks.clear();if(latest)updateTracks(latest,true);clearAttack();}
window.addEventListener('resize',refresh);
window.addEventListener('blur',()=>{resetMotion();refresh();});
document.addEventListener('visibilitychange',()=>{resetMotion();if(!document.hidden)refresh();});
reduced.addEventListener('change',()=>{resetMotion();sample();refresh();});
window.addEventListener('pagehide',resetMotion);window.addEventListener('pageshow',refresh);
if(document.readyState==='complete')installSprite();else window.addEventListener('load',installSprite,{once:true});
window.GulchCameraSmoothing=Object.freeze({camera,entityPosition,previewAttack,report(){return {available:Boolean(rawCamera),sourceKind:lastSourceKind,animating:cameraMoving(),enemyAnimating:enemiesMoving(performance.now()),enemyTracks:tracks.size,attackPreview:Boolean(attack),durationMs:DURATION,enemyDurationMs:ENEMY_DURATION,queueSnapTiles:MAX_GLIDE,heldMovement:heldMovement(),instantPresentation:reduced.matches,reducedMotion:reduced.matches,position:current?point(current):null,target:target?point(target):null};}});
})();
