(function(){
'use strict';
const commit=Gulch.commit;
let latest=null;
function epoch(data){return String(data?.respawnSettings?.token||'original');}
function fallen(data){
 if(data?.gulchPermanentGameOver?.ended===true)return true;
 const player=data?.seed?.entities?.find(e=>e.id==='player');
 if(!player||player.hp===null||player.hp===undefined||player.hp==='')return false;
 const hp=Number(player.hp);
 return Number.isFinite(hp)&&hp<=0;
}
Gulch.register('death-enforcement',{snapshot(s){latest=s.gameState;}});
Gulch.commit=function(data,activity){
 if(!data?.seed?.entities)return commit(data,activity);
 const alreadyFallen=latest&&epoch(latest)===epoch(data)&&fallen(latest);
 if(!alreadyFallen&&!fallen(data))return commit(data,activity);
 // Latch lethal health before armor or other commit wrappers can raise it.
 // Vital integrity enforces this latch after all damage processing finishes.
 const next={...data,seed:{...data.seed,entities:data.seed.entities.map(e=>e.id==='player'?{...e,hp:0}:e)},gulchPermanentGameOver:{...data.gulchPermanentGameOver,ended:true}};
 return commit(next,activity);
};
})();
