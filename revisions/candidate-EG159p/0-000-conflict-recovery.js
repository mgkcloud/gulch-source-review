(function(){
'use strict';
const records=[],requests=new Map(),reported=new Set();
let latest=null,output=null,lastSent=-Infinity,sent=0,suppressed=0;
const conflict=/^(?:State changed; action rejected\.|World changed before submission;)/i;
const epoch=d=>String(d?.respawnSettings?.token||'original');
const bounded=(v,n)=>String(v??'').slice(0,n);
const revision=v=>Number.isSafeInteger(v)&&v>=0?v:null;
function stack(){try{return bounded(new Error('Client submission call site (not a server stack)').stack,1800);}catch(error){return '';}}
function draw(){if(output)output.value=records.map(r=>JSON.stringify(r)).join('\n');}
function telemetry(row){
 const key=row.clientOpId||[row.kind,row.responseSourceRevision,row.responseStateRevision,row.text].join(':');
 if(reported.has(key))return;
 reported.add(key);if(reported.size>128)reported.delete(reported.values().next().value);
 const now=performance.now();
 if(sent>=20||now-lastSent<3000){suppressed++;row.telemetry='Rate limited locally';return;}
 const message=JSON.stringify({kind:row.kind,clientOpId:row.clientOpId,base:row.base,source:row.source,responseStateRevision:row.responseStateRevision,responseSourceRevision:row.responseSourceRevision,error:row.text,clientStack:row.clientStack,suppressedSinceLastReport:suppressed});
 try{
  parent.postMessage({type:'gulch:module-error',module:'client-conflict-diagnostics',message},'*');
  lastSent=now;sent++;suppressed=0;row.telemetry='Sent to existing host bridge; server persistence unverified';
 }catch(error){row.telemetry='Bridge delivery failed: '+bounded(error.message||error,160);}
}
Gulch.register('client-conflict-recovery',{snapshot(s){
 if(latest&&(latest.revision!==s.revision||epoch(latest.gameState)!==epoch(s.gameState)))requests.clear();
 latest=s;
}});
// Observe the existing submission boundary without changing CAS data or IDs.
const originalPost=window.postMessage;
// Commit callbacks run synchronously before the runtime posts in a microtask.
// Keep only a small diagnostic call-site record; never retain proposed state.
let candidate=null;
function install(){
 const commit=Gulch.commit;
 Gulch.commit=function(data,activity,options){
  const eligible=!window.GulchMovementState?.inFlight;
  const call=eligible?{source:revision(latest?.revision),base:revision(latest?.stateRevision),clientStack:stack(),time:performance.now()}:null;
  try{return commit.call(this,data,activity,options);}
  finally{if(call&&window.GulchMovementState?.inFlight)candidate=call;}
 };
}
// The opaque iframe cannot intercept the parent's postMessage method safely.
// Match the diagnostic call site only to a response whose base can be inferred
// from the currently pending submission; otherwise explicitly leave it absent.
window.addEventListener('message',event=>{
 if(event.source!==parent)return;
 const m=event.data;
 if(!m||typeof m!=='object'||m.type!=='gulch:commit-result')return;
 const id=typeof m.clientOpId==='string'?bounded(m.clientOpId,128):null;
 if(m.ok!==false){candidate=null;return;}
 const text=bounded(m.error||'Action rejected',400),incoming=m.snapshot;
 const row={time:new Date().toISOString(),kind:conflict.test(text)?'CAS-conflict':'rejection',clientOpId:id,base:null,source:null,observedSourceRevision:revision(latest?.revision),observedStateRevision:revision(latest?.stateRevision),responseSourceRevision:revision(incoming?.revision),responseStateRevision:revision(incoming?.stateRevision),text,clientStack:null,decision:'Runtime reconciles authoritative state. No whole-state replay or merge.'};
 // The bridge does not expose outgoing IDs to this component. A recent stack
 // is context only, never asserted to belong to this response's operation ID.
 if(candidate&&performance.now()-candidate.time<30000){
  row.recentSubmissionContext={base:candidate.base,source:candidate.source,stack:candidate.clientStack,correlated:false};
 }
 candidate=null;
 records.push(row);if(records.length>100)records.shift();
 telemetry(row);draw();
});
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
function mount(){
 install();
 const host=document.getElementById('livingPanel')||document.getElementById('workBoard');if(!host)return;
 const section=el('details');section.id='clientConflictRecord';
 section.append(el('summary','Room synchronization · rejected-update diagnostics'),el('p','Simultaneous room actions can compete for the same revision. The losing proposal is discarded and the runtime refreshes authoritative state. Held movement continues through the runtime; crafting, purchases, rewards and inventory edits are never replayed by this helper. Check the current result before repeating a one-shot action.'),el('p','Last 100 rejections are retained in this browser. Diagnostic reports use the existing module-error bridge, with at most one report every three seconds and 20 reports per page session. No world data, inventory contents or activity text is included. Host delivery does not establish server persistence or automatic repair. The server stack is not exposed by the response protocol.'));
 output=el('textarea');output.readOnly=true;output.rows=10;output.setAttribute('aria-label','Local room rejection diagnostics');output.style.cssText='width:100%;font:11px/1.5 monospace;user-select:text!important;-webkit-user-select:text!important';
 const select=el('button','Select diagnostic records');select.type='button';select.addEventListener('click',()=>{draw();output.focus();output.select();});
 section.append(select,output);host.append(section);draw();
}
if(document.readyState==='complete')mount();else window.addEventListener('load',()=>setTimeout(mount,0),{once:true});
})();
