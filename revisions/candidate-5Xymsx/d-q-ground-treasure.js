(function(){
'use strict';
const commit=Gulch.commit;
let latest=null;
const epoch=data=>String(data.respawnSettings?.token||'original');
const quantity=value=>Number.isFinite(value)?Math.max(0,Math.floor(value)):0;
Gulch.register('ground-treasure-drops',{snapshot(s){latest=s;}});
Gulch.commit=function(data,activity){
 const receipt=data?.imageKillReward;
 if(!latest||!data?.seed||epoch(data)!==epoch(latest.gameState)||!receipt||receipt.epoch!==epoch(data)||receipt.id===latest.gameState.imageKillReward?.id||!(Number(data.turn)>Number(latest.turn)))return commit(data,activity);
 const pack=data.itemEcosystem;
 if(!pack||pack.epoch!==epoch(data))return commit(data,activity);
 const previous=latest.gameState.itemEcosystem;
 const oldBag=previous?.epoch===epoch(data)?previous.bag||{}:{};
 const bag={...pack.bag},contents={};
 for(const [id,value] of Object.entries(bag)){
  if(!id.startsWith('image_'))continue;
  const gained=quantity(value)-quantity(oldBag[id]);
  if(gained<=0)continue;
  contents[id]=gained;
  if(Object.prototype.hasOwnProperty.call(oldBag,id))bag[id]=oldBag[id];
  else delete bag[id];
 }
 if(!Object.keys(contents).length)return commit(data,activity);
 const after=new Map(data.seed.entities.map(e=>[e.id,e]));
 const player=latest.player;
 const victims=latest.seed.entities.filter(e=>e.id!=='player'&&e.faction==='hostile'&&Number.isFinite(e.hp)&&e.hp>0&&!e.practiceTarget&&e.map===player.map&&Math.max(Math.abs(e.x-player.x),Math.abs(e.y-player.y))<=1&&(!after.has(e.id)||after.get(e.id).hp<=0));
 if(!victims.length)return commit(data,activity);
 const site=victims[0],entities=data.seed.entities.slice();
 let id='image-reward:'+site.id+':'+String(latest.stateRevision);
 while(entities.some(e=>e.id===id))id+='x';
 entities.push({id,name:'Dropped enemy treasure',kind:'loot',map:site.map,x:site.x,y:site.y,glyph:'♦',color:'#ffe09a',ecosystemLoot:true,contents});
 const text='Treasure dropped at '+site.x+', '+site.y+'. Stand beside the cache and collect it from the pack workshop.';
 const next={...data,seed:{...data.seed,entities},itemEcosystem:{...pack,bag,log:[text,...(Array.isArray(pack.log)?pack.log:[])].slice(0,12)},imageKillReward:{...receipt,text:receipt.text+' '+text}};
 return commit(next,(activity?activity+' ':'')+text);
};
})();
