(function(){
'use strict';
const descriptor=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');
if(!descriptor?.get||!descriptor?.set||!descriptor.configurable)return;
const transient=new Set();
const conflict=/^(?:Module commit: )?(?:State changed; action rejected\.|World changed before submission;)/i;
const reconciliation=/^(?:Another room update (?:arrived|won)|The room changed(?:\.| before saving)|Room updated\.|The room is updating\. Please try again\.|Update was not submitted\. Wait for the room|Pickup was not submitted\. (?:Please try again|Try again when the room)|Pat was not submitted\. Wait for the current room update|The room is not ready for this update\.|Trade was not submitted\. Try again when the room is ready\.)/i;
function statusNode(node){
 return node instanceof Element&&(node.getAttribute('role')==='status'||/^(?:packStatus|benchNotice|livingStatus|atlasStatus|npcTalkStatus|foxPatStatus|quickConsumableStatus|interactKeyStatus|respawnStatus|characterStatus)$/.test(node.id));
}
Object.defineProperty(Node.prototype,'textContent',{
 ...descriptor,
 set(value){
  let text=value==null?'':String(value);
  if(this instanceof Element&&this.id==='moduleErrors'&&conflict.test(text))text='';
  else if(statusNode(this)&&reconciliation.test(text)){
   text=window.GulchMovementState?.inFlight?'Updating…':'';
   transient.add(this);
   if(transient.size>128)transient.delete(transient.values().next().value);
  }else transient.delete(this);
  descriptor.set.call(this,text);
 }
});
function settle(){
 if(window.GulchMovementState?.inFlight)return;
 for(const node of transient){
  if(node.isConnected&&descriptor.get.call(node)==='Updating…')descriptor.set.call(node,'');
 }
 transient.clear();
 const errors=document.getElementById('moduleErrors');
 if(errors&&conflict.test(descriptor.get.call(errors)))descriptor.set.call(errors,'');
}
window.addEventListener('gulch:recovered',settle);
Gulch.register('quiet-reconciliation-messages',{snapshot(){queueMicrotask(settle);}});
})();
