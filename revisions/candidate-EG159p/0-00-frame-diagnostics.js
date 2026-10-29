(function(){
'use strict';
// Capture the browser scheduler before the game's idle frame limiter is installed.
const request=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window);
let running=false,frame=0,timeout=null,startTime=0,last=0,activeLast=false;
let gaps=[],tasks=[],events=[],observer=null,eventObserver=null,supported=false,eventSupported=false;
let baseline=null,current=null,output=null;
function percentile(values,p){if(!values.length)return null;const a=values.slice().sort((a,b)=>a-b);return a[Math.min(a.length-1,Math.floor((a.length-1)*p))];}
function collect(list,target){if(!running)return;for(const entry of list)if(entry.startTime>=startTime&&target.length<2400)target.push(entry.duration);}
try{if(window.PerformanceObserver?.supportedEntryTypes?.includes('longtask')){observer=new PerformanceObserver(list=>collect(list.getEntries(),tasks));supported=true;}}catch(error){}
try{if(window.PerformanceObserver?.supportedEntryTypes?.includes('event')){eventObserver=new PerformanceObserver(list=>collect(list.getEntries(),events));eventSupported=true;}}catch(error){}
function sample(now){
 frame=0;if(!running)return;
 const m=window.GulchMovementState;
 const active=Boolean(m?.heldKeys?.length||m?.inFlight||window.GulchFrameBudget?.isActive());
 if(active&&activeLast&&last&&gaps.length<4800)gaps.push(now-last);
 last=now;activeLast=active;frame=request(sample);
}
function show(){
 if(!output)return;
 function format(value){return value==null?'no samples':value.toFixed(1)+' ms';}
 function describe(r){return r?r.seconds.toFixed(1)+' s; '+r.samples+' active frame gaps; median '+format(r.median)+'; p95 '+format(r.p95)+'; worst '+format(r.worst)+'; gaps >50 ms '+r.over50+'\nLong tasks: '+(supported?r.longTasks+'; '+r.blocking.toFixed(1)+' ms blocking beyond 50 ms':'unsupported')+'\nSlow interaction duration p95: '+(eventSupported?format(r.interactionP95):'unsupported'):'No capture yet.';}
 output.textContent=(running?'Recording…\n':'')+'LATEST\n'+describe(current)+'\n\nBASELINE\n'+describe(baseline)+(current&&baseline&&current.p95!==null&&baseline.p95!==null?'\n\np95 difference: '+(current.p95-baseline.p95).toFixed(1)+' ms (negative is better).':'');
}
function stop(){
 if(!running)return current;
 if(observer)collect(observer.takeRecords(),tasks);
 if(eventObserver)collect(eventObserver.takeRecords(),events);
 running=false;cancel(frame);frame=0;clearTimeout(timeout);timeout=null;observer?.disconnect();eventObserver?.disconnect();
 current={seconds:(performance.now()-startTime)/1000,samples:gaps.length,median:percentile(gaps,.5),p95:percentile(gaps,.95),worst:gaps.length?Math.max(...gaps):null,over50:gaps.filter(n=>n>50).length,longTasks:tasks.length,blocking:tasks.reduce((n,t)=>n+Math.max(0,t-50),0),interactionP95:percentile(events,.95)};
 show();return {...current};
}
function start(){
 stop();gaps=[];tasks=[];events=[];last=0;activeLast=false;startTime=performance.now();running=true;
 try{observer?.observe({type:'longtask',buffered:false});}catch(error){supported=false;}
 try{eventObserver?.observe({type:'event',buffered:false,durationThreshold:16});}catch(error){eventSupported=false;}
 frame=request(sample);timeout=setTimeout(stop,20000);show();
}
window.GulchFrameDiagnostics=Object.freeze({start,stop,report(){return current?{...current}:null;}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
function mount(){
 const host=document.getElementById('performanceProbe')||document.getElementById('livingPanel');if(!host)return;
 const section=document.createElement('section'),heading=document.createElement('h3');heading.textContent='Browser frame and stall measurements';
 const explanation=document.createElement('p');explanation.textContent='Capture the same 20-second route with the same movement, attacks and menus. This sampler uses the browser frame scheduler directly, bypassing the game’s intentional idle throttle. Only consecutive interactive frames are counted. Each room browser measures its own client.';
 const controls=document.createElement('div');
 for(const [label,fn] of [['Start frame capture',start],['Stop frame capture',stop],['Keep latest as baseline',()=>{if(current&&!running)baseline={...current};show();}],['Refresh measurements',show]]){const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',fn);controls.append(b);}
 output=document.createElement('pre');output.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;font:11px/1.6 monospace';
 const limits=document.createElement('p');limits.textContent='Frame gaps measure scheduling stalls, not GPU presentation or network latency. Long tasks and Event Timing depend on browser support. Interaction duration includes browser processing and presentation delay; only events above the browser threshold are reported, so it is not an all-input latency percentile. Captures stop when hidden. Baselines last for this page session only. Use the component capture above separately to locate expensive callbacks; profiling adds overhead.';
 section.append(heading,explanation,controls,output,limits);host.append(section);show();
}
window.addEventListener('load',()=>setTimeout(mount,0),{once:true});
})();
