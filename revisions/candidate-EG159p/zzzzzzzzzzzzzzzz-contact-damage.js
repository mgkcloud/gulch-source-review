(function(){
'use strict';
const commit=Gulch.commit;
let latest=null;
Gulch.register('contact-damage',{snapshot(s){latest=s;}});
Gulch.commit=function(data,activity){
 if(!latest||!data?.seed||String(data.respawnSettings?.token||'original')!==String(latest.gameState.respawnSettings?.token||'original')||!(Number(data.turn)>Number(latest.turn)))return commit(data,activity);
 const p=data.seed.entities.find(e=>e.id==='player');
 if(!p||!(Number(p.hp)>0))return commit(data,activity);
 const map=data.seed.maps.find(m=>m.id===p.map);
 function floor(x,y){const c=map?.ascii[y]?.[x];return Boolean(c)&&!['#','~'].includes(c)&&!['wall','water'].includes(data.seed.legend[c]?.[0]);}
 const attackers=data.seed.entities.filter(e=>{
  if(e.id==='player'||e.faction!=='hostile'||e.ai!=='chase'||e.caveEncounter===1||e.practiceTarget||e.isPlayer||e.playerId||e.clientId||e.ownerId||e.loreSpeaker||e.itemId!=null||e.map!==p.map||(e.hp!=null&&Number(e.hp)<=0))return false;
  if(/(^|[^a-z])rats?([^a-z]|$)/i.test([e.id,e.name,e.species,e.type,e.kind].join(' ')))return false;
  const dx=p.x-e.x,dy=p.y-e.y;
  return Math.max(Math.abs(dx),Math.abs(dy))<=1&&(!(dx&&dy)||(floor(e.x+dx,e.y)&&floor(e.x,e.y+dy)));
 });
 const damage=Math.min(2,attackers.length);
 if(!damage)return commit(data,activity);
 return commit({...data,seed:{...data.seed,entities:data.seed.entities.map(e=>e.id==='player'?{...e,hp:Math.max(0,Number(e.hp)-damage)}:e)}},(activity||'')+' Nearby enemies strike for '+damage+' base damage.');
};
})();
