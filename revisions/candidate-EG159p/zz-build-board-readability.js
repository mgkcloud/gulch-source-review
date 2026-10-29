(function(){
'use strict';
const board=document.getElementById('workBoard');
if(!board)return;
const style=document.createElement('style');
style.textContent=`
#workBoard{inset:10px;max-width:1400px;margin:auto;background:#0b1c22;color:#e1e8dd}
#workBoard .bb-head{padding:16px 20px}
#workBoard .bb-head h2{font-size:18px;letter-spacing:1px}
#workBoard .bb-muted{font-size:13px;line-height:1.65;color:#b6c9bd}
#workBoard .bb-body{grid-template-columns:minmax(260px,36%) minmax(0,1fr)}
#workBoard .bb-tree,#workBoard .bb-inspector{padding:18px;scrollbar-gutter:stable}
#workBoard .bb-tree summary{font-size:14px;font-weight:600;padding:12px 8px}
#workBoard .bb-branch{padding-left:14px;border-left-color:#678575}
#workBoard .bb-tree .bb-task{font-size:13px;padding:12px;line-height:1.5;margin:10px 0}
#workBoard .bb-task strong{font-size:14px}
#workBoard .bb-task[aria-pressed=true]{box-shadow:inset 4px 0 #e4c68a}
#workBoard .bb-inspector h3{font-size:20px;margin-bottom:12px}
#workBoard .bb-inspector details{padding:14px;background:#10272a;border-color:#526f63}
#workBoard .bb-inspector summary{font-size:14px;font-weight:600;line-height:1.6}
#workBoard .bb-result{font-size:14px;padding:13px 0;line-height:1.6}
#workBoard .bb-result.pass{color:#c4e7ad}#workBoard .bb-result.fail{color:#ffc0aa}
#workBoard .bb-events,#workBoard .bb-note,#workBoard .bb-empty{font-size:13px;line-height:1.7}
#workBoard .bb-toolbar{gap:8px;padding:10px 18px}#workBoard .bb-toolbar span{font-size:13px}
#workBoard button{min-height:40px}#workBoard summary:focus-visible{outline:2px solid #e4c68a;outline-offset:3px}
#workBoard .bb-foot{font-size:11px;line-height:1.5}
.bb-live{padding:12px 18px;border-bottom:1px solid #526f63;background:#10262a;max-height:32%;overflow:auto;flex-shrink:0}
.bb-live-title{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap;margin-bottom:8px}
.bb-live-title strong{font-size:13px;color:#efd39c;letter-spacing:1px}.bb-live-title span{font-size:12px;color:#b6c9bd}
.bb-live-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin:0}
.bb-live-cell{padding:9px 11px;background:#091c20;border:1px solid #3e5c52;border-radius:5px;min-width:0}
.bb-live-cell dt{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#a8c0b1}
.bb-live-cell dd{margin:4px 0 0;font-size:15px;color:#f1e4c6;overflow-wrap:anywhere}
.bb-live details{margin-top:10px}.bb-live summary{cursor:pointer;color:#e4c68a;font-size:13px;padding:5px 0}
.bb-live ol{margin:8px 0;padding-left:24px;font-size:12px;line-height:1.7;color:#c8dbce}
.bb-live li{padding:3px 0;overflow-wrap:anywhere}.bb-live-note{font-size:11px;color:#a8c0b1;margin:8px 0 0}
@media(max-width:850px){.bb-live-grid{grid-template-columns:repeat(3,minmax(0,1fr))}#workBoard .bb-body{grid-template-columns:minmax(220px,37%) minmax(0,1fr)}}
@media(max-width:700px){#workBoard{inset:6px}#workBoard .bb-head{padding:10px 12px}#workBoard .bb-head h2{font-size:15px}#workBoard .bb-body{display:block;overflow:auto}#workBoard .bb-tree{max-height:none;overflow:visible}#workBoard .bb-inspector{overflow:visible}#workBoard .bb-tree,#workBoard .bb-inspector{padding:12px}.bb-live{padding:10px 12px;max-height:28%}.bb-live-cell{padding:6px 8px}.bb-live-cell dd{font-size:13px}#workBoard .bb-toolbar{padding:8px 12px}#workBoard .bb-foot{max-height:52px;overflow:auto}}
@media(max-height:550px){.bb-live{max-height:100px}#workBoard .bb-head .bb-muted{display:none}#workBoard .bb-foot{display:none}}
`;
document.head.append(style);
function node(tag,text){const element=document.createElement(tag);if(text!==undefined)element.textContent=text;return element;}
const toolbar=board.querySelector('.bb-toolbar');
function expandButton(label,open){
 const button=node('button',label);button.type='button';
 button.addEventListener('click',()=>{
  board.querySelectorAll('details').forEach(detail=>{
   detail.open=open;
   detail.dispatchEvent(new Event('toggle'));
  });
 });
 toolbar.append(button);
}
expandButton('Expand all',true);expandButton('Collapse all',false);
const live=node('section');live.className='bb-live';live.setAttribute('aria-label','Live room information');
const heading=node('div');heading.className='bb-live-title';
const title=node('strong','LIVE ROOM'),stamp=node('span','Waiting for a snapshot…');heading.append(title,stamp);
const grid=node('dl');grid.className='bb-live-grid';
const cells={};
['State revision','Source revision','Turn','Players','Map','Position','Health','World entities','Visible entities','Visible tiles','Movement','Checks'].forEach(label=>{
 const cell=node('div');cell.className='bb-live-cell';const value=node('dd','—');cell.append(node('dt',label),value);grid.append(cell);cells[label]=value;
});
const feed=node('details');feed.open=true;
const feedTitle=node('summary','Recent room changes'),list=node('ol');feed.append(feedTitle,list);
const note=node('p','Live values follow incoming snapshots even when check watching is off. Changes are observed in this browser session; check evidence remains in each task.');note.className='bb-live-note';
live.append(heading,grid,feed,note);toolbar.after(live);
let previous=null,events=[];
function put(key,value){const text=String(value??'—');if(cells[key].textContent!==text)cells[key].textContent=text;}
function updateChecks(){put('Checks',toolbar.querySelector('span')?.textContent||'Waiting');}
const observer=new MutationObserver(updateChecks);observer.observe(toolbar,{childList:true,subtree:true,characterData:true});updateChecks();
function movement(){const state=window.GulchMovementState;return state?.inFlight?'Saving shared state':state?.focused?'Map focused':'Map unfocused';}
Gulch.register('build-board-live-information',{
 snapshot(s){
  const entities=s.seed.entities,p=s.player,map=s.seed.maps.find(m=>m.id===s.mapId);
  const visible=entities.filter(e=>e.map===s.mapId&&s.lit[e.y]?.[e.x]===1).length;
  const tiles=s.lit.reduce((count,row)=>count+row.filter(value=>value===1).length,0);
  const current={revision:s.stateRevision,source:s.revision,turn:s.turn,clients:s.clients,map:s.mapId,x:p.x,y:p.y,hp:p.hp,maxHp:p.maxHp,entities:entities.length};
  const changes=[];
  if(!previous)changes.push('Room snapshot received');
  else{
   if(current.source!==previous.source)changes.push('Source revision '+previous.source+' → '+current.source);
   if(current.revision!==previous.revision)changes.push('State revision '+previous.revision+' → '+current.revision);
   if(current.turn!==previous.turn)changes.push('Turn '+previous.turn+' → '+current.turn);
   if(current.map!==previous.map)changes.push('Map '+previous.map+' → '+current.map);
   if(current.x!==previous.x||current.y!==previous.y)changes.push('Position '+previous.x+', '+previous.y+' → '+current.x+', '+current.y);
   if(current.hp!==previous.hp||current.maxHp!==previous.maxHp)changes.push('Health '+previous.hp+'/'+previous.maxHp+' → '+current.hp+'/'+current.maxHp);
   if(current.clients!==previous.clients)changes.push('Connected players '+previous.clients+' → '+current.clients);
   if(current.entities!==previous.entities)changes.push('World entities '+previous.entities+' → '+current.entities);
  }
  const time=new Date().toLocaleTimeString();
  if(changes.length){
   events=[{time,text:changes.join(' · ')},...events].slice(0,12);
   list.replaceChildren(...events.map(event=>node('li',event.time+' — '+event.text)));
   feedTitle.textContent='Recent room changes ('+events.length+') · newest first';
  }
  previous=current;stamp.textContent='Snapshot received '+time;
  put('State revision',s.stateRevision);put('Source revision',s.revision);put('Turn',s.turn);put('Players',s.clients);
  put('Map',map?.name||s.mapId);put('Position',p.x+', '+p.y);put('Health',p.hp+'/'+p.maxHp);
  put('World entities',entities.length);put('Visible entities',visible);put('Visible tiles',tiles);put('Movement',movement());updateChecks();
 },
 resize(){if(!board.hidden)put('Movement',movement());}
});
})();
