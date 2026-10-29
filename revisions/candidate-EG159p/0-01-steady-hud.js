(function(){
'use strict';
const descriptor=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');
if(!descriptor?.get||!descriptor?.set||!descriptor.configurable)return;
let skipped=0;
Object.defineProperty(Node.prototype,'textContent',{
 ...descriptor,
 set(value){
  const text=value==null?'':String(value);
  // Preserve child elements, event handlers, and the existing reconciliation
  // setter. Only suppress an identical write to a plain-text game UI node.
  if(this instanceof HTMLElement&&this.closest('#left')&&!this.matches('script,style,textarea')&&this.childElementCount===0&&(this.childNodes.length===0||this.childNodes.length===1&&this.firstChild.nodeType===Node.TEXT_NODE)&&descriptor.get.call(this)===text){
   skipped++;return;
  }
  descriptor.set.call(this,value);
 }
});
window.GulchSteadyUI=Object.freeze({report(){return {unchangedTextWritesSkipped:skipped};}});
})();

(function(){
'use strict';
function mount(){
 for(const id of ['waitHistory','liveLagMeter']){
  const panel=document.getElementById(id),summary=panel?.querySelector('summary');
  if(!summary)continue;
  const label=document.createElement('span');
  label.textContent='UI Refresh Rate: 1s (1000ms)';
  label.style.cssText='display:block;padding:5px 8px;color:#e8d6a7;font:10px/1.5 ui-monospace,monospace;pointer-events:none';
  panel.insertBefore(label,summary);
  const explanation=document.createElement('p');
  explanation.textContent=id==='waitHistory'
   ?'UI Refresh Rate is the diagnostic display and history sampling interval, not network ping or a delay added to movement. Recording runs once per second while visible and enabled. Wait averages below measure completed shared-update waits separately.'
   :'UI Refresh Rate is the diagnostic display update interval while profiling is enabled and this browser is visible. Profiling starts paused. The 1000ms interval is not network ping or a delay added to movement; preparation and observed-update measurements below are separate.';
  const body=document.getElementById(id==='waitHistory'?'waitHistoryBody':'liveLagBody');
  if(body)body.prepend(explanation);
 }
}
if(document.readyState==='complete')mount();
else window.addEventListener('load',mount,{once:true});
})();
