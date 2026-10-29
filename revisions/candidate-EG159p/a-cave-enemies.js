(function(){
'use strict';
const KEY='smallCaveEncounter';
let attempted=false;
const patterns={
 beetle:['..aa..aa..','...aaaa...','..abbbba..','.abccccba.','aabccccbaa','.abccccba.','aabccccbaa','..abbbba..','.aa....aa.','..........'],
 crawler:['..........','.a......a.','..aaaaaa..','.abbccbba.','aabeeee baa'.replace(' ',''),'.abbbbbba.','..abbbba..','.aa.aa.aa.','a........a','..........'],
 wisp:['....aa....','...abba...','..abbbba..','.abbccbba.','.abeeee ba'.replace(' ',''),'.abbbbbba.','..abbbba..','...abba...','..aa..aa..','..........']
};
const palettes={beetle:{a:'#24243b',b:'#b58a57',c:'#e6c17b',e:'#fff1c0'},crawler:{a:'#243c39',b:'#65a58a',c:'#b7d9a0',e:'#fff0b5'},wisp:{a:'#343050',b:'#a895d4',c:'#e2c9ff',e:'#fff4ce'}};
const {isEncounter:ours,walk,rat,advanceBase:advance}=globalThis.GulchCaveEffects;
function sprite(ctx,e,x,y,ts,alpha){
 const rows=patterns[e.caveSprite],palette=palettes[e.caveSprite];if(!rows)return;
 const pixel=Math.max(1,Math.floor(ts/12)),left=Math.round(x-5*pixel),top=Math.round(y-5*pixel);
 ctx.save();ctx.globalAlpha=alpha;
 rows.forEach((row,iy)=>Array.from(row).forEach((c,ix)=>{if(palette[c]){ctx.fillStyle=palette[c];ctx.fillRect(left+ix*pixel,top+iy*pixel,pixel,pixel);}}));ctx.restore();
}
window.GulchCaveEnemies=Object.freeze({advance,sprite});
const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');canvas.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:1';document.getElementById('left').append(canvas);
let snap=null;
function paint(){
 const host=document.getElementById('left'),w=host.clientWidth,h=host.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
 if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));canvas.style.width=w+'px';canvas.style.height=h+'px';}
 const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 if(!snap)return;
 const p=snap.player,v=window.GulchMovementState?.visual,camera=v&&v.map===p.map?v:p,ts=Math.max(20,Math.min(64,Number(snap.seed.meta?.tileSize)||32));
 for(const e of snap.seed.entities){
  if(!ours(e)||e.map!==p.map||!snap.lit[e.y]?.[e.x])continue;
  const x=w/2+(e.x-camera.x)*ts,y=h/2+(e.y-camera.y)*ts;
  (window.GulchCaveEnemies?.sprite||sprite)(ctx,e,x,y,ts,snap.lit[e.y]?.[e.x]===1?1:.35);
 }
}
function spawn(s){
 if(attempted||s.gameState[KEY]?.spawned||window.GulchMovementState?.inFlight)return;
 const seed=s.seed,p=s.player,map=seed.maps.find(m=>m.id===p.map);
 if(!map)return;
 const cave=/cave|cavern|grotto|mine|dungeon|underground/i.test([map.id,map.name,map.biome,map.type].join(' '));
 const queue=[{x:p.x,y:p.y}],seen=new Set([p.x+','+p.y]);
 for(let i=0;i<queue.length&&queue.length<20000;i++){
  const q=queue[i];
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const x=q.x+dx,y=q.y+dy,key=x+','+y;
   if(!seen.has(key)&&walk(seed,map,x,y)){seen.add(key);queue.push({x,y});}
  }
 }
 const exits=[...(map.exits||[])];
 map.ascii.forEach((row,y)=>Array.from(row).forEach((c,x)=>{if(c==='>')exits.push({x,y});}));
 const candidates=queue.filter(q=>{
  const ch=map.ascii[q.y][q.x],material=seed.legend[ch]?.[1];
  return (cave||material==='stone')&&Math.hypot(q.x-p.x,q.y-p.y)>=5&&exits.every(e=>Math.hypot(q.x-e.x,q.y-e.y)>=3)&&!seed.entities.some(e=>e.map===p.map&&e.x===q.x&&e.y===q.y);
 }).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y)||a.y-b.y||a.x-b.x);
 if(candidates.length<3)return;
 const anchor=candidates[0],spots=candidates.slice().sort((a,b)=>Math.hypot(a.x-anchor.x,a.y-anchor.y)-Math.hypot(b.x-anchor.x,b.y-anchor.y)).slice(0,3);
 const definitions=[['Amber shell beetle','beetle',4],['Moss cave crawler','crawler',4],['Violet cave wisp','wisp',6]];
 const occupied=new Set(seed.entities.map(e=>e.id));
 const enemies=definitions.map(([name,caveSprite,hp],i)=>{
  let id='small-cave-enemy-'+i;while(occupied.has(id))id+='-1';occupied.add(id);
  return {id,name,caveSprite,caveEncounter:1,kind:'cave-creature',faction:'hostile',map:p.map,x:spots[i].x,y:spots[i].y,hp,maxHp:hp,glyph:' ',color:'#ffffff'};
 });
 attempted=true;
 Gulch.commit({...s.gameState,seed:{...seed,entities:[...seed.entities,...enemies]},[KEY]:{spawned:true,map:p.map,enemyIds:enemies.map(e=>e.id)}},'Three cave enemies stir nearby: beetle, crawler, and wisp.');
}
Gulch.register('small-cave-encounter',{snapshot(s){snap=s;spawn(s);paint();},resize:paint});
})();
