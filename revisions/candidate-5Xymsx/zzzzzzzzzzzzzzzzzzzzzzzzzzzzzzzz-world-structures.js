(function(){
'use strict';
const baseCommit=Gulch.commit,VERSION=1;
let latest=null,attempt=null;
const host=document.getElementById('left');
if(!host)return;
function random(text){let h=2166136261;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619);return ()=>{h=(h+0x6d2b79f5)|0;let t=Math.imul(h^(h>>>15),h|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
function walk(grid,legend,x,y){const c=grid[y]?.[x];return Boolean(c)&&!['#','~'].includes(c)&&!['wall','water'].includes(legend[c]?.[0]);}
function symbol(legend,kind,material){for(const c of Object.keys(legend))if(c.length===1&&!['#','~','>'].includes(c)&&legend[c]?.[0]===kind&&legend[c]?.[1]===material)return c;for(let i=0xe700;i<0xf800;i++){const c=String.fromCharCode(i);if(!Object.prototype.hasOwnProperty.call(legend,c)){legend[c]=[kind,material];return c;}}throw new Error('No structure terrain symbols remain.');}
function enrich(data){
 const seed=data?.seed,p=seed?.entities?.find(e=>e.id==='player'),map=seed?.maps?.find(m=>m.id===p?.map);
 if(!map||p.hp<=0||data.gulchPermanentGameOver?.ended||map.blockSettlements?.version===VERSION)return data;
 const area=map.ascii.reduce((n,row)=>n+row.length,0);
 if(area>16000)return data;
 const cell=map.infiniteCell,key=String(data.respawnSettings?.generationSeed||seed.meta?.seed||'gulch')+':block-settlements:'+(cell?cell.realm+':'+cell.x+':'+cell.y:map.id),rng=random(key);
 const cave=map.secretCave||/cave|cavern|underground|dungeon|grotto|mine/i.test([map.biome,map.name].join(' '));
 const legend={...seed.legend},tile={};
 for(const [name,kind,mat] of [['wall','wall','wood'],['stoneWall','wall','stone'],['wood','floor','plank'],['stone','floor','stone'],['path','floor','soil'],['tree','floor','tree']])tile[name]=symbol(legend,kind,mat);
 const grid=map.ascii.map(row=>row.split('')),width=Math.max(...map.ascii.map(r=>r.length)),height=grid.length;
 if(width*height>32000)return data;
 const size=width*height,reachable=new Uint8Array(size),protectedCells=new Uint8Array(size),reserved=new Uint8Array(size),queue=new Int32Array(size);
 let head=0,tail=0;
 const origin=p.y*width+p.x;queue[tail++]=origin;reachable[origin]=1;
 while(head<tail){const index=queue[head++],x=index%width,y=Math.floor(index/width);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=width||ny>=height)continue;const k=ny*width+nx;if(!reachable[k]&&walk(grid,legend,nx,ny)){reachable[k]=1;queue[tail++]=k;}}}
 function protect(x,y,r){for(let yy=Math.max(0,y-r);yy<=Math.min(height-1,y+r);yy++)for(let xx=Math.max(0,x-r);xx<=Math.min(width-1,x+r);xx++)protectedCells[yy*width+xx]=1;}
 protect(p.x,p.y,4);
 seed.entities.filter(e=>e.map===map.id).forEach(e=>protect(e.x,e.y,1));
 for(const q of map.exits||[])protect(q.x,q.y,3);
 for(const q of [...(map.dynamicRegion?.sites||[]),...(map.landmarks||[]),...(map.groundHazards?.cells||[])])protect(q.x,q.y,2);
 for(const q of [...(data.legendarySwordQuest?.sites||[]),...(data.wayfarerPilgrimage?.sites||[])])if(q.map===map.id)protect(q.x,q.y,2);
 for(const site of map.npcConstruction?.sites||[])for(let y=site.y-1;y<=site.y+site.h;y++)for(let x=site.x-1;x<=site.x+site.w;x++)protect(x,y,0);
 for(const d of map.villageLife?.districts||[]){protect(d.well.x,d.well.y,1);for(const q of d.garden)protect(q.x,q.y,1);}
 grid.forEach((row,y)=>row.forEach((c,x)=>{if(c==='>')protect(x,y,2);}));
 const candidates=[];
 for(let y=3;y<height-4;y++)for(let x=3;x<grid[y].length-4;x++)if(reachable[y*width+x])candidates.push({x,y});
 for(let i=candidates.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
 const designs=[];
 function fits(x,y,w,h){
  for(let yy=y-1;yy<=y+h;yy++)for(let xx=x-1;xx<=x+w;xx++){
   if(xx<0||yy<0||xx>=width||yy>=height)return false;
   const k=yy*width+xx,c=grid[yy]?.[xx],material=legend[c]?.[1];
   if(!c||!reachable[k]||protectedCells[k]||reserved[k]||!walk(grid,legend,xx,yy)||['wood','plank'].includes(material))return false;
  }
  return true;
 }
 function reserve(x,y,w,h){for(let yy=y-1;yy<=y+h;yy++)for(let xx=x-1;xx<=x+w;xx++)reserved[yy*width+xx]=1;}
 function install(x,y,w,h,kind){
  if(!fits(x,y,w,h))return false;
  const door=x+Math.floor(w/2);
  // A clear, unchanged perimeter connects every former crossing. The interior
  // remains connected through both doors, so no whole-map flood is needed here.
  for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){
   const edge=xx===x||xx===x+w-1||yy===y||yy===y+h-1;
   let c=kind==='house'?tile.wood:tile.stone;
   if(edge){if(kind==='house')c=tile.wall;else if(((xx===x||xx===x+w-1)&&(yy===y||yy===y+h-1))||rng()<.38)c=tile.stoneWall;}
   if(xx===door&&(yy===y||yy===y+h-1))c=kind==='house'?tile.wood:tile.path;
   grid[yy][xx]=c;
  }
  grid[y-1][door]=tile.path;grid[y+h][door]=tile.path;
  reserve(x,y,w,h);designs.push({kind,x,y,w,h,door,roof:Math.floor(rng()*3)});return true;
 }
 const names=['Birch Lantern','Copperbrook','Oakbarrow','Moss Crossing','Stone Orchard'],target=area>2400?8:5;
 let village=null,houses=0,tries=0;
 for(const q of candidates){
  if(tries++>=140||designs.length>=target)break;
  const house=!cave&&houses<Math.ceil(target*.6);
  if(village&&house&&Math.hypot(q.x-village.x,q.y-village.y)>19)continue;
  const w=house?(rng()<.5?5:7):5,h=house?5:(rng()<.5?5:7);
  if(install(q.x,q.y,w,h,house?'house':'ruin')&&house){houses++;if(!village)village={x:q.x,y:q.y,name:names[Math.floor(rng()*names.length)]};}
 }
 let ruins=designs.filter(d=>d.kind==='ruin').length;
 for(const q of candidates){if(designs.length>=target+2||ruins>=3)break;if(designs.some(d=>Math.hypot(d.x-q.x,d.y-q.y)<10))continue;if(install(q.x,q.y,5,5,'ruin'))ruins++;}
 if(!cave){let trees=0;for(const q of candidates){if(trees>=(area>2400?9:5))break;if(!fits(q.x,q.y,3,3)||designs.some(d=>Math.hypot(d.x-q.x,d.y-q.y)<7))continue;for(let dy=0;dy<3;dy++)for(let dx=0;dx<3;dx++)grid[q.y+dy][q.x+dx]=tile.tree;reserve(q.x,q.y,3,3);designs.push({kind:'great-tree',x:q.x+1,y:q.y+1,w:3,h:3,variant:Math.floor(rng()*3)});trees++;}}
 const entities=seed.entities.slice(),ids=new Set(entities.map(e=>e.id));
 function add(site,values){let id='block-site:'+map.id+':'+designs.indexOf(site);while(ids.has(id))id+='x';ids.add(id);entities.push({id,map:map.id,...values});}
 const house=designs.find(d=>d.kind==='house');
 if(house&&entities.filter(e=>e.blockSettler).length<24)add(house,{name:(village?.name||'Woodland')+' builder',x:house.x+1,y:house.y+2,kind:'villager',faction:'friendly',outsideNPC:true,blockSettler:true,dialogue:'We build with oak frames, stone footings and steep block roofs. The open doors run north to south. Old towers lie beyond the great trees; search their fallen halls for supplies.'});
 const ruin=designs.find(d=>d.kind==='ruin');
 if(ruin&&entities.filter(e=>e.ecosystemLoot).length<44)add(ruin,{name:'Overgrown ruin coffer',x:ruin.x+1,y:ruin.y+1,kind:'loot',ecosystemLoot:true,glyph:'▣',color:'#d8c68e',contents:{scrap:2,fiber:2,image_coin:1}});
 const next={...data,seed:{...seed,legend,entities,maps:seed.maps.map(m=>m.id===map.id?{...m,ascii:grid.map(row=>row.join('')),blockSettlements:{version:VERSION,village,designs}}:m)}};
 return new TextEncoder().encode(JSON.stringify(next)).length<320000?next:data;
}
Gulch.commit=function(data,activity,options){return baseCommit(data?.seed?enrich(data):data,activity,options);};
const canvas=document.createElement('canvas');canvas.id='blockSettlementArt';canvas.setAttribute('aria-hidden','true');canvas.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:1';host.append(canvas);
let lastPaintKey='',scene=0;
function paint(){
 if(document.hidden)return;
 const w=host.clientWidth,h=host.clientHeight,dpr=Math.min(window.devicePixelRatio||1,2),p=latest?.player,visual=window.GulchMovementState?.visual,camera=visual?.map===p?.map?visual:p;
 const key=[scene,w,h,dpr,camera?.map,camera?.x,camera?.y].join('|');if(key===lastPaintKey)return;lastPaintKey=key;
 const cw=Math.max(1,Math.round(w*dpr)),ch=Math.max(1,Math.round(h*dpr));
 if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;canvas.style.width=w+'px';canvas.style.height=h+'px';}
 const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.imageSmoothingEnabled=false;
 if(!latest||!p)return;
 const map=latest.seed.maps.find(m=>m.id===p.map),ts=Math.max(20,Math.min(64,Number(latest.seed.meta?.tileSize)||32));
 const point=(x,y)=>({x:w/2+(x-camera.x)*ts,y:h/2+(y-camera.y)*ts});
 const visible=(x,y)=>latest.lit[y]?.[x]===1;
 for(const d of map?.blockSettlements?.designs||[]){
  if(d.kind==='great-tree'){
   const q=point(d.x,d.y);if(q.x<-ts*3||q.x>w+ts*3||q.y<-ts*3||q.y>h+ts*3)continue;
   const colors=[['#244634','#3d6440','#62864e'],['#354c35','#637841','#92a355'],['#473f30','#80623c','#b08b47']][d.variant||0];
   for(let dy=-2;dy<=1;dy++)for(let dx=-2;dx<=2;dx++){
    if(!visible(d.x+dx,d.y+dy)||Math.abs(dx)+(dy===-2?1:0)>2)continue;
    const a=point(d.x+dx,d.y+dy),near=Math.abs(p.x-d.x)<=3&&Math.abs(p.y-d.y)<=3;
    ctx.globalAlpha=near?.38:.9;ctx.fillStyle=colors[(dx*dx+dy*dy)%3];ctx.fillRect(a.x-ts*.5,a.y-ts*.5,ts,ts);ctx.fillStyle='#abc578';ctx.globalAlpha=near?.18:.3;ctx.fillRect(a.x-ts*.4,a.y-ts*.4,ts*.65,ts*.12);
   }
   ctx.globalAlpha=1;
   if(visible(d.x,d.y)){ctx.fillStyle='#59402b';ctx.fillRect(q.x-ts*.2,q.y-ts*.25,ts*.4,ts*.8);ctx.fillStyle='#987047';ctx.fillRect(q.x-ts*.12,q.y-ts*.2,ts*.12,ts*.7);}
   continue;
  }
  for(let dy=0;dy<d.h;dy++)for(let dx=0;dx<d.w;dx++){
   const x=d.x+dx,y=d.y+dy;if(!visible(x,y))continue;
   const q=point(x,y);if(q.x<-ts||q.x>w+ts||q.y<-ts||q.y>h+ts)continue;
   const wall=latest.seed.legend[map.ascii[y]?.[x]]?.[0]==='wall';
   if(d.kind==='house'&&wall){
    ctx.fillStyle=['#8e563b','#627874','#84564e'][d.roof];ctx.fillRect(q.x-ts*.5,q.y-ts*.5,ts,ts*.8);ctx.fillStyle='#d3a571';ctx.fillRect(q.x-ts*.5,q.y+ts*.23,ts,ts*.12);
    ctx.fillStyle='#45392f';ctx.fillRect(q.x-ts*.44,q.y-ts*.5,ts*.12,ts);ctx.fillRect(q.x+ts*.32,q.y-ts*.5,ts*.12,ts);
    if(dy>0&&dy<d.h-1){ctx.fillStyle='#263e44';ctx.fillRect(q.x-ts*.22,q.y-ts*.13,ts*.44,ts*.35);ctx.fillStyle='#d8c587';ctx.fillRect(q.x-ts*.03,q.y-ts*.13,ts*.06,ts*.35);ctx.fillRect(q.x-ts*.22,q.y+ts*.02,ts*.44,ts*.05);}
    else{ctx.fillStyle='#ba8053';for(let k=0;k<3;k++)ctx.fillRect(q.x-ts*.3,q.y-ts*.4+k*ts*.23,ts*.6,ts*.04);}
   }else if(d.kind==='ruin'){
    ctx.fillStyle=wall?'#9b9a80':'#656f58';ctx.globalAlpha=wall?.8:.5;ctx.fillRect(q.x-ts*.35,q.y-ts*.32,ts*.29,ts*.16);ctx.fillRect(q.x+ts*.1,q.y+ts*.15,ts*.2,ts*.12);
    if(wall){ctx.fillStyle='#496c44';ctx.fillRect(q.x-ts*.35,q.y-ts*.35,ts*.2,ts*.5);ctx.fillRect(q.x-ts*.2,q.y-ts*.1,ts*.3,ts*.12);}ctx.globalAlpha=1;
   }
  }
 }
 ctx.globalAlpha=1;
}
function setup(){if(!latest||document.hidden||window.GulchMovementState?.inFlight||attempt===latest.stateRevision)return;const next=enrich(latest.gameState);if(next===latest.gameState)return;attempt=latest.stateRevision;Gulch.commit(next,'Discovered block-built homes, ancient ruins and great woodland trees.');}
Gulch.register('block-settlements',{snapshot(s){latest=s;scene++;setup();paint();},resize:paint});
document.addEventListener('visibilitychange',()=>{lastPaintKey='';if(!document.hidden)paint();});
setInterval(()=>{if(!document.hidden)setup();},1400);
})();
