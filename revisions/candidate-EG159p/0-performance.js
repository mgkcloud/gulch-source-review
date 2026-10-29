(function(){
'use strict';
const register=Gulch.register,commit=Gulch.commit;
let current=null,scheduled=false;
const deferred=new Map();
const views={
 'work-board':'.bb-body',
 'build-board-live-information':'.bb-live',
 'live-code-tree':'#liveCodeTree',
 'operations-live-detail':'#operationLive',
 'build-intelligence':'#buildInspector',
 'build-workspace':'#buildWorkspace',
 'build-board-worlds':'.build-world'
};
function visible(selector){
 const board=document.getElementById('workBoard');
 if(document.hidden||!board||board.hidden||board.dataset.selecting==='true')return false;
 const node=board.querySelector(selector);if(!node)return false;
 for(let parent=node;parent;parent=parent.parentElement)if(parent.hidden)return false;
 return node.getClientRects().length>0;
}
function queue(){if(scheduled||document.hidden)return;scheduled=true;requestAnimationFrame(flush);}
function flush(){
 scheduled=false;
 for(const [name,entry] of deferred){
  if(!entry.latest||entry.delivered===entry.latest||!visible(entry.selector))continue;
  try{entry.callbacks.snapshot(entry.latest);entry.delivered=entry.latest;}
  catch(error){const box=document.getElementById('moduleErrors');if(box)box.textContent='Module '+name+': '+String(error?.message||error).slice(0,300);}
 }
}
register('performance-coordinator',{snapshot(s){current=s;}});
Gulch.register=function(name,callbacks){
 if(!Object.prototype.hasOwnProperty.call(views,name)||typeof callbacks?.snapshot!=='function')return register(name,callbacks);
 const entry={selector:views[name],callbacks,latest:null,delivered:null};deferred.set(name,entry);
 return register(name,{...callbacks,snapshot(s){entry.latest=s;if(visible(entry.selector))queue();},resize(){if(visible(entry.selector)){if(entry.delivered!==entry.latest)queue();else callbacks.resize?.();}}});
};
Gulch.commit=function(data,activity,options){return commit(globalThis.GulchTurnEffects.progression(current?.gameState,data),activity,options);};
function observe(){
 const board=document.getElementById('workBoard');if(!board)return;
 new MutationObserver(queue).observe(board,{subtree:true,attributes:true,attributeFilter:['hidden','open','data-selecting']});queue();
}
window.addEventListener('load',observe,{once:true});
window.addEventListener('resize',queue);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)queue();});
})();
