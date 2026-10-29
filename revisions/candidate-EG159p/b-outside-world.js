(function(){
'use strict';
const KEY='outsideWorld',MAP='gulch-outside-meadow';
let snapshot=null,pending=null;
const host=document.getElementById('left');
function node(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
const style=node('style');style.textContent='#outsideTools{position:absolute;left:18px;top:182px;z-index:4;max-width:235px;padding:10px;border:1px solid #81966a;border-radius:6px;background:#13291ff0;color:#dce4c8;font:11px/1.5 monospace}#outsideTools button{display:block;margin-top:6px;padding:8px;min-height:40px;background:#2d4931;color:#ffe6b1;border:1px solid #8da073;border-radius:4px;font:inherit}#outsideTools button:disabled{opacity:.5}#outsideTools p{margin:3px 0}@media(max-width:700px){#outsideTools{left:10px;top:210px;max-width:170px;font-size:10px}}';document.head.append(style);
const box=node('section');box.id='outsideTools';box.setAttribute('aria-label','Outside world');const heading=node('strong','THE OUTSIDE WORLD'),info=node('p','Finding a safe staircase…'),stock=node('p'),gather=node('button','Gather nearby resource');gather.type='button';const status=node('p');status.setAttribute('role','status');box.append(heading,info,stock,gather,status);host.append(box);
function floor(seed,map,x,y){const c=map?.ascii[y]?.[x];return Boolean(c)&&!['#','~'].includes(c)&&!['wall','water'].includes(seed.legend[c]?.[0]);}
function free(seed,map,x,y){return floor(seed,map,x,y)&&!map.exits?.some(e=>e.x===x&&e.y===y)&&!seed.entities.some(e=>e.map===map.id&&e.x===x&&e.y===y);}
function stairLocation(s){
 const map=s.seed.maps.find(m=>m.id===s.mapId),p=s.player,queue=[{x:p.x,y:p.y}],seen=new Set([p.x+','+p.y]);
 for(let i=0;i<queue.length&&i<12000;i++){
  const q=queue[i];if(i>0&&free(s.seed,map,q.x,q.y)&&map.ascii[q.y][q.x]!=='>')return q;
  for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]){const x=q.x+dx,y=q.y+dy,k=x+','+y;if(!seen.has(k)&&floor(s.seed,map,x,y)&&!s.seed.entities.some(e=>e.id!=='player'&&e.map===map.id&&e.x===x&&e.y===y)){seen.add(k);queue.push({x,y});}}
 }
 if(floor(s.seed,map,p.x,p.y)&&!map.exits?.some(e=>e.x===p.x&&e.y===p.y))return {x:p.x,y:p.y};return null;
}
function build(s,stair){
 const seed=s.seed,W=48,H=36;let id=MAP;while(seed.maps.some(m=>m.id===id))id+='-1';
 const occupiedIds=new Set(seed.entities.map(e=>e.id));
 function uid(base){let n='outdoors-'+base;while(occupiedIds.has(n))n+='-1';occupiedIds.add(n);return n;}
 const legend={...seed.legend};
 function symbol(kind,material){for(let code=0xe000;code<0xe100;code++){const c=String.fromCharCode(code);if(!Object.prototype.hasOwnProperty.call(legend,c)){legend[c]=[kind,material];return c;}}throw new Error('No outdoor terrain symbols available.');}
 const grass=symbol('floor','grass'),tree=symbol('floor','tree'),wall=symbol('wall','wood'),plank=symbol('floor','plank'),path=symbol('floor','soil'),water=symbol('water','water'),stone=symbol('floor','stone');
 const grid=Array.from({length:H},(_,y)=>Array.from({length:W},(_,x)=>x===0||y===0||x===W-1||y===H-1?wall:grass));
 const noise=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
 for(let y=2;y<H-2;y++)for(let x=2;x<W-2;x++){if(x>35&&y>23&&((x-40)*(x-40)/30+(y-28)*(y-28)/18)<1)grid[y][x]=water;else if(noise(x,y)>.81)grid[y][x]=tree;}
 for(let y=3;y<33;y++)for(let x=22;x<=24;x++)grid[y][x]=path;
 for(let x=5;x<43;x++)for(let y=10;y<=11;y++)grid[y][x]=path;
 for(let x=5;x<35;x++)for(let y=25;y<=26;y++)grid[y][x]=path;
 function house(x,y){for(let dy=0;dy<5;dy++)for(let dx=0;dx<7;dx++)grid[y+dy][x+dx]=dy===0||dy===4||dx===0||dx===6?wall:plank;grid[y+4][x+3]=plank;for(let yy=y+5;yy<=Math.min(H-2,y+6);yy++)grid[yy][x+3]=path;}
 house(6,4);house(29,4);house(6,19);house(28,19);
 for(let y=2;y<=6;y++)for(let x=21;x<=25;x++)grid[y][x]=stone;grid[3][23]='>';
 const entities=[];function add(base,e){entities.push({id:uid(base),map:id,...e});}
 function clearing(x,y){for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const a=x+dx,b=y+dy;if(a>0&&a<W-1&&b>0&&b<H-1&&grid[b][a]===tree)grid[b][a]=grass;}}
 const villagers=[['elder','Elder Willow',20,10,'Welcome to Willowbrook. Our northern village shares the road with Copper Hollow to the south. Gather wood from fallen branches and ore from the exposed deposits.'],['smith','Copper Hollow smith',25,25,'Iron and copper lie along the eastern ridge. Bring your pick and gather beside a deposit; the shared resource pack keeps your supplies.'],['gardener','Willowbrook gardener',9,8,'The grass is soft and the animals are friendly. Doors in the wooden houses are open.'],['forester','Hollow forester',31,23,'Look for fallen wood beside the trees. We leave the living forest standing.']];
 villagers.forEach(([key,name,x,y,dialogue])=>{clearing(x,y);add(key,{name,x,y,kind:'villager',faction:'friendly',dialogue,outsideNPC:true});});
 const animals=[['deer','Meadow deer',15,15],['rabbit','White rabbit',19,8],['sheep','Village sheep',13,27],['fox','Woodland fox',34,16],['rabbit','Brown rabbit',18,29],['deer','Young deer',29,29]];
 animals.forEach(([species,name,x,y],i)=>{clearing(x,y);grid[y][x]=grass;add('animal-'+i,{name,x,y,kind:'animal',species,faction:'friendly',outsideAnimal:species,glyph:' ',dialogue:species==='sheep'?'The sheep gives a gentle bleat.':species==='fox'?'The fox watches you with bright, curious eyes.':'The animal grazes peacefully nearby.'});});
 const resources=[['wood',5,14],['wood',16,6],['wood',31,14],['wood',17,23],['wood',5,29],['wood',33,30],['iron',39,5],['copper',41,10],['crystal',39,16],['stone',36,20],['iron',42,19],['copper',37,8],['crystal',7,32],['stone',26,31]];
 resources.forEach(([resource,x,y],i)=>{clearing(x,y);grid[y][x]=resource==='wood'?grass:stone;add('resource-'+i,{name:{wood:'Fallen oak wood',iron:'Iron ore deposit',copper:'Copper ore deposit',crystal:'Quartz mineral cluster',stone:'Loose mineral stone'}[resource],x,y,kind:'resource',outsideResource:resource,quantity:resource==='wood'?3:2,glyph:resource==='wood'?'≡':'◆',color:{wood:'#deb77f',iron:'#b9c4cb',copper:'#e39b62',crystal:'#bcdfff',stone:'#d5d4bf'}[resource]});});
 const current=seed.maps.find(m=>m.id===s.mapId),ascii=current.ascii.map((row,y)=>y===stair.y?row.slice(0,stair.x)+'>'+row.slice(stair.x+1):row);
 const entrance={x:stair.x,y:stair.y,to:id,at:{x:23,y:3}};
 const outside={id,name:'Willowbrook & Copper Hollow',biome:'meadow',ascii:grid.map(row=>row.join('')),exits:[{x:23,y:3,to:current.id,at:{x:stair.x,y:stair.y}}]};
 return {...s.gameState,seed:{...seed,legend,maps:[...seed.maps.map(m=>m.id===current.id?{...m,ascii,exits:[...(m.exits||[]),entrance]}:m),outside],entities:[...seed.entities,...entities]},[KEY]:{map:id,entrance:{map:current.id,...stair},resources:{},villages:[{name:'Willowbrook',x:20,y:10},{name:'Copper Hollow',x:25,y:25}]}};
}
function setup(){
 if(!snapshot||snapshot.gameState[KEY]||window.GulchMovementState?.inFlight||pending===snapshot.stateRevision)return;
 const stair=stairLocation(snapshot);if(!stair){info.textContent='Move to open ground to create the outdoor stairs.';return;}
 const data=build(snapshot,stair);pending=snapshot.stateRevision;Gulch.commit(data,'A staircase to the outside world opens at '+stair.x+', '+stair.y+'.');
}
function nearest(){
 if(!snapshot)return null;const p=snapshot.player,map=snapshot.seed.maps.find(m=>m.id===p.map);
 return snapshot.seed.entities.filter(e=>e.outsideResource&&e.map===p.map&&Math.max(Math.abs(e.x-p.x),Math.abs(e.y-p.y))<=1&&(!(e.x!==p.x&&e.y!==p.y)||(floor(snapshot.seed,map,e.x,p.y)&&floor(snapshot.seed,map,p.x,e.y)))).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0]||null;
}
function modal(){return ['inventoryPanel','characterPanel','questBoard','workBoard'].some(id=>{const n=document.getElementById(id);return n&&!n.hidden;});}
function harvest(){
 const move=window.GulchMovementState;if(!snapshot||!move?.focused||move.inFlight||modal())return;
 const e=nearest(),world=snapshot.gameState[KEY];if(!e||!world)return;
 const amount=e.quantity||1,resources={...world.resources,[e.outsideResource]:(Number(world.resources?.[e.outsideResource])||0)+amount};
 Gulch.commit({...snapshot.gameState,seed:{...snapshot.seed,entities:snapshot.seed.entities.filter(v=>v.id!==e.id)},[KEY]:{...world,resources}},'Gathered '+amount+' '+e.outsideResource+' into the shared outdoor resource pack.');
}
gather.addEventListener('click',harvest);
function update(){
 if(!snapshot)return;const world=snapshot.gameState[KEY],p=snapshot.player,settings=snapshot.gameState.respawnSettings;let description;
 if(settings?.hardcore&&settings.generationSeed){const names={easy:'Easy',normal:'Normal',hard:'Hard',nightmare:'Nightmare'};description='Hardcore · '+(names[settings.difficulty]||'Normal')+' · seed '+settings.generationSeed+' · No route to previous worlds.';}
 else if(world)description=p.map===world.map?'Outside · stairs back at 23, 3. Visit Willowbrook (20, 10) and Copper Hollow (25, 25).':p.map===world.entrance.map?'Outdoor stairs: '+world.entrance.x+', '+world.entrance.y+'. Stand there and use > / exit.':'Outdoor stairs are on '+world.entrance.map+'.';
 if(description!==undefined&&info.textContent!==description)info.textContent=description;
 if(world){const text='Shared resources: '+(Object.entries(world.resources||{}).map(([k,v])=>k+' '+v).join(' · ')||'none yet');if(stock.textContent!==text)stock.textContent=text;}
 const e=nearest();gather.hidden=!world||p.map!==world.map;gather.disabled=!e||Boolean(window.GulchMovementState?.inFlight)||modal();gather.textContent=e?'Gather '+e.outsideResource:'Stand beside wood or ore';status.textContent=e?e.name+' · '+e.quantity+' available':'';
}
const overlay=node('canvas');overlay.setAttribute('aria-hidden','true');overlay.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:1';host.append(overlay);
const patterns={deer:['..a...a.....','..aa.aa.....','...bbb......','...beb......','...bbb......','....bbbbbbb.','....bbbbbbb.','.....bbbbbb.','.....b..b...','.....b..b...'],rabbit:['..b.b.......','..b.b.......','..bbb.......','..beb.......','...bbbb.....','...bbbbb....','...bbbbb....','....bbbb....','...bb.bb....','............'],sheep:['............','............','...cccccc...','..cccccccc..','.bbccccccc..','.bebcccccc..','..bbcccccc..','...cccccc...','...b...b....','...b...b....'],fox:['..b..b......','..bbbb......','..bebb......','...bbb......','....bbbbbb..','....bbbbbbbc','.....bbbbbcc','.....b..b...','.....b..b...','............']};
function paint(){
 const w=host.clientWidth,h=host.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
 if(overlay.width!==Math.round(w*dpr)||overlay.height!==Math.round(h*dpr)){overlay.width=Math.max(1,Math.round(w*dpr));overlay.height=Math.max(1,Math.round(h*dpr));overlay.style.width=w+'px';overlay.style.height=h+'px';}
 const ctx=overlay.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);if(!snapshot)return;
 const s=snapshot,p=s.player,v=window.GulchMovementState?.visual,camera=v&&v.map===p.map?v:p,ts=Math.max(20,Math.min(64,Number(s.seed.meta?.tileSize)||32));
 const point=(x,y)=>({x:w/2+(x-camera.x)*ts,y:h/2+(y-camera.y)*ts}),world=s.gameState[KEY];
 if(world&&p.map===world.map){
  const map=s.seed.maps.find(m=>m.id===p.map);
  for(let y=Math.max(0,Math.floor(camera.y-h/ts/2)-1);y<Math.min(map.ascii.length,camera.y+h/ts/2+1);y++)for(let x=Math.max(0,Math.floor(camera.x-w/ts/2)-1);x<Math.min(map.ascii[y].length,camera.x+w/ts/2+1);x++){
   if(s.lit[y]?.[x]!==1||s.seed.legend[map.ascii[y][x]]?.[1]!=='grass')continue;
   const q=point(x,y);ctx.strokeStyle='#8dac6955';ctx.lineWidth=1;
   for(let k=0;k<3;k++){const xx=q.x-ts*.4+((x*7+y*3+k*11)%23)/23*ts*.8,yy=q.y+ts*.36;ctx.beginPath();ctx.moveTo(xx,yy);ctx.lineTo(xx-2,yy-4);ctx.moveTo(xx,yy);ctx.lineTo(xx+2,yy-6);ctx.stroke();}
  }
 }
 for(const e of s.seed.entities){
  if(!e.outsideAnimal||e.map!==p.map||s.lit[e.y]?.[e.x]!==1)continue;
  const visualPosition=window.GulchCameraSmoothing?.entityPosition(e)||e;
  const q=point(visualPosition.x,visualPosition.y),pixel=Math.max(1,Math.floor(ts/14)),rows=patterns[e.outsideAnimal],palette={a:'#d5bd8a',b:e.outsideAnimal==='fox'?'#d2864b':e.outsideAnimal==='rabbit'?'#d1c5ae':'#997753',c:'#eee6cd',e:'#1e2625'};
  rows.forEach((row,y)=>Array.from(row).forEach((c,x)=>{if(palette[c]){ctx.fillStyle=palette[c];ctx.fillRect(Math.round(q.x-6*pixel)+x*pixel,Math.round(q.y-5*pixel)+y*pixel,pixel,pixel);}}));
 }
 if(world){const stair=p.map===world.map?{x:23,y:3}:p.map===world.entrance.map?world.entrance:null;if(stair&&s.lit[stair.y]?.[stair.x]===1){const q=point(stair.x,stair.y);ctx.strokeStyle='#ffe2a1';ctx.lineWidth=2;ctx.strokeRect(q.x-ts*.42,q.y-ts*.42,ts*.84,ts*.84);ctx.font='10px monospace';ctx.textAlign='center';ctx.fillStyle='#fff1ca';ctx.shadowColor='#000';ctx.shadowBlur=4;ctx.fillText(p.map===world.map?'↓ CAVE':'↑ OUTSIDE',q.x,q.y-ts*.58);ctx.shadowBlur=0;}}
}
Gulch.register('outside-world',{snapshot(s){snapshot=s;setup();update();paint();},resize:paint,action(a){if(a?.type==='gather')harvest();}});
setInterval(()=>{if(document.hidden)return;setup();update();},500);
})();
