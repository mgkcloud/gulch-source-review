(function(){
'use strict';
const host=document.getElementById('left');
if(!host)return;
const canvas=document.createElement('canvas');
canvas.id='combatImpactArt';canvas.setAttribute('aria-hidden','true');
canvas.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:3';host.append(canvas);
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
let latest=null,previous=null,frame=0,last=0;
let pieces=[],stains=[],slashes=[];
const epoch=d=>String(d?.respawnSettings?.token||'original');
function creature(e){
 return e&&e.id!=='player'&&!e.isPlayer&&!e.playerId&&!e.clientId&&!e.ownerId&&!e.practiceTarget&&!e.itemId&&!e.ecosystemLoot&&!e.swordQuestLandmark&&!e.loreSpeaker&&Number.isFinite(e.hp)&&e.hp>0&&(e.faction==='hostile'||e.kind==='animal')&&!/item|loot|prop|weapon|armor|resource/.test(e.kind||'');
}
function tileSize(){return Math.max(20,Math.min(64,Number(latest?.seed.meta?.tileSize)||32));}
function wall(x,y){
 const map=latest?.seed.maps.find(m=>m.id===latest.mapId),c=map?.ascii[Math.round(y)]?.[Math.round(x)];
 return !c||c==='#'||['wall','water'].includes(latest.seed.legend[c]?.[0])||c==='~';
}
function palette(e){
 if(e.enemyVariety==='storm'||e.caveSprite==='wisp')return {body:'#aaa4d6',light:'#e4dcfa',blood:'#a5c9d8',spirit:true};
 if(e.outsideAnimal)return {body:'#b68051',light:'#e8c99b',blood:'#984e48'};
 if(e.dreadBeast)return {body:'#9c5351',light:'#c5a57b',blood:'#a14a43'};
 if(e.caveSprite==='crawler')return {body:'#659b7e',light:'#b1c99a',blood:'#777c49'};
 if(e.caveSprite==='beetle')return {body:'#b08c58',light:'#dfbd7e',blood:'#8a7445'};
 return {body:'#91a476',light:'#c3c998',blood:'#984e48'};
}
function bodyImage(e){
 const art=document.createElement('canvas');art.width=art.height=32;
 const c=art.getContext('2d');c.imageSmoothingEnabled=false;
 if(e.caveEncounter===1&&window.GulchCaveEnemies?.sprite){
  const size=e.enemyVariety==='colossus'?10:e.enemyVariety==='brute'?18:e.dreadBeast?21:26;
  c.save();window.GulchCaveEnemies.sprite(c,e,16,17,size,1);c.restore();
 }else{
  const colors=palette(e),rows=e.kind==='animal'?['..a..a....','..aaaa....','..abaaaa..','...aaaaaa.','....aaaaaa','....a..a..']:['...aaaa...','..abbbaa..','..abbbba..','...aaaa...','..aaaaaa..','.aaaaaaaa.','..aaaaaa..','...a..a...','..aa..aa..'];
  rows.forEach((row,y)=>Array.from(row).forEach((v,x)=>{if(v!=='.'){c.fillStyle=v==='b'?colors.light:colors.body;c.fillRect(5+x*2,5+y*2,2,2);}}));
 }
 return art;
}
function slash(x,y,dx,dy,heavy,color){
 const now=performance.now();
 slashes.push({map:latest.mapId,x,y,angle:Math.atan2(dy,dx),born:now,life:reduced.matches?180:260,heavy,color:color||'#ffe7b0'});
 slashes=slashes.slice(-12);
}
function destroy(e,dx,dy){
 const now=performance.now(),colors=palette(e),art=bodyImage(e),ctx=art.getContext('2d'),pixels=ctx.getImageData(0,0,32,32).data;
 const length=Math.hypot(dx,dy)||1;dx/=length;dy/=length;
 const scale=e.enemyVariety==='colossus'?1.7:e.dreadBeast?1.25:1;
 const candidates=[];
 for(let y=2;y<30;y+=4)for(let x=2;x<30;x+=4){
  let opaque=false;
  for(let yy=y;yy<Math.min(32,y+4)&&!opaque;yy++)for(let xx=x;xx<Math.min(32,x+4);xx++)if(pixels[(yy*32+xx)*4+3]>80){opaque=true;break;}
  if(opaque)candidates.push({x,y});
 }
 const limit=reduced.matches?8:24;
 const stride=Math.max(1,Math.ceil(candidates.length/limit));
 for(let i=0;i<candidates.length;i+=stride){
  const q=candidates[i],side=((q.x-16)*-dy+(q.y-16)*dx)>=0?1:-1;
  const split=.65+Math.random()*.65;
  pieces.push({map:e.map,art,sx:q.x,sy:q.y,x:e.x+(q.x-14)/32*scale,y:e.y+(q.y-14)/32*scale,z:0,vx:dx*.6-dy*side*split,vy:dy*.6+dx*side*split,vz:1.3+Math.random()*1.2,size:4/32*scale,born:now,life:reduced.matches?650:1600+Math.random()*700,bounces:0});
 }
 for(let i=0;i<(reduced.matches?3:7);i++){
  const angle=Math.random()*Math.PI*2,radius=.13+Math.random()*.55;
  stains.push({map:e.map,x:e.x+Math.cos(angle)*radius,y:e.y+Math.sin(angle)*radius,size:.035+Math.random()*.045,color:colors.blood,born:now,life:reduced.matches?900:3800,spirit:colors.spirit});
 }
 if(!reduced.matches)for(let i=0;i<5;i++)pieces.push({map:e.map,x:e.x,y:e.y,z:.1,vx:dx*.5+(Math.random()-.5)*2,vy:dy*.5+(Math.random()-.5)*2,vz:1+Math.random(),size:.045,color:colors.blood,born:now,life:850,bounces:0});
 pieces=pieces.slice(-160);stains=stains.slice(-100);
 slash(e.x,e.y,dx,dy,true,colors.spirit?'#c9dcff':'#fff0cc');
}
function paint(now){
 const w=host.clientWidth,h=host.clientHeight,dpr=Math.min(window.devicePixelRatio||1,2);
 if(canvas.width!==Math.max(1,Math.round(w*dpr))||canvas.height!==Math.max(1,Math.round(h*dpr))){canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));canvas.style.width=w+'px';canvas.style.height=h+'px';}
 const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);c.imageSmoothingEnabled=false;
 if(!latest)return;
 const dt=Math.min(.04,Math.max(0,(now-last)/1000));last=now;
 const p=latest.player,v=window.GulchMovementState?.visual,camera=v?.map===p.map?v:p,ts=tileSize();
 const point=(x,y)=>({x:w/2+(x-camera.x)*ts,y:h/2+(y-camera.y)*ts});
 const visible=e=>e.map===p.map&&latest.lit[Math.round(e.y)]?.[Math.round(e.x)]===1;
 stains=stains.filter(e=>now-e.born<e.life);
 pieces=pieces.filter(e=>now-e.born<e.life);
 slashes=slashes.filter(e=>now-e.born<e.life);
 for(const e of stains){
  if(!visible(e))continue;const q=point(e.x,e.y),age=(now-e.born)/e.life;
  c.globalAlpha=.65*Math.min(1,(1-age)*3);c.fillStyle=e.color;
  const size=Math.max(2,Math.round(e.size*ts));c.fillRect(Math.round(q.x),Math.round(q.y),size*2,size);
 }
 for(const e of pieces){
  if(!reduced.matches){
   const nx=e.x+e.vx*dt,ny=e.y+e.vy*dt;
   if(wall(nx,e.y))e.vx*=-.35;else e.x=nx;
   if(wall(e.x,ny))e.vy*=-.35;else e.y=ny;
   e.vz-=6*dt;e.z+=e.vz*dt;
   if(e.z<0){e.z=0;e.vz=e.bounces++<2?-e.vz*.28:0;e.vx*=.48;e.vy*=.48;}
   e.vx*=Math.exp(-dt*2);e.vy*=Math.exp(-dt*2);
  }
  if(!visible(e))continue;
  const q=point(e.x,e.y),age=(now-e.born)/e.life,size=Math.max(2,Math.round(e.size*ts));
  c.globalAlpha=Math.min(1,(1-age)*3);
  if(e.art){
   c.fillStyle='#101a2044';c.fillRect(Math.round(q.x),Math.round(q.y+3),size,size/2);
   c.drawImage(e.art,e.sx,e.sy,4,4,Math.round(q.x-size/2),Math.round(q.y-e.z*ts-size/2),size,size);
  }else{c.fillStyle=e.color;c.fillRect(Math.round(q.x),Math.round(q.y-e.z*ts),size,size);}
 }
 for(const e of slashes){
  if(!visible(e))continue;const q=point(e.x,e.y),t=(now-e.born)/e.life;
  c.save();c.translate(q.x,q.y);c.rotate(e.angle);c.globalAlpha=(1-t)*.85;
  const sweep=reduced.matches?0:-.9+t*1.8,r=ts*(e.heavy?.65:.95);
  c.strokeStyle=e.color;c.lineWidth=e.heavy?3:2;
  c.beginPath();c.arc(0,0,r,sweep-.6,sweep+.55);c.stroke();
  c.strokeStyle='#fff9e3';c.lineWidth=1;c.beginPath();c.moveTo(Math.cos(sweep)*r*.45,Math.sin(sweep)*r*.45);c.lineTo(Math.cos(sweep)*r*1.12,Math.sin(sweep)*r*1.12);c.stroke();c.restore();
 }
 c.globalAlpha=1;
}
function tick(now){frame=0;if(document.hidden)return;paint(now);if(pieces.length||stains.length||slashes.length)frame=requestAnimationFrame(tick);}
function wake(){if(!frame&&!document.hidden){last=performance.now();frame=requestAnimationFrame(tick);}}
function reset(){pieces=[];stains=[];slashes=[];if(frame)cancelAnimationFrame(frame);frame=0;}
Gulch.register('combat-impact-effects',{snapshot(s){
 const old=previous;latest=s;previous=s;
 if(!old||epoch(old.gameState)!==epoch(s.gameState)||old.mapId!==s.mapId){reset();paint(performance.now());return;}
 if(s.stateRevision===old.stateRevision)return;
 const attack=s.gameState.sword?.lastAttack,oldAttack=old.gameState.sword?.lastAttack;
 const freshSlash=attack&&attack.id!==oldAttack?.id&&attack.map===s.mapId&&Number.isFinite(attack.time)&&Math.abs(Date.now()-attack.time)<2000;
 if(freshSlash)slash(attack.x,attack.y,attack.dx,attack.dy,false);
 if(Number(s.turn)>Number(old.turn)){
  const after=new Map(s.seed.entities.map(e=>[e.id,e]));let deaths=0,bump=false;
  for(const e of old.seed.entities){
   if(!creature(e)||e.map!==s.mapId||old.lit[e.y]?.[e.x]!==1)continue;
   const next=after.get(e.id),d=Math.hypot(e.x-old.player.x,e.y-old.player.y);
   if(!next||Number.isFinite(next.hp)&&next.hp<=0){
    if(deaths++<6){let dx=e.x-old.player.x,dy=e.y-old.player.y;if(!dx&&!dy){dx=1;dy=0;}destroy(e,dx,dy);}
   }else if(next.hp<e.hp&&d<=Math.SQRT2+.01&&!freshSlash&&!bump){
    slash(old.player.x,old.player.y,e.x-old.player.x,e.y-old.player.y,false);bump=true;
   }
  }
 }
 if(pieces.length||stains.length||slashes.length){window.GulchFrameBudget?.activate();wake();}
},resize(){paint(performance.now());}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(frame)cancelAnimationFrame(frame);frame=0;}else{paint(performance.now());wake();}});
reduced.addEventListener('change',()=>{reset();paint(performance.now());});
})();
