(function(){
'use strict';
let dropped=0,installed=false;
function install(){
 if(installed)return;installed=true;
 const commit=Gulch.commit;
 Gulch.commit=function(data,activity,options){
  // The runtime already refuses overlapping submissions. Apply the same gate
  // before the world generators, pathfinding, loot and serialization wrappers.
  if(window.GulchMovementState?.inFlight){dropped++;return;}
  return commit.call(this,data,activity,options);
 };
}
window.GulchCommitPreflight=Object.freeze({report(){return {installed,duplicateProposalsSkipped:dropped};}});
// All classic game scripts install their commit extensions before load.
// A microtask also runs after synchronous load-time component initialization.
if(document.readyState==='complete')queueMicrotask(install);
else window.addEventListener('load',()=>queueMicrotask(install),{once:true});
})();
