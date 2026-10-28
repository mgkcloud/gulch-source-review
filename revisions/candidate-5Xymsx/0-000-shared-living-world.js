(function(){
'use strict';
const KEY='livingWorld';
const seasons=[{name:'Greenwake',description:'New growth renews scattered wood and herbs.',resource:'wood'},{name:'Emberfall',description:'Dry ground exposes iron; restless beetles emerge.',resource:'iron'},{name:'Crystal dusk',description:'Crystal seams brighten and wisps gather.',resource:'crystal'},{name:'Long frost',description:'Stone breaks loose while crawlers seek shelter.',resource:'stone'}];
const directions=[[1,0],[-1,0],[0,1],[0,-1]];
function number(v,max){return Number.isFinite(v)?Math.max(0,Math.min(max,Math.floor(v))):0;}
function epoch(data){return String(data.respawnSettings?.token||'original');}
function state(data){const v=data[KEY];return v&&v.epoch===epoch(data)?{...v,visits:Array.isArray(v.visits)?v.visits.slice(-256):[],claims:Array.isArray(v.claims)?v.claims.slice(0,12):[],log:Array.isArray(v.log)?v.log.slice(0,18):[],age:number(v.age,1000000),wave:number(v.wave,100000),forge:number(v.forge,3),camp:number(v.camp,2),herbs:number(v.herbs,99)}:{epoch:epoch(data),age:0,wave:0,forge:0,camp:0,herbs:0,visits:[],claims:[],log:[]};}
function log(v,text){return {...v,log:[{age:v.age,text},...v.log].slice(0,18)};}
function floor(seed,map,x,y){const c=map?.ascii?.[y]?.[x];return Boolean(c)&&!['#','~'].includes(c)&&!['wall','water'].includes(seed.legend[c]?.[0]);}
function spots(seed,p){
 const map=seed.maps.find(m=>m.id===p.map);if(!map)return [];
 const queue=[{x:p.x,y:p.y}];
 const integerPoint=q=>Number.isInteger(q.x)&&Number.isInteger(q.y);
 const numeric=integerPoint(p)&&seed.entities.every(e=>e.map!==p.map||integerPoint(e))&&(!map.exits||map.exits.every(integerPoint));
 if(numeric){
  const seen=new Map([[p.y,new Set([p.x])]]);
  for(let i=0;i<queue.length&&queue.length<6000;i++)for(const [dx,dy] of directions){
   const x=queue[i].x+dx,y=queue[i].y+dy;
   let row=seen.get(y);
   if(!row?.has(x)&&floor(seed,map,x,y)){
    if(!row){row=new Set();seen.set(y,row);}
    row.add(x);queue.push({x,y});
   }
  }
 }else{
  const seen=new Set([p.x+','+p.y]);
  for(let i=0;i<queue.length&&queue.length<6000;i++)for(const [dx,dy] of directions){
   const x=queue[i].x+dx,y=queue[i].y+dy,k=x+','+y;
   if(!seen.has(k)&&floor(seed,map,x,y)){seen.add(k);queue.push({x,y});}
  }
 }
 const occupied=new Set(seed.entities.filter(e=>e.map===p.map).map(e=>e.x+','+e.y));
 return queue.filter(q=>Math.hypot(q.x-p.x,q.y-p.y)>=5&&!occupied.has(q.x+','+q.y)&&map.ascii[q.y][q.x]!=='>'&&!map.exits?.some(e=>e.x===q.x&&e.y===q.y));
}
function supplies(data){const raw=data.outsideWorld?.resources||{};return {...raw,wood:number(raw.wood,9999),iron:number(raw.iron,9999),crystal:number(raw.crystal,9999),stone:number(raw.stone,9999)};}
function withSupplies(data,resources){return {...data,outsideWorld:{...(data.outsideWorld||{}),resources}};}
function evolve(data){
 let v=state(data),seed=data.seed,p=seed.entities.find(e=>e.id==='player');
 if(!p||p.hp<=0)return data;
 v={...v,age:v.age+1};
 const cell=p.map+':'+Math.floor(p.x/4)+','+Math.floor(p.y/4);
 if(!v.visits.includes(cell))v={...v,visits:[...v.visits,cell].slice(-256)};
 const thresholds=[4,10,20,40];
 for(const threshold of thresholds){
  const id='explore-'+threshold;
  if(v.visits.length>=threshold&&!v.claims.includes(id)){
   v=log({...v,claims:[...v.claims,id],herbs:Math.min(99,v.herbs+2)},'Exploration milestone: '+threshold+' regions charted. Received two healing herbs. Next goal: '+(threshold<40?'chart more regions.':'survive the changing seasons.'));
  }
 }
 if(v.age%12===0){
  const season=seasons[Math.floor(v.age/24)%4],wave=v.wave+1;
  v={...v,wave};
  const available=spots(seed,p),entities=[...seed.entities];
  let cursor=available.length?((wave*37)%available.length):0;
  function take(){if(!available.length)return null;const q=available.splice(cursor%available.length,1)[0];cursor+=17;return q;}
  function uid(label){let id='living-'+wave+'-'+label;while(entities.some(e=>e.id===id))id+='x';return id;}
  const resourceCount=entities.filter(e=>e.livingResource).length;
  let supplied=0;
  for(let i=0;i<Math.min(2,24-resourceCount);i++){
   const q=take();if(!q)break;
   const herb=i===1;
   entities.push({id:uid('supply-'+i),name:herb?'Wild healing herbs':season.resource+' outcrop',map:p.map,...q,kind:'resource',livingResource:herb?'herb':season.resource,glyph:herb?'✿':'◆',color:herb?'#bce8ad':'#edcd93',quantity:herb?1:2});supplied++;
  }
  const hostile=entities.filter(e=>e.map===p.map&&e.faction==='hostile'&&e.hp>0).length;
  let spawned=false;
  if(wave%2===0&&hostile<8&&entities.filter(e=>e.livingEnemy).length<16){
   const q=take();
   if(q){
    const tier=Math.min(4,Math.floor(wave/4)),type=['beetle','crawler','wisp'][wave%3],hp=4+tier*2;
    entities.push({id:uid('creature'),name:['Wandering','Hardened','Ancient','Elder','Mythic'][tier]+' '+type,map:p.map,...q,hp,maxHp:hp,faction:'hostile',kind:'cave-creature',caveEncounter:1,caveSprite:type,livingEnemy:true,glyph:' '});spawned=true;
   }
  }
  seed={...seed,entities};
  v=log(v,season.name+': '+(supplied?supplied+' reachable supply patches appeared. ':'No free supply sites available. ')+(spawned?'A stronger wanderer entered this region.':'The encounter population remains bounded.')+' World plan: '+(v.forge<3?'gather iron and crystal to improve your blade.':'prepare healing herbs for the next season.'));
 }
 return {...data,seed,[KEY]:v};
}
function utf8Bytes(text){
 if(text===undefined)return 0;
 text=String(text);
 let bytes=0;
 for(let i=0;i<text.length;i++){
  const code=text.charCodeAt(i);
  if(code<128)bytes++;
  else if(code<2048)bytes+=2;
  else if(code>=55296&&code<=56319&&i+1<text.length&&text.charCodeAt(i+1)>=56320&&text.charCodeAt(i+1)<=57343){bytes+=4;i++;}
  else bytes+=3;
 }
 return bytes;
}
function apply(previousGameState,nextGameState){
 const data=nextGameState;
 if(!previousGameState||!data?.seed||epoch(data)!==epoch(previousGameState))return data;
 let next=data;
 const before=previousGameState;
 if(Number(data.turn)>Number(before.turn)){
  const level=state(before).forge;
  if(level){
   const old=new Map(before.seed.entities.map(e=>[e.id,e]));
   next={...next,seed:{...next.seed,entities:next.seed.entities.map(e=>{
    const prev=old.get(e.id);
    return prev&&e.id!=='player'&&e.faction==='hostile'&&Number.isFinite(prev.hp)&&Number.isFinite(e.hp)&&e.hp<prev.hp?{...e,hp:Math.max(0,e.hp-level)}:e;
   }).filter(e=>!(e.id!=='player'&&e.faction==='hostile'&&Number.isFinite(e.hp)&&e.hp<=0))}};
  }
  next=evolve(next);
 }
 const text=JSON.stringify(next);
 if(text.length*3<=350000)return next;
 if(utf8Bytes(text)>350000)return data;
 return next;
}
globalThis.GulchLivingWorldEffects=Object.freeze({KEY,seasons,number,epoch,state,log,floor,spots,supplies,withSupplies,evolve,apply,utf8Bytes});
})();
