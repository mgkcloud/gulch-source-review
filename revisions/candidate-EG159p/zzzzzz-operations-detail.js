(function(){
'use strict';
const board=document.getElementById('workBoard'),source=document.getElementById('sourceResponse');
if(!board||!source)return;
let latest=null,previous=null,history=[],selection='room',paused=false,pending=false,lastBridge='',dirty=true;
const expanded=new Set(['root','operations','events']);
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function button(text,fn){const b=el('button',text);b.type='button';b.addEventListener('click',fn);return b;}
const style=el('style');style.textContent=`
#workBoard{inset:4px;max-width:none;overflow:auto;display:block;scrollbar-gutter:stable}
#workBoard>.bb-head{position:sticky;top:0;z-index:4;background:var(--world-bg,#09191f)}
#workBoard>.build-world{height:108px}
#workBoard>.bb-body{min-height:460px}
#workBoard #sourceResponse{margin:12px;border:1px solid var(--world-line,#526f63);border-radius:8px}
#workBoard #sourceResponse>summary{font-size:17px;padding:18px}
#workBoard .source-response-body{max-height:none;padding:0 18px 20px}
#workBoard .source-code{height:65vh;max-height:none;min-height:320px;font-size:13px;line-height:1.8}
#workBoard #sourceResponse textarea{min-height:200px}
#operationLive{margin:12px;border:1px solid var(--world-line,#526f63);border-radius:8px;background:var(--world-card,#10272a)}
#operationLive>summary{padding:16px;font-size:16px;cursor:pointer;color:var(--world-accent,#e4c68a)}
.op-toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:0 16px 12px}
.op-toolbar span{font-size:12px;color:var(--world-muted,#b6c9bd)}
.op-layout{display:grid;grid-template-columns:minmax(220px,30%) minmax(0,1fr);min-height:420px}
.op-tree{padding:12px;border-right:1px solid var(--world-line,#526f63);max-height:65vh;overflow:auto}
.op-tree details{margin:8px 0}.op-tree summary{padding:8px;cursor:pointer;color:var(--world-text,#e1e8dd)}
#workBoard .op-tree button{display:block;width:100%;text-align:left;margin:5px 0;font-size:12px;overflow-wrap:anywhere}
.op-detail{padding:18px;min-width:0;max-height:75vh;overflow:auto}
.op-detail h3{margin:0 0 12px;color:var(--world-accent,#e4c68a)}
.op-detail p{font-size:13px;line-height:1.7;overflow-wrap:anywhere}
.op-detail pre{white-space:pre-wrap;overflow-wrap:anywhere;background:var(--world-bg,#09191f);padding:14px;border-radius:6px;font:12px/1.7 monospace;max-height:55vh;overflow:auto}
.op-detail table{border-collapse:collapse;width:100%;font-size:12px}.op-detail td,.op-detail th{text-align:left;vertical-align:top;padding:10px;border-bottom:1px solid var(--world-line,#526f63);overflow-wrap:anywhere;white-space:pre-wrap}
@media(max-width:700px){.op-layout{grid-template-columns:1fr}.op-tree{max-height:240px;border-right:0;border-bottom:1px solid var(--world-line,#526f63)}.op-detail{padding:12px}#workBoard .source-code{height:60vh;font-size:12px}#workBoard #sourceResponse,#operationLive{margin:6px}}
`;document.head.append(style);
source.querySelector('summary').textContent='Operations / complete generated files';
const panel=el('details');panel.id='operationLive';panel.open=true;
const heading=el('summary','Live information / click a tree item for details');
const toolbar=el('div',undefined,'op-toolbar'),stamp=el('span');stamp.setAttribute('role','status');
const pause=button('Pause live view',()=>{paused=!paused;pause.textContent=paused?'Resume live view':'Pause live view';pause.setAttribute('aria-pressed',String(paused));if(!paused)render();});pause.setAttribute('aria-pressed','false');
toolbar.append(pause,button('Open full operations',()=>{source.open=true;source.scrollIntoView({block:'start'});}),stamp);
const layout=el('div',undefined,'op-layout'),tree=el('nav',undefined,'op-tree'),detail=el('section',undefined,'op-detail');tree.setAttribute('aria-label','Live operations information tree');detail.setAttribute('aria-label','Selected information');layout.append(tree,detail);panel.append(heading,toolbar,layout);source.before(panel);
function value(v){const t=JSON.stringify(v,null,2);return t===undefined?'(absent)':t;}
function short(v){const t=value(v);return t.length>1000?t.slice(0,1000)+'\n… value preview truncated':t;}
function operations(){
 const input=document.getElementById('sourceResponseInput');
 if(!input?.value.trim())return {items:[],message:'Paste a generated response into Operations to inspect its file operations.'};
 try{const raw=input.value.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');const data=JSON.parse(raw);if(!Array.isArray(data.operations)||data.operations.length>24)throw new Error('Expected at most 24 operations.');return {items:data.operations.map((o,i)=>({index:i,op:String(o?.op||'unknown'),path:String(o?.path||'(missing path)'),content:typeof o?.content==='string'?o.content:''})),message:'These operations are pasted response data, not a live editor queue or proof of installation.'};}catch(e){return {items:[],message:'Cannot inspect response: '+String(e.message)};}
}
function branch(key,label,fill){const d=el('details');d.open=expanded.has(key);d.append(el('summary',label));fill(d);d.addEventListener('toggle',()=>{if(!d.isConnected)return;if(d.open)expanded.add(key);else expanded.delete(key);});tree.append(d);}
function item(parent,key,label){const b=button(label,()=>{selection=key;render();});b.dataset.selection=key;b.setAttribute('aria-pressed',String(selection===key));parent.append(b);}
function render(){
 if(board.hidden||!panel.open||paused)return;
 const active=document.activeElement?.dataset?.selection,scroll=tree.scrollTop;
 const ops=operations(),m=window.GulchMovementState;
 tree.replaceChildren();
 branch('root','Room / live systems',d=>{item(d,'room','Room overview');item(d,'commit','Focus and commit lifecycle');item(d,'player','Shared player');item(d,'map','Active map');item(d,'errors','Runtime errors');});
 branch('operations','File operations / '+ops.items.length,d=>{item(d,'operations','Operation summary');ops.items.forEach(o=>item(d,'operation:'+o.index,o.op.toUpperCase()+' · '+o.path));});
 branch('state','Shared state / top-level fields',d=>Object.keys(latest?.gameState||{}).slice(0,80).forEach(k=>item(d,'state:'+k,k)));
 branch('events','Observed changes / '+history.length,d=>history.forEach(e=>item(d,'event:'+e.id,e.time+' · state '+e.revision+' · '+e.count+' field changes')));
 detail.replaceChildren();
 function title(t){detail.append(el('h3',t));}function text(t){detail.append(el('p',t));}function code(v){detail.append(el('pre',short(v)));}
 stamp.textContent=(latest?'State '+latest.stateRevision+' · source '+latest.revision:'Waiting for snapshot')+' · '+(m?.inFlight?'commit awaiting confirmation':'no commit pending');
 if(selection==='room'){title('Live room overview');text('Select an item in the tree to inspect its current values. This view observes the game runtime; it does not access editor chat, builds, or server queues.');code(latest?{stateRevision:latest.stateRevision,sourceRevision:latest.revision,turn:latest.turn,players:latest.clients,map:latest.mapId,entities:latest.seed.entities.length}:null);}
 else if(selection==='commit'){title('Focus and commit lifecycle');text(m?.inFlight?'A CAS commit request is pending. Gameplay waits for an authoritative snapshot with a different state revision.':'No commit is currently pending in the runtime.');text('A revision change alone does not prove that this browser’s proposal won a concurrent update. The bridge exposes pending status, not a server acceptance receipt.');code(m);}
 else if(selection==='player'){title('Shared player');code(latest?.player);}
 else if(selection==='map'){title('Active map');const map=latest?.seed.maps.find(v=>v.id===latest.mapId);if(map){const {ascii,...metadata}=map;code({...metadata,rows:ascii.length,columns:Math.max(0,...ascii.map(r=>r.length))});detail.append(el('pre',ascii.join('\n')));}else text('Waiting for map data.');}
 else if(selection==='errors'){title('Runtime errors');text(document.getElementById('moduleErrors')?.textContent.trim()||'No runtime error is currently displayed. This is not a complete error history.');}
 else if(selection==='operations'){title('Generated file operations');text(ops.message);code(ops.items.map(o=>({operation:o.op,path:o.path,bytes:new TextEncoder().encode(o.content).length,lines:o.content.split('\n').length})));}
 else if(selection.startsWith('operation:')){const o=ops.items[Number(selection.slice(10))];title(o?o.op.toUpperCase()+' · '+o.path:'Operation unavailable');if(o){text(ops.message);text(new TextEncoder().encode(o.content).length+' UTF-8 bytes · '+o.content.split('\n').length+' lines. '+(o.op==='delete'?'Removes the file.':'Entire replacement file contents.'));detail.append(el('pre',o.content));}}
 else if(selection.startsWith('state:')){const key=selection.slice(6);title('gameState.'+key);code(latest?.gameState[key]);text('Value preview is limited to 1,000 characters. Use Shared player or Active map for focused details.');}
 else if(selection.startsWith('event:')){const e=history.find(v=>String(v.id)===selection.slice(6));title('Observed snapshot changes');if(!e)text('This event has expired from the 30-event history.');else{text(e.time+' · state '+e.revision+' · source '+e.source);text(e.initial?'Initial snapshot captured as the baseline.':'Compared entity records by ID and other shared state fields by name. First 60 changed records retained.');const table=el('table'),head=el('tr');['Field','Before','After'].forEach(t=>head.append(el('th',t)));table.append(head);e.rows.forEach(r=>{const row=el('tr');[r.path,r.before,r.after].forEach(t=>row.append(el('td',t)));table.append(row);});detail.append(table);}}
 if(active)Array.from(tree.querySelectorAll('button')).find(b=>b.dataset.selection===active)?.focus();tree.scrollTop=scroll;dirty=false;
}
let serial=0;
function records(s){const rows=new Map();Object.entries(s.gameState).forEach(([k,v])=>{if(k!=='seed')rows.set('gameState.'+k,value(v));});Object.entries(s.seed).forEach(([k,v])=>{if(k!=='entities')rows.set('seed.'+k,value(v));});s.seed.entities.forEach(e=>rows.set('entity['+e.id+']',value(e)));rows.set('room.clients',value(s.clients));return rows;}
Gulch.register('operations-live-detail',{snapshot(s){
 const next=records(s),rows=[];let count=0;
 if(previous)for(const key of new Set([...previous.keys(),...next.keys()])){if(previous.get(key)!==next.get(key)){count++;if(rows.length<60){const clip=v=>v===undefined?'(absent)':v.length>1000?v.slice(0,1000)+'…':v;rows.push({path:key,before:clip(previous.get(key)),after:clip(next.get(key))});}}}
 if(!latest||count||latest.stateRevision!==s.stateRevision||latest.revision!==s.revision)history=[{id:++serial,time:new Date().toLocaleTimeString(),revision:s.stateRevision,source:s.revision,initial:!latest,count,rows},...history].slice(0,30);
 previous=next;latest=s;dirty=true;
}});
source.addEventListener('input',()=>{dirty=true;});source.addEventListener('click',()=>{dirty=true;});panel.addEventListener('toggle',()=>{if(panel.open)render();});
new MutationObserver(()=>{if(!board.hidden)render();}).observe(board,{attributes:true,attributeFilter:['hidden']});
setInterval(()=>{if(document.hidden||board.hidden||paused)return;const m=window.GulchMovementState,signature=JSON.stringify([m?.focused,m?.inFlight,document.getElementById('moduleErrors')?.textContent]);if(signature!==lastBridge){lastBridge=signature;dirty=true;}if(dirty)render();},500);
})();
