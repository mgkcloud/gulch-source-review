(function(){
'use strict';
const kinds={
 skitter:{name:'Needle skitterer',hp:4,damage:1,size:.62,color:'#9ec887'},
 brute:{name:'Ironhide charger',hp:20,damage:5,size:1.4,color:'#bb8966'},
 storm:{name:'Storm lantern',hp:10,damage:3,size:.95,color:'#b7b4ee'},
 colossus:{name:'Ancient Hollow Colossus',hp:100,damage:12,size:2.6,color:'#dfab70'}
};
function hash(value){let h=2166136261;for(const c of String(value))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
function epoch(d){return String(d.respawnSettings?.token||'original');}
function floor(seed,map,x,y){const c=map?.ascii[y]?.[x];return Boolean(c)&&!['#','~'].includes(c)&&!['wall','water'].includes(seed.legend[c]?.[0]);}
function line(seed,map,a,b){
 let x=a.x,y=a.y,dx=Math.abs(b.x-x),dy=-Math.abs(b.y-y),sx=x<b.x?1:-1,sy=y<b.y?1:-1,err=dx+dy;
 for(let i=0;i<128;i++){
  if(x===b.x&&y===b.y)return true;
  const twice=2*err;let nx=x,ny=y;
  if(twice>=dy){err+=dy;nx+=sx;}
  if(twice<=dx){err+=dx;ny+=sy;}
  if(!floor(seed,map,nx,ny)||(nx!==x&&ny!==y&&(!floor(seed,map,nx,y)||!floor(seed,map,x,ny))))return false;
  x=nx;y=ny;
 }
 return false;
}
function footprint(seed,map,e,x,y){
 const radius=e.enemyVariety==='colossus'?1:0;
 for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++)if(!floor(seed,map,x+dx,y+dy)||map.exits?.some(v=>v.x===x+dx&&v.y===y+dy))return false;
 return true;
}
function utf8Bytes(text){
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
function populate(data){
 const seed=data.seed,p=seed?.entities?.find(e=>e.id==='player'),map=seed?.maps?.find(m=>m.id===p?.map);
 if(!map||p.hp<=0||data.gulchPermanentGameOver?.ended||map.enemyVarietyVersion===1)return data;
 const root=String(data.respawnSettings?.generationSeed||seed.meta?.seed||'gulch'),key=root+':variety:'+map.id;
 const mode=data.respawnSettings?.difficulty||'hard',scale={easy:.8,normal:1,hard:1.25,nightmare:1.6}[mode]||1;
 let converted=0;
 let entities=seed.entities.map(e=>{
  if(e.map!==map.id||e.caveEncounter!==1||e.dreadBeast||e.enemyVariety||!(e.hp>0)||e.practiceTarget)return e;
  const roll=hash(key+':'+e.id)%5;
  if(roll>2)return e;
  const type=['skitter','brute','storm'][roll],k=kinds[type],maxHp=Math.ceil(k.hp*scale);
  converted++;
  return {...e,name:k.name,enemyVariety:type,maxHp,hp:Math.max(1,Math.ceil(maxHp*Math.min(1,e.hp/(e.maxHp||e.hp)))),enemyBeat:0,enemyIntent:null};
 });
 const seen=new Set([p.x+','+p.y]),queue=[{x:p.x,y:p.y}];
 for(let i=0;i<queue.length&&queue.length<10000;i++)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
  const x=queue[i].x+dx,y=queue[i].y+dy,k=x+','+y;
  if(!seen.has(k)&&floor(seed,map,x,y)){seen.add(k);queue.push({x,y});}
 }
 const occupied=new Set(entities.filter(e=>e.map===map.id).map(e=>e.x+','+e.y));
 const refuges=entities.filter(e=>e.map===map.id&&(e.townRefuge||e.outsideNPC||e.swordQuestLandmark));
 const spots=queue.filter(q=>Math.hypot(q.x-p.x,q.y-p.y)>=10&&!occupied.has(q.x+','+q.y)&&!map.exits?.some(e=>Math.hypot(e.x-q.x,e.y-q.y)<4)&&refuges.every(e=>Math.hypot(e.x-q.x,e.y-q.y)>7)).sort((a,b)=>hash(key+':'+a.x+','+a.y)-hash(key+':'+b.x+','+b.y));
 let serial=0;
 function add(type,q){
  let id='variety:'+map.id+':'+serial++;while(entities.some(e=>e.id===id))id+='x';
  const k=kinds[type],hp=Math.ceil(k.hp*scale);
  entities.push({id,map:map.id,...q,name:k.name,kind:'cave-creature',faction:'hostile',caveEncounter:1,caveSprite:type==='storm'?'wisp':'beetle',enemyVariety:type,enemyBeat:0,enemyIntent:null,hp,maxHp:hp,glyph:' '});occupied.add(q.x+','+q.y);
 }
 const hostileCount=entities.filter(e=>e.map===map.id&&e.faction==='hostile'&&e.hp>0).length;
 if(converted<2&&hostileCount<36){
  for(const type of ['skitter','brute','storm'].slice(0,Math.min(2,36-hostileCount))){const q=spots.find(q=>!occupied.has(q.x+','+q.y));if(q)add(type,q);}
 }
 let boss=false;
 if(hash(key+':rare-colossus')%12===0&&!entities.some(e=>e.enemyVariety==='colossus'&&e.hp>0)){
  const q=spots.find(q=>Math.hypot(q.x-p.x,q.y-p.y)>=17&&footprint(seed,map,{enemyVariety:'colossus'},q.x,q.y)&&[-1,0,1].every(dy=>[-1,0,1].every(dx=>seen.has((q.x+dx)+','+(q.y+dy))&&!occupied.has((q.x+dx)+','+(q.y+dy)))));
  if(q){add('colossus',q);boss=true;}
 }
 const next={...data,seed:{...seed,entities,maps:seed.maps.map(m=>m.id===map.id?{...m,enemyVarietyVersion:1,rareColossusRegion:boss}:m)}};
 return utf8Bytes(JSON.stringify(next))<325000?next:data;
}
function advance(seed,baseAdvance){
 const originalPlayer=seed.entities.find(e=>e.id==='player');
 if(!originalPlayer||originalPlayer.hp<=0)return baseAdvance(seed);
 const active=seed.entities.filter(e=>kinds[e.enemyVariety]&&e.caveEncounter===1&&e.hp>0&&e.map===originalPlayer.map);
 if(!active.length)return baseAdvance(seed);
 const ids=new Set(active.map(e=>e.id));
 let next=baseAdvance({...seed,entities:seed.entities.map(e=>ids.has(e.id)?{...e,caveEncounter:0}:e)});
 let entities=next.entities.map(e=>ids.has(e.id)?{...e,caveEncounter:1}:e);
 const p=entities.find(e=>e.id==='player'),map=seed.maps.find(m=>m.id===p.map);
 if(p.hp<=0)return {...next,entities};
 let damage=0;
 function update(e){entities=entities.map(v=>v.id===e.id?e:v);}
 function move(e,steps){
  for(let i=0;i<steps;i++){
   const dx=p.x-e.x,dy=p.y-e.y;
   if(Math.max(Math.abs(dx),Math.abs(dy))<=1)break;
   const options=Math.abs(dx)>=Math.abs(dy)?[[Math.sign(dx),0],[0,Math.sign(dy)]]:[[0,Math.sign(dy)],[Math.sign(dx),0]];
   const step=options.find(([a,b])=>{
    if(!a&&!b)return false;const x=e.x+a,y=e.y+b;
    return footprint(seed,map,e,x,y)&&!entities.some(v=>v.id!==e.id&&v.map===p.map&&v.x===x&&v.y===y);
   });
   if(!step)break;
   e={...e,x:e.x+step[0],y:e.y+step[1]};update(e);
  }
  return e;
 }
 for(const original of active){
  let e=entities.find(v=>v.id===original.id);if(!e)continue;
  const beat=(Number.isSafeInteger(e.enemyBeat)?e.enemyBeat:0)+1;
  e={...e,enemyBeat:beat%100000};
  const distance=Math.hypot(p.x-e.x,p.y-e.y),k=kinds[e.enemyVariety];
  if(distance>13){update({...e,enemyIntent:null});continue;}
  if(e.enemyIntent){
   const intent=e.enemyIntent;
   if(intent.tiles.some(q=>q.x===p.x&&q.y===p.y)&&line(seed,map,e,p))damage+=k.damage;
   update({...e,enemyIntent:null,enemyRecovery:e.enemyVariety==='colossus'?2:1});
   continue;
  }
  if(e.enemyRecovery>0){update({...e,enemyRecovery:e.enemyRecovery-1});continue;}
  const adjacent=Math.max(Math.abs(p.x-e.x),Math.abs(p.y-e.y))<=1&&line(seed,map,e,p);
  if(e.enemyVariety==='skitter'){
   if(adjacent){damage+=k.damage;update(e);}else move(e,beat%3===0?2:1);
   continue;
  }
  let tiles=[];
  if(e.enemyVariety==='storm'&&distance<=6&&line(seed,map,e,p))tiles=[{x:p.x,y:p.y}];
  if(e.enemyVariety==='brute'&&distance<=4&&line(seed,map,e,p)){
   const dx=Math.sign(p.x-e.x),dy=Math.sign(p.y-e.y);
   if(!dx||!dy||Math.abs(p.x-e.x)===Math.abs(p.y-e.y))for(let i=1;i<=4;i++){
    const q={x:e.x+dx*i,y:e.y+dy*i};if(!floor(seed,map,q.x,q.y)||!line(seed,map,e,q))break;tiles.push(q);
   }
  }
  if(e.enemyVariety==='colossus'&&distance<=3.5){
   for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
    const q={x:e.x+dx,y:e.y+dy};if((dx||dy)&&floor(seed,map,q.x,q.y)&&line(seed,map,e,q))tiles.push(q);
   }
  }
  if(tiles.length){update({...e,enemyIntent:{tiles,kind:e.enemyVariety}});continue;}
  if(e.enemyVariety==='colossus'&&beat%2===0){update(e);continue;}
  move(e,1);
 }
 if(damage)entities=entities.map(e=>e.id==='player'?{...e,hp:Math.max(0,e.hp-damage)}:e);
 return {...next,entities};
}
globalThis.GulchEnemyVarietyEffects=Object.freeze({kinds,hash,epoch,floor,line,footprint,populate,advance});
})();
