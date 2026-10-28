(function(){
'use strict';
const register=Gulch.register,painters=new Map();
const names=new Set(['renderer','small-cave-encounter','outside-world','landscape-life','world-construction-crews']);
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
let timer=null,ready=false,lastPhase=null;
function phase(){return reduced.matches?0:Math.floor(performance.now()/520)%2===0?-1:1;}
window.GulchLifeAnimation=Object.freeze({phase});
Gulch.register=function(name,callbacks){
 if(names.has(name)&&typeof callbacks?.resize==='function')painters.set(name,()=>callbacks.resize());
 return register(name,callbacks);
};
function moving(){
 const m=window.GulchMovementState;
 return Boolean(m?.heldKeys?.length||window.GulchFrameBudget?.isActive());
}
function paint(){
 for(const [name,callback] of painters){
  try{callback();}
  catch(error){const box=document.getElementById('moduleErrors');if(box)box.textContent='Module '+name+': '+String(error?.message||error).slice(0,300);}
 }
}
function wake(){
 if(timer!==null||!ready||document.hidden||reduced.matches)return;
 timer=setTimeout(tick,Math.max(16,520-performance.now()%520+2));
}
function tick(){
 timer=null;if(document.hidden||reduced.matches||!ready)return;
 const current=phase();
 if(current!==lastPhase){lastPhase=current;if(!moving())paint();}
 wake();
}
function stop(){clearTimeout(timer);timer=null;}
register('ambient-animation',{snapshot(){ready=true;lastPhase=phase();wake();}});
document.addEventListener('visibilitychange',()=>{stop();if(!document.hidden){lastPhase=null;paint();wake();}});
reduced.addEventListener('change',()=>{stop();lastPhase=null;paint();if(!reduced.matches)wake();});
})();
