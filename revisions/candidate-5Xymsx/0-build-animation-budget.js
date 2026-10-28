(function(){
'use strict';
const register=Gulch.register;
let installed=false;
function install(){
 if(installed)return;installed=true;
 const request=window.requestAnimationFrame.bind(window);
 const cancel=window.cancelAnimationFrame.bind(window);
 const parked=new Map(),active=new Map();
 let serial=0;
 function visible(){
  const board=document.getElementById('workBoard');
  const hero=board?.querySelector('.build-world');
  if(document.hidden||!board||board.hidden||!hero)return false;
  for(let n=hero;n;n=n.parentElement)if(n.hidden)return false;
  return hero.getClientRects().length>0&&getComputedStyle(hero).display!=='none';
 }
 function schedule(id,callback){
  active.set(id,request(now=>{
   active.delete(id);
   if(!visible()){parked.set(id,callback);return;}
   callback(now);
  }));
 }
 let capturing=false;
 window.requestAnimationFrame=function(callback){
  if(!capturing)return request(callback);
  const id=--serial;
  const wrapped=function(now){
   const previous=capturing;capturing=true;
   try{callback(now);}finally{capturing=previous;}
  };
  if(visible())schedule(id,wrapped);else parked.set(id,wrapped);
  return id;
 };
 window.cancelAnimationFrame=function(id){
  if(parked.delete(id))return;
  if(active.has(id)){cancel(active.get(id));active.delete(id);return;}
  cancel(id);
 };
 function refresh(){
  if(!visible()){
   // Active callbacks park themselves on their next frame.
   return;
  }
  for(const [id,callback] of parked){parked.delete(id);schedule(id,callback);}
 }
 const board=document.getElementById('workBoard');
 if(board)new MutationObserver(refresh).observe(board,{subtree:true,attributes:true,attributeFilter:['hidden','style','class','data-selecting']});
 document.addEventListener('visibilitychange',refresh);
 window.addEventListener('resize',refresh);
 window.GulchBuildAnimationBudget=Object.freeze({capture(fn){const old=capturing;capturing=true;try{return fn();}finally{capturing=old;}}});
}
// The globe registers immediately before scheduling its perpetual frame loop.
// Capture that initial request only; subsequent requests inherit the scope.
Gulch.register=function(name,callbacks){
 const result=register(name,callbacks);
 if(name!=='build-board-worlds')return result;
 install();
 const request=window.requestAnimationFrame;
 let armed=true;
 window.requestAnimationFrame=function(callback){
  if(!armed)return request.call(window,callback);
  armed=false;window.requestAnimationFrame=request;
  return window.GulchBuildAnimationBudget.capture(()=>request.call(window,callback));
 };
 queueMicrotask(()=>{if(armed){armed=false;window.requestAnimationFrame=request;}});
 return result;
};
})();
