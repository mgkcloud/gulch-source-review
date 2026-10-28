(function(){
'use strict';
const host=document.getElementById('left');if(!host)return;
const canvas=document.createElement('canvas');canvas.id='confirmedHitFeedback';canvas.setAttribute('aria-hidden','true');canvas.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:4';host.append(canvas);
const announcement=document.createElement('div');announcement.setAttribute('role','status');announcement.setAttribute('aria-live','polite');announcement.style.cssText='position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);pointer-events:none';host.append(announcement);
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
let latest=null,previous=null,marks=[],hurtUntil=0,frame=0;
const epoch=s=>String(s.gameState.respawnSettings?.token||'original');
function enemy(e){return e&&e.id!=='player'&&e.faction==='hostile'&&!e.isPlayer&&!e.playerId&&!e.ownerId&&!e.clientId&&!e.loreSpeaker&&!e.ecosystemLoot&&e.itemId==null&&!/item|weapon|armor|loot|prop|resource/i.test(e.kind||'');}
function add(e,text,player,now){marks.push({map:e.map,x:e.x,y:e.y,text,player,born:now});marks=marks.slice(-24);}
function paint(now){
 const w=host.clientWidth,h=host.clientHeight,dpr=Math.min(window.devicePixelRatio||1,2),cw=Math.max(1,Math.round(w*dpr)),ch=Math.max(1,Math.round(h*dpr));
 if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;canvas.style.width=w+'px';canvas.style.height=h+'px';}
 const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
 marks=marks.filter(m=>now-m.born<850);
 if(!latest)return;
 const p=latest.player,v=window.GulchMovementState?.visual,camera=v?.map===p.map?v:p,ts=Math.max(20,Math.min(64,Number(latest.seed.meta?.tileSize)||32));
 if(now<hurtUntil){
  const alpha=Math.min(1,(hurtUntil-now)/300);c.save();c.globalAlpha=alpha;
  const g=c.createRadialGradient(w/2,h/2,Math.min(w,h)*.28,w/2,h/2,Math.max(w,h)*.62);g.addColorStop(0,'#bb302000');g.addColorStop(1,'#c53a3588');c.fillStyle=g;c.fillRect(0,0,w,h);
  c.strokeStyle='#f07168';c.lineWidth=3;c.strokeRect(2,2,w-4,h-4);c.restore();
 }
 const stacks=new Map();
 for(const m of marks){
  if(m.map!==p.map||(!m.player&&latest.lit[m.y]?.[m.x]!==1))continue;
  const age=now-m.born,t=age/850,key=m.x+','+m.y,stack=stacks.get(key)||0;stacks.set(key,stack+1);
  const point=m.player?camera:m,x=w/2+(point.x-camera.x)*ts,y=h/2+(point.y-camera.y)*ts;
  c.save();
  if(age<200){c.globalAlpha=(1-age/200)*.6;c.fillStyle=m.player?'#ff776c':'#fff2b5';c.fillRect(x-ts*.35,y-ts*.4,ts*.7,ts*.8);}
  c.globalAlpha=Math.min(1,(1-t)*3);c.font='bold 14px monospace';c.textAlign='center';c.textBaseline='bottom';c.lineJoin='round';c.lineWidth=4;
  const yy=y-ts*.55-stack*18-(reduced.matches?0:t*25);
  c.strokeStyle='#0b141b';c.strokeText(m.text,x,yy);c.fillStyle=m.player?'#ffa197':'#ffe5a0';c.fillText(m.text,x,yy);c.restore();
 }
}
function tick(now){frame=0;if(document.hidden)return;paint(now);if(marks.length||now<hurtUntil)frame=requestAnimationFrame(tick);}
function wake(){if(!document.hidden&&!frame){window.GulchFrameBudget?.activate();frame=requestAnimationFrame(tick);}}
function reset(){marks=[];hurtUntil=0;if(frame)cancelAnimationFrame(frame);frame=0;}
Gulch.register('confirmed-hit-feedback',{snapshot(s){
 const old=previous;previous=s;latest=s;
 if(!old||epoch(old)!==epoch(s)||old.mapId!==s.mapId||old.revision!==s.revision){reset();paint(performance.now());return;}
 if(old.stateRevision===s.stateRevision)return;
 const now=performance.now(),messages=[];
 const loss=Number(old.player.hp)-Number(s.player.hp);
 if(Number.isFinite(loss)&&loss>0){add(s.player,'−'+Math.round(loss*100)/100+' HP',true,now);hurtUntil=now+(reduced.matches?300:450);messages.push('You lost '+Math.round(loss*100)/100+' health.');}
 if(Number(s.turn)>Number(old.turn)){
  const after=new Map(s.seed.entities.map(e=>[e.id,e]));
  for(const e of old.seed.entities){
   if(!enemy(e)||e.map!==s.mapId||old.lit[e.y]?.[e.x]!==1)continue;
   const next=after.get(e.id);
   if(!next&&Number.isFinite(e.hp)&&e.hp>0){add(e,'DEFEATED',false,now);messages.push((e.name||'Enemy')+' defeated.');continue;}
   if(!next||!Number.isFinite(next.hp))continue;
   const before=Number.isFinite(e.hp)?e.hp:4,damage=before-next.hp;
   if(damage>0){add(next,next.hp<=0?'DEFEATED':'−'+Math.round(damage*100)/100,false,now);messages.push((e.name||'Enemy')+' lost '+Math.round(damage*100)/100+' health.');}
  }
 }
 if(messages.length){announcement.textContent=messages.slice(0,6).join(' ');wake();}
 else if(marks.length)wake();
},resize(){paint(performance.now());}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){reset();paint(performance.now());}else paint(performance.now());});
})();
