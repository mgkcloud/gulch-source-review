(function(){
'use strict';
const commit=Gulch.commit,register=Gulch.register;
let latest=null;
const epoch=data=>String(data?.respawnSettings?.token||'original');
function numeric(value,fallback){const n=Number(value);return value!==null&&value!==''&&Number.isFinite(n)?n:fallback;}
function dead(data){
 const player=data?.seed?.entities?.find(e=>e.id==='player');
 return data?.gulchPermanentGameOver?.ended===true||Boolean(player&&numeric(player.hp,1)<=0);
}
function normalize(data,force){
 if(!data?.seed?.entities)return data;
 const player=data.seed.entities.find(e=>e.id==='player');
 if(!player)return data;
 const maximum=Math.max(1,numeric(player.maxHp,20));
 const ended=force||dead(data);
 const hp=ended?0:Math.max(0,Math.min(maximum,numeric(player.hp,maximum)));
 return {...data,seed:{...data.seed,entities:data.seed.entities.map(e=>e.id==='player'?{...e,hp,maxHp:maximum}:e)},gulchPermanentGameOver:{...data.gulchPermanentGameOver,ended:hp<=0}};
}
register('vital-integrity',{snapshot(s){latest=s;}});
Gulch.register=function(name,callbacks){
 if(typeof callbacks?.snapshot!=='function')return register(name,callbacks);
 return register(name,{...callbacks,snapshot(s){
  if(!dead(s.gameState))return callbacks.snapshot(s);
  const data=normalize(s.gameState,true);
  const player=data.seed.entities.find(e=>e.id==='player');
  return callbacks.snapshot({...s,gameState:data,seed:data.seed,player});
 }});
};
Gulch.commit=function(data,activity){
 if(!data?.seed?.entities)return commit(data,activity);
 const same=latest&&epoch(data)===epoch(latest.gameState);
 const next=normalize(data,Boolean(same&&dead(latest.gameState)));
 const fallen=dead(next)&&same&&!dead(latest.gameState);
 return commit(next,(activity||'')+(fallen?' You have fallen. This expedition has ended.':''));
};
})();
