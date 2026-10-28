(function(){
'use strict';
const host=document.getElementById('left');
if(!host)return;
let latest=null,context='',spriteInstalled=false,heroPosition=null,resetHero=true;
let attackUntil=0,attackTimer=null,audio=null,voice=null,voiceToken=0;
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
const epoch=s=>String(s?.gameState?.respawnSettings?.token||'original');
const style=document.createElement('style');
style.textContent=`
#localFeedbackHero{position:absolute;left:0;top:0;width:128px;height:128px;pointer-events:none;z-index:3;image-rendering:pixelated;transition:transform 0.08s linear;will-change:transform}
#localAttackFeedback{position:absolute;left:0;top:0;width:128px;height:128px;pointer-events:none;z-index:4;image-rendering:pixelated}
#localFeedbackHero[hidden],#localAttackFeedback[hidden]{display:none!important}
#localAttackFeedback.local-attack-flash{animation:local-attack-flash 180ms ease-out both}
@keyframes local-attack-flash{0%{opacity:1;filter:brightness(1.8)}40%{opacity:.8;filter:brightness(1.2)}100%{opacity:0;filter:brightness(1)}}
@media(prefers-reduced-motion:reduce){#localFeedbackHero{transition:none!important}#localAttackFeedback.local-attack-flash{animation:none;opacity:.7}}
`;
document.head.append(style);
function layer(id){const n=document.createElement('canvas');n.id=id;n.width=n.height=128;n.hidden=true;n.setAttribute('aria-hidden','true');host.append(n);return n;}
const hero=layer('localFeedbackHero'),attack=layer('localAttackFeedback');
const dialogs=['inventoryPanel','workBoard','characterPanel','questBoard','livingPanel','respawnScreen','interfaceMenu','tradePanel','travelMapPanel','pilgrimJournal','itemContext','enemyInspectCard','atlasPanel','keyHelp','lorePanel'];
function typing(n){return n instanceof HTMLElement&&(n.matches('input,textarea,select')||n.isContentEditable);}
function blocked(){return document.hidden||host.inert||Boolean(document.querySelector('dialog[open]'))||dialogs.some(id=>{const n=document.getElementById(id);return n&&!n.hidden;})||typing(document.activeElement);}
function alive(){return latest&&latest.player.hp>0&&!latest.gameState.gulchPermanentGameOver?.ended;}
function stopSound(){voiceToken++;if(voice){try{voice.stop();}catch(error){}voice=null;}}
function clearAttack(){clearTimeout(attackTimer);attackTimer=null;attack.hidden=true;attack.classList.remove('local-attack-flash');stopSound();}
function reset(){resetHero=true;heroPosition=null;hero.hidden=true;attackUntil=0;clearAttack();}
function sound(){
 const token=++voiceToken;
 try{
  const Audio=window.AudioContext||window.webkitAudioContext;
  if(!Audio)return;
  if(!audio)audio=new Audio();
  function play(){
   if(token!==voiceToken||document.hidden||!alive()||audio.state!=='running')return;
   if(voice){try{voice.stop();}catch(error){}}
   const oscillator=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime;
   oscillator.type='triangle';oscillator.frequency.setValueAtTime(560,now);oscillator.frequency.exponentialRampToValueAtTime(110,now+.09);
   gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.035,now+.008);gain.gain.exponentialRampToValueAtTime(.0001,now+.1);
   oscillator.connect(gain);gain.connect(audio.destination);voice=oscillator;
   oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();if(voice===oscillator)voice=null;};
   oscillator.start(now);oscillator.stop(now+.11);
  }
  if(audio.state==='suspended')audio.resume().then(play).catch(()=>{});else play();
 }catch(error){}
}
function installSprite(){
 if(spriteInstalled||typeof window.GulchPlayerSprite!=='function')return;
 spriteInstalled=true;
 const base=window.GulchPlayerSprite;
 window.GulchPlayerSprite=function(ctx,p,x,y,size){
  if(ctx.canvas.id!=='predictedAdventurer')return base.apply(this,arguments);
  if(!alive()||document.hidden){hero.hidden=true;return base.apply(this,arguments);}
  const c=hero.getContext('2d');
  if(!c)return base.apply(this,arguments);
  c.clearRect(0,0,128,128);c.imageSmoothingEnabled=false;
  c.fillStyle='rgba(0,0,0,.45)';c.beginPath();c.ellipse(64,64+size*.3,size*.29,size*.11,0,0,Math.PI*2);c.fill();
  c.fillStyle='rgba(244,205,137,.09)';c.fillRect(64-size/2+1,64-size/2+1,size-2,size-2);
  c.strokeStyle=window.GulchLocalMovementQueue?.report().inFlight?'#99c9c0':'#d1af73';c.lineWidth=1;c.strokeRect(64-size/2+2.5,64-size/2+2.5,size-5,size-5);
  try{base.call(this,c,p,64,64,size);}catch(error){hero.hidden=true;ctx.canvas.style.visibility='';return base.apply(this,arguments);}
  const next={x:x-64,y:y-64};
  const jump=heroPosition&&Math.hypot(next.x-heroPosition.x,next.y-heroPosition.y)>size*2;
  if(resetHero||jump||hero.hidden||reduced.matches){
   hero.style.transition='none';hero.style.transform='translate('+next.x+'px,'+next.y+'px)';hero.hidden=false;
   void hero.offsetWidth;
   hero.style.transition=reduced.matches?'none':'transform 0.08s linear';resetHero=false;
  }else hero.style.transform='translate('+next.x+'px,'+next.y+'px)';
  heroPosition=next;hero.hidden=false;
  // The original prediction canvas still drives positions and reconciliation.
  // Hide it only after a replacement sprite has successfully been painted.
  ctx.canvas.style.visibility='hidden';
 };
}
function hostile(e){return e.id!=='player'&&!e.isPlayer&&!e.playerId&&!e.clientId&&!e.ownerId&&!e.loreSpeaker&&e.itemId==null&&e.faction==='hostile'&&(!Number.isFinite(e.hp)||e.hp>0)&&!/player|item|weapon|armor|armour|equipment|consumable|loot|object|prop/i.test([e.kind,e.type,e.species].join(' '));}
function previewAttack(trusted){
 const state=window.GulchMovementState;
 if(!alive()||blocked()||!state?.focused||state.inFlight)return;
 const now=performance.now(),last=latest.gameState.sword?.lastAttack?.time;
 if(now<attackUntil||Number.isFinite(last)&&Math.min(350,last+350-Date.now())>0)return;
 const p=latest.player,map=latest.seed.maps.find(m=>m.id===p.map);
 const supplied=latest.gameState.sword?.facing;
 const f=supplied&&Number.isInteger(supplied.dx)&&Number.isInteger(supplied.dy)&&Math.abs(supplied.dx)<=1&&Math.abs(supplied.dy)<=1&&(supplied.dx||supplied.dy)?supplied:{dx:0,dy:1};
 const floor=(x,y)=>{const ch=map?.ascii[y]?.[x];return Boolean(ch)&&!['#','~'].includes(ch)&&!['wall','water'].includes(latest.seed.legend[ch]?.[0]);};
 const clear=(dx,dy)=>floor(p.x+dx,p.y+dy)&&(!(dx&&dy)||(floor(p.x+dx,p.y)&&floor(p.x,p.y+dy)));
 const angle=Math.atan2(f.dy,f.dx),targets=[];
 for(const e of latest.seed.entities){
  if(!hostile(e)||e.map!==p.map)continue;
  const dx=e.x-p.x,dy=e.y-p.y;
  if(!Number.isInteger(dx)||!Number.isInteger(dy)||Math.max(Math.abs(dx),Math.abs(dy))!==1||!clear(dx,dy))continue;
  const delta=Math.abs(Math.atan2(Math.sin(Math.atan2(dy,dx)-angle),Math.cos(Math.atan2(dy,dx)-angle)));
  if(delta<=Math.PI/4+.000001)targets.push({e,dx,dy,delta});
 }
 targets.sort((a,b)=>a.delta-b.delta||String(a.e.id).localeCompare(String(b.e.id)));
 const chosen=targets[0],dx=chosen?.dx??f.dx,dy=chosen?.dy??f.dy;
 const ts=Math.max(20,Math.min(64,Number(latest.seed.meta?.tileSize)||32));
 const v=state.visual,cam=v?.map===p.map?v:p;
 const x=host.clientWidth/2+(p.x+dx-cam.x)*ts,y=host.clientHeight/2+(p.y+dy-cam.y)*ts;
 const c=attack.getContext('2d');if(!c)return;
 clearAttack();attackUntil=now+350;c.clearRect(0,0,128,128);c.imageSmoothingEnabled=false;
 // Enemies are canvas sprites, so flash a short-lived DOM canvas at their tile.
 // This is a swing preview, never a damage number or a predicted death.
 if(chosen&&latest.lit[chosen.e.y]?.[chosen.e.x]===1){
  c.fillStyle='#ffe9b53d';c.fillRect(64-ts*.4,64-ts*.4,ts*.8,ts*.8);
  if(chosen.e.caveEncounter===1&&window.GulchCaveEnemies?.sprite){
   c.save();try{window.GulchCaveEnemies.sprite(c,chosen.e,64,64,Math.min(ts,chosen.e.enemyVariety==='colossus'?32:ts),.8);}finally{c.restore();}
  }
 }
 c.save();c.translate(64,64);c.rotate(Math.atan2(dy,dx));c.strokeStyle='#fff0c4';c.lineWidth=3;c.beginPath();c.arc(-ts*.35,0,ts*.62,-.9,.9);c.stroke();c.restore();
 attack.style.transform='translate('+(x-64)+'px,'+(y-64)+'px)';attack.hidden=false;
 void attack.offsetWidth;attack.classList.add('local-attack-flash');
 attackTimer=setTimeout(()=>{attack.hidden=true;attack.classList.remove('local-attack-flash');attackTimer=null;},180);
 if(trusted)sound();
}
window.addEventListener('keydown',event=>{
 if(event.isComposing||event.ctrlKey||event.altKey||event.metaKey||typing(event.target)||blocked())return;
 if(event.code==='Space'||event.key===' '){if(!event.repeat&&!event.defaultPrevented)previewAttack(event.isTrusted);return;}
 if(/^(?:w|a|s|d|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/i.test(event.key)&&window.GulchMovementState?.focused)window.GulchFrameBudget?.activate();
},true);
document.addEventListener('click',event=>{
 const node=event.target instanceof Element?event.target.closest('#swordControls button'):null;
 if(node&&node===document.querySelector('#swordControls button')&&!node.disabled)previewAttack(event.isTrusted);
},true);
Gulch.register('local-dom-feedback',{snapshot(s){
 const next=s.revision+':'+epoch(s)+':'+s.mapId;
 const old=latest;latest=s;
 if(next!==context||!alive()){context=next;reset();}
 else if(old&&old.stateRevision!==s.stateRevision)clearAttack();
 },resize(){resetHero=true;clearAttack();}});
window.addEventListener('resize',()=>{resetHero=true;clearAttack();});
window.addEventListener('blur',clearAttack);
window.addEventListener('message',event=>{if(event.source===parent&&event.data?.type==='gulch:focus'&&event.data.granted===false)clearAttack();});
document.addEventListener('visibilitychange',()=>{resetHero=true;if(document.hidden){hero.hidden=true;clearAttack();}});
reduced.addEventListener('change',()=>{resetHero=true;clearAttack();});
if(document.readyState==='complete')installSprite();else window.addEventListener('load',installSprite,{once:true});
})();
