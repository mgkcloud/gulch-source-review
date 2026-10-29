(function(){
'use strict';
let snap=null,lastEvent=null,effect=null,localUntil=0,frameId=0,wakeTimer=null,scheduled=false;
const COOLDOWN=350,DURATION=240,LIMIT=16;
const queue=[];
const host=document.getElementById('left');
const epoch=s=>String(s?.gameState?.respawnSettings?.token||'original');
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
const style=document.createElement('style');style.textContent='#swordControls{position:absolute;right:18px;bottom:204px;z-index:4;display:flex;flex-direction:column;align-items:flex-end;gap:6px;max-width:210px}#swordControls button{min-height:48px;padding:10px 14px;border:1px solid #ad9867;border-radius:6px;background:#20352e;color:#ffe1a3;font:12px monospace;touch-action:manipulation}#swordControls button:disabled{opacity:.5}#swordControls button[hidden]{display:none}#swordStatus{font:10px/1.4 monospace;color:#ded9b9;text-align:right;background:#09191dcc;border-radius:4px;padding:3px 6px}#swordEffect{position:absolute;inset:0;pointer-events:none;z-index:4}#attackBufferNotice{position:absolute;right:18px;bottom:170px;z-index:5;max-width:260px;padding:4px 7px;background:#102329ed;color:#ffe1a3;font:11px/1.5 monospace;pointer-events:none}#attackBufferNotice:empty{display:none}@media(max-width:700px){#swordControls{right:10px;bottom:184px;max-width:180px}#attackBufferNotice{right:10px;bottom:150px}}';document.head.append(style);
const canvas=document.createElement('canvas');canvas.id='swordEffect';canvas.setAttribute('aria-hidden','true');
const controls=document.createElement('div');controls.id='swordControls';
const attack=document.createElement('button');attack.type='button';attack.textContent='⚔ Attack [Space]';attack.setAttribute('aria-label','Attack or queue a sword attack during movement');
const dummy=document.createElement('button');dummy.type='button';dummy.textContent='Place training dummy';dummy.hidden=true;
const status=document.createElement('span');status.id='swordStatus';status.setAttribute('role','status');
const notice=document.createElement('div');notice.id='attackBufferNotice';notice.setAttribute('role','status');
controls.append(attack,dummy,status);host.append(canvas,controls,notice);
function typing(n){return n instanceof HTMLElement&&(n.matches('input,textarea,select')||n.isContentEditable);}
function blocked(){return document.hidden||host.inert||Boolean(document.querySelector('dialog[open]'))||['inventoryPanel','workBoard','characterPanel','questBoard','livingPanel','respawnScreen','interfaceMenu','tradePanel','travelMapPanel','pilgrimJournal','itemContext','enemyInspectCard','atlasPanel','keyHelp','lorePanel'].some(id=>{const p=document.getElementById(id);return p&&!p.hidden;})||typing(document.activeElement);}
function usable(){return Boolean(snap&&snap.player.hp>0&&!snap.gameState.gulchPermanentGameOver?.ended&&window.GulchMovementState?.focused&&!blocked());}
function allowed(){return usable()&&!window.GulchMovementState.inFlight;}
function target(e){
 const kind=[e.kind,e.type,e.species].filter(v=>typeof v==='string').join(' ');
 return e.id!=='player'&&!e.isPlayer&&!e.playerId&&!e.clientId&&!e.ownerId&&!e.loreSpeaker&&e.faction==='hostile'&&!/player|item|weapon|armor|armour|equipment|consumable|loot|object|prop/i.test(kind)&&e.itemId==null&&(!Number.isFinite(e.hp)||e.hp>0);
}
function direction(){const f=snap?.gameState?.sword?.facing;return f&&Number.isInteger(f.dx)&&Number.isInteger(f.dy)&&Math.abs(f.dx)<=1&&Math.abs(f.dy)<=1&&(f.dx||f.dy)?{dx:f.dx,dy:f.dy}:{dx:0,dy:1};}
function floor(map,x,y){const ch=map?.ascii[y]?.[x];return Boolean(ch)&&!['#','~'].includes(ch)&&!['wall','water'].includes(snap.seed.legend[ch]?.[0]);}
function clear(map,p,f){return floor(map,p.x+f.dx,p.y+f.dy)&&(!(f.dx&&f.dy)||(floor(map,p.x+f.dx,p.y)&&floor(map,p.x,p.y+f.dy)));}
function aim(map,p,facing=direction()){
 const angle=Math.atan2(facing.dy,facing.dx),candidates=[];
 for(const e of snap.seed.entities){
  if(!target(e)||e.map!==p.map)continue;
  const dx=e.x-p.x,dy=e.y-p.y;
  if(!Number.isInteger(dx)||!Number.isInteger(dy)||Math.max(Math.abs(dx),Math.abs(dy))!==1)continue;
  const delta=Math.atan2(Math.sin(Math.atan2(dy,dx)-angle),Math.cos(Math.atan2(dy,dx)-angle));
  if(Math.abs(delta)>Math.PI/4+.000001||!clear(map,p,{dx,dy}))continue;
  candidates.push({dx,dy,turn:Math.abs(delta),id:String(e.id)});
 }
 candidates.sort((a,b)=>a.turn-b.turn||a.id.localeCompare(b.id));
 const chosen=candidates[0];return chosen?{dx:chosen.dx,dy:chosen.dy}:facing;
}
function remaining(){const time=snap?.gameState?.sword?.lastAttack?.time;return Math.max(0,localUntil-performance.now(),Number.isFinite(time)?Math.min(COOLDOWN,time+COOLDOWN-Date.now()):0);}
function cancelBuffer(reason){
 const had=queue.length;queue.length=0;clearTimeout(wakeTimer);wakeTimer=null;effect=null;
 if(had)notice.textContent=reason+' '+had+' unsent attack'+(had===1?'':'s')+' cancelled.';
}
function preview(){
 const actual=snap.player,q=window.GulchLocalMovementQueue?.camera?.();
 const valid=q&&q.source===snap.revision&&q.base===snap.stateRevision&&q.epoch===epoch(snap)&&q.map===actual.map&&Number.isInteger(q.x)&&Number.isInteger(q.y);
 const p=valid?q:actual,map=snap.seed.maps.find(m=>m.id===p.map);
 let facing=direction();
 if(valid&&(p.x!==actual.x||p.y!==actual.y))facing={dx:Math.sign(p.x-actual.x),dy:Math.sign(p.y-actual.y)};
 const f=aim(map,p,facing),hits=clear(map,p,f)?snap.seed.entities.filter(e=>target(e)&&e.map===p.map&&e.x===p.x+f.dx&&e.y===p.y+f.dy&&snap.lit[e.y]?.[e.x]===1).map(e=>({x:e.x,y:e.y})):[];
 effect={start:performance.now(),preview:true,event:{map:p.map,x:p.x,y:p.y,dx:f.dx,dy:f.dy,hits}};
 window.GulchFrameBudget?.activate();paint(performance.now());
}
function requestAttack(){
 if(!usable())return false;
 if(queue.length>=LIMIT){notice.textContent='Attack buffer full (16). This tap was not queued.';return false;}
 queue.push({source:snap.revision,epoch:epoch(snap),map:snap.mapId});
 preview();notice.textContent='Attack queued · '+queue.length+' waiting';flush();return true;
}
function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;flush();});}
function flush(){
 clearTimeout(wakeTimer);wakeTimer=null;
 if(!queue.length||!snap)return;
 if(!usable()){cancelBuffer('Control paused.');return;}
 const first=queue[0];
 if(first.source!==snap.revision||first.epoch!==epoch(snap)||first.map!==snap.mapId){cancelBuffer('Expedition changed.');return;}
 if(window.GulchMovementState.inFlight)return;
 const delay=remaining();
 if(delay>0){wakeTimer=setTimeout(flush,Math.ceil(delay)+1);return;}
 const oldUntil=localUntil;
 swing();
 if(window.GulchMovementState.inFlight){queue.shift();notice.textContent=queue.length?'Attack sent · '+queue.length+' waiting':'';}
 else{localUntil=oldUntil;cancelBuffer('Attack could not be submitted.');}
}
function swing(){
 if(!allowed()||remaining()>0)return;
 const data=snap.gameState,p=snap.player,map=snap.seed.maps.find(m=>m.id===p.map),f=aim(map,p),x=p.x+f.dx,y=p.y+f.dy;
 const hits=clear(map,p,f)?snap.seed.entities.filter(e=>target(e)&&e.map===p.map&&e.x===x&&e.y===y):[],ids=new Set(hits.map(e=>e.id));
 const entities=snap.seed.entities.map(e=>ids.has(e.id)?{...e,hp:Math.max(0,(Number.isFinite(e.hp)?e.hp:4)-2)}:e).filter(e=>!ids.has(e.id)||e.hp>0);
 const event={id:String(snap.stateRevision)+':'+String(Date.now()),time:Date.now(),map:p.map,x:p.x,y:p.y,dx:f.dx,dy:f.dy,hits:hits.map(e=>({id:e.id,x:e.x,y:e.y}))};
 localUntil=performance.now()+COOLDOWN;
 let seed={...snap.seed,entities};
 if(window.GulchCaveEnemies)seed=window.GulchCaveEnemies.advance(seed);
 const hp=seed.entities.find(e=>e.id==='player').hp,damage=Number.isFinite(p.hp)&&Number.isFinite(hp)?p.hp-hp:0;
 Gulch.commit({...data,seed,turn:(Number(data.turn)||0)+1,sword:{...data.sword,facing:f,lastAttack:event}},(hits.length?'Sword slash hits for 2 damage.':'Sword slash.')+(damage>0?' Cave enemies deal '+damage+' damage.':''));
}
function place(){
 if(!allowed()||queue.length)return;
 const data=snap.gameState,seed=snap.seed,p=snap.player;
 if(data.sword?.dummyPlaced||seed.entities.some(target))return;
 const map=seed.maps.find(m=>m.id===p.map),f=direction();
 const open=(x,y)=>floor(map,x,y)&&map.ascii[y][x]!=='>'&&!map.exits?.some(e=>e.x===x&&e.y===y);
 const choices=[f,{dx:0,dy:1},{dx:1,dy:0},{dx:0,dy:-1},{dx:-1,dy:0},{dx:1,dy:1},{dx:-1,dy:1},{dx:1,dy:-1},{dx:-1,dy:-1}];
 const spot=choices.map(d=>({...d,x:p.x+d.dx,y:p.y+d.dy})).find(v=>open(v.x,v.y)&&(!(v.dx&&v.dy)||(open(p.x+v.dx,p.y)&&open(p.x,p.y+v.dy)))&&!seed.entities.some(e=>e.map===p.map&&e.x===v.x&&e.y===v.y));
 if(!spot){notice.textContent='No empty adjacent ground. Move and retry.';return;}
 let id='sword-training-dummy';while(seed.entities.some(e=>e.id===id))id+='-1';
 const e={id,name:'Wooden practice target',kind:'training-dummy',faction:'hostile',map:p.map,x:spot.x,y:spot.y,hp:6,maxHp:6,glyph:'♜',color:'#cc9b63',practiceTarget:true};
 Gulch.commit({...data,seed:{...seed,entities:[...seed.entities,e]},sword:{...data.sword,dummyPlaced:true}},'Placed one harmless wooden practice target.');
}
attack.addEventListener('click',requestAttack);dummy.addEventListener('click',place);
document.addEventListener('keydown',e=>{
 if(e.code!=='Space'&&e.key!==' ')return;
 if(e.ctrlKey||e.altKey||e.metaKey||e.isComposing||typing(e.target)||!usable())return;
 if(e.target instanceof Element&&e.target.closest('button,input,select,textarea,a'))return;
 e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)requestAttack();
},true);
function paint(now){
 const w=host.clientWidth,h=host.clientHeight,dpr=Math.min(devicePixelRatio||1,2),cw=Math.max(1,Math.round(w*dpr)),ch=Math.max(1,Math.round(h*dpr));
 if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;canvas.style.width=w+'px';canvas.style.height=h+'px';}
 const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 if(!snap)return;
 attack.disabled=!usable();
 dummy.hidden=Boolean(snap.gameState.sword?.dummyPlaced)||snap.seed.entities.some(target);dummy.disabled=!allowed()||Boolean(queue.length);
 const p=snap.player,f=direction(),names={'0,1':'south','0,-1':'north','1,0':'east','-1,0':'west','1,1':'southeast','-1,1':'southwest','1,-1':'northeast','-1,-1':'northwest'};
 const text='Facing '+names[f.dx+','+f.dy]+' · '+(queue.length?queue.length+' attacks queued':remaining()>0?'recovering':'sword ready');if(status.textContent!==text)status.textContent=text;
 const ts=Math.max(20,Math.min(64,Number(snap.seed.meta?.tileSize)||32)),visual=window.GulchMovementState?.visual,camera=visual?.map===p.map?visual:p;
 const point=(x,y)=>({x:w/2+(x-camera.x)*ts,y:h/2+(y-camera.y)*ts});
 const center=point(p.x,p.y),angle=Math.atan2(f.dy,f.dx);
 ctx.fillStyle='#f3d69a';ctx.beginPath();ctx.arc(center.x+Math.cos(angle)*ts*.43,center.y+Math.sin(angle)*ts*.43,2,0,Math.PI*2);ctx.fill();
 if(!effect)return;
 const t=(now-effect.start)/DURATION,a=effect.event;
 if(t>=1){effect=null;return;}if(a.map!==snap.mapId)return;
 const origin=point(a.x,a.y),aimAngle=Math.atan2(a.dy,a.dx),sweep=reduced.matches?.5:Math.min(1,t*2);
 ctx.save();ctx.translate(origin.x,origin.y);ctx.rotate(aimAngle);ctx.globalAlpha=1-t;
 ctx.beginPath();ctx.arc(0,0,ts*.96,-.67,.67);ctx.arc(0,0,ts*.57,.67,-.67,true);ctx.closePath();ctx.fillStyle='#ffe3a1';ctx.fill();
 ctx.rotate(-.67+1.34*sweep);ctx.strokeStyle='#fffbed';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(ts*.3,0);ctx.lineTo(ts*1.08,0);ctx.stroke();ctx.restore();
 for(const hit of a.hits){
  if(snap.lit[hit.y]?.[hit.x]!==1)continue;
  const q=point(hit.x,hit.y);ctx.save();ctx.globalAlpha=(1-t)*.8;
  if(t<.65){ctx.fillStyle='#fff5d1';ctx.globalAlpha=(1-t/.65)*.35;ctx.fillRect(q.x-ts*.36,q.y-ts*.4,ts*.72,ts*.8);}
  ctx.globalAlpha=1-t;ctx.fillStyle=effect.preview?'#ffe6ac':'#fff6d9';
  for(let i=0;i<(reduced.matches?3:7);i++){
   const angle=aimAngle+(i-3)*.65,r=ts*(reduced.matches?.25:.12+t*.65);
   ctx.fillRect(Math.round(q.x+Math.cos(angle)*r),Math.round(q.y+Math.sin(angle)*r),2,2);
  }
  ctx.restore();
 }
}
Gulch.register('sword-combat',{snapshot(s){
 const reset=snap&&(snap.revision!==s.revision||epoch(snap)!==epoch(s)||snap.mapId!==s.mapId);
 snap=s;
 if(reset){cancelBuffer('Expedition changed.');lastEvent=null;localUntil=0;}
 if(s.player.hp<=0||s.gameState.gulchPermanentGameOver?.ended)cancelBuffer('Expedition ended.');
 const a=s.gameState.sword?.lastAttack;
 if(a&&a.id!==lastEvent){lastEvent=a.id;if(Number.isFinite(a.time)&&Date.now()-a.time<1500&&Number.isFinite(a.x)&&Number.isFinite(a.y)&&Number.isFinite(a.dx)&&Number.isFinite(a.dy)&&Array.isArray(a.hits))effect={event:a,start:performance.now(),preview:false};}
 schedule();
 },action(a){if(a?.type==='attack')requestAttack();},resize(){paint(performance.now());}});
window.addEventListener('gulch:recovered',schedule);
window.addEventListener('message',event=>{
 if(event.source!==parent)return;
 if(event.data?.type==='gulch:focus'&&event.data.granted===false)cancelBuffer('Focus lost.');
});
window.addEventListener('blur',()=>cancelBuffer('Focus lost.'));
window.addEventListener('keydown',e=>{if(e.key==='Escape')cancelBuffer('Control paused.');},true);
new MutationObserver(()=>{if(queue.length&&blocked())cancelBuffer('Menu opened.');}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['hidden','open','inert']});
function frame(now){frameId=0;if(document.hidden)return;if(queue.length&&!usable())cancelBuffer('Control paused.');paint(now);frameId=requestAnimationFrame(frame);}
frameId=requestAnimationFrame(frame);
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelBuffer('Game hidden.');if(frameId)cancelAnimationFrame(frameId);frameId=0;}else if(!frameId)frameId=requestAnimationFrame(frame);});
window.addEventListener('load',()=>{const help=document.getElementById('keyHelp');if(help){const p=document.createElement('p');p.textContent='Attack: Space or Attack queues up to 16 taps during movement or sword recovery. Swings and sparks appear immediately at your predicted position; they do not confirm damage. Queued attacks resolve from the confirmed position and facing, with the existing 350 ms cooldown and one-step aim assist. Focus loss, menus, death and region/source changes cancel unsent attacks. A full buffer reports an unqueued tap. Confirmed damage and defeat effects remain separate.';help.append(p);}},{once:true});
})();
