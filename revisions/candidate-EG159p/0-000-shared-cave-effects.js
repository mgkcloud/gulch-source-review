(function(){
'use strict';
function ours(e){return e.caveEncounter===1;}
function walk(seed,map,x,y){const c=map?.ascii[y]?.[x];return Boolean(c)&&!['#','~'].includes(c)&&!['wall','water'].includes(seed.legend[c]?.[0]);}
function rat(e){return [e.id,e.name,e.species,e.type,e.kind].some(v=>typeof v==='string'&&/(^|[^a-z])rats?([^a-z]|$)/i.test(v));}
function advance(seed){
 const player=seed.entities.find(e=>e.id==='player');
 if(!player||!Number.isFinite(player.hp)||player.hp<=0)return seed;
 const map=seed.maps.find(m=>m.id===player.map);
 const active=seed.entities.filter(e=>ours(e)&&e.map===player.map&&e.hp>0);
 if(!active.length)return seed;
 const occupied=new Map(),exits=new Set(),updates=new Map();
 const key=(x,y)=>x+','+y;
 const blocking=e=>!rat(e)||e.id==='player';
 function change(x,y,delta){const k=key(x,y),n=(occupied.get(k)||0)+delta;if(n>0)occupied.set(k,n);else occupied.delete(k);}
 for(const e of seed.entities)if(e.map===player.map&&blocking(e))change(e.x,e.y,1);
 for(const e of map?.exits||[])exits.add(key(e.x,e.y));
 let damage=0;
 for(const original of active){
  const dx=player.x-original.x,dy=player.y-original.y,d=Math.hypot(dx,dy);
  if(d>9)continue;
  if(Math.max(Math.abs(dx),Math.abs(dy))<=1){
   const clear=!(dx&&dy)||(walk(seed,map,original.x+dx,original.y)&&walk(seed,map,original.x,original.y+dy));
   if(clear&&damage<2)damage++;
   continue;
  }
  const choices=Math.abs(dx)>=Math.abs(dy)?[[Math.sign(dx),0],[0,Math.sign(dy)]]:[[0,Math.sign(dy)],[Math.sign(dx),0]];
  const step=choices.find(([x,y])=>{
   if(!x&&!y)return false;
   const nx=original.x+x,ny=original.y+y;
   return walk(seed,map,nx,ny)&&!exits.has(key(nx,ny))&&!occupied.has(key(nx,ny));
  });
  if(!step)continue;
  const moved={...original,x:original.x+step[0],y:original.y+step[1]};
  updates.set(original.id,moved);
  if(blocking(original)){change(original.x,original.y,-1);change(moved.x,moved.y,1);}
 }
 if(damage)updates.set('player',{...player,hp:Math.max(0,player.hp-damage)});
 if(!updates.size)return seed;
 return {...seed,entities:seed.entities.map(e=>updates.get(e.id)||e)};
}
globalThis.GulchCaveEffects=Object.freeze({advanceBase:advance,isEncounter:ours,walk,rat});
})();
