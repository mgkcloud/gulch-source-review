(function(){
'use strict';
const register=Gulch.register;
const staticLayers=new Set(['ground-catalog-art','ground-hazards','block-settlements','landscape-life','keeper-quest-journal','enemy-variety','wild-plant-gardens']);
const entries=new Map();
function viewKey(){const host=document.getElementById('left'),v=window.GulchMovementState?.visual;return [host?.clientWidth,host?.clientHeight,window.devicePixelRatio||1,v?.map,v?.x,v?.y].join('|');}
Gulch.register=function(name,callbacks){
 if(!staticLayers.has(name)||typeof callbacks?.resize!=='function')return register(name,callbacks);
 const entry={key:null};entries.set(name,entry);
 const wrapped={...callbacks,resize(){
  if(document.hidden){entry.key=null;return;}
  const key=viewKey();if(entry.key===key)return;
  entry.key=null;const result=callbacks.resize.apply(callbacks,arguments);entry.key=key;return result;
 }};
 if(typeof callbacks.snapshot==='function')wrapped.snapshot=function(){entry.key=null;return callbacks.snapshot.apply(callbacks,arguments);};
 return register(name,wrapped);
};
function invalidate(){for(const entry of entries.values())entry.key=null;}
window.addEventListener('resize',invalidate);document.addEventListener('visibilitychange',invalidate);
})();
