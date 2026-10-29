(function(){
'use strict';
const register=Gulch.register;
const INTERVAL=1000;
// Only presentation callbacks belong here. Gameplay snapshots maintain the
// current CAS base and must never wait for a panel refresh.
const panels=new Set([
 'health-running','turn-status-line','inventory-help',
 'build-board-live-information','build-intelligence',
 'operations-live-detail','build-board-worlds',
 'detailed-gear-dossier','sword-recipe-section'
]);
const entries=new Map();
let timer=null,lastFlush=-Infinity,interaction=false,interactionQueued=false;
let received=0,delivered=0,coalesced=0;
function context(s){
 const p=s.player||{};
 return JSON.stringify([s.revision,String(s.gameState?.respawnSettings?.token||'original'),s.mapId,p.hp,p.maxHp,Boolean(s.gameState?.gulchPermanentGameOver?.ended)]);
}
function report(name,error){
 const box=document.getElementById('moduleErrors');
 if(box)box.textContent='Module '+name+': '+String(error?.message||error).slice(0,300);
}
function deliver(entry){
 if(!entry.pending)return;
 const s=entry.pending;entry.pending=null;
 try{entry.callbacks.snapshot.call(entry.callbacks,s);delivered++;}
 catch(error){report(entry.name,error);}
}
function cancelTimer(){clearTimeout(timer);timer=null;}
function flush(){
 cancelTimer();
 if(document.hidden)return;
 lastFlush=performance.now();
 for(const entry of entries.values())deliver(entry);
}
function schedule(){
 if(timer!==null||document.hidden)return;
 timer=setTimeout(flush,Math.max(0,lastFlush+INTERVAL-performance.now()));
}
Gulch.register=function(name,callbacks){
 if(!panels.has(name)||typeof callbacks?.snapshot!=='function')return register.call(this,name,callbacks);
 const entry={name,callbacks,pending:null,key:null};
 entries.set(name,entry);
 return register.call(this,name,{...callbacks,snapshot(s){
  received++;
  const key=context(s),urgent=entry.key===null||entry.key!==key;
  entry.key=key;
  if(entry.pending)coalesced++;
  entry.pending=s;
  if(!document.hidden&&(urgent||interaction)){
   deliver(entry);
   if(lastFlush===-Infinity)lastFlush=performance.now();
  }else schedule();
 }});
};
function directInteraction(){
 interaction=true;
 // Capture runs before menu handlers, giving them the newest presentation
 // state without postponing their normal synchronous rendering.
 flush();
 if(interactionQueued)return;
 interactionQueued=true;
 queueMicrotask(()=>{interactionQueued=false;interaction=false;});
}
for(const type of ['pointerdown','click','input','change','focusin']){
 document.addEventListener(type,directInteraction,true);
}
window.addEventListener('keydown',event=>{
 const target=event.target;
 const editing=target instanceof HTMLElement&&(target.matches('input,textarea,select')||target.isContentEditable);
 const direction=/^(w|a|s|d|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/i.test(event.key);
 const menu=target instanceof Element&&target.closest('[role="dialog"],dialog,nav,details');
 if(!direction||editing||menu)directInteraction();
},true);
// Programmatic opening also refreshes immediately, including menus opened by
// another component after an authoritative room update.
new MutationObserver(records=>{
 if(records.some(record=>{
  const node=record.target;
  return node instanceof HTMLElement&&
   ((record.attributeName==='hidden'&&!node.hidden)||
    (record.attributeName==='open'&&node.hasAttribute('open')));
 }))flush();
}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['hidden','open']});
document.addEventListener('visibilitychange',()=>{
 if(document.hidden)cancelTimer();else flush();
});
window.addEventListener('pagehide',cancelTimer);
window.addEventListener('pageshow',flush);
window.GulchUIRefresh=Object.freeze({
 interval:INTERVAL,
 flush,
 report(){return {intervalMs:INTERVAL,registeredPanels:entries.size,receivedSnapshots:received,deliveredSnapshots:delivered,coalescedSnapshots:coalesced,pendingPanels:Array.from(entries.values()).filter(entry=>entry.pending).length};}
});
})();
