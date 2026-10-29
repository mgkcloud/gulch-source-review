(function(){
'use strict';
const register=Gulch.register;
let suppressPickupMenu=false;
Gulch.register=function(name,callbacks){
 if(name!=='context-item-collection'||typeof callbacks.snapshot!=='function')return register(name,callbacks);
 return register(name,{...callbacks,snapshot(s){
  suppressPickupMenu=true;
  try{return callbacks.snapshot(s);}
  finally{queueMicrotask(()=>{suppressPickupMenu=false;});}
 }});
};
window.addEventListener('click',event=>{
 const toggle=document.getElementById('inventoryToggle');
 const inventory=document.getElementById('inventoryPanel');
 if(suppressPickupMenu&&!event.isTrusted&&event.target===toggle&&inventory?.hidden){
  event.preventDefault();
  event.stopImmediatePropagation();
 }
},true);
const host=document.getElementById('left');
if(!host)return;
const notice=document.createElement('div');
notice.hidden=true;
notice.setAttribute('role','status');
notice.style.cssText='position:absolute;left:50%;bottom:190px;transform:translateX(-50%);z-index:8;max-width:calc(100% - 32px);padding:9px 12px;border:1px solid #9eaa86;border-radius:7px;background:#132823ed;color:#e2dfc2;font:12px/1.5 monospace;pointer-events:none';
host.append(notice);
let previous=null,timer=null;
register('quiet-item-pickup',{snapshot(s){
 const receipt=s.gameState.inventoryPickup;
 const epoch=String(s.gameState.respawnSettings?.token||'original');
 const token=receipt?.epoch===epoch?receipt.token:null;
 if(previous&&previous.epoch===epoch&&token&&token!==previous.token&&s.player.hp>0){
  const items=window.GulchItemCatalog?.items||{};
  const names=Object.entries(receipt.items||{}).filter(([,n])=>Number(n)>0).map(([id,n])=>(items[id]?.name||id)+' ×'+n);
  notice.textContent=(names.length?'Collected '+names.slice(0,3).join(', ')+(names.length>3?' and more':''):'Item collected')+' · Inventory [I]';
  notice.hidden=false;
  clearTimeout(timer);
  timer=setTimeout(()=>{notice.hidden=true;},2400);
 }
 if(s.player.hp<=0||(previous&&previous.epoch!==epoch)){clearTimeout(timer);notice.hidden=true;}
 previous={epoch,token};
}});
})();
