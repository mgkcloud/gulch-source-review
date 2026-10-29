(function(){
'use strict';
const board=document.getElementById('workBoard');
if(!board)return;
const files=[
 ['runtime.js','Runtime bridge','Receives snapshots, isolates component callbacks, coordinates focus, movement animation and CAS commits.',['Snapshot → derived player / map / visibility','Action → registered gameplay components','Commit → parent CAS request'],['controls','focusHint']],
 ['character.js','Character editor','Previews and saves the shared player name and appearance.',['Reads player appearance','Commits updated seed.entities'],['characterToggle','characterPanel']],
 ['inventory.js','Inventory','Resolves carried items and equipment; provides search and inspection.',['Reads player / shared inventory','Reads item definitions and equipment'],['inventoryPanel','inventoryList','equipmentSlots']],
 ['renderer.js','World rendering','Draws terrain, sprites, lighting, camera interpolation and HUD.',['Reads derived seed / mapId / lit / player','Reads GulchMovementState.visual'],['board','hud']],
 ['world.js','World actions','Handles movement, collisions, attacks, chase AI and exits.',['Receives move / descend actions','Commits seed and turn changes'],[]],
 ['z-inventory-help.js','Control help','Explains controls and adds keyboard inventory browsing.',['Reads mounted inventory controls'],['keyHelp','keyHelpToggle']],
 ['z-visual-polish.js','Visual theme','Styles the game interface and movement controls.',['Styles mounted game components'],[]],
 ['z-work-board.js','Game status board','Runs structural checks and maintains local task notes.',['Reads incoming room snapshots','Runs checks against current state and DOM'],['workBoard','workToggle']],
 ['zz-build-board-readability.js','Live room dashboard','Displays snapshot metrics and recent room changes.',['Reads snapshots and movement bridge','Observes check status text'],[]],
 ['zz-middle-earth-lore.js','NPC conversations','Displays nearby speakers and can invite a storyteller.',['Reads visible friendly entities','Commits a new storyteller entity'],['lorePanel','loreToggle']],
 ['zzz-live-code-tree.js','Building / Code tree','Displays code responsibilities, live state trees and observed differences.',['Reads snapshots without changing game state','Keeps bounded local revision history'],['liveCodeTree']],
 ['index.html','Document and interface','Provides the canvas, HUD, inventory, controls and script injection marker.',['Runtime loads first; remaining JavaScript loads alphabetically'],['left','board']],
 ['editor-ui.json','Editor layout data','Declares activity and chat widths. This is source data, not runtime state.',['Declared widths: activity 360px; chat 380px'],[]]
];
const style=document.createElement('style');
style.textContent=`
#workBoard .code-live{flex-shrink:0;border-bottom:1px solid #526f63;background:#0a2025}
#workBoard .code-live>summary{padding:12px 18px;color:#f0d49d;font-size:14px;font-weight:600;cursor:pointer}
#workBoard .code-live-body{max-height:44vh;overflow:auto;padding:0 18px 14px;scrollbar-gutter:stable}
#workBoard .code-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px}
#workBoard .code-tools input{min-width:130px;flex:1;padding:10px;background:#07191d;border:1px solid #607d6d;border-radius:5px;color:#e0e9da;font:inherit}
#workBoard .code-stamp,#workBoard .code-note{font-size:12px;line-height:1.6;color:#b6c9bd;margin:7px 0}
#workBoard .code-tree details{border-left:1px solid #567561;margin:7px 0;padding-left:12px}
#workBoard .code-tree summary{cursor:pointer;padding:7px 0;color:#e4d2a8;overflow-wrap:anywhere;font-size:13px}
#workBoard .code-tree p,#workBoard .code-tree li{font-size:12px;line-height:1.65;overflow-wrap:anywhere;white-space:pre-wrap;margin:6px 0}
#workBoard .code-tree ul{padding-left:20px;margin:6px 0}
#workBoard .code-tree .code-value{color:#c4ddc9}
#workBoard .code-tree .code-change{color:#f0d194;border-left:2px solid #c2a260;padding-left:8px}
#workBoard .code-tree .code-warning{color:#f3b6a2}
@media(max-width:700px){#workBoard .code-live-body{padding:0 12px 12px;max-height:40vh}#workBoard .code-live>summary{padding:10px 12px}}
`;
document.head.append(style);
function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function button(text,fn){const b=node('button',text);b.type='button';b.addEventListener('click',fn);return b;}
const section=node('details',undefined,'code-live');section.id='liveCodeTree';
const heading=node('summary','Building / Code · waiting for snapshot');
const body=node('div',undefined,'code-live-body'),tools=node('div',undefined,'code-tools');
const search=node('input');search.type='search';search.placeholder='Filter code, state paths, or changes…';search.setAttribute('aria-label','Filter Building and Code information');
const stamp=node('p','Waiting for room state…','code-stamp');stamp.setAttribute('role','status');
const tree=node('div',undefined,'code-tree');
const note=node('p','Live values and changes are observed in this browser session. File responsibilities describe the supplied source; source revision changes do not expose new code text, compiler output, or editor activity. DOM checks confirm presence, not successful execution.','code-note');
let latest=null,previous=null,history=[],receipts=0,paused=false,dirty=false,lastPaint=0,lastSignature='',lastActivity='Waiting',query='';
const expanded=new Set(['code','changes']);
const pause=button('Pause view',()=>{paused=!paused;pause.textContent=paused?'Resume view':'Pause view';pause.setAttribute('aria-pressed',String(paused));dirty=true;paint();});pause.setAttribute('aria-pressed','false');
function expandAll(open){
 tree.querySelectorAll('details').forEach(d=>{d.open=open;if(open)expanded.add(d.dataset.branch);else expanded.delete(d.dataset.branch);});
}
tools.append(search,pause,button('Expand tree',()=>expandAll(true)),button('Collapse tree',()=>expandAll(false)));
body.append(tools,stamp,note,tree);section.append(heading,body);
const live=board.querySelector('.bb-live');(live||board.querySelector('.bb-toolbar')).after(section);
section.addEventListener('toggle',()=>{if(section.open){dirty=true;paint();}});
search.addEventListener('input',()=>{query=search.value.trim().toLowerCase();dirty=true;paint();});
function branch(parent,key,label,fill){
 const d=node('details'),s=node('summary',label);d.dataset.branch=key;d.open=expanded.has(key)||Boolean(query);s.dataset.codeFocus=key;d.append(s);
 const content=node('div');fill(content);d.append(content);
 d.addEventListener('toggle',()=>{if(!d.isConnected)return;if(d.open)expanded.add(key);else expanded.delete(key);});parent.append(d);
}
function text(value){
 if(value===undefined)return '(absent)';
 const raw=typeof value==='string'?JSON.stringify(value):JSON.stringify(value);
 return String(raw).slice(0,220)+(String(raw).length>220?'…':'');
}
function flatten(value){
 const result=new Map();let count=0,truncated=false;
 function walk(v,path,depth){
  if(count>=2400){truncated=true;return;}count++;
  if(v===null||typeof v!=='object'){result.set(path,text(v));return;}
  const keys=Object.keys(v);
  if(depth>=9){result.set(path,'['+(Array.isArray(v)?'array':'object')+'; '+keys.length+' entries; depth limit]');truncated=true;return;}
  if(!keys.length){result.set(path,Array.isArray(v)?'[]':'{}');return;}
  for(const key of keys){
   if(count>=2400){truncated=true;break;}
   const child=Array.isArray(v)?path+'['+key+']':path+'['+JSON.stringify(key)+']';walk(v[key],child,depth+1);
  }
 }
 walk(value,'gameState',0);return {values:result,truncated};
}
function collect(s){
 const flat=flatten(s.gameState),changes=[];let total=0;
 if(previous){
  const keys=new Set([...previous.values.keys(),...flat.values.keys()]);
  for(const key of keys){
   const before=previous.values.get(key),after=flat.values.get(key);
   if(before!==after){total++;if(changes.length<80)changes.push({path:key,before:before??'(absent)',after:after??'(removed)'});}
  }
  if(latest.revision!==s.revision)changes.unshift({path:'Source revision',before:text(latest.revision),after:text(s.revision)});
  if(latest.clients!==s.clients)changes.unshift({path:'Connected players',before:text(latest.clients),after:text(s.clients)});
 }
 const changed=!latest||latest.stateRevision!==s.stateRevision||latest.revision!==s.revision||changes.length;
 if(changed){
  history=[{time:new Date().toLocaleTimeString(),state:s.stateRevision,source:s.revision,initial:!latest,total,changes,truncated:flat.truncated||Boolean(previous?.truncated)},...history].slice(0,24);
 }
 previous=flat;latest=s;receipts++;dirty=true;
}
function matches(value){return !query||String(value).toLowerCase().includes(query);}
function paint(){
 if(board.hidden||!section.open)return;
 if(paused){stamp.textContent='View paused · incoming snapshots continue to be recorded ('+receipts+' received).';return;}
 const focused=document.activeElement?.dataset?.codeFocus,scroll=body.scrollTop;
 tree.replaceChildren();
 stamp.textContent=latest?'State '+latest.stateRevision+' · source '+latest.revision+' · '+receipts+' snapshots · '+lastActivity:'Waiting for a room snapshot…';
 branch(tree,'code','Code files / responsibilities and live mounts',box=>{
  const visible=files.filter(f=>matches(f.slice(0,4).flat().join(' ')));
  if(!visible.length)box.append(node('p','No matching code files.'));
  visible.forEach(([file,label,description,links,ids])=>branch(box,'file:'+file,file+' · '+label,content=>{
   content.append(node('p',description));
   const ul=node('ul');links.forEach(link=>ul.append(node('li',link)));content.append(ul);
   if(ids.length)ids.forEach(id=>{const mounted=document.getElementById(id);content.append(node('p','#'+id+' · '+(mounted?'mounted'+(mounted.hidden?' · hidden':''):'missing'),mounted?'code-value':'code-warning'));});
   else content.append(node('p','No DOM presence probe for this file.','code-note'));
  }));
 });
 branch(tree,'changes','Live changes / '+history.length+' retained revision events',box=>{
  if(!history.length)box.append(node('p','Waiting for the first snapshot.'));
  history.forEach((entry,index)=>{
   const rows=entry.changes.filter(c=>matches(c.path+' '+c.before+' '+c.after));
   if(query&&!rows.length&&!matches('state '+entry.state+' source '+entry.source))return;
   branch(box,'event:'+entry.state+':'+entry.source+':'+entry.time,entry.time+' · state '+entry.state+' · source '+entry.source+(index===0?' · latest':''),content=>{
    if(entry.initial)content.append(node('p','Initial baseline captured; earlier changes are unavailable.'));
    else if(!entry.changes.length)content.append(node('p','Revision changed with no differences in the inspected state paths.'));
    rows.forEach(c=>content.append(node('p',c.path+'\n'+c.before+' → '+c.after,'code-change')));
    if(entry.total>80)content.append(node('p',entry.total+' inspected paths changed; first 80 state differences retained.','code-note'));
    if(entry.truncated)content.append(node('p','Inspection limits reached; differences outside inspected paths may be omitted.','code-warning'));
   });
  });
 });
 branch(tree,'state','Shared gameState / live value tree',box=>{
  if(!previous){box.append(node('p','Waiting for state.'));return;}
  const groups=new Map();let shown=0,matching=0;
  for(const [path,value] of previous.values){
   if(!matches(path+' '+value))continue;matching++;
   if(shown>=300)continue;shown++;
   const group=path.match(/^gameState\["([^"\\]+)"\]/)?.[1]||'root';
   if(!groups.has(group))groups.set(group,[]);groups.get(group).push([path,value]);
  }
  groups.forEach((rows,key)=>branch(box,'state:'+key,key+' / '+rows.length+' displayed paths',content=>rows.forEach(([path,value])=>content.append(node('p',path+' = '+value,'code-value')))));
  box.append(node('p',shown+' / '+matching+' matching inspected paths shown. Filter to narrow results. Inspection bounded to 2,400 nodes, depth 9 and 220 characters per value. Array paths use indices.','code-note'));
  if(previous.truncated)box.append(node('p','Large or deeply nested state was truncated.','code-warning'));
 });
 branch(tree,'bridge','Runtime / current movement and commit state',box=>{
  const state=window.GulchMovementState;
  if(!state){box.append(node('p','Movement bridge unavailable.','code-warning'));return;}
  [['Focus',state.focused?'Game focused':'Game unfocused'],['Commit',state.inFlight?'Awaiting authoritative snapshot':'No commit in flight'],['Held keys',state.heldKeys.join(', ')||'None'],['Visual position',state.visual?state.visual.map+' / '+state.visual.x.toFixed(2)+', '+state.visual.y.toFixed(2):'Unavailable']].forEach(([k,v])=>{if(matches(k+' '+v))box.append(node('p',k+': '+v,'code-value'));});
  const error=document.getElementById('moduleErrors')?.textContent?.trim();box.append(node('p',error?'Latest module error: '+error:'No module error currently displayed.',error?'code-warning':'code-note'));
 });
 if(focused)Array.from(tree.querySelectorAll('summary')).find(n=>n.dataset.codeFocus===focused)?.focus();
 body.scrollTop=scroll;dirty=false;lastPaint=performance.now();
}
Gulch.register('live-code-tree',{snapshot(s){collect(s);heading.textContent='Building / Code · state '+s.stateRevision+' · source '+s.revision;},resize(){dirty=true;}});
setInterval(()=>{
 if(board.hidden||!section.open)return;
 const state=window.GulchMovementState;
 const signature=JSON.stringify([state?.focused,state?.inFlight,state?.heldKeys,state?.visual,document.getElementById('moduleErrors')?.textContent]);
 if(signature!==lastSignature){lastSignature=signature;lastActivity=state?.inFlight?'Commit pending':state?.focused?'Game focused':'Game unfocused';dirty=true;}
 if(dirty&&performance.now()-lastPaint>=500)paint();
},500);
})();
