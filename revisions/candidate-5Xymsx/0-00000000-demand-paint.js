(function(){
'use strict';
const register=Gulch.register;
const request=window.requestAnimationFrame.bind(window);
const cancel=window.cancelAnimationFrame.bind(window);
const targets=new Set(['enemy-variety','ground-hazards','keeper-quest-journal','world-construction-crews','village-harvest-and-homes']);
let armed=null,serial=0,skipped=0;
const dormant=new Set();
Gulch.register=function(name,callbacks){
 const result=register(name,callbacks);
 if(!targets.has(name)||typeof callbacks?.snapshot!=='function'||typeof callbacks?.resize!=='function')return result;
 // These supplied components paint in snapshot and resize. Their immediate
 // self-rescheduling frame loops duplicate the runtime's camera delivery.
 const token={name};armed=token;
 queueMicrotask(()=>{if(armed===token)armed=null;});
 return result;
};
window.requestAnimationFrame=function(callback){
 if(armed&&typeof callback==='function'&&callback.name==='frame'){
  armed=null;skipped++;
  const id=--serial;dormant.add(id);
  return id;
 }
 return request(callback);
};
window.cancelAnimationFrame=function(id){
 if(dormant.delete(id))return;
 return cancel(id);
};
window.GulchDemandPaint=Object.freeze({report(){return {redundantLoopsRemoved:skipped};}});
})();
