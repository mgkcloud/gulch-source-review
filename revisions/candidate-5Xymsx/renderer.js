(function(){
'use strict';
const $=id=>document.getElementById(id);
const colors={stone:[62,72,73],soil:[71,57,43],water:[27,76,94],wood:[92,70,47],fungus:[42,66,47],tree:[32,61,44],plank:[103,78,52]};
let snap=null;
const sprites={
 adventurer:['.....hhh....','....hhhhhh..','....HHHHH...','....sesse...','.....sss....','...ccggcc...','..sccggccs..','..sccggccsw.','...ccbbcc.w.','....llll..w.','....l..l....','...bb..bb...'],
 villager:['....hhhh....','...hhhhhh...','....ssss....','....esse....','.....ss.....','...cccccc...','..sccccccs..','..sccccccs..','...ccbbcc...','....llll....','....l..l....','...bb..bb...'],
 quill:['.....hhh....','....hhhhh...','...hhhhhhh..','....sesse...','....sHHs....','.....HH.....','...cccccc.w.','..sccccccsw.','..sccbbcc.w.','....llll..w.','....l..l..w.','...bb..bb.w.'],
 glowcap:['............','.....ss.....','...ssssss...','..ssgssgss..','.ssssssssss.','.sgsssssgss.','..cccccccc..','.....HH.....','.....HH.....','.....HH.....','....HHHH....','............'],
 goblin:['...h....h...','..hhh..hhh..','...ssssss...','..ssessess.','...ssssss...','....ssss....','..cccccccc..','.sccccccccs.','.s.ccbbcc.sw','...llllll..w','...ll..ll...','..bbb..bbb..'],
 rat:['............','............','............','.....hh.hh..','....hsshssh.','...hhhhhhhh.','..hhhhhhhehs','..hhhhhhhhh.','.thhhhhhhh..','t..ss..ss...','tt..........','............'],
 slime:['............','............','....ssss....','...ssssss...','..ssgsssss..','..sggsssss..','.ssssssssss.','.ssesssesss.','.ssssssssss.','.ssssssssss.','..cccccccc..','............']
};
function identity(e){return [e.id,e.name,e.species,e.type,e.kind].filter(v=>typeof v==='string').join(' ').toLowerCase();}
function beat(e){const phase=window.GulchLifeAnimation?.phase()||0;let h=0;for(const c of String(e.id||''))h=(h+c.charCodeAt(0))%2;return phase*(h?-1:1);}
function character(ctx,e,x,y,ts,light,animate){
 const player=e.id==='player',hostile=e.faction==='hostile',name=identity(e);
 const kind=player?'adventurer':/glow[\s_-]*caps?/.test(name)?'glowcap':/old[\s_-]*quill/.test(name)?'quill':/rat|mouse|rodent/.test(name)?'rat':/slime|ooze/.test(name)?'slime':hostile?'goblin':'villager';
 const defaults=kind==='glowcap'?{s:'#74ad82',g:'#bad9a3',c:'#426e62',H:'#b8cfb1'}:kind==='rat'?{h:'#9b8e81',s:'#d4a599',e:'#211c23',t:'#b58884'}:kind==='slime'?{s:'#74ad82',g:'#bad9a3',e:'#152f30',c:'#426e62'}:{h:player?'#b79059':hostile?'#557d52':'#785a43',H:'#e0c28a',s:hostile?'#9db878':'#e6b78e',e:'#233237',c:player?'#4d9090':hostile?'#815c55':'#8a83a3',g:'#b8cfb1',b:'#684f3c',l:'#364b5a',w:'#dae5dc'};
 const appearance=player?e.appearance:null;
 const color=(key,fallback)=>typeof appearance?.[key]==='string'&&/^#[0-9a-f]{6}$/i.test(appearance[key])?appearance[key]:fallback;
 const palette=player?{...defaults,s:color('skin',defaults.s),h:color('hair',defaults.h),c:color('clothing',defaults.c)}:defaults;
 const rows=sprites[kind],pixel=Math.max(1,Math.floor(ts/14));
 const phase=animate&&!(Number.isFinite(e.hp)&&e.hp<=0)?beat(e):0;
 const movement=window.GulchMovementState;
 const walking=player&&movement?.visual?.map===e.map&&(Math.abs(movement.visual.x-e.x)>.01||Math.abs(movement.visual.y-e.y)>.01);
 const left=Math.round(x-6*pixel),top=Math.round(y+ts*.34-12*pixel);
 function position(rx,ry){
  const upper=ry<9;
  const sway=upper?phase*Math.max(1,Math.round(pixel*.5)):0;
  const step=walking&&ry>=9?(rx<6?phase:-phase)*pixel:0;
  return [left+rx*pixel+sway,top+ry*pixel+step];
 }
 ctx.globalAlpha=light;ctx.fillStyle='#111b24';
 rows.forEach((row,ry)=>Array.from(row).forEach((key,rx)=>{if(key!=='.'){const [px,py]=position(rx,ry);ctx.fillRect(px-pixel,py,pixel*3,pixel);ctx.fillRect(px,py-pixel,pixel,pixel*3);}}));
 rows.forEach((row,ry)=>Array.from(row).forEach((key,rx)=>{if(palette[key]){const [px,py]=position(rx,ry);ctx.fillStyle=palette[key];ctx.fillRect(px,py,pixel,pixel);}}));ctx.globalAlpha=1;
}
window.GulchPlayerSprite=function(ctx,player,x,y,size){ctx.save();character(ctx,{...player,id:'player'},x,y,size,1,false);ctx.restore();};
function isCharacter(e){
 if(e.id==='player'||/glow[\s_-]*caps?/.test(identity(e)))return true;
 const types=[e.kind,e.type].filter(v=>typeof v==='string').join(' ');
 if(/\b(item|weapon|armor|armour|equipment|consumable|loot|object|prop)\b/i.test(types)||e.itemId!=null)return false;
 return Boolean(e.ai||e.dialogue||e.loreSpeaker||/old[\s_-]*quill|\b(rats?|mouse|rodent|slime|ooze|villager|merchant|guard|goblin|npc|character|creature|traveler|storyteller|elf|dwarf|hobbit)\b/.test(identity(e)));
}
function noise(x,y){const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);}
function rgb(base,f){return 'rgb('+base.map(c=>Math.round(Math.min(255,c*f))).join(',')+')';}
function draw(){
 const canvas=$('board'),host=$('left');
 const w=host.clientWidth||window.innerWidth,h=host.clientHeight||window.innerHeight,dpr=Math.min(window.devicePixelRatio||1,2);
 const cw=Math.max(1,Math.round(w*dpr)),ch=Math.max(1,Math.round(h*dpr));
 if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;canvas.style.width=w+'px';canvas.style.height=h+'px';}
 const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=false;
 ctx.fillStyle='#070e12';ctx.fillRect(0,0,w,h);
 if(!snap||!snap.player)return;
 const p=snap.player,seed=snap.seed,map=seed.maps.find(m=>m.id===snap.mapId);if(!map)return;
 const visual=window.GulchMovementState?.visual,camera=visual&&visual.map===p.map?visual:p;
 const ts=Math.max(20,Math.min(64,Number(seed.meta?.tileSize)||32));
 const cols=Math.ceil(w/ts)+3,rows=Math.ceil(h/ts)+3;
 const ox=Math.floor(camera.x-w/(2*ts))-1,oy=Math.floor(camera.y-h/(2*ts))-1;
 const offsetX=(w-ts)/2-(camera.x-ox)*ts,offsetY=(h-ts)/2-(camera.y-oy)*ts;
 const radius=Number(seed.meta?.fov?.radius)||8;
 const phase=window.GulchLifeAnimation?.phase()||0;
 function tile(x,y){return map.ascii[y]?.[x];}
 function wall(x,y){const ch=tile(x,y);return ch==='#'||seed.legend[ch]?.[0]==='wall';}
 for(let sy=0;sy<rows;sy++)for(let sx=0;sx<cols;sx++){
  const x=ox+sx,y=oy+sy,v=snap.lit[y]?.[x];if(!v)continue;
  const px=offsetX+sx*ts,py=offsetY+sy*ts,ch=tile(x,y),mat=seed.legend[ch]?.[1]||'stone';
  const distance=Math.hypot(x-camera.x,y-camera.y),light=v===1?Math.max(.5,1-distance/(radius*2.2)):.28;
  const base=colors[mat]||colors.stone,n=noise(x,y);
  ctx.fillStyle=rgb(base,light*(.85+n*.19));ctx.fillRect(px,py,ts+.5,ts+.5);
  ctx.fillStyle='rgba(0,0,0,.12)';ctx.fillRect(px,py+ts-1,ts,1);ctx.fillRect(px+ts-1,py,1,ts);
  if(wall(x,y)){
   ctx.fillStyle=rgb(base,light*.55);ctx.fillRect(px,py,ts+.5,ts+.5);
   ctx.fillStyle=rgb(base,light*1.35);ctx.fillRect(px+1,py+1,ts-2,ts-7);
   ctx.fillStyle=rgb(base,light*1.65);ctx.fillRect(px+2,py+1,ts-4,2);
   ctx.fillStyle='rgba(0,0,0,.24)';ctx.fillRect(px+2,py+Math.floor(ts*.48),ts-4,1);ctx.fillRect(px+Math.floor(ts*(n>.5?.36:.67)),py+2,1,Math.floor(ts*.45));
   if(!wall(x,y+1)){ctx.fillStyle='rgba(0,0,0,.28)';ctx.fillRect(px,py+ts,ts,5);}
  }else if(mat==='water'||ch==='~'){
   ctx.fillStyle=rgb([64,132,150],light*.75);
   for(let k=0;k<3;k++){const xx=3+noise(x+k,y)*ts*.55,yy=5+k*(ts-6)/3;ctx.fillRect(px+xx,py+yy,ts*(.16+n*.17),1);}
  }else if(mat==='tree'){
   ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.ellipse(px+ts*.55,py+ts*.8,ts*.35,ts*.15,0,0,Math.PI*2);ctx.fill();
   ctx.fillStyle=rgb([90,73,48],light);ctx.fillRect(px+ts*.44,py+ts*.52,ts*.14,ts*.4);
   const sway=v===1?phase*(n>.5?1:-1)*Math.max(.5,ts/40):0;
   for(let k=0;k<3;k++){const shift=sway*(1-k*.25);ctx.fillStyle=rgb([43+k*8,83+k*9,57+k*6],light);ctx.beginPath();ctx.moveTo(px+ts*.5+shift,py+ts*(.06+k*.16));ctx.lineTo(px+ts*.88+shift,py+ts*(.49+k*.14));ctx.lineTo(px+ts*.12+shift,py+ts*(.49+k*.14));ctx.closePath();ctx.fill();}
  }else if(mat==='wood'||mat==='plank'){
   ctx.fillStyle='rgba(0,0,0,.26)';for(let k=1;k<4;k++)ctx.fillRect(px,py+Math.floor(ts*k/4),ts,1);
   ctx.fillStyle=rgb([156,120,76],light*.6);ctx.fillRect(px+3,py+3,ts*.5,1);
  }else{
   ctx.fillStyle=rgb(base,light*1.3);for(let k=0;k<4;k++)ctx.fillRect(px+3+Math.floor(noise(x+k*7,y)*Math.max(1,ts-7)),py+3+Math.floor(noise(x,y+k*11)*Math.max(1,ts-7)),k===0?3:1,1);
   if(mat==='fungus'){ctx.fillStyle=rgb([115,167,111],light);ctx.fillRect(px+ts*.65,py+ts*.35,3,2);}
  }
  if(ch==='>'){
   ctx.fillStyle='#111d22';ctx.fillRect(px+4,py+4,ts-8,ts-8);ctx.fillStyle=rgb([231,187,112],light);
   for(let k=0;k<4;k++)ctx.fillRect(px+6+k*2,py+6+k*(ts-12)/4,Math.max(2,ts-12-k*4),2);
  }
 }
 for(const e of seed.entities){
  if(e.map!==snap.mapId||!snap.lit[e.y]?.[e.x]||!e.emitsLight)continue;
  const position=e.id==='player'?camera:e;
  const x=offsetX+(position.x-ox+.5)*ts,y=offsetY+(position.y-oy+.5)*ts,r=Math.min(8,Number(e.emitsLight)||1)*ts;
  const glow=ctx.createRadialGradient(x,y,0,x,y,r);glow.addColorStop(0,'rgba(169,224,132,.17)');glow.addColorStop(1,'rgba(169,224,132,0)');ctx.fillStyle=glow;ctx.fillRect(x-r,y-r,r*2,r*2);
 }
 const entities=seed.entities.filter(e=>e.map===snap.mapId&&snap.lit[e.y]?.[e.x]).slice().sort((a,b)=>(a.id==='player')-(b.id==='player')||a.y-b.y);
 for(const e of entities){
  const isPlayer=e.id==='player',position=isPlayer?camera:e;
  const x=offsetX+(position.x-ox+.5)*ts,y=offsetY+(position.y-oy+.5)*ts,hostile=e.faction==='hostile',alpha=snap.lit[e.y]?.[e.x]===1?1:.35;
  ctx.globalAlpha=alpha;
  ctx.fillStyle='rgba(0,0,0,.45)';ctx.beginPath();ctx.ellipse(x,y+ts*.3,ts*.29,ts*.11,0,0,Math.PI*2);ctx.fill();
  if(isPlayer){ctx.fillStyle='rgba(244,205,137,.09)';ctx.fillRect(x-ts/2+1,y-ts/2+1,ts-2,ts-2);ctx.strokeStyle='#d1af73';ctx.lineWidth=1;ctx.strokeRect(x-ts/2+2.5,y-ts/2+2.5,ts-5,ts-5);}
  if(e.caveEncounter===1||e.outsideAnimal){
   // Dedicated overlay components draw these creatures.
  }else if(isCharacter(e))character(ctx,e,x,y,ts,alpha,alpha===1);
  else{
   ctx.font='bold '+Math.floor(ts*.72)+'px ui-monospace,monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor='#000';ctx.shadowBlur=4;ctx.shadowOffsetY=2;
   ctx.fillStyle=e.color||'#bfd9bd';ctx.fillText(e.glyph||'?',x,y+1);ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  }
  ctx.globalAlpha=alpha;
  if(hostile&&Number.isFinite(e.hp)&&Number.isFinite(e.maxHp)&&e.maxHp>0&&e.hp<e.maxHp){ctx.fillStyle='#281f21';ctx.fillRect(x-ts*.3,y-ts*.43,ts*.6,3);ctx.fillStyle='#d98776';ctx.fillRect(x-ts*.3,y-ts*.43,ts*.6*Math.max(0,Math.min(1,e.hp/e.maxHp)),3);}
  ctx.globalAlpha=1;
 }
 const vignette=ctx.createRadialGradient(w/2,h/2,Math.min(w,h)*.18,w/2,h/2,Math.max(w,h)*.7);vignette.addColorStop(0,'rgba(3,10,14,0)');vignette.addColorStop(1,'rgba(3,10,14,.65)');ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
 ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.font='10px ui-monospace,monospace';ctx.fillStyle='#7e9695';ctx.fillText('G U L C H  /  SHARED EXPEDITION',16,h-14);
}
function hud(){
 if(!snap?.player)return;const p=snap.player;
 $('hp').textContent=p.hp+'/'+p.maxHp;$('hp').style.color=p.hp/Math.max(1,p.maxHp)<.3?'#f19b87':'#d9ddb4';
 $('mapName').textContent=snap.seed.maps.find(m=>m.id===snap.mapId)?.name||'?';$('pos').textContent=p.x+', '+p.y;$('turn').textContent=snap.turn;$('clients').textContent=snap.clients;
}
Gulch.register('renderer',{snapshot(s){snap=s;hud();draw();},resize:draw});
})();
