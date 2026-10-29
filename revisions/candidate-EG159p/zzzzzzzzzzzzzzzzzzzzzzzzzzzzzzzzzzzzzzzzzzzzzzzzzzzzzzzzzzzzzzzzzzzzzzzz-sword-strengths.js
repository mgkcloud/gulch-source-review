(function(){
'use strict';
const commit=Gulch.commit;
let latest=null;
const epoch=d=>String(d?.respawnSettings?.token||'original');
function matches(e,target){
 if(target==='giant')return Boolean(e.dreadBeast||e.enemyVariety==='colossus');
 if(e.dreadBeast||e.enemyVariety==='colossus')return false;
 if(target==='brute')return e.enemyVariety==='brute';
 if(target==='skitter')return e.enemyVariety==='skitter';
 if(target==='spirit')return e.enemyVariety==='storm'||(!e.enemyVariety&&e.caveSprite==='wisp');
 if(e.enemyVariety)return false;
 return e.caveSprite===target;
}
Gulch.register('crafted-sword-strengths',{snapshot(s){latest=s;}});
Gulch.commit=function(data,activity){
 if(!latest||!data?.seed||epoch(data)!==epoch(latest.gameState)||!(Number(data.turn)>Number(latest.turn)))return commit(data,activity);
 const pack=latest.gameState.itemEcosystem;
 if(pack?.epoch!==epoch(data))return commit(data,activity);
 const id=pack.equipment?.weapon,trait=window.GulchCraftedSwordStrengths?.[id];
 if(!trait||!(Number(pack.bag?.[id])>0)||latest.player.hp<=0)return commit(data,activity);
 const old=new Map(latest.seed.entities.map(e=>[e.id,e]));
 let hits=0;
 const entities=data.seed.entities.map(e=>{
  const before=old.get(e.id),p=latest.player;
  if(!before||e.id==='player'||before.faction!=='hostile'||before.practiceTarget||before.isPlayer||before.playerId||before.ownerId||before.clientId||before.loreSpeaker||before.itemId!=null||before.map!==p.map||e.map!==before.map||Math.max(Math.abs(before.x-p.x),Math.abs(before.y-p.y))>1)return e;
  if(!Number.isFinite(before.hp)||!Number.isFinite(e.hp)||before.hp<=0||e.hp<=0||e.hp>=before.hp||!matches(before,trait.target))return e;
  hits++;
  return {...e,hp:Math.max(0,e.hp-trait.extra)};
 });
 if(!hits)return commit(data,activity);
 // Keep lethal targets until the existing loot pipeline records their defeat.
 return commit({...data,seed:{...data.seed,entities}},(activity||'')+' '+trait.title+' adds '+trait.extra+' damage to '+hits+' matching target'+(hits===1?'':'s')+'.');
};
})();
