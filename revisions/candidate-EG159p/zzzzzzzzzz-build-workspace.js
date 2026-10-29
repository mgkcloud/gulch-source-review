(function(){
'use strict';
const board=document.getElementById('workBoard');
if(!board)return;
let latest=null,previous=null,selected='overview',query='',history=[],counter=0;
const sections=new Map();
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function button(text,fn){const b=el('button',text);b.type='button';b.addEventListener('click',fn);return b;}
const style=el('style');style.textContent=`
#workBoard:not([data-selecting=true]){display:flex;flex-direction:column;overflow:hidden;inset:8px;border-radius:12px}
#workBoard:not([data-selecting=true])>.bb-head{position:static;flex-shrink:0}
#workBoard:not([data-selecting=true])>.build-world,#workBoard:not([data-selecting=true])>.bb-foot{display:none}
#workBoard:not([data-selecting=true])>.bb-toolbar{flex-shrink:0;max-height:105px;overflow:auto}
#buildWorkspace{display:grid;grid-template-columns:210px minmax(0,1fr);flex:1;min-height:0;color:var(--world-text,#d3edf0)}
#buildWorkspace nav{padding:14px;overflow:auto;border-right:1px solid var(--world-line,#246073);background:var(--world-bg,#041723)}
#buildWorkspace nav input{width:100%;min-width:0;padding:10px;margin-bottom:12px;background:var(--world-card,#092632);color:inherit;border:1px solid var(--world-line,#246073);border-radius:6px}
#buildWorkspace nav button{width:100%;display:block;text-align:left;margin:5px 0;padding:11px;font-size:12px;min-height:44px}
#buildWorkspace nav button[aria-current=page]{border-color:var(--world-accent,#62e8eb);box-shadow:inset 3px 0 var(--world-accent,#62e8eb)}
.bx-main{overflow:auto;min-width:0;padding:20px;scrollbar-gutter:stable}
.bx-main>[hidden]{display:none!important}
.bx-title{font:600 22px system-ui,sans-serif;margin:0 0 8px}.bx-sub{font-size:12px;line-height:1.7;color:var(--world-muted,#8eafb9)}
.bx-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:12px;margin:18px 0}
.bx-card{padding:16px;border:1px solid var(--world-line,#246073);border-radius:8px;background:var(--world-card,#092632);min-width:0}
.bx-card strong{display:block;font-size:23px;overflow-wrap:anywhere;margin:6px 0}.bx-card span{font-size:11px;color:var(--world-muted,#8eafb9)}
.bx-actions{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}.bx-list{padding:0;list-style:none}.bx-list li{padding:13px 0;border-bottom:1px solid var(--world-line,#246073);font-size:12px;line-height:1.7;overflow-wrap:anywhere}
.bx-good{color:#9cdcb7}.bx-bad{color:#ffb49e}#workBoard[data-world=orbit] .bx-good{color:#286a43}#workBoard[data-world=orbit] .bx-bad{color:#9a3030}
.bx-main pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:14px;background:var(--world-bg,#041723);border:1px solid var(--world-line,#246073);border-radius:6px;font:12px/1.7 monospace;max-height:45vh;overflow:auto}
#bxMap{width:100%;height:auto;max-height:52vh;object-fit:contain;background:#07151c;image-rendering:pixelated;border:1px solid var(--world-line,#246073)}
.bx-main #buildInspector,.bx-main #operationLive,.bx-main #sourceResponse{margin:0;border:0}
.bx-main .bb-live{max-height:none}.bx-main .code-live-body{max-height:none}.bx-main .bb-body{min-height:500px}.bx-main .source-code{height:55vh}
.bx-main .bx-search-empty{padding:24px;font-size:12px}
@media(max-width:750px){#buildWorkspace{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr)}#buildWorkspace nav{display:flex;gap:6px;overflow:auto;padding:8px;border-right:0;border-bottom:1px solid var(--world-line,#246073)}#buildWorkspace nav input{width:150px;flex-shrink:0;margin:0}#buildWorkspace nav button{width:auto;white-space:nowrap;margin:0}.bx-main{padding:12px}#workBoard:not([data-selecting=true])>.bb-toolbar{max-height:78px}.bx-title{font-size:19px}}
`;document.head.append(style);
const root=el('section');root.id='buildWorkspace';root.setAttribute('aria-label','Build workspace');
const nav=el('nav');nav.setAttribute('aria-label','Build workspace views');
const search=el('input');search.type='search';search.placeholder='Find a tool…';search.setAttribute('aria-label','Filter workspace navigation');nav.append(search);
const main=el('div',undefined,'bx-main');root.append(nav,main);
const overview=el('section'),diagnostics=el('section'),atlas=el('section'),timeline=el('section');
function add(id,label,node,description){if(!node)return;sections.set(id,{label,node,description});main.append(node);}
add('overview','Overview',overview,'health summary shortcuts');
add('diagnostics','Diagnostics',diagnostics,'validation checks errors exits terrain');
add('atlas','World inspector',atlas,'maps entities terrain player');
add('timeline','Revision history',timeline,'changes compare snapshots');
add('checks','Check runner',board.querySelector('.bb-body'),'run checks tasks notes discussion');
add('metrics','Live metrics',board.querySelector('.bb-live'),'room players movement');
add('code','Loaded source',document.getElementById('buildInspector'),'script bodies source search intelligence');
add('files','Response files',document.getElementById('sourceResponse'),'import generated operations complete files');
add('operations','Operation inspector',document.getElementById('operationLive'),'state fields commit lifecycle');
add('tree','Code and state tree',document.getElementById('liveCodeTree'),'responsibilities differences state paths');
board.append(root);
const navButtons=new Map();
sections.forEach((v,id)=>{v.node.hidden=true;v.node.setAttribute('data-workspace-view',id);const b=button(v.label,()=>show(id,true));b.setAttribute('aria-controls',v.node.id||(v.node.id='bx-'+id));navButtons.set(id,b);nav.append(b);});
const empty=el('p','No matching tools.','bx-search-empty');empty.hidden=true;nav.append(empty);
function show(id,focus){
 if(!sections.has(id))return;
 selected=id;
 sections.forEach((v,key)=>{v.node.hidden=key!==id;if(key===id&&v.node.tagName==='DETAILS')v.node.open=true;navButtons.get(key).setAttribute('aria-current',key===id?'page':'false');});
 main.scrollTop=0;render();
 if(focus){const n=sections.get(id).node;n.tabIndex=-1;n.focus({preventScroll:true});}
}
search.addEventListener('input',()=>{query=search.value.trim().toLowerCase();let count=0;sections.forEach((v,id)=>{const visible=(v.label+' '+v.description).toLowerCase().includes(query);navButtons.get(id).hidden=!visible;if(visible)count++;});empty.hidden=count>0;});
function checks(s){
 const seed=s.seed,ids=seed.entities.map(e=>e.id),maps=seed.maps;
 const inside=(map,x,y)=>Number.isInteger(x)&&Number.isInteger(y)&&Boolean(map?.ascii?.[y]?.[x]);
 const badEntities=seed.entities.filter(e=>!inside(maps.find(m=>m.id===e.map),e.x,e.y));
 const badExits=maps.flatMap(m=>(m.exits||[]).filter(e=>!inside(m,e.x,e.y)||!inside(maps.find(n=>n.id===e.to),e.at?.x,e.at?.y)).map(e=>m.id+' → '+e.to));
 const duplicateMaps=maps.length!==new Set(maps.map(m=>m.id)).size;
 return [
 ['Entity IDs',new Set(ids).size===ids.length&&ids.every(id=>typeof id==='string'&&id.length>0),'Identifiers must be nonempty strings and unique.'],
 ['Map IDs',!duplicateMaps&&maps.every(m=>typeof m.id==='string'&&m.id.length>0),'Maps need unique nonempty string identifiers.'],
 ['Entity positions',badEntities.length===0,badEntities.length?badEntities.slice(0,12).map(e=>e.id).join(', '):'All entities occupy integer coordinates within their maps.'],
 ['Exit destinations',badExits.length===0,badExits.length?badExits.slice(0,12).join(', '):'All exit origins and destinations are within map bounds.'],
 ['Shared player',seed.entities.filter(e=>e.id==='player').length===1,'Exactly one shared player is expected by this game.'],
 ['Player health',Number.isFinite(s.player.hp)&&Number.isFinite(s.player.maxHp)&&s.player.maxHp>0&&s.player.hp>=0&&s.player.hp<=s.player.maxHp,'Health must be finite and between zero and maximum health.'],
 ['Runtime error display',!document.getElementById('moduleErrors')?.textContent.trim(),document.getElementById('moduleErrors')?.textContent.trim()||'No error is currently displayed; this is not a complete error history.']
 ];
}
function heading(node,title,subtitle){node.replaceChildren(el('h2',title,'bx-title'),el('p',subtitle,'bx-sub'));}
function cards(node,values){const grid=el('div',undefined,'bx-grid');values.forEach(([label,value])=>{const card=el('div',undefined,'bx-card');card.append(el('span',label),el('strong',String(value)));grid.append(card);});node.append(grid);}
function overviewView(){
 heading(overview,'Build workspace','Inspect the running game, diagnose structural problems, and review complete source responses. All views are local and read-only unless an existing tool explicitly commits a gameplay edit.');
 if(!latest){overview.append(el('p','Waiting for an authoritative snapshot.'));return;}
 const rows=checks(latest),passed=rows.filter(r=>r[1]).length;
 cards(overview,[['Structural checks',passed+'/'+rows.length],['State revision',latest.stateRevision],['Source revision',latest.revision],['World maps',latest.seed.maps.length],['Entities',latest.seed.entities.length],['Connected players',latest.clients??'Unknown']]);
 const actions=el('div',undefined,'bx-actions');[['diagnostics','Inspect findings'],['code','Browse loaded code'],['files','Review generated files'],['atlas','Inspect world']].forEach(([id,label])=>{if(sections.has(id))actions.append(button(label,()=>show(id,true)));});overview.append(actions);
 const list=el('ul',undefined,'bx-list');rows.filter(r=>!r[1]).forEach(r=>list.append(el('li',r[0]+': '+r[2],'bx-bad')));if(!list.children.length)list.append(el('li','Structural checks pass. Verify movement, attacks, exits and simultaneous edits in both browsers before calling gameplay tested.','bx-good'));overview.append(list);
 overview.append(el('p','The room still uses one shared character. Build tools cannot access editor chat, compiler output, server queues, or install imported source.','bx-sub'));
}
function diagnosticView(){heading(diagnostics,'Diagnostics','Checks recompute from the latest authoritative snapshot. These are structural checks, not automated gameplay tests.');if(!latest)return;const list=el('ul',undefined,'bx-list');checks(latest).forEach(([name,pass,evidence])=>{const li=el('li');li.append(el('strong',(pass?'PASS · ':'CHECK · ')+name,pass?'bx-good':'bx-bad'),el('div',evidence));list.append(li);});diagnostics.append(list);}
let mapChoice='',entityQuery='';
const mapSelect=el('select');mapSelect.setAttribute('aria-label','Inspect map');
const entitySearch=el('input');entitySearch.type='search';entitySearch.placeholder='Filter entity names or IDs';entitySearch.setAttribute('aria-label','Filter map entities');
const mapCanvas=el('canvas');mapCanvas.id='bxMap';mapCanvas.setAttribute('role','img');
const mapFacts=el('p',undefined,'bx-sub'),entityList=el('ul',undefined,'bx-list');
heading(atlas,'World inspector','Diagnostic map of the complete supplied world. Visibility fog is intentionally omitted in this inspection view. No entities or terrain are edited.');
const atlasTools=el('div',undefined,'bx-actions');atlasTools.append(mapSelect,entitySearch);atlas.append(atlasTools,mapFacts,mapCanvas,entityList);
mapSelect.addEventListener('change',()=>{mapChoice=mapSelect.value;paintMap();});entitySearch.addEventListener('input',()=>{entityQuery=entitySearch.value.toLowerCase();paintEntities();});
function paintEntities(){entityList.replaceChildren();if(!latest)return;const entities=latest.seed.entities.filter(e=>e.map===mapChoice&&(String(e.id)+' '+String(e.name||'')).toLowerCase().includes(entityQuery));entities.slice(0,120).forEach(e=>{const li=el('li'),d=el('details');d.append(el('summary',(e.name||e.id)+' · '+e.x+', '+e.y),el('pre',JSON.stringify(e,null,2)));li.append(d);entityList.append(li);});if(!entities.length)entityList.append(el('li','No matching entities.'));if(entities.length>120)entityList.append(el('li','Showing first 120 matches. Narrow the filter.'));}
function paintMap(){
 if(!latest)return;const seed=latest.seed,map=seed.maps.find(m=>m.id===mapChoice);if(!map)return;
 const width=Math.max(1,...map.ascii.map(r=>r.length)),height=Math.max(1,map.ascii.length),scale=Math.min(12,1024/width,768/height);
 mapCanvas.width=Math.max(1,Math.ceil(width*scale));mapCanvas.height=Math.max(1,Math.ceil(height*scale));const ctx=mapCanvas.getContext('2d');ctx.fillStyle='#07151c';ctx.fillRect(0,0,mapCanvas.width,mapCanvas.height);
 map.ascii.forEach((row,y)=>Array.from(row).forEach((ch,x)=>{const kind=seed.legend[ch]?.[0];ctx.fillStyle=ch==='#'||kind==='wall'?'#354958':ch==='~'||kind==='water'?'#317a96':'#779174';ctx.fillRect(x*scale,y*scale,Math.ceil(scale),Math.ceil(scale));}));
 (map.exits||[]).forEach(e=>{ctx.fillStyle='#ffd780';ctx.fillRect(e.x*scale,e.y*scale,Math.max(2,scale),Math.max(2,scale));});
 seed.entities.filter(e=>e.map===map.id).forEach(e=>{ctx.fillStyle=e.id==='player'?'#fff':e.faction==='hostile'?'#ff766e':'#73e3df';ctx.beginPath();ctx.arc((e.x+.5)*scale,(e.y+.5)*scale,Math.max(1,scale*.34),0,Math.PI*2);ctx.fill();});
 mapFacts.textContent=(map.name||map.id)+' · '+width+' × '+height+' · '+(map.exits||[]).length+' exits. White: player · red: hostile · cyan: other entity · gold: exit.';mapCanvas.setAttribute('aria-label',mapFacts.textContent);paintEntities();
}
function atlasView(){if(!latest)return;if(!latest.seed.maps.some(m=>m.id===mapChoice))mapChoice=latest.mapId;mapSelect.replaceChildren(...latest.seed.maps.map(m=>{const o=el('option',m.name||m.id);o.value=m.id;return o;}));mapSelect.value=mapChoice;paintMap();}
function records(s){const entries=Object.entries(s.gameState).filter(([key])=>key!=='seed').map(([key,v])=>['state.'+key,JSON.stringify(v)]);Object.entries(s.seed).filter(([key])=>!['maps','entities'].includes(key)).forEach(([key,v])=>entries.push(['seed.'+key,JSON.stringify(v)]));s.seed.maps.forEach(m=>entries.push(['map.'+m.id,JSON.stringify(m)]));s.seed.entities.forEach(e=>entries.push(['entity.'+e.id,JSON.stringify(e)]));return new Map(entries);}
function timelineView(){const open=new Set(Array.from(timeline.querySelectorAll('details[open]')).map(n=>n.dataset.id));heading(timeline,'Revision history','Entity and map comparisons use stable IDs. First 40 changed records per event; previews capped at 800 characters. Last 20 events are retained in this browser session. Changes do not identify an author or confirm which concurrent proposal won.');history.forEach(event=>{const d=el('details');d.dataset.id=String(event.id);d.open=open.has(String(event.id));d.append(el('summary','State '+event.state+' · source '+event.source+' · '+event.total+' changed records'));if(event.initial)d.append(el('p','Initial baseline captured.'));event.rows.forEach(r=>d.append(el('h3',r.path),el('pre','Before\n'+r.before+'\n\nAfter\n'+r.after)));if(event.total>event.rows.length)d.append(el('p','Additional changed records omitted.'));timeline.append(d);});}
function render(){if(board.hidden||board.dataset.selecting==='true')return;if(selected==='overview')overviewView();if(selected==='diagnostics')diagnosticView();if(selected==='atlas')atlasView();if(selected==='timeline')timelineView();}
Gulch.register('build-workspace',{snapshot(s){const next=records(s),rows=[];let total=0;const clip=v=>v===undefined?'(absent)':v.length>800?v.slice(0,800)+'…':v;if(previous)for(const key of new Set([...previous.keys(),...next.keys()])){if(previous.get(key)!==next.get(key)){total++;if(rows.length<40)rows.push({path:key,before:clip(previous.get(key)),after:clip(next.get(key))});}}if(!latest||total||s.stateRevision!==latest.stateRevision||s.revision!==latest.revision)history=[{id:++counter,state:s.stateRevision,source:s.revision,initial:!latest,total,rows},...history].slice(0,20);previous=next;latest=s;render();}});
new MutationObserver(()=>{if(!board.hidden)render();}).observe(board,{attributes:true,attributeFilter:['hidden','data-selecting']});
const toolbar=board.querySelector('.bb-toolbar');
if(toolbar){toolbar.addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;if(b.textContent==='Source response')show('files',false);if(b.textContent==='Build intelligence')show('code',false);if(['Run checks','Pause','Resume'].includes(b.textContent))show('checks',false);});}
root.addEventListener('click',event=>{if(event.target.closest('button')?.textContent==='Open full operations')show('files',false);});
show('overview',false);
})();
