(function(){
'use strict';
const host=document.getElementById('left');if(!host)return;
let latest=null,pending=null,recording=true,installed=false;
let samples=[],history=[],started=performance.now(),sequence=0,timer=null;
const LIMIT=3600;
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
const style=el('style');style.textContent='#waitHistory{position:absolute;left:50%;top:48px;transform:translateX(-50%);z-index:9;width:min(410px,calc(100% - 24px));background:#0a1c24f2;color:#dce8d7;border:1px solid #76917c;border-radius:6px;font:10px/1.5 monospace}#waitHistory summary{padding:5px 8px;cursor:pointer;font-variant-numeric:tabular-nums}#waitHistoryBody{padding:8px;max-height:55vh;overflow:auto;border-top:1px solid #486253}#waitHistory button{min-height:36px;padding:6px 9px;margin:3px;background:#243d35;color:#ffe2ae;border:1px solid #819477;border-radius:4px;font:inherit}#waitHistory canvas{width:100%;height:100px;display:block}#waitHistory textarea{width:100%;height:120px;background:#08161d;color:#dce8d7;font:10px monospace;user-select:text!important;-webkit-user-select:text!important}#waitHistory table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}#waitHistory th,#waitHistory td{padding:3px;text-align:right;border-bottom:1px solid #324c40}#waitHistory :focus-visible{outline:2px solid #ffe2ae;outline-offset:2px}';document.head.append(style);
const panel=el('details');panel.id='waitHistory';
const summary=el('summary','Wait averages · awaiting updates'),body=el('div');body.id='waitHistoryBody';
const live=el('p'),chart=el('canvas');chart.setAttribute('role','img');chart.setAttribute('aria-label','One-minute average shared-update wait');
const controls=el('div');
function button(text,fn){const b=el('button',text);b.type='button';b.addEventListener('click',fn);controls.append(b);return b;}
const pause=button('Pause recording',()=>{recording=!recording;pause.textContent=recording?'Pause recording':'Resume recording';pending=null;schedule();draw(null);});
button('Clear records',()=>{samples=[];history=[];sequence=0;pending=null;started=performance.now();csv.value='';draw(null);});
button('Prepare CSV',()=>{csv.hidden=false;csv.value=['timestamp,elapsed_seconds,completed_total,count_10s,mean_10s_ms,count_60s,mean_60s_ms,count_300s,mean_300s_ms,p95_60s_ms,pending_ms',...history.map(r=>[r.time,r.elapsed,r.total,r.short.n,r.short.mean,r.minute.n,r.minute.mean,r.long.n,r.long.mean,r.minute.p95,r.pending].map(v=>v==null?'':v).join(','))].join('\n');csv.focus();csv.select();});
const csv=el('textarea');csv.hidden=true;csv.readOnly=true;csv.setAttribute('aria-label','Recorded wait history CSV');
const table=el('table'),head=el('thead'),row=el('tr');for(const text of ['Time','10s avg','1m avg','5m avg','Pending'])row.append(el('th',text));head.append(row);const rows=el('tbody');table.append(head,rows);
body.append(live,chart,el('p','Wait measures entry into the commit pipeline until the runtime releases its pending gate, including local preparation, confirmation or recovery. It is not network ping and does not prove proposal acceptance.'),controls,csv,el('p','One sample row per second while visible and recording; last 3,600 rows and 12,000 recent completed waits retained. Hiding or pausing excludes unfinished waits. Detailed tables and charts update only while expanded. Records last for this browser session.'),table);panel.append(summary,body);host.append(panel);
function stats(now){
 let shortN=0,shortSum=0,minuteN=0,minuteSum=0,longSum=0;const minuteValues=[];
 let first=0;while(first<samples.length&&now-samples[first].end>300000)first++;
 if(first)samples=samples.slice(first);
 for(const s of samples){const age=now-s.end;longSum+=s.ms;if(age<=60000){minuteN++;minuteSum+=s.ms;minuteValues.push(s.ms);}if(age<=10000){shortN++;shortSum+=s.ms;}}
 minuteValues.sort((a,b)=>a-b);
 const average=(n,sum)=>({n,mean:n?Math.round(sum/n*10)/10:null});
 return {short:average(shortN,shortSum),minute:{...average(minuteN,minuteSum),p95:minuteN?Math.round(minuteValues[Math.ceil(minuteN*.95)-1]*10)/10:null},long:average(samples.length,longSum)};
}
function finish(){
 if(!pending||window.GulchMovementState?.inFlight)return;
 const end=performance.now(),request=pending;pending=null;
 if(!recording||document.hidden||latest?.revision!==request.source||String(latest?.gameState.respawnSettings?.token||'original')!==request.epoch)return;
 samples.push({end,ms:end-request.start});if(samples.length>12000)samples.shift();sequence++;
}
Gulch.register('rolling-wait-history',{snapshot(s){if(latest&&(latest.revision!==s.revision||String(latest.gameState.respawnSettings?.token||'original')!==String(s.gameState.respawnSettings?.token||'original')))pending=null;latest=s;queueMicrotask(finish);}});
function install(){if(installed)return;installed=true;const commit=Gulch.commit;Gulch.commit=function(data,activity,options){const eligible=recording&&!document.hidden&&!window.GulchMovementState?.inFlight,start=performance.now(),source=latest?.revision,epoch=String(latest?.gameState.respawnSettings?.token||'original');try{return commit.call(this,data,activity,options);}finally{if(eligible&&window.GulchMovementState?.inFlight)pending={start,source,epoch};}};}
if(document.readyState==='complete')setTimeout(install,0);else window.addEventListener('load',()=>setTimeout(install,0),{once:true});
window.addEventListener('message',e=>{if(e.source===parent&&(e.data?.type==='gulch:commit-result'||e.data?.type==='gulch:snapshot'))queueMicrotask(finish);});
const format=value=>value==null?'—':Math.round(value)+'ms';
function plot(){
 const w=Math.max(1,chart.clientWidth),h=100,dpr=Math.min(window.devicePixelRatio||1,2),cw=Math.round(w*dpr),ch=Math.round(h*dpr);
 if(chart.width!==cw||chart.height!==ch){chart.width=cw;chart.height=ch;}
 const c=chart.getContext('2d');if(!c)return;c.setTransform(dpr,0,0,dpr,0,0);c.fillStyle='#08171e';c.fillRect(0,0,w,h);
 const recent=history.slice(-300),max=Math.max(100,...recent.map(r=>r.minute.mean||0));c.fillStyle='#b8cabb';c.font='10px monospace';c.fillText(Math.ceil(max)+' ms',5,12);c.fillText('0',5,h-4);c.strokeStyle='#ecd095';c.lineWidth=2;c.beginPath();
 const first=recent[0]?.elapsed,last=recent[recent.length-1]?.elapsed;let previous=null;
 for(const r of recent){if(r.minute.mean==null){previous=null;continue;}const x=42+(r.elapsed-first)/Math.max(1,last-first)*(w-48),y=h-10-r.minute.mean/max*(h-28);if(previous===null||r.elapsed-previous>2)c.moveTo(x,y);else c.lineTo(x,y);previous=r.elapsed;}c.stroke();
}
function draw(measurement){
 if(document.hidden)return;
 finish();const now=performance.now(),s=measurement||stats(now),wait=pending?now-pending.start:null;
 const text=(recording?'WAIT':'PAUSED')+' · 10s '+format(s.short.mean)+' · 1m '+format(s.minute.mean)+' · 5m '+format(s.long.mean)+(wait!==null?' · pending '+format(wait):'');if(summary.textContent!==text)summary.textContent=text;
 if(!panel.open)return;
 live.textContent='Completed waits: '+sequence+' · window samples 10s / 1m / 5m: '+s.short.n+' / '+s.minute.n+' / '+s.long.n+' · 1m p95: '+format(s.minute.p95)+' · recorded rows: '+history.length+'.';
 plot();rows.replaceChildren(...history.slice(-60).reverse().map(r=>{const tr=el('tr');for(const v of [r.time.slice(11,19),format(r.short.mean),format(r.minute.mean),format(r.long.mean),format(r.pending)])tr.append(el('td',v));return tr;}));
}
function tick(){timer=null;if(document.hidden)return;finish();const now=performance.now(),s=stats(now);if(recording){history.push({time:new Date().toISOString(),elapsed:Math.round((now-started)/100)/10,total:sequence,...s,pending:pending?Math.round(now-pending.start):null});if(history.length>LIMIT)history.shift();}draw(s);schedule();}
function schedule(){clearTimeout(timer);timer=null;if(!document.hidden&&(recording||panel.open))timer=setTimeout(tick,1000);}
panel.addEventListener('toggle',()=>{draw(null);schedule();});
document.addEventListener('visibilitychange',()=>{pending=null;schedule();if(!document.hidden)draw(null);});
schedule();draw(null);
})();
