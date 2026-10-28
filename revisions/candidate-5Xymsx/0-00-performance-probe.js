(function(){
'use strict';
const register=Gulch.register;
const request=window.requestAnimationFrame;
const records=new Map();
let enabled=false,started=0,ended=0,timeout=null,output=null,recordButton=null,stopButton=null;
let sample=null,frames=0,gaps=[],lastFrame=null;
function record(key,ms){
 let row=records.get(key);
 if(!row){if(records.size>=256)return;row={name:key,calls:0,total:0,max:0,slow:0};records.set(key,row);}
 row.calls++;row.total+=ms;row.max=Math.max(row.max,ms);if(ms>=8)row.slow++;
}
function timed(key,fn,receiver,args){
 if(!enabled)return fn.apply(receiver,args);
 const start=performance.now();
 try{return fn.apply(receiver,args);}finally{record(key,performance.now()-start);}
}
Gulch.register=function(name,callbacks){
 if(!callbacks||typeof callbacks!=='object')return register(name,callbacks);
 const wrapped={...callbacks};
 for(const method of ['snapshot','action','resize']){
  const fn=callbacks[method];
  if(typeof fn==='function')wrapped[method]=function(){return timed(name+' / '+method,fn,callbacks,arguments);};
 }
 return register(name,wrapped);
};
const animationWrappers=new WeakMap();
window.requestAnimationFrame=function(callback){
 if(typeof callback!=='function')return request.call(window,callback);
 let wrapped=animationWrappers.get(callback);
 if(!wrapped){
  wrapped=function(){return timed('Animation / '+(callback.name||'anonymous')+' (grouped)',callback,this,arguments);};
  animationWrappers.set(callback,wrapped);
 }
 return request.call(window,wrapped);
};
function report(){
 const sorted=gaps.slice().sort((a,b)=>a-b);
 return {
  recording:enabled,
  seconds:started?((enabled?performance.now():ended)-started)/1000:0,
  animationFrames:frames,
  interactiveFrameGaps:sorted.length,
  interactiveGapP95:sorted.length?sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))]:null,
  interactiveGapsOver50ms:sorted.filter(n=>n>50).length,
  components:Array.from(records.values(),r=>({...r,average:r.total/r.calls})).sort((a,b)=>b.total-a.total)
 };
}
function draw(){
 if(!output)return;
 const r=report();
 output.textContent=(r.recording?'RECORDING':'STOPPED')+' · '+r.seconds.toFixed(1)+' seconds\n'+
  'Interactive frame samples: '+r.interactiveFrameGaps+' · p95 gap: '+(r.interactiveGapP95===null?'no samples':r.interactiveGapP95.toFixed(1)+' ms')+' · gaps >50 ms: '+r.interactiveGapsOver50ms+'\n\n'+
  (r.components.length?r.components.slice(0,35).map(v=>v.name+'\n'+v.calls+' calls · '+v.total.toFixed(1)+' ms total · '+v.average.toFixed(2)+' ms average · '+v.max.toFixed(1)+' ms max · '+v.slow+' calls ≥8 ms').join('\n\n'):'Start a capture, close Living world, and play a repeatable route.');
 recordButton.disabled=enabled;stopButton.disabled=!enabled;
}
function stop(){
 if(enabled)ended=performance.now();enabled=false;
 clearTimeout(timeout);timeout=null;
 if(sample!==null)window.cancelAnimationFrame(sample);sample=null;
 draw();return report();
}
function sampleFrame(now){
 sample=null;if(!enabled)return;
 const m=window.GulchMovementState;
 const active=Boolean(m?.heldKeys?.length||m?.inFlight||window.GulchFrameBudget?.isActive());
 if(active&&lastFrame!==null&&gaps.length<2400)gaps.push(now-lastFrame);
 lastFrame=active?now:null;frames++;
 sample=window.requestAnimationFrame(sampleFrame);
}
function start(){
 stop();records.clear();gaps=[];frames=0;lastFrame=null;
 started=performance.now();ended=started;enabled=true;
 timeout=setTimeout(stop,20000);sample=window.requestAnimationFrame(sampleFrame);draw();
}
window.GulchPerformanceProbe=Object.freeze({start,stop,report});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&enabled)stop();});
function mount(){
 const host=document.getElementById('livingPanel');if(!host)return;
 const section=document.createElement('details');section.id='performanceProbe';
 const title=document.createElement('summary');title.textContent='Performance diagnostics · 20-second capture';
 const explanation=document.createElement('p');
 explanation.textContent='Start capture, return to the expedition, then repeat the same movement, combat and inventory sequence. Capture stops automatically after 20 seconds or when this browser becomes hidden. Reopen this section to read the report. Profiling is off by default and never changes shared game data.';
 recordButton=document.createElement('button');recordButton.type='button';recordButton.textContent='Start 20-second capture';recordButton.addEventListener('click',start);
 stopButton=document.createElement('button');stopButton.type='button';stopButton.textContent='Stop and report';stopButton.addEventListener('click',stop);
 const refresh=document.createElement('button');refresh.type='button';refresh.textContent='Refresh report';refresh.addEventListener('click',draw);
 output=document.createElement('pre');output.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;max-height:420px;overflow:auto;font:11px/1.6 monospace';
 const limits=document.createElement('p');
 limits.textContent='Interpretation: timings are inclusive and overlap; do not add animation and component totals. Animation functions with the same name are grouped. Direct interval work, DOM observers, rendering/compositing and the runtime visibility calculation are not individually attributed. Frame gaps are sampled only while the existing frame budget reports interaction; they are not a whole-game FPS benchmark. Capture itself adds overhead.';
 const plan=document.createElement('p');
 plan.textContent='Migration gate: compare repeated captures in both room browsers, identify one expensive pure calculation, preserve its JavaScript reference, and test a compiled Rust/Wasm candidate against identical inputs. Measure allocation and boundary costs as well as frame latency. Switch only after parity, sandbox compatibility and a repeatable improvement; retain a JavaScript fallback. The current visibility cache makes visibility an unproven target. No Rust module is installed by this probe.';
 const checks=document.createElement('p');
 checks.textContent='Manual acceptance: start and stop capture; verify reports remain fixed after stopping; hide the browser during capture; verify movement, diagonal movement, attack, inventory, map transitions and shared updates still work. Repeat the same route with profiling disabled. These checks have not been executed by this source response.';
 section.append(title,explanation,recordButton,stopButton,refresh,output,limits,plan,checks);host.append(section);
 section.addEventListener('toggle',()=>{if(section.open)draw();});draw();
}
if(document.readyState==='complete')mount();else window.addEventListener('load',mount,{once:true});
})();
