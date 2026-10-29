(function(){
'use strict';
const register=Gulch.register;
const names=new Set(['ground-catalog-art','ground-hazards','block-settlements','landscape-life']);
const records=new Map();
let enabled=true,skipped=0;
function key(){
 const host=document.getElementById('left'),v=window.GulchMovementState?.visual;
 return [host?.clientWidth,host?.clientHeight,window.devicePixelRatio||1,v?.map,v?.x,v?.y].join('|');
}
function invalidate(){for(const r of records.values())r.key=null;}
Gulch.register=function(name,callbacks){
 if(!names.has(name)||typeof callbacks?.resize!=='function')return register(name,callbacks);
 const r={key:null};records.set(name,r);
 const wrapped={...callbacks,resize(){
  if(document.hidden){r.key=null;return;}
  const next=key();
  if(enabled&&next===r.key){skipped++;return;}
  r.key=null;
  const result=callbacks.resize.apply(callbacks,arguments);
  r.key=next;
  return result;
 }};
 if(typeof callbacks.snapshot==='function')wrapped.snapshot=function(){
  r.key=null;
  return callbacks.snapshot.apply(callbacks,arguments);
 };
 return register(name,wrapped);
};
// Suppress redundant work at the component boundary, never individual canvas
// drawing commands. Direct painters retain their native rendering semantics.
window.addEventListener('resize',invalidate);
window.addEventListener('load',invalidate,{once:true});
document.addEventListener('visibilitychange',invalidate);
window.GulchCanvasReuse=Object.freeze({
 report(){return {enabled,skippedClears:0,skippedComponentPaints:skipped,layers:records.size};},
 setEnabled(value){enabled=Boolean(value);invalidate();}
});
})();
