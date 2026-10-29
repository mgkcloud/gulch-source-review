(function(){
'use strict';
const host=document.getElementById('left');
if(!host)return;
const STEP=100;
let latest=null,active=false,timer=null,due=0,context='',previous=null,waiting=null,steps=0,lastStep=0;
let visited=new Set(),seen=new Set(),ignored=new Set(),plan=[],heading={dx:0,dy:1},goal=null;
const key=(x,y)=>x+','+y;
const epoch=s=>String(s.gameState.respawnSettings?.token||'original');
const button=document.createElement('button');button.type='button';button.id='autoExploreToggle';button.textContent='Explore [Shift]';button.setAttribute('aria-pressed','false');button.setAttribute('aria-keyshortcuts','Shift');
const status=document.createElement('span');status.id='autoExploreStatus';status.setAttribute('role','status');
const box=document.createElement('div');box.id='autoExploreControls';box.append(button,status);host.append(box);
const style=document.createElement('style');style.textContent='#autoExploreControls{position:absolute;left:12px;bottom:145px;z-index:6;max-width:min(290px,calc(100% - 24px));font:11px/1.5 monospace}#autoExploreToggle{min-height:42px;padding:8px 12px;background:#16332e;color:#f0dfac;border:1px solid #819777;border-radius:5px;font:inherit}#autoExploreToggle[aria-pressed=true]{background:#465c36;border-color:#eed49c}#autoExploreToggle:focus-visible{outline:2px solid #ffe2a0;outline-offset:3px}#autoExploreStatus{display:block;margin-top:4px;padding:3px 6px;background:#102329e8;color:#d9e4ce;pointer-events:none}#autoExploreStatus:empty{display:none}@media(max-width:700px){#autoExploreControls{left:8px;bottom:132px;max-width:180px}}';document.head.append(style);
function typing(n){return n instanceof HTMLElement&&(n.matches('input,textarea,select')||n.isContentEditable);}
function blocked(){return typing(document.activeElement)||host.inert||Boolean(document.querySelector('dialog[open]'))||['inventoryPanel','characterPanel','questBoard','workBoard','livingPanel','respawnScreen','interfaceMenu','tradePanel','travelMapPanel','pilgrimJournal','itemContext','enemyInspectCard','keyHelp','lorePanel'].some(id=>{const n=document.getElementById(id);return n&&!n.hidden;});}
function danger(){return latest.seed.entities.some(e=>e.id!=='player'&&e.map===latest.mapId&&e.faction==='hostile'&&!e.practiceTarget&&!e.isPlayer&&!e.playerId&&!e.clientId&&!e.ownerId&&!e.ecosystemLoot&&e.itemId==null&&(e.hp==null||Number(e.hp)>0)&&latest.lit[e.y]?.[e.x]===1);}
function stop(text){active=false;clearTimeout(timer);timer=null;due=0;waiting=null;plan=[];goal=null;button.textContent='Explore [Shift]';button.setAttribute('aria-pressed','false');status.textContent=text||'Exploration stopped.';}
function schedule(delay=0){
 if(!active)return;
 const next=performance.now()+Math.max(0,delay);
 if(timer!==null&&due<=next)return;
 clearTimeout(timer);due=next;
 timer=setTimeout(()=>{timer=null;due=0;tick();},Math.max(0,next-performance.now()));
}
function observe(){
 if(!latest)return;
 const next=latest.revision+':'+epoch(latest)+':'+latest.mapId;
 if(next!==context){context=next;visited=new Set();seen=new Set();ignored=new Set();plan=[];goal=null;}
 const map=latest.seed.maps.find(m=>m.id===latest.mapId);
 for(let y=0;y<(map?.ascii.length||0);y++)for(let x=0;x<map.ascii[y].length;x++)if(latest.lit[y]?.[x]===1)seen.add(key(x,y));
 visited.add(key(latest.player.x,latest.player.y));
}
function safe(map,x,y){
 const c=map.ascii[y]?.[x];
 return Boolean(c)&&!['#','~','>'].includes(c)&&!['wall','water'].includes(latest.seed.legend[c]?.[0])&&!map.exits?.some(q=>q.x===x&&q.y===y)&&!map.groundHazards?.cells?.some(q=>q.x===x&&q.y===y)&&!map.sinkingGround?.cells?.some(q=>q.x===x&&q.y===y)&&!map.dynamicRegion?.sites?.some(q=>q.kind==='trap'&&!q.spent&&q.x===x&&q.y===y);
}
function collectible(e){
 if(e.id==='player'||e.map!==latest.mapId||ignored.has(e.id)||latest.lit[e.y]?.[e.x]!==1)return false;
 if(e.swordQuestLandmark||e.kind==='quest-relic')return false;
 return Boolean(e.ecosystemLoot||e.outsideResource||e.livingResource||e.regionFood||e.itemId!=null||/^(item|weapon|armor|armour|consumable|material|relic)$/.test(e.kind||''));
}
function route(){
 const p=latest.player,map=latest.seed.maps.find(m=>m.id===p.map);if(!map)return null;
 const occupied=new Set(latest.seed.entities.filter(e=>e.id!=='player'&&e.map===p.map).map(e=>key(e.x,e.y)));
 const pass=(x,y)=>seen.has(key(x,y))&&!occupied.has(key(x,y))&&safe(map,x,y);
 while(plan.length&&plan[0].x===p.x&&plan[0].y===p.y)plan.shift();
 if(plan.length){
  const next=plan[0],destination=plan[plan.length-1];
  const goalValid=goal?.kind==='loot'?latest.seed.entities.some(e=>e.id===goal.id&&collectible(e)&&Math.abs(e.x-destination.x)+Math.abs(e.y-destination.y)<=1):!visited.has(key(destination.x,destination.y));
  if(goalValid&&Math.abs(next.x-p.x)+Math.abs(next.y-p.y)===1&&plan.every(q=>pass(q.x,q.y)))return {dx:next.x-p.x,dy:next.y-p.y};
  plan=[];goal=null;
 }
 const lootGoals=new Map();
 for(const e of latest.seed.entities.filter(collectible))for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
  const x=e.x+dx,y=e.y+dy;if(pass(x,y))lootGoals.set(key(x,y),e.id);
 }
 const directions=[[heading.dx,heading.dy],[-heading.dy,heading.dx],[heading.dy,-heading.dx],[-heading.dx,-heading.dy]];
 const queue=[{x:p.x,y:p.y,parent:-1}],checked=new Set([key(p.x,p.y)]);
 let destination=-1,explore=-1,lootId=null;
 for(let i=0;i<queue.length&&i<20000;i++){
  const q=queue[i],k=key(q.x,q.y);
  if(i>0&&lootGoals.has(k)){destination=i;lootId=lootGoals.get(k);break;}
  if(i>0&&!visited.has(k)&&explore<0)explore=i;
  for(const [dx,dy] of directions){
   const x=q.x+dx,y=q.y+dy,n=key(x,y);
   if(checked.has(n)||!pass(x,y))continue;
   checked.add(n);queue.push({x,y,parent:i});
  }
 }
 if(destination<0)destination=explore;
 if(destination<0)return null;
 const path=[];
 for(let i=destination;i>0;i=queue[i].parent)path.push({x:queue[i].x,y:queue[i].y});
 plan=path.reverse();goal=lootId?{kind:'loot',id:lootId}:{kind:'explore'};
 const next=plan[0];return next?{dx:next.x-p.x,dy:next.y-p.y}:null;
}
function tick(){
 if(!active||!latest)return;
 const movement=window.GulchMovementState;
 if(document.hidden||!movement?.focused||blocked())return stop('Paused: focus changed or a menu opened.');
 if(latest.player.hp<=0||latest.gameState.gulchPermanentGameOver?.ended)return stop('Expedition ended.');
 if(danger())return stop('Enemy spotted — exploration stopped.');
 if(latest.gameState.quicksandEscape?.epoch===epoch(latest))return stop('Unstable ground — take control!');
 if(movement.heldKeys.length)return stop('Manual movement took control.');
 if(movement.inFlight){schedule(100);return;}
 if(waiting){
  const job=waiting;waiting=null;
  if(job.kind==='move'){
   if(latest.player.x===job.x&&latest.player.y===job.y)return stop('Movement was blocked or not confirmed.');
   if(latest.player.x!==job.toX||latest.player.y!==job.toY){plan=[];goal=null;}
  }else{
   const entity=latest.seed.entities.find(e=>e.id===job.id);
   if(entity&&JSON.stringify(entity)===job.before)ignored.add(job.id);
   plan=[];goal=null;
  }
 }
 const delay=lastStep+STEP-performance.now();
 if(delay>0){schedule(delay);return;}
 if(steps>=1200)return stop('Exploration limit reached. Press Shift to continue.');
 const p=latest.player;
 const nearby=latest.seed.entities.filter(e=>collectible(e)&&Math.abs(e.x-p.x)+Math.abs(e.y-p.y)<=1);
 const interact=document.getElementById('interactKeyButton');
 if(nearby.length&&interact&&!interact.disabled){
  waiting={kind:'pickup',id:nearby[0].id,before:JSON.stringify(nearby[0])};
  lastStep=performance.now();steps++;
  status.textContent='Exploring · collecting nearby items';interact.click();schedule(STEP);return;
 }
 const next=route();
 if(!next)return stop('No more reachable unexplored ground or collectible items.');
 const move=document.querySelector('#controls button[data-move="'+next.dx+','+next.dy+'"]');
 if(!move)return stop('Movement control unavailable.');
 heading=next;
 waiting={kind:'move',x:p.x,y:p.y,toX:p.x+next.dx,toY:p.y+next.dy};
 lastStep=performance.now();steps++;status.textContent='Exploring · Shift or any manual action to stop';move.click();schedule(STEP);
}
function toggle(){
 if(active)return stop('Exploration stopped.');
 if(!latest||latest.player.hp<=0)return;
 if(!window.GulchMovementState?.focused||blocked()){status.textContent='Close menus and click the map first.';return;}
 if(window.GulchMovementState.inFlight||window.GulchMovementState.heldKeys.length){status.textContent='Release movement and wait for the current step.';return;}
 if(danger()){status.textContent='Enemy in sight — clear the danger first.';return;}
 const f=latest.gameState.sword?.facing;
 heading=f&&Math.abs(f.dx)+Math.abs(f.dy)===1?{dx:f.dx,dy:f.dy}:{dx:0,dy:1};
 observe();active=true;steps=0;lastStep=-Infinity;waiting=null;plan=[];goal=null;ignored.clear();button.textContent='Stop exploring [Shift]';button.setAttribute('aria-pressed','true');schedule();
}
button.addEventListener('click',toggle);
window.addEventListener('keydown',event=>{
 if(event.key==='Shift'&&!event.repeat&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&!event.isComposing&&!typing(event.target)){
  if(active){event.preventDefault();stop('Exploration stopped.');}
  else if(window.GulchMovementState?.focused&&!blocked()){event.preventDefault();toggle();}
  return;
 }
 if(active&&!['Shift','Control','Alt','Meta'].includes(event.key))stop('Manual input took control.');
},true);
document.addEventListener('pointerdown',event=>{if(active&&!button.contains(event.target))stop('Manual input took control.');},true);
window.addEventListener('blur',()=>{if(active)stop('Exploration paused: game lost focus.');});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&active)stop('Exploration paused while hidden.');});
window.addEventListener('message',event=>{if(event.source===parent&&active&&(event.data?.type==='gulch:action'||event.data?.type==='gulch:focus'&&event.data.granted===false))stop('Manual input or focus change stopped exploration.');},true);
window.addEventListener('gulch:recovered',()=>{if(active)schedule();});
Gulch.register('shift-auto-explore',{snapshot(s){
 const old=previous;previous=s;latest=s;
 if(active&&old){
  if(old.revision!==s.revision||epoch(old)!==epoch(s)||old.mapId!==s.mapId)stop('Region changed — press Shift to explore here.');
  else if(Number(s.player.hp)<Number(old.player.hp))stop('Damage taken — exploration stopped.');
 }
 observe();button.disabled=s.player.hp<=0;
 if(active&&danger())stop('Enemy spotted — exploration stopped.');
 else if(active)schedule();
}});
new MutationObserver(()=>{if(active&&blocked())stop('Exploration paused: a menu opened.');}).observe(host,{subtree:true,attributes:true,attributeFilter:['hidden','inert']});
window.addEventListener('load',()=>{
 const help=document.getElementById('keyHelp');if(!help)return;
 const text=document.createElement('p');text.textContent='Shift — toggle auto-explore. Follows a stable route, preferring the current direction when paths are equally short. Each step checks for obstacles and waits for room confirmation, then continues without an extra fixed pause. Collects ordinary nearby items through E. Stops on visible enemies, damage, manual input, menus or region changes. Avoids known hazards and exits; unknown dangers can still be revealed. Both players control the same adventurer.';help.append(text);
},{once:true});
})();
