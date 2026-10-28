(function(){
'use strict';
const host=document.getElementById('left');
let snapshot=null,openTask='state',running=false,run=0,step=0,timer=null,watch=true,notes=[],events=[],returnFocus=null;
const expanded=new Set(['overview','tasks','discussion']);
const definitions=[
 {id:'state',name:'Shared state',description:'Validate the latest room snapshot and its shared player.',checks:[['Snapshot received',s=>Boolean(s)],['Seed contains maps and entities',s=>Array.isArray(s?.seed?.maps)&&Array.isArray(s?.seed?.entities)],['Shared player exists',s=>Boolean(s?.seed?.entities?.some(e=>e.id==='player'))],['Player coordinates are finite',s=>Number.isFinite(s?.player?.x)&&Number.isFinite(s?.player?.y)]]},
 {id:'map',name:'Map and visibility',description:'Check the active map against the player and derived visibility.',checks:[['Active map exists',s=>Boolean(s?.seed?.maps?.find(m=>m.id===s.mapId))],['Map has terrain rows',s=>{const m=s?.seed?.maps?.find(m=>m.id===s.mapId);return Boolean(m?.ascii?.length&&m.ascii.every(r=>typeof r==='string'));}],['Player is on the map',s=>Boolean(s?.seed?.maps?.find(m=>m.id===s.mapId)?.ascii?.[s.player.y]?.[s.player.x])],['Player tile is visible',s=>s?.lit?.[s.player?.y]?.[s.player?.x]===1]]},
 {id:'controls',name:'Controls and components',description:'Inspect the actual mounted interface and movement bridge.',checks:[['Movement pad mounted',()=>document.querySelectorAll('#controls [data-move]').length===8],['Exit control mounted',()=>Boolean(document.getElementById('descendBtn'))],['Inventory component mounted',()=>Boolean(document.getElementById('inventoryPanel'))],['Movement bridge available',()=>Boolean(window.GulchMovementState)]]},
 {id:'entities',name:'World entities',description:'Check identifiers, map references, and positions without changing gameplay.',checks:[['Entity identifiers are unique',s=>{const a=s?.seed?.entities;return Boolean(a&&a.every(e=>typeof e.id==='string')&&new Set(a.map(e=>e.id)).size===a.length);}],['Entities reference known maps',s=>Boolean(s?.seed?.entities?.every(e=>s.seed.maps.some(m=>m.id===e.map)))],['Entity positions are integers',s=>Boolean(s?.seed?.entities?.every(e=>Number.isInteger(e.x)&&Number.isInteger(e.y)))],['Entities are within map bounds',s=>Boolean(s?.seed?.entities?.every(e=>s.seed.maps.find(m=>m.id===e.map)?.ascii?.[e.y]?.[e.x]))]]}
];
let tasks=fresh();
function fresh(){return definitions.map(d=>({...d,status:'queued',results:[],revision:null}));}
function node(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function button(text,fn){const b=node('button','',text);b.type='button';b.addEventListener('click',fn);return b;}
const style=node('style');style.textContent=`
#workToggle{position:absolute;right:18px;top:170px;z-index:4;padding:9px 13px;border:1px solid #879c6e66;border-radius:5px;background:#132c2b;color:#dedabd;font:11px monospace}
#workBoard[hidden]{display:none}#workBoard{position:absolute;inset:18px;z-index:9;display:flex;flex-direction:column;background:#09191ffa;border:1px solid #668779;border-radius:10px;box-shadow:0 20px 70px #000b;overflow:hidden;color:#cedbd0}
#workBoard button,#workBoard textarea{font:inherit;background:#17312f;color:#dce3cd;border:1px solid #4c6c5c;border-radius:5px;padding:8px 10px}#workBoard button:hover{background:#2b4940}#workBoard button:disabled{opacity:.45;cursor:default}#workBoard button[aria-pressed=true]{border-color:#e4c68a;color:#ffe1a3;background:#334738}
.bb-head,.bb-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid #365149}.bb-head h2{margin:0;color:#e4c68a;font-size:15px;letter-spacing:2px}.bb-head>div{flex:1}.bb-muted{font-size:11px;color:#9bb2a6;line-height:1.6}.bb-body{display:grid;grid-template-columns:minmax(180px,35%) minmax(0,1fr);flex:1;min-height:0}.bb-tree,.bb-inspector{padding:14px;overflow:auto;min-width:0}.bb-tree{border-right:1px solid #365149}.bb-tree details{margin:6px 0}.bb-tree summary{cursor:pointer;padding:9px 5px;color:#e2cf9f}.bb-branch{border-left:1px solid #486252;margin:4px 0 12px 8px;padding-left:12px}.bb-tree .bb-task{display:block;width:100%;text-align:left;margin:7px 0;font-size:11px}.bb-task strong{display:block;margin-bottom:5px}.bb-tree p{overflow-wrap:anywhere}.bb-inspector h3{color:#e5d4ad;margin:4px 0 10px}.bb-inspector details{border:1px solid #365149;border-radius:5px;padding:10px;margin:10px 0}.bb-inspector summary{cursor:pointer;color:#e2cf9f}.bb-result{font-size:12px;padding:10px 0;border-bottom:1px solid #294238}.bb-result.pass{color:#b4d79c}.bb-result.fail{color:#f0ad96}.bb-result.running{color:#f2d18c}.bb-progress{width:100%;height:9px;accent-color:#d7bc7b}.bb-events{padding-left:20px;font-size:11px;line-height:1.8;overflow-wrap:anywhere}.bb-note{padding:10px;background:#102825;border-left:2px solid #78986e;margin:8px 0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}.bb-note small{display:block;color:#9bb2a6;margin-bottom:5px}#boardNote{width:100%;resize:vertical;min-height:80px;margin:8px 0}.bb-foot{padding:9px 16px;border-top:1px solid #365149;font-size:10px;color:#90a899}.bb-toolbar span{font-size:11px;color:#c8d7b8}.bb-empty{font-size:12px;color:#9bb2a6}
@media(max-width:700px){#workToggle{top:154px;right:10px}#workBoard{inset:8px}.bb-body{grid-template-columns:1fr;display:block;overflow:auto}.bb-tree{max-height:260px;overflow:auto;border-right:0;border-bottom:1px solid #365149}.bb-inspector{overflow:visible}.bb-head h2{font-size:12px}}
`;document.head.append(style);
const toggle=button('Game status',()=>show(board.hidden));toggle.id='workToggle';toggle.setAttribute('aria-controls','workBoard');toggle.setAttribute('aria-expanded','false');
const board=node('section');board.id='workBoard';board.hidden=true;board.setAttribute('role','dialog');board.setAttribute('aria-modal','true');board.setAttribute('aria-labelledby','buildBoardTitle');
const header=node('header','bb-head'),heading=node('div'),title=node('h2','','GAME STATUS');title.id='buildBoardTitle';heading.append(title,node('div','bb-muted','Live game state and runtime checks'));
const close=button('Close',()=>show(false));header.append(heading,close);
const toolbar=node('div','bb-toolbar');
const start=button('Run checks',begin),stop=button('Pause',pause),watchButton=button('Watch live: on',()=>{watch=!watch;watchButton.textContent='Watch live: '+(watch?'on':'off');watchButton.setAttribute('aria-pressed',String(watch));if(watch&&snapshot&&!running)begin();});watchButton.setAttribute('aria-pressed','true');
const status=node('span');status.setAttribute('role','status');toolbar.append(start,stop,watchButton,status);
const body=node('div','bb-body'),tree=node('nav','bb-tree'),inspector=node('section','bb-inspector');tree.setAttribute('aria-label','Build information tree');body.append(tree,inspector);
board.append(header,toolbar,body,node('footer','bb-foot','Checks run against real room snapshots. Notes stay in this browser session. This board cannot access editor chat, source builds, or AI task feeds.'));host.append(toggle,board);
function show(value){if(value)returnFocus=document.activeElement;board.hidden=!value;toggle.setAttribute('aria-expanded',String(value));if(value){render();close.focus();}else (returnFocus?.isConnected?returnFocus:toggle).focus();}
window.addEventListener('keydown',event=>{
 if(board.hidden||!document.getElementById('inventoryPanel').hidden)return;
 if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();show(false);return;}
 if(event.key==='Tab'){
  const controls=Array.from(board.querySelectorAll('button,textarea,summary')).filter(n=>!n.disabled&&n.getClientRects().length);
  const first=controls[0],last=controls[controls.length-1];
  if(event.shiftKey&&(document.activeElement===first||!board.contains(document.activeElement))){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&(document.activeElement===last||!board.contains(document.activeElement))){event.preventDefault();first?.focus();}
 }
},true);
function log(text){events=[{text,time:new Date().toLocaleTimeString()},...events].slice(0,60);}
function branch(parent,id,label,fill){const d=node('details');d.open=expanded.has(id);const s=node('summary','',label);s.dataset.focus='tree:'+id;d.append(s);const content=node('div','bb-branch');fill(content);d.append(content);d.addEventListener('toggle',()=>{if(d.open)expanded.add(id);else expanded.delete(id);});parent.append(d);}
function renderTree(){
 tree.replaceChildren();
 branch(tree,'overview','Room / current state',box=>{
  const p=snapshot?.player;
  [['Source revision',snapshot?.revision],['State revision',snapshot?.stateRevision],['Turn',snapshot?.turn],['Connected players',snapshot?.clients],['Map',p?.map],['Position',p?p.x+', '+p.y:null]].forEach(([k,v])=>box.append(node('p','bb-muted',k+': '+(v??'waiting'))));
 });
 branch(tree,'tasks','Live tasks / '+tasks.filter(t=>t.status==='passed').length+' of '+tasks.length+' passed',box=>{
  tasks.forEach(t=>{
   const b=button('',()=>{openTask=t.id;render();});b.className='bb-task';b.dataset.focus='task:'+t.id;b.setAttribute('aria-pressed',String(openTask===t.id));b.append(node('strong','',t.name),node('span','',t.status+' · '+t.results.length+'/'+t.checks.length));box.append(b);
   branch(box,'sub:'+t.id,'Check tree',sub=>t.checks.forEach(([name],i)=>sub.append(node('p','bb-muted',(t.results[i]?(t.results[i].pass?'✓ ':'! '):'○ ')+name))));
  });
 });
 branch(tree,'discussion','Board discussion / '+notes.length,box=>{box.append(node('p','bb-muted','Local notes linked to each task. Select a task to add a note.'));notes.slice(-5).reverse().forEach(n=>box.append(node('p','bb-muted',n.task+': '+n.text.slice(0,100))));});
 branch(tree,'activity','Activity / '+events.length,box=>{const list=node('ol','bb-events');events.slice(0,15).forEach(e=>list.append(node('li','',e.time+' · '+e.text)));box.append(list);});
}
function renderDetail(){
 const task=tasks.find(t=>t.id===openTask)||tasks[0];
 inspector.replaceChildren(node('h3','',task.name),node('p','bb-muted',task.description));
 inspector.append(node('p','bb-muted','Status: '+task.status+' · Checked state revision: '+(task.revision??'pending')));
 const progress=node('progress','bb-progress');progress.max=task.checks.length;progress.value=task.results.length;progress.setAttribute('aria-label',task.name+' progress');inspector.append(progress);
 branch(inspector,'checks:'+task.id,'Validation evidence / '+task.results.length+'/'+task.checks.length,box=>{
  task.checks.forEach(([name],i)=>{const result=task.results[i];const active=running&&tasks[Math.floor(step/4)]?.id===task.id&&i===task.results.length;box.append(node('div','bb-result '+(result?(result.pass?'pass':'fail'):active?'running':''),(result?(result.pass?'✓ PASS · ':'! FAIL · '):active?'◉ CHECKING · ':'○ QUEUED · ')+name));if(result)box.append(node('div','bb-muted',result.evidence));});
 });
 branch(inspector,'context:'+task.id,'Dependencies and execution',box=>{
  box.append(node('p','bb-muted','Input: latest room snapshot and mounted browser components.'),node('p','bb-muted','Each check executes once per run. A new shared state revision queues a fresh run when live watching is on.'),node('p','bb-muted','Passing these checks validates runtime structure, not a source build or a complete gameplay test.'));
 });
 const heading=node('h4','','BOARD DISCUSSION');inspector.append(heading,node('p','bb-muted','Notes for '+task.name+' · local to this browser · separate from room chat'));
 const thread=node('div');notes.filter(n=>n.taskId===task.id).forEach(n=>{const entry=node('div','bb-note'),text=node('div','',n.text);entry.append(node('small','',n.time+' · You'),text);thread.append(entry);});if(!thread.children.length)thread.append(node('p','bb-empty','No notes for this task yet.'));inspector.append(thread);
 const form=node('form'),label=node('label','','Add a task note'),input=node('textarea');input.id='boardNote';input.maxLength=2000;input.placeholder='Observations, questions, or next steps…';label.htmlFor=input.id;
 const send=node('button','','Add note');send.type='submit';form.append(label,input,send);form.addEventListener('submit',event=>{event.preventDefault();const text=input.value.trim();if(!text)return;notes=[...notes,{taskId:task.id,task:task.name,text,time:new Date().toLocaleTimeString()}].slice(-100);log('Note added to '+task.name+'.');render();inspector.querySelector('textarea')?.focus();});inspector.append(form);
}
function render(){
 if(board.hidden)return;
 const focused=document.activeElement,focusId=focused?.dataset?.focus;
 const input=inspector.querySelector('textarea'),draft=input?.value||'',selection=input?[input.selectionStart,input.selectionEnd]:null,wasTyping=focused===input;
 const oldTask=inspector.dataset.task,scroll=inspector.scrollTop,treeScroll=tree.scrollTop;
 renderTree();renderDetail();inspector.dataset.task=openTask;
 if(oldTask===openTask){const next=inspector.querySelector('textarea');next.value=draft;if(wasTyping){next.focus();if(selection)next.setSelectionRange(...selection);}inspector.scrollTop=scroll;}
 if(focusId){const target=Array.from(board.querySelectorAll('[data-focus]')).find(n=>n.dataset.focus===focusId);target?.focus();}
 tree.scrollTop=treeScroll;
 start.disabled=running||!snapshot;stop.disabled=!running&&step===0;stop.textContent=running?'Pause':'Resume';
 status.textContent=(running?'Running':step>0&&step<16?'Paused':'Ready')+' · '+tasks.reduce((n,t)=>n+t.results.length,0)+'/16 checks';
}
function begin(){
 if(!snapshot||running)return;
 clearTimeout(timer);run++;step=0;tasks=fresh();running=true;log('Run '+run+' started at state revision '+snapshot.stateRevision+'.');tick();
}
function pause(){
 if(running){clearTimeout(timer);running=false;log('Run '+run+' paused.');render();}
 else if(step>0&&step<16){running=true;log('Run '+run+' resumed.');tick();}
}
function tick(){
 if(!running)return;
 const index=Math.floor(step/4),checkIndex=step%4;
 if(index>=tasks.length){running=false;step=0;log('Run '+run+' finished: '+tasks.filter(t=>t.status==='passed').length+'/'+tasks.length+' tasks passed.');render();return;}
 const task=tasks[index],check=task.checks[checkIndex];
 tasks=tasks.map((t,i)=>i===index?{...t,status:'running'}:t);render();
 timer=setTimeout(()=>{
  if(!running)return;
  let pass=false,evidence='';
  try{pass=Boolean(check[1](snapshot));evidence=(pass?'Condition verified':'Condition not met')+' at state revision '+snapshot.stateRevision+'.';}catch(error){evidence='Check error: '+String(error.message||error).slice(0,200);}
  const results=[...tasks[index].results,{pass,evidence}];
  tasks=tasks.map((t,i)=>i===index?{...t,results,revision:snapshot.stateRevision,status:results.length===t.checks.length?(results.every(r=>r.pass)?'passed':'failed'):'running'}:t);
  log(task.name+' / '+check[0]+': '+(pass?'passed':'failed')+'.');step++;render();tick();
 },450);
}
expanded.add('checks:state');
Gulch.register('work-board',{snapshot(s){
 const changed=!snapshot||snapshot.stateRevision!==s.stateRevision||snapshot.revision!==s.revision;snapshot=s;
 if(changed&&watch){clearTimeout(timer);running=false;begin();}else render();
}});
})();
