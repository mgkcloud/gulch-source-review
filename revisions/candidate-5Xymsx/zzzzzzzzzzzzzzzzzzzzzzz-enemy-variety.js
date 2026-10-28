(function(){
'use strict';
const base=window.GulchCaveEnemies,commit=Gulch.commit;
if(!base)return;
let latest=null,attempt=null;
const shared=globalThis.GulchEnemyVarietyEffects;
const {kinds,hash,epoch,floor,line,footprint,populate}=shared;
Gulch.commit=function(data,activity){return commit(data?.seed?populate(data):data,activity);};
function advance(seed){return shared.advance(seed,s=>base.advance(s));}
function sprite(ctx,e,x,y,ts,alpha){
 const k=kinds[e.enemyVariety];if(!k)return base.sprite(ctx,e,x,y,ts,alpha);
 const size=ts*k.size,u=size/16;
 ctx.save();ctx.globalAlpha=alpha;
 ctx.fillStyle='#101a20';ctx.fillRect(x-6*u,y-5*u,12*u,10*u);
 ctx.fillStyle=k.color;ctx.fillRect(x-5*u,y-4*u,10*u,8*u);
 ctx.fillStyle=e.enemyVariety==='storm'?'#e7e2ff':'#716951';ctx.fillRect(x-3*u,y-6*u,6*u,3*u);
 if(e.enemyVariety==='storm'){
  ctx.fillStyle='#e6edff';ctx.fillRect(x-u,y-3*u,2*u,6*u);ctx.fillRect(x-3*u,y-u,6*u,2*u);
  ctx.strokeStyle='#b9c9f2';ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,size*.48,0,Math.PI*2);ctx.stroke();
 }else{
  ctx.fillStyle='#252332';ctx.fillRect(x-3*u,y-2*u,2*u,u);ctx.fillRect(x+u,y-2*u,2*u,u);
  ctx.fillStyle='#e9d4a5';ctx.fillRect(x-3*u,y+2*u,u,3*u);ctx.fillRect(x+2*u,y+2*u,u,3*u);
  ctx.fillStyle=k.color;
  for(const side of [-1,1])for(let i=0;i<3;i++)ctx.fillRect(x+side*6*u-u,y+(i*3-3)*u,2*u,2*u);
 }
 if(e.enemyVariety==='colossus'){
  ctx.fillStyle='#eee0bf';for(const side of [-1,1]){ctx.fillRect(x+side*5*u-u,y-8*u,2*u,5*u);ctx.fillRect(x+side*6*u-u,y-9*u,2*u,2*u);}
  ctx.fillStyle='#3b2325';ctx.fillRect(x-size*.48,y-size*.7,size*.96,4);
  ctx.fillStyle='#e8ad72';ctx.fillRect(x-size*.48,y-size*.7,size*.96*Math.max(0,Math.min(1,e.hp/e.maxHp)),4);
 }
 if(e.enemyIntent){ctx.fillStyle='#ffe1ac';ctx.font='bold 14px monospace';ctx.textAlign='center';ctx.fillText('!',x,y-size*.75-5);}
 ctx.restore();
}
window.GulchCaveEnemies=Object.freeze({...base,advance,sprite});
const canvas=document.createElement('canvas');canvas.id='enemyIntentTiles';canvas.setAttribute('aria-hidden','true');canvas.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:2';
const warning=document.createElement('div');warning.id='enemyThreatWarning';warning.hidden=true;warning.setAttribute('role','status');warning.style.cssText='position:absolute;left:50%;top:54px;transform:translateX(-50%);max-width:min(440px,60%);padding:7px 10px;pointer-events:none;z-index:4;border:1px solid #b78363;border-radius:5px;background:#201e24ed;color:#ffe1ad;font:11px/1.5 monospace;text-align:center';
document.getElementById('left').append(canvas,warning);
const help=document.getElementById('keyHelp');
if(help){const text=document.createElement('p');text.textContent='Enemy tells: small skitterers sprint; Ironhide chargers mark a straight lane; Storm lanterns mark your tile; rare Colossi mark a wide slam. Leave marked tiles before your next turn. Attacks and movement advance enemy turns; a killing blow cancels that enemy’s attack. Colossi have 100 base HP and deal 12 base damage before difficulty and armor.';help.append(text);}
function paint(){
 const host=document.getElementById('left'),w=host.clientWidth,h=host.clientHeight,dpr=Math.min(window.devicePixelRatio||1,2);
 if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));canvas.style.width=w+'px';canvas.style.height=h+'px';}
 const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 if(!latest)return;
 const p=latest.player,v=window.GulchMovementState?.visual,camera=v?.map===p.map?v:p,ts=Math.max(20,Math.min(64,Number(latest.seed.meta?.tileSize)||32));
 const visible=latest.seed.entities.filter(e=>kinds[e.enemyVariety]&&e.map===p.map&&e.hp>0&&latest.lit[e.y]?.[e.x]===1);
 let threats=0;
 for(const e of visible)for(const q of e.enemyIntent?.tiles||[]){
  if(latest.lit[q.y]?.[q.x]!==1)continue;
  const x=w/2+(q.x-camera.x)*ts,y=h/2+(q.y-camera.y)*ts;
  ctx.fillStyle='#eb825b40';ctx.fillRect(x-ts*.47,y-ts*.47,ts*.94,ts*.94);
  ctx.strokeStyle='#f7bc83';ctx.lineWidth=1.5;ctx.strokeRect(x-ts*.43,y-ts*.43,ts*.86,ts*.86);
  ctx.beginPath();ctx.moveTo(x-4,y-4);ctx.lineTo(x+4,y+4);ctx.moveTo(x+4,y-4);ctx.lineTo(x-4,y+4);ctx.stroke();threats++;
 }
 const boss=visible.find(e=>e.enemyVariety==='colossus');
 const modal=['inventoryPanel','respawnScreen','questBoard','workBoard','characterPanel','livingPanel'].some(id=>{const n=document.getElementById(id);return n&&!n.hidden;});
 warning.hidden=modal||p.hp<=0||(!threats&&!boss);
 const text=threats?'ATTACK WINDUP · Leave the amber tiles before your next turn.':boss?'RARE COLOSSUS · '+boss.hp+'/'+boss.maxHp+' HP · devastating 12-base-damage slam.':'';
 if(warning.textContent!==text)warning.textContent=text;
}
function setup(){
 if(!latest||document.hidden||window.GulchMovementState?.inFlight||attempt===latest.stateRevision)return;
 const next=populate(latest.gameState);if(next===latest.gameState)return;
 attempt=latest.stateRevision;Gulch.commit(next,'The region reveals skittering hunters, heavy chargers and storm lanterns. Rare ancient giants may roam distant open ground.');
}
Gulch.register('enemy-variety',{snapshot(s){latest=s;setup();paint();},resize:paint});
let last=0;
function frame(now){if(!document.hidden&&latest&&now-last>=50){last=now;paint();}requestAnimationFrame(frame);}requestAnimationFrame(frame);
setInterval(setup,1100);
})();
