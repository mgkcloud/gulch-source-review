(function(){
'use strict';
const nativeRequest=window.requestAnimationFrame.bind(window);
const nativeCancel=window.cancelAnimationFrame.bind(window);
const callbacks=new Map();
let serial=0,frame=null,activeUntil=0,lastAttack=null,lastPosition=null;
function moving(){
 const movement=window.GulchMovementState;
 if(movement?.heldKeys?.length)return true;
 const visual=movement?.visual;
 return Boolean(visual&&lastPosition&&visual.map===lastPosition.map&&(Math.abs(visual.x-lastPosition.x)>.001||Math.abs(visual.y-lastPosition.y)>.001));
}
function isActive(){return performance.now()<activeUntil||moving();}
function wake(){
 if(frame!==null||!callbacks.size||document.hidden)return;
 frame=nativeRequest(flush);
}
function flush(now){
 frame=null;
 if(document.hidden)return;
 // Requests made during a callback belong to the next browser frame.
 const batch=Array.from(callbacks.keys());
 for(const id of batch){
  if(document.hidden)break;
  const callback=callbacks.get(id);
  if(!callback)continue;
  callbacks.delete(id);
  try{callback(now);}catch(error){setTimeout(()=>{throw error;},0);}
 }
 wake();
}
function interactive(){
 activeUntil=Math.max(activeUntil,performance.now()+400);
 wake();
}
window.GulchFrameBudget=Object.freeze({isActive,activate:interactive});
window.requestAnimationFrame=function(callback){
 if(typeof callback!=='function')throw new TypeError('Animation callback must be a function.');
 const id=++serial;
 callbacks.set(id,callback);
 wake();
 return id;
};
window.cancelAnimationFrame=function(id){
 callbacks.delete(id);
 if(!callbacks.size&&frame!==null){nativeCancel(frame);frame=null;}
};
document.addEventListener('pointerdown',interactive,{passive:true,capture:true});
window.addEventListener('keydown',interactive,{passive:true,capture:true});
window.addEventListener('resize',interactive,{passive:true});
window.addEventListener('message',event=>{
 if(event.source===parent&&event.data?.type==='gulch:action')interactive();
},true);
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){
  if(frame!==null)nativeCancel(frame);
  frame=null;
 }else interactive();
});
Gulch.register('frame-budget',{
 snapshot(s){
  const p=s.player;
  if(p){
   if(!lastPosition||p.map!==lastPosition.map||p.x!==lastPosition.x||p.y!==lastPosition.y)interactive();
   lastPosition={map:p.map,x:p.x,y:p.y};
  }
  const attack=s.gameState.sword?.lastAttack;
  if(attack?.id!==lastAttack){
   lastAttack=attack?.id;
   if(attack&&Number.isFinite(attack.time)&&Date.now()-attack.time<1500)interactive();
  }
 }
});
})();
