(function(){
'use strict';
const baseCommit=Gulch.commit;
let latest=null,lastEvent=null,effect=null;
const epoch=d=>String(d?.respawnSettings?.token||'original');
function hostile(e){return e&&e.id!=='player'&&e.faction==='hostile'&&!e.practiceTarget&&!e.isPlayer&&!e.playerId&&!e.ownerId&&!e.clientId&&!e.loreSpeaker&&!e.itemId&&!e.ecosystemLoot&&!/loot|prop|item|weapon|armor/i.test(String(e.kind||''));}
function clear(seed,map,a,b){
 const floor=(x,y)=>{const c=map?.ascii[y]?.[x];return Boolean(c)&&!['#','~'].includes(c)&&!['wall','water'].includes(seed.legend[c]?.[0]);};
 let x=a.x,y=a.y,dx=Math.abs(b.x-x),dy=-Math.abs(b.y-y),sx=x<b.x?1:-1,sy=y<b.y?1:-1,error=dx+dy;
 for(let i=0;i<32;i++){
  if(x===b.x&&y===b.y)return true;
  const twice=2*error;let nx=x,ny=y;
  if(twice>=dy){error+=dy;nx+=sx;}if(twice<=dx){error+=dx;ny+=sy;}
  if(!floor(nx,ny)||(nx!==x&&ny!==y&&(!floor(nx,y)||!floor(x,ny))))return false;
  x=nx;y=ny;
 }
 return false;
}
Gulch.commit=function(data,activity){
 if(!latest||!data?.seed||epoch(data)!==epoch(latest.gameState)||!(Number(data.turn)>Number(latest.turn))||latest.player.hp<=0)return baseCommit(data,activity);
 const pack=latest.gameState.itemEcosystem,id=pack?.equipment?.weapon,ability=window.GulchSwordMagic?.[id];
 if(!ability||pack.epoch!==epoch(data)||!(Number(pack.bag?.[id])>0))return baseCommit(data,activity);
 const old=latest.gameState.swordMagic;
 const state=old?.epoch===epoch(data)?old:{epoch:epoch(data),ready:{}};
 const turn=Number(data.turn);
 if(Number(state.ready?.[id])>turn)return baseCommit(data,activity);
 const after=new Map(data.seed.entities.map(e=>[e.id,e])),p=latest.player;
 const target=latest.seed.entities.find(e=>hostile(e)&&e.hp>0&&e.map===p.map&&Math.max(Math.abs(e.x-p.x),Math.abs(e.y-p.y))<=1&&(!after.has(e.id)||Number(after.get(e.id).hp)<e.hp));
 if(!target)return baseCommit(data,activity);
 const map=data.seed.maps.find(m=>m.id===target.map);
 if(!clear(data.seed,map,p,target))return baseCommit(data,activity);
 const affected=[];
 const entities=data.seed.entities.map(e=>{
  if(!hostile(e)||!(e.hp>0)||e.map!==target.map)return e;
  const direct=e.id===target.id;
  if(!direct&&(!ability.radius||Math.hypot(e.x-target.x,e.y-target.y)>ability.radius||!clear(data.seed,map,target,e)))return e;
  const before=latest.seed.entities.find(v=>v.id===e.id)||e;
  const damage=ability.damage*(ability.execute&&direct&&Number(before.maxHp)>0&&before.hp<before.maxHp/2?2:1);
  affected.push({x:e.x,y:e.y,damage});return {...e,hp:Math.max(0,e.hp-damage)};
 });
 const player=entities.find(e=>e.id==='player');
 const heal=player&&player.hp>0&&!data.gulchPermanentGameOver?.ended&&Number.isFinite(player.maxHp)?Math.min(ability.heal,Math.max(0,player.maxHp-player.hp)):0;
 const event={id:epoch(data)+':'+latest.stateRevision+':'+id,map:target.map,x:target.x,y:target.y,weapon:id,name:ability.name,color:ability.color,radius:ability.radius,hits:affected,heal,time:Date.now()};
 const next={...data,seed:{...data.seed,entities:heal?entities.map(e=>e.id==='player'?{...e,hp:e.hp+heal}:e):entities},swordMagic:{epoch:epoch(data),ready:{...state.ready,[id]:turn+ability.cooldown},event}};
 return baseCommit(next,(activity||'')+' '+ability.name+'! '+affected.length+' magic target'+(affected.length===1?'':'s')+(heal?' · restored '+heal+' HP':'')+'.');
};
const host=document.getElementById('left');if(!host)return;
const style=document.createElement('style');style.textContent='#swordMagicStatus{position:absolute;right:18px;bottom:266px;z-index:4;max-width:240px;padding:7px 10px;border:1px solid #809c94;border-radius:6px;background:#10252ced;color:#d6f0e4;font:11px/1.5 monospace;pointer-events:none}#swordMagicStatus[hidden]{display:none!important}@media(max-width:700px){#swordMagicStatus{right:10px;bottom:246px;max-width:190px}}';document.head.append(style);
const status=document.createElement('div');status.id='swordMagicStatus';status.hidden=true;status.setAttribute('role','status');
const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');canvas.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:2';host.append(canvas,status);
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
function update(){
 if(!latest)return;
 const pack=latest.gameState.itemEcosystem,id=pack?.equipment?.weapon,a=window.GulchSwordMagic?.[id],token=epoch(latest.gameState),state=latest.gameState.swordMagic;
 status.hidden=!a||pack?.epoch!==token||latest.player.hp<=0||!(pack.bag?.[id]>0);
 if(status.hidden)return;
 const left=state?.epoch===token?Math.max(0,(Number(state.ready?.[id])||0)-(Number(latest.turn)||0)):0;
 status.textContent=a.name+' · '+(left?left+' turn'+(left===1?'':'s')+' to recharge':'ready on next melee hit');
}
function paint(now){
 const w=host.clientWidth,h=host.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
 if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));canvas.style.width=w+'px';canvas.style.height=h+'px';}
 const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 if(!effect||!latest)return;
 const t=(now-effect.start)/700;if(t>=1){effect=null;return;}
 const e=effect.event;if(e.map!==latest.mapId)return;
 const p=latest.player,v=window.GulchMovementState?.visual,camera=v?.map===p.map?v:p,ts=Math.max(20,Math.min(64,Number(latest.seed.meta?.tileSize)||32));
 const x=w/2+(e.x-camera.x)*ts,y=h/2+(e.y-camera.y)*ts;
 ctx.save();ctx.globalAlpha=(1-t)*.8;ctx.strokeStyle=e.color;ctx.fillStyle=e.color;ctx.lineWidth=2;
 const radius=ts*(.5+(reduced.matches?.5:t)*(e.radius+1));
 ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.stroke();
 for(let i=0;i<8;i++){const angle=i*Math.PI/4;ctx.fillRect(x+Math.cos(angle)*radius-2,y+Math.sin(angle)*radius-2,4,4);}
 ctx.font='bold 11px monospace';ctx.textAlign='center';ctx.fillText(e.name,x,y-ts*(1.1+(reduced.matches?0:t*.5)));
 for(const hit of e.hits||[]){if(latest.lit[hit.y]?.[hit.x]!==1)continue;ctx.fillText('−'+hit.damage,w/2+(hit.x-camera.x)*ts,h/2+(hit.y-camera.y)*ts-ts*.3);}
 ctx.restore();
}
Gulch.register('sword-magic',{snapshot(s){
 const reset=latest&&epoch(latest.gameState)!==epoch(s.gameState);latest=s;if(reset)effect=null;
 const event=s.gameState.swordMagic?.event;
 if(event&&event.id!==lastEvent){lastEvent=event.id;if(Date.now()-event.time<2000)effect={event,start:performance.now()};}
 update();paint(performance.now());
},resize(){paint(performance.now());}});
function frame(now){if(!document.hidden&&effect)paint(now);requestAnimationFrame(frame);}requestAnimationFrame(frame);
})();
