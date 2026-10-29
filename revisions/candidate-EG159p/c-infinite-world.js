(function(){
'use strict';
const originalRegister=Gulch.register;
let snapshot=null,attempt=null;
const SIDE=33,LIMIT=8;
function epoch(s){return String(s.gameState.respawnSettings?.token||'original');}
function random(text){let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return function(){h=(h+0x6d2b79f5)|0;let t=Math.imul(h^(h>>>15),h|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
function symbols(seed){
 const legend={...seed.legend},result={};
 for(const [name,kind,material] of [['grass','floor','grass'],['tree','floor','tree'],['soil','floor','soil'],['stone','floor','stone'],['water','water','water']]){
  let c=Object.keys(legend).find(k=>k.length===1&&legend[k]?.[0]===kind&&legend[k]?.[1]===material&&!['#','~','>'].includes(k));
  if(!c){for(let code=0xe100;code<0xf800;code++){const candidate=String.fromCharCode(code);if(!Object.prototype.hasOwnProperty.call(legend,candidate)){c=candidate;break;}}}
  if(!c)throw new Error('No terrain symbols available for the frontier.');
  legend[c]=[kind,material];result[name]=c;
 }
 return {legend,tiles:result};
}
function mapId(cell){return 'frontier:'+encodeURIComponent(cell.realm)+':'+cell.x+':'+cell.y;}
function generate(cell,tiles,seedText){
 const rng=random(seedText+':'+cell.realm+':'+cell.x+':'+cell.y),wet=rng(),forest=rng(),hill=rng();
 const ponds=Array.from({length:3},()=>({x:3+Math.floor(rng()*27),y:3+Math.floor(rng()*27),r:2+rng()*3}));
 const grid=Array.from({length:SIDE},(_,y)=>Array.from({length:SIDE},(_,x)=>{
  const n=rng();
  if(x===0||y===0||x===SIDE-1||y===SIDE-1||Math.abs(x-16)<=1||Math.abs(y-16)<=1)return tiles.soil;
  if(wet>.35&&ponds.some(p=>Math.hypot(x-p.x,y-p.y)<p.r))return tiles.water;
  return n<.12+forest*.34?tiles.tree:n>.94-hill*.12?tiles.stone:tiles.grass;
 }));
 return {id:mapId(cell),name:(wet>.7?'Silverwater':forest>.6?'Wildwood':hill>.65?'Stonefield':'Greenreach')+' · '+cell.x+', '+cell.y,biome:'meadow',ascii:grid.map(r=>r.join('')),exits:[],infiniteCell:cell,infiniteGenerated:true};
}
function road(map,x,y,symbol){
 const rows=map.ascii.map(r=>r.split(''));
 function put(a,b){if(rows[b]?.[a]!==undefined&&rows[b][a]!=='>'&&!map.exits?.some(e=>e.x===a&&e.y===b))rows[b][a]=symbol;}
 for(let a=0;a<(rows[y]?.length||0);a++)put(a,y);
 for(let b=0;b<rows.length;b++)put(Math.min(x,rows[b].length-1),b);
 return {...map,ascii:rows.map(r=>r.join(''))};
}
function busy(){return !snapshot||snapshot.player.hp<=0||window.GulchMovementState?.inFlight;}
function initialize(){
 if(busy())return;
 const s=snapshot,map=s.seed.maps.find(m=>m.id===s.mapId);
 if(!map||map.infiniteCell||attempt===s.stateRevision)return;
 const {legend,tiles}=symbols(s.seed),cell={realm:map.id,x:0,y:0};
 const opened={...road(map,s.player.x,s.player.y,tiles.soil),infiniteCell:cell};
 attempt=s.stateRevision;
 Gulch.commit({...s.gameState,seed:{...s.seed,legend,maps:s.seed.maps.map(m=>m.id===map.id?opened:m)},infiniteWorld:{...s.gameState.infiniteWorld,epoch:epoch(s),seed:String(s.gameState.respawnSettings?.generationSeed||s.seed.meta?.seed||'gulch-frontier'),recent:s.gameState.infiniteWorld?.recent||[]}},'The frontier opens: follow the paths to any map edge to discover new lands.');
}
function transition(action){
 if(action?.type!=='move'||busy())return false;
 const dx=action.dx,dy=action.dy;
 if(!Number.isInteger(dx)||!Number.isInteger(dy)||Math.abs(dx)>1||Math.abs(dy)>1||(!dx&&!dy))return false;
 const s=snapshot,p=s.player,map=s.seed.maps.find(m=>m.id===p.map),cell=map?.infiniteCell;
 if(!cell)return false;
 const width=map.ascii[p.y]?.length||0,height=map.ascii.length;
 let edge=null;
 if(dx<0&&p.x<=0)edge='west';else if(dx>0&&p.x>=width-1)edge='east';else if(dy<0&&p.y<=0)edge='north';else if(dy>0&&p.y>=height-1)edge='south';
 if(!edge)return false;
 const cx=cell.x+(edge==='west'?-1:edge==='east'?1:0),cy=cell.y+(edge==='north'?-1:edge==='south'?1:0);
 if(!Number.isSafeInteger(cx)||!Number.isSafeInteger(cy))return true;
 const nextCell={realm:cell.realm,x:cx,y:cy};
 const {legend,tiles}=symbols(s.seed);
 let destination=s.seed.maps.find(m=>m.infiniteCell?.realm===cell.realm&&m.infiniteCell.x===cx&&m.infiniteCell.y===cy);
 const fresh=!destination;
 if(!destination)destination=generate(nextCell,tiles,s.gameState.infiniteWorld?.seed||epoch(s));
 const dh=destination.ascii.length,dw=Math.max(1,...destination.ascii.map(r=>r.length));
 let x=edge==='west'?dw-1:edge==='east'?0:Math.min(dw-1,Math.max(0,Math.round(p.x/Math.max(1,width-1)*(dw-1))));
 let y=edge==='north'?dh-1:edge==='south'?0:Math.min(dh-1,Math.max(0,Math.round(p.y/Math.max(1,height-1)*(dh-1))));
 x=Math.min(x,destination.ascii[y].length-1);
 destination=road(destination,x,y,tiles.soil);
 const occupied=new Set(s.seed.entities.filter(e=>e.map===destination.id&&e.id!=='player').map(e=>e.x+','+e.y));
 const queue=[{x,y}],seen=new Set([x+','+y]);let landing=null;
 for(let i=0;i<queue.length&&i<10000;i++){
  const q=queue[i];
  if(!occupied.has(q.x+','+q.y)&&!destination.exits?.some(e=>e.x===q.x&&e.y===q.y)){landing=q;break;}
  for(const [a,b] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const nx=q.x+a,ny=q.y+b,c=destination.ascii[ny]?.[nx],key=nx+','+ny;
   if(c&&!seen.has(key)&&!['#','~'].includes(c)&&!['wall','water'].includes(legend[c]?.[0])){seen.add(key);queue.push({x:nx,y:ny});}
  }
 }
 if(!landing)return true;
 let maps=fresh?[...s.seed.maps,destination]:s.seed.maps.map(m=>m.id===destination.id?destination:m);
 const previous=s.gameState.infiniteWorld||{};
 const recent=[...(previous.recent||[]).filter(id=>id!==destination.id),destination.id];
 const pinned=new Set([destination.id,s.gameState.legendarySwordQuest?.map,s.gameState.outsideWorld?.map,s.gameState.outsideWorld?.entrance?.map]);
 maps.forEach(m=>(m.exits||[]).forEach(e=>pinned.add(e.to)));
 s.seed.entities.filter(e=>e.swordQuestLandmark).forEach(e=>pinned.add(e.map));
 const generated=maps.filter(m=>m.infiniteGenerated&&!pinned.has(m.id)).sort((a,b)=>recent.indexOf(a.id)-recent.indexOf(b.id));
 const remove=new Set(generated.slice(0,Math.max(0,maps.filter(m=>m.infiniteGenerated).length-LIMIT)).map(m=>m.id));
 maps=maps.filter(m=>!remove.has(m.id));
 let seed={...s.seed,legend,maps,entities:s.seed.entities.filter(e=>!remove.has(e.map)).map(e=>e.id==='player'?{...e,map:destination.id,...landing}:e)};
 if(window.GulchCaveEnemies)seed=window.GulchCaveEnemies.advance(seed);
 Gulch.commit({...s.gameState,seed,turn:(Number(s.turn)||0)+1,sword:{...s.gameState.sword,facing:{dx,dy}},infiniteWorld:{...previous,epoch:epoch(s),seed:previous.seed||epoch(s),recent:recent.filter(id=>maps.some(m=>m.id===id)).slice(-32)}},(fresh?'Discovered ':'Entered ')+destination.name+'.');
 return true;
}
Gulch.register=function(name,callbacks){
 if(name!=='world'||typeof callbacks.action!=='function')return originalRegister(name,callbacks);
 return originalRegister(name,{...callbacks,action(a){if(!transition(a))callbacks.action(a);}});
};
const label=document.createElement('span');label.id='frontierLocation';label.style.cssText='position:absolute;left:18px;top:112px;z-index:2;max-width:55%;pointer-events:none;color:#c9dabb;background:#102321dd;padding:4px 7px;border-radius:4px;font:10px monospace';label.setAttribute('aria-live','polite');document.getElementById('left').append(label);
Gulch.register('infinite-frontier',{snapshot(s){
 snapshot=s;
 const cell=s.seed.maps.find(m=>m.id===s.mapId)?.infiniteCell;
 label.textContent=cell?'FRONTIER '+cell.x+', '+cell.y+' · cross an edge to explore':'Opening frontier paths…';
 initialize();
}});
setInterval(()=>{if(!document.hidden)initialize();},700);
})();
