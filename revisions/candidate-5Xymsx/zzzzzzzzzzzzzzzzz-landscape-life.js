(function(){
'use strict';
let latest=null,attempt=null;
const host=document.getElementById('left'),baseCommit=Gulch.commit;
const VERSION=1;
function hash(text){let h=2166136261;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
function random(text){let h=hash(text);return ()=>{h=(h+0x6d2b79f5)|0;let t=Math.imul(h^(h>>>15),h|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
function floor(seed,map,x,y){const c=map?.ascii[y]?.[x];return Boolean(c)&&!['#','~'].includes(c)&&!['wall','water'].includes(seed.legend[c]?.[0]);}
function enrich(data){
 const seed=data.seed,p=seed?.entities?.find(e=>e.id==='player'),map=seed?.maps?.find(m=>m.id===p?.map);
 if(!map||p.hp<=0||data.gulchPermanentGameOver?.ended||map.landscapeLife?.version===VERSION)return data;
 const rng=random(String(data.respawnSettings?.generationSeed||seed.meta?.seed||'gulch')+':detail:'+map.id);
 const queue=[{x:p.x,y:p.y}],seen=new Set([p.x+','+p.y]);
 for(let i=0;i<queue.length&&queue.length<10000;i++)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
  const x=queue[i].x+dx,y=queue[i].y+dy,k=x+','+y;
  if(!seen.has(k)&&floor(seed,map,x,y)){seen.add(k);queue.push({x,y});}
 }
 const entities=seed.entities.slice(),ids=new Set(entities.map(e=>e.id));
 const occupied=new Set(entities.filter(e=>e.map===map.id).map(e=>e.x+','+e.y));
 const exits=map.exits||[],refuges=entities.filter(e=>e.map===map.id&&(e.townRefuge||e.outsideNPC||e.swordQuestLandmark));
 const candidates=queue.filter(q=>!occupied.has(q.x+','+q.y)&&map.ascii[q.y][q.x]!=='>'&&exits.every(e=>Math.hypot(q.x-e.x,q.y-e.y)>3));
 for(let i=candidates.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
 let serial=0;
 function take(min,max,safe){const index=candidates.findIndex(q=>{const d=Math.hypot(q.x-p.x,q.y-p.y);return d>=min&&d<=max&&(!safe||refuges.every(e=>Math.hypot(q.x-e.x,q.y-e.y)>8));});return index<0?null:candidates.splice(index,1)[0];}
 function add(q,values){let id='landscape:'+map.id+':'+serial++;while(ids.has(id))id+='x';ids.add(id);entities.push({id,map:map.id,...q,...values,landscapeEntity:true});}
 const outdoors=!/cave|cavern|mine|dungeon|underground/i.test([map.biome,map.name].join(' '));
 const discoveries=['image_handaxe','image_pickaxe','image_sickle','image_bow','image_red_potion','image_satchel','image_silver_bar'];
 let tools=0,animals=0,beasts=0;
 const existing=entities.filter(e=>e.landscapeEntity).length,budget=Math.max(0,100-existing);
 for(let i=0;i<Math.min(6,budget);i++){
  const q=take(3,Infinity,false);if(!q)break;
  const item=discoveries[Math.floor(rng()*discoveries.length)],definition=window.GulchItemCatalog?.items[item];if(!definition)continue;
  add(q,{name:'Abandoned '+definition.name.toLowerCase(),kind:'loot',ecosystemLoot:true,landscapeTool:item,contents:{[item]:1},glyph:' ',color:'#ecd6a0'});tools++;
 }
 if(outdoors)for(let i=0;i<Math.min(5,Math.max(0,budget-tools));i++){
  const q=take(5,Infinity,false);if(!q)break;const species=['deer','rabbit','sheep','fox'][Math.floor(rng()*4)];
  add(q,{name:'Wild '+species,kind:'animal',species,outsideAnimal:species,faction:'friendly',glyph:' ',dialogue:'The '+species+' pauses among the wildflowers, ears alert to the wind.'});animals++;
 }
 const globalBeasts=entities.filter(e=>e.dreadBeast&&e.hp>0).length;
 const desired=queue.length>900?2:queue.length>180?1:0;
 for(let i=0;i<Math.min(desired,Math.max(0,12-globalBeasts),Math.max(0,budget-tools-animals));i++){
  const q=take(15,Infinity,true);if(!q)break;
  const hp={easy:22,normal:30,hard:38,nightmare:48}[data.respawnSettings?.difficulty]||38;
  add(q,{name:'Crimson Dreadmaw',kind:'cave-creature',faction:'hostile',caveEncounter:1,caveSprite:'beetle',dreadBeast:true,hp,maxHp:hp,glyph:' ',color:'#ff403b'});beasts++;
 }
 const detail={version:VERSION,outdoors,tools,animals,beasts};
 const next={...data,seed:{...seed,entities,maps:seed.maps.map(m=>m.id===map.id?{...m,landscapeLife:detail}:m)}};
 return new TextEncoder().encode(JSON.stringify(next)).length<=335000?next:data;
}
Gulch.commit=function(data,activity){return baseCommit(data?.seed?enrich(data):data,activity);};
const cave=window.GulchCaveEnemies;
if(cave){
 window.GulchCaveEnemies=Object.freeze({...cave,advance(seed){
  const p=seed.entities.find(e=>e.id==='player');
  if(!p||p.hp<=0)return cave.advance(seed);
  const map=seed.maps.find(m=>m.id===p.map);
  const attackers=seed.entities.filter(e=>e.dreadBeast&&e.hp>0&&e.map===p.map&&Math.max(Math.abs(e.x-p.x),Math.abs(e.y-p.y))<=1&&(!(e.x!==p.x&&e.y!==p.y)||(floor(seed,map,e.x,p.y)&&floor(seed,map,p.x,e.y))));
  const advanced=cave.advance(seed);
  if(!attackers.length)return advanced;
  return {...advanced,entities:advanced.entities.map(e=>e.id==='player'?{...e,hp:Math.max(0,p.hp-8)}:e)};
 },sprite(ctx,e,x,y,ts,alpha){
  if(!e.dreadBeast)return cave.sprite(ctx,e,x,y,ts,alpha);
  ctx.save();ctx.globalAlpha=alpha;
  const u=Math.max(1,ts/16);
  ctx.fillStyle='#321619';ctx.fillRect(x-9*u,y-7*u,18*u,13*u);
  ctx.fillStyle='#79363b';ctx.fillRect(x-8*u,y-6*u,16*u,11*u);
  ctx.fillStyle='#a55550';ctx.fillRect(x-6*u,y-7*u,12*u,9*u);
  ctx.fillStyle='#bb7d69';ctx.fillRect(x-4*u,y-6*u,8*u,2*u);
  ctx.fillStyle='#c6b99a';
  for(const side of [-1,1]){ctx.fillRect(x+side*8*u-u,y-10*u,2*u,5*u);ctx.fillRect(x+side*4*u-u,y+2*u,2*u,4*u);}
  ctx.fillStyle='#d2bd88';ctx.fillRect(x-5*u,y-2*u,3*u,2*u);ctx.fillRect(x+2*u,y-2*u,3*u,2*u);
  ctx.fillStyle='#42151e';ctx.fillRect(x-3*u,y+2*u,6*u,2*u);
  ctx.fillStyle='#87434a';for(const side of [-1,1])for(let i=0;i<3;i++)ctx.fillRect(x+side*(7+i%2)*u-u,y+(i*4-4)*u,3*u,3*u);
  ctx.restore();
 }});
}
const canvas=document.createElement('canvas');canvas.id='quietLandscape';canvas.setAttribute('aria-hidden','true');canvas.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:1';host.append(canvas);
const notice=document.createElement('div');notice.setAttribute('role','status');notice.style.cssText='position:absolute;bottom:220px;left:50%;transform:translateX(-50%);z-index:3;max-width:320px;padding:7px 10px;border-radius:6px;background:#271a20ee;color:#d8c4ab;font:11px/1.5 monospace;pointer-events:none';notice.hidden=true;host.append(notice);
function paint(){
 if(!latest||document.hidden)return;
 const w=host.clientWidth,h=host.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
 if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));canvas.style.width=w+'px';canvas.style.height=h+'px';}
 const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 const s=latest,p=s.player,map=s.seed.maps.find(m=>m.id===p.map);if(!map)return;
 const visual=window.GulchMovementState?.visual,camera=visual?.map===p.map?visual:p,ts=Math.max(20,Math.min(64,Number(s.seed.meta?.tileSize)||32));
 const point=(x,y)=>({x:w/2+(x-camera.x)*ts,y:h/2+(y-camera.y)*ts});
 for(const e of s.seed.entities){
  if(!e.landscapeTool||e.map!==p.map||s.lit[e.y]?.[e.x]!==1)continue;
  const q=point(e.x,e.y),u=ts/32;
  ctx.fillStyle='#a99a73';ctx.globalAlpha=.45;ctx.fillRect(q.x-10*u,q.y+9*u,20*u,2*u);ctx.globalAlpha=1;
  if(/axe|sickle/.test(e.landscapeTool)){
   ctx.strokeStyle='#a38460';ctx.lineWidth=3*u;ctx.beginPath();ctx.moveTo(q.x-6*u,q.y+8*u);ctx.lineTo(q.x+5*u,q.y-7*u);ctx.stroke();
   ctx.fillStyle='#a6b8b9';ctx.fillRect(q.x+u,q.y-9*u,9*u,5*u);ctx.fillStyle='#c2c8b2';ctx.fillRect(q.x+7*u,q.y-8*u,3*u,7*u);
  }else{ctx.font=Math.floor(ts*.65)+'px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#c8b88e';ctx.fillText(window.GulchItemCatalog?.items[e.landscapeTool]?.glyph||'♦',q.x,q.y);}
 }
}
function updateNotice(){
 if(!latest)return;
 const p=latest.player;
 const beasts=latest.seed.entities.filter(e=>e.dreadBeast&&e.hp>0&&e.map===p.map&&latest.lit[e.y]?.[e.x]===1);
 const loot=latest.seed.entities.find(e=>e.landscapeTool&&e.map===p.map&&Math.abs(e.x-p.x)+Math.abs(e.y-p.y)<=1);
 notice.hidden=p.hp<=0||(!beasts.length&&!loot);
 notice.textContent=beasts.length?'CRIMSON DREADMAW · 8 base damage per adjacent attack before armor and difficulty. Retreat or prepare!':loot?'Found '+(window.GulchItemCatalog?.items[loot.landscapeTool]?.name||'a tool')+' · Pack [I] → Collect nearby loot.':'';
}
function setup(){
 if(!latest||document.hidden||window.GulchMovementState?.inFlight||attempt===latest.stateRevision)return;
 const data=enrich(latest.gameState);if(data===latest.gameState)return;
 attempt=latest.stateRevision;Gulch.commit(data,'The landscape reveals abandoned tools, wildlife and distant crimson predators.');
}
let frameId=0,lastCamera='';
function cameraKey(){const p=window.GulchMovementState?.visual;return p?p.map+':'+p.x+':'+p.y:'';}
function follow(){
 frameId=0;
 if(document.hidden)return;
 const key=cameraKey();
 if(key!==lastCamera){lastCamera=key;paint();}
 const p=latest?.player,v=window.GulchMovementState?.visual;
 if(p&&v&&v.map===p.map&&(Math.abs(v.x-p.x)>.0001||Math.abs(v.y-p.y)>.0001))frameId=requestAnimationFrame(follow);
}
function redraw(){paint();if(!frameId&&!document.hidden)frameId=requestAnimationFrame(follow);}
Gulch.register('landscape-life',{snapshot(s){latest=s;setup();updateNotice();redraw();},resize:redraw});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)redraw();});
setInterval(setup,900);
})();
