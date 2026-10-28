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
})();
