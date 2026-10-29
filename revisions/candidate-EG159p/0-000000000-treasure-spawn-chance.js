(function(){
'use strict';
const commit=Gulch.commit;
let latest=null;
const epoch=data=>String(data?.respawnSettings?.token||'original');
function roll(data,map){
 const text=String(data.respawnSettings?.generationSeed||data.seed.meta?.seed||epoch(data))+':ranked-chest-chance:'+map.id;
 let h=2166136261;
 for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);
 h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);h^=h>>>16;
 return (h>>>0)/4294967296<0.1;
}
Gulch.register('treasure-spawn-chance',{snapshot(s){latest=s;}});
Gulch.commit=function(data,activity,options){
 if(!data?.seed?.maps||!Array.isArray(data.seed.entities))return commit.call(this,data,activity,options);
 const same=latest&&epoch(latest.gameState)===epoch(data);
 const previousMaps=new Map((same?latest.gameState.seed.maps:[]).map(map=>[map.id,map]));
 const previousIds=new Set((same?latest.gameState.seed.entities:[]).map(entity=>entity.id));
 const excluded=new Set();
 let changed=false;
 const maps=data.seed.maps.map(map=>{
  if(!map.rankedTreasureVersion||map.rankedTreasureChance)return map;
  const established=Boolean(previousMaps.get(map.id)?.rankedTreasureVersion);
  const spawned=established||roll(data,map);
  if(!spawned)excluded.add(map.id);
  changed=true;
  return {...map,rankedTreasureChance:{version:1,probability:0.1,spawned,existingPreserved:established}};
 });
 if(!changed)return commit.call(this,data,activity,options);
 const entities=data.seed.entities.filter(entity=>!excluded.has(entity.map)||previousIds.has(entity.id)||(!entity.rankedChest&&!entity.treasureKey));
 let note=activity;
 if(excluded.size&&activity==='Treasure chests and lost keys are scattered throughout this region.')note='This region has no ranked treasure chest. New regions have a 10% chance to contain ranked treasure.';
 return commit.call(this,{...data,seed:{...data.seed,maps,entities}},note,options);
};
})();
