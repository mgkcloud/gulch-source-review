(function(){
'use strict';
const raf=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window);
const host=document.getElementById('left');if(!host)return;
const samples={};
let latest=null,enabled=false,frame=0,timer=null,lastFrame=0,frames=0,windowStart=0,hz=0,missed=0,longCount=0,blocking=0,rejected=0,timeouts=0,pending=null,observer=null;
let history=[],lastHistory=0;
function add(key,value){if(!Number.isFinite(value)||value<0)return;const a=samples[key]||(samples[key]=[]);a.push(value);if(a.length>120)a.shift();}
function percentile(key,p){const a=(samples[key]||[]).slice().sort((a,b)=>a-b);return a.length?a[Math.floor((a.length-1)*p)]:null;}
function last(key){const a=samples[key];return a?.length?a[a.length-1]:null;}
function ms(value){return value==null?'—':value.toFixed(value<10?1:0);}
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
const style=el('style');style.textContent='#liveLagMeter{position:absolute;left:8px;bottom:7px;z-index:9;max-width:calc(100% - 16px);color:#c5e0d2;background:#061318df;border:1px solid #55756966;border-radius:4px;font:9px/1.35 ui-monospace,monospace;font-variant-numeric:tabular-nums}#liveLagMeter summary{cursor:pointer;padding:4px 6px;white-space:pre-wrap}#liveLagMeter[open]{width:min(430px,calc(100% - 16px))}#liveLagBody{padding:5px 8px;max-height:min(55vh,420px);overflow:auto;border-top:1px solid #55756966}#liveLagBody pre{white-space:pre-wrap;overflow-wrap:anywhere;font:10px/1.5 monospace;margin:5px 0}#liveLagBody p{font-size:10px;line-height:1.5;margin:6px 0}#liveLagBody button{min-height:34px;font:10px monospace;padding:5px 8px;margin:3px;background:#19332e;color:#e1dfbc;border:1px solid #718779;border-radius:3px}#liveLagHistory{display:block;width:100%;height:48px}#liveLagMeter :focus-visible{outline:2px solid #efd49c;outline-offset:2px}';document.head.append(style);
const panel=el('details');panel.id='liveLagMeter';
const summary=el('summary','Performance · paused');summary.setAttribute('aria-label','Optional performance monitor');
const body=el('div');body.id='liveLagBody';
const graph=el('canvas');graph.id='liveLagHistory';graph.setAttribute('role','img');graph.setAttribute('aria-label','Confirmation wait and browser callback gap history; independent scales');
const report=el('pre'),controls=el('div');
function button(text,fn){const b=el('button',text);b.type='button';b.addEventListener('click',fn);controls.append(b);return b;}
const toggle=button('Start profiling',()=>setEnabled(!enabled));
button('Reset history',()=>{for(const key of Object.keys(samples))delete samples[key];history=[];missed=longCount=blocking=rejected=timeouts=0;lastHistory=0;draw();});
body.append(report,graph,controls,el('p','Profiling starts paused to avoid a permanent browser-frame sampler during normal play. Start it for a comparison route, then stop it. Closing this panel keeps an explicitly started capture running; hiding the browser excludes unfinished waits and suspends sampling.'),el('p','ACK measures observed commit-to-confirmation time, including local preparation, messaging and host work. It is not network ping. The bridge does not expose outgoing operation IDs here: responses without an established ID correlation are labeled uncorrelated and excluded from ACK samples. Browser Hz measures animation callbacks, not presented FPS. For component and renderer costs, use the separate 20-second component capture under Living world. Profiling adds overhead.'));
panel.append(summary,body);host.append(panel);
function sample(now){
 frame=0;if(!enabled||document.hidden)return;
 if(lastFrame){const gap=now-lastFrame;add('frame',gap);if(gap>50)missed++;}
 lastFrame=now;frames++;
 const span=now-windowStart;if(span>=1000){hz=frames*1000/span;frames=0;windowStart=now;}
 frame=raf(sample);
}
function stopSchedulers(){if(frame)cancel(frame);frame=0;clearTimeout(timer);timer=null;observer?.disconnect();}
function observe(){try{observer?.observe({type:'longtask',buffered:false});}catch(error){}}
try{if(window.PerformanceObserver?.supportedEntryTypes?.includes('longtask'))observer=new PerformanceObserver(list=>{if(!enabled||document.hidden)return;for(const entry of list.getEntries()){longCount++;blocking+=Math.max(0,entry.duration-50);}});}catch(error){}
function wake(){
 if(!enabled||document.hidden)return;
 if(!frame)frame=raf(sample);
 if(timer===null)timer=setTimeout(tick,1000);
}
function tick(){
 timer=null;if(!enabled||document.hidden)return;
 const now=performance.now();
 if(pending&&!window.GulchMovementState?.inFlight)pending=null;
 if(pending&&now-pending.start>7000&&!pending.warned){pending.warned=true;timeouts++;}
 if(now-lastHistory>=1000){lastHistory=now;history.push({time:now,ack:last('ack'),gap:percentile('frame',.95)});history=history.filter(r=>now-r.time<=300000).slice(-300);}
 draw();timer=setTimeout(tick,1000);
}
function setEnabled(value){
 enabled=Boolean(value);pending=null;stopSchedulers();lastFrame=0;frames=0;hz=0;windowStart=performance.now();lastHistory=0;
 toggle.textContent=enabled?'Stop profiling':'Start profiling';toggle.setAttribute('aria-pressed',String(enabled));
 if(enabled){observe();wake();}draw();
}
Gulch.register('live-metrics-state',{snapshot(s){
 const old=latest;latest=s;
 if(!enabled||!pending)return;
 const request=pending;
 if(old&&(s.revision!==request.source||String(s.gameState.respawnSettings?.token||'original')!==request.epoch)){pending=null;return;}
 queueMicrotask(()=>{
  if(!enabled||document.hidden||pending!==request)return;
  if(!window.GulchMovementState?.inFlight){
   if(s.stateRevision>request.base)add('sync',performance.now()-request.start);
   pending=null;
  }
 });
}});
function installCommit(){
 const commit=Gulch.commit;
 Gulch.commit=function(data,activity,options){
  if(!enabled||document.hidden)return commit.call(this,data,activity,options);
  const eligible=!window.GulchMovementState?.inFlight,start=performance.now(),source=latest?.revision,base=latest?.stateRevision,epoch=String(latest?.gameState.respawnSettings?.token||'original');
  try{return commit.call(this,data,activity,options);}finally{
   if(eligible&&window.GulchMovementState?.inFlight){
    add('prepare',performance.now()-start);pending={start,source,base,epoch,warned:false};
   }
  }
 };
}
window.addEventListener('message',event=>{
 if(!enabled||document.hidden||event.source!==parent)return;
 const m=event.data;if(m?.type!=='gulch:commit-result')return;
 if(m.ok===false)rejected++;
 // The public commit API does not return its operation ID. Never match an
 // arbitrary late response to the currently pending proposal by arrival alone.
 add('uncorrelated',1);
},true);
function plot(){
 const w=Math.max(1,graph.clientWidth),h=48,dpr=Math.min(window.devicePixelRatio||1,2);
 const width=Math.round(w*dpr),height=Math.round(h*dpr);
 if(graph.width!==width||graph.height!==height){graph.width=width;graph.height=height;}
 const c=graph.getContext('2d');if(!c)return;
 c.setTransform(dpr,0,0,dpr,0,0);c.fillStyle='#0b2228';c.fillRect(0,0,w,h);
 const end=history[history.length-1]?.time||0,start=history[0]?.time||end;
 for(const [key,color] of [['ack','#e0bd77'],['gap','#8bc6a4']]){
  const max=Math.max(key==='ack'?100:20,...history.map(v=>v[key]||0));c.strokeStyle=color;c.lineWidth=1;c.beginPath();let previous=null;
  for(const v of history){if(v[key]==null){previous=null;continue;}const x=(v.time-start)/Math.max(1,end-start)*(w-2)+1,y=h-2-v[key]/max*(h-4);if(previous===null||v.time-previous>2000)c.moveTo(x,y);else c.lineTo(x,y);previous=v.time;}c.stroke();
 }
}
function draw(){
 if(document.hidden)return;
 const wait=pending?performance.now()-pending.start:null;
 const text=enabled?hz.toFixed(0)+' Hz · prep '+ms(last('prepare'))+'ms · observed update '+ms(last('sync'))+'ms'+(wait!==null?' · waiting '+ms(wait)+'ms':''):'Performance · paused';
 if(summary.textContent!==text)summary.textContent=text;
 if(!panel.open)return;
 report.textContent=(enabled?'RECORDING':'PAUSED')+'\nLatest / p95, last 120 samples (ms)\n'+[['Commit preparation','prepare'],['Observed update and gate release','sync'],['Browser callback gap','frame']].map(([label,key])=>label+': '+ms(last(key))+' / '+ms(percentile(key,.95))).join('\n')+'\n\nFrames >50ms: '+missed+'\nObserved rejected responses: '+rejected+'\nPending >7s: '+timeouts+'\nLong tasks: '+(observer?longCount+'; '+ms(blocking)+'ms blocking':'unsupported')+'\nCorrelated ACK / network ping / server timing: unavailable\n\nObserved update timing can include a competing room action; it does not establish acceptance of this client’s proposal. Green chart: browser callback gap p95. Captures are local to this tab.';
 plot();
}
panel.addEventListener('toggle',draw);
document.addEventListener('visibilitychange',()=>{stopSchedulers();pending=null;lastFrame=0;frames=0;windowStart=performance.now();lastHistory=0;if(!document.hidden){if(enabled){observe();wake();}draw();}});
if(document.readyState==='complete')setTimeout(installCommit,0);else window.addEventListener('load',()=>setTimeout(installCommit,0),{once:true});
toggle.setAttribute('aria-pressed','false');draw();
})();
