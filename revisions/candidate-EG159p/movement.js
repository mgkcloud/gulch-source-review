(function(){
'use strict';
window.GulchOptimisticMovement=Object.freeze({
 cadence:80,
 step(dx,dy){
  return window.GulchLocalMovementQueue?.enqueue({type:'move',dx,dy})||false;
 },
 stop(){
  Gulch.setMovement(0,0);
  window.GulchLocalMovementQueue?.cancel();
 }
});

// The runtime already retains the exact pending operation and provides its
// reconnect retry through the online listener. Wake that existing recovery
// path without fabricating a receipt, releasing its gate, or resubmitting state.
let latest=null,timer=null,attempts=0,paused=false,denied=false,context=null;
let observedOperation=null;
const delays=[750,1500,3000,6000];
const run=s=>JSON.stringify([s.revision,String(s.gameState.respawnSettings?.token||'original')]);
function cancel(){clearTimeout(timer);timer=null;}
function reset(){cancel();attempts=0;paused=false;denied=false;observedOperation=null;}
function schedule(){
 if(timer!==null||!paused||denied||document.hidden||attempts>=delays.length)return;
 if(!window.GulchMovementState?.inFlight){reset();return;}
 timer=setTimeout(()=>{
  timer=null;
  const state=window.GulchMovementState;
  if(!state?.inFlight){reset();return;}
  if(document.hidden||denied||!paused)return;
  // Accepted operations use runtime's receipt-aware head recovery. Unknown
  // operations use its exact original request, including the original ID.
  // Never retry authentication failures automatically.
  attempts++;
  paused=false;
  window.dispatchEvent(new Event('online'));
 },delays[attempts]);
}
Gulch.register('paused-movement-recovery',{
 snapshot(s){
  const next=run(s);
  if(context!==null&&context!==next)reset();
  context=next;latest=s;
  queueMicrotask(()=>{
   if(!window.GulchMovementState?.inFlight)reset();
   else schedule();
  });
 }
});
window.addEventListener('message',event=>{
 if(event.source!==parent)return;
 const message=event.data;
 if(message?.type!=='gulch:commit-result')return;
 const state=window.GulchMovementState;
 if(!state?.inFlight){reset();return;}
 if(message.status===401||message.status===403){denied=true;cancel();return;}
 if(message.paused!==true||!['accepted','unknown'].includes(message.outcome))return;
 if(state.transportOutcome!==message.outcome)return;
 if(typeof message.clientOpId!=='string'||typeof message.frameInstance!=='string')return;
 if(message.snapshot&&latest&&message.snapshot.revision!==latest.revision)return;
 const operation=message.frameInstance+':'+message.clientOpId;
 if(observedOperation!==null&&observedOperation!==operation)return;
 observedOperation=operation;
 paused=true;schedule();
});
window.addEventListener('gulch:recovered',reset);
document.addEventListener('visibilitychange',()=>{
 if(document.hidden)cancel();else schedule();
});
window.addEventListener('pagehide',cancel);
window.addEventListener('pageshow',schedule);
})();
