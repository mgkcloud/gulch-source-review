(function(){
'use strict';
const board=document.getElementById('workBoard');
if(!board)return;
let latest=null,sources=[],selected=0,job=0,timer=null,scanned=false;
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);return n;}
function button(text,fn){const n=el('button',text);n.type='button';n.addEventListener('click',fn);return n;}
const style=el('style');style.textContent='#buildInspector{margin:12px;border:1px solid var(--world-line,#526f63);border-radius:8px;background:var(--world-card,#10272a)}#buildInspector>summary{padding:16px;font-size:16px;cursor:pointer}.bi-body{padding:0 16px 16px}.bi-tools{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}#buildInspector p{font-size:12px;line-height:1.6}#buildInspector input,#buildInspector select{max-width:100%;min-height:40px;padding:8px;background:var(--world-bg,#09191f);color:var(--world-text,#eee);border:1px solid var(--world-line,#526f63)}#buildInspector .bi-code{white-space:pre;overflow:auto;max-height:60vh;background:var(--world-bg,#09191f);padding:12px;font:12px/1.7 monospace;tab-size:2}.bi-line{display:block;min-width:max-content}.bi-line mark{background:#efd292;color:#14231d}.bi-line-number{display:inline-block;width:54px;color:var(--world-muted,#9bb2a6);user-select:none}';document.head.append(style);
const panel=el('details');panel.id='buildInspector';panel.open=true;
const body=el('div');body.className='bi-body';
const stamp=el('p'),findings=el('ul');stamp.setAttribute('role','status');
const sourceSection=el('details');sourceSection.append(el('summary','Loaded code / complete readable script bodies'));
const controls=el('div');controls.className='bi-tools';
const select=el('select');select.setAttribute('aria-label','Loaded script');
const search=el('input');search.type='search';search.placeholder='Find in loaded code';search.setAttribute('aria-label','Find in loaded code');
const note=el('p','Expand this section to inspect source. Scripts are read only when selected.'),count=el('p'),code=el('div');code.className='bi-code';code.tabIndex=0;code.setAttribute('role','region');code.setAttribute('aria-label','Loaded source with line numbers');
let matches=[],matchIndex=-1,needsRender=true;
const next=button('Next match',()=>{if(!matches.length)return;matchIndex=(matchIndex+1)%matches.length;matches[matchIndex].scrollIntoView({block:'nearest',inline:'nearest'});count.textContent='Match '+(matchIndex+1)+' of '+matches.length;});next.disabled=true;
controls.append(select,search,next,button('Rescan scripts',scan));sourceSection.append(controls,note,count,code);
panel.append(el('summary','Build intelligence / loaded source and structural checks'),body);
body.append(el('p','Inspect the running game and its loaded scripts. Source inspection is local and read-only. Revision history remains available in the workspace’s Revision history and Operation inspector views.'),stamp,findings,sourceSection);
board.querySelector('.bb-toolbar').after(panel);
board.querySelector('.bb-toolbar').append(button('Build intelligence',()=>{panel.open=true;panel.scrollIntoView({block:'start'});}));
function visible(){if(document.hidden||board.hidden||!panel.open)return false;for(let n=panel;n;n=n.parentElement)if(n.hidden)return false;return panel.getClientRects().length>0;}
function cancel(){job++;clearTimeout(timer);timer=null;code.removeAttribute('aria-busy');}
function scan(){
 cancel();sources=Array.from(document.scripts);scanned=true;
 selected=Math.min(selected,Math.max(0,sources.length-1));
 select.replaceChildren(...sources.map((script,i)=>{const option=el('option','Script '+(i+1)+(script.hasAttribute('src')?' · external':''));option.value=String(i);return option;}));
 select.value=String(selected);needsRender=true;refresh();
}
function renderCode(){
 cancel();if(!visible()||!sourceSection.open){needsRender=true;return;}
 needsRender=false;
 const token=job,script=sources[selected],text=script?.textContent||'',query=search.value.toLowerCase();
 code.replaceChildren();matches=[];matchIndex=-1;next.disabled=true;
 if(!text.trim()){note.textContent=script?.hasAttribute('src')?'The script body is not exposed in the DOM. No network request is made. Use Response files to inspect supplied source.':'No readable script body is exposed.';count.textContent='';return;}
 note.textContent='Script '+(selected+1)+' · complete DOM source, displayed incrementally. Script order does not establish a source filename or installation receipt.';
 code.setAttribute('aria-busy','true');let offset=0,lineNumber=0;
 function chunk(){
  timer=null;if(token!==job)return;
  if(!visible()||!sourceSection.open){needsRender=true;cancel();return;}
  const fragment=document.createDocumentFragment(),start=performance.now();let added=0;
  while(offset<=text.length&&added<100&&performance.now()-start<6){
   const end=text.indexOf('\n',offset),line=end<0?text.slice(offset):text.slice(offset,end);
   offset=end<0?text.length+1:end+1;lineNumber++;added++;
   const row=el('span');row.className='bi-line';const number=el('span',lineNumber);number.className='bi-line-number';row.append(number);
   const at=query?line.toLowerCase().indexOf(query):-1;
   if(at>=0){row.append(document.createTextNode(line.slice(0,at)),el('mark',line.slice(at,at+query.length)),document.createTextNode(line.slice(at+query.length)));matches.push(row);}else row.append(document.createTextNode(line));
   fragment.append(row);
  }
  code.append(fragment);next.disabled=!matches.length;
  count.textContent=lineNumber+' lines displayed'+(offset<=text.length?' · loading…':' · complete')+(query?' · '+matches.length+' matching lines':'');
  if(offset<=text.length)timer=setTimeout(chunk,16);else code.removeAttribute('aria-busy');
 }
 timer=setTimeout(chunk,0);
}
function refresh(){
 if(!visible()){if(timer!==null){needsRender=true;cancel();}return;}
 if(latest){
  const seed=latest.seed,ids=new Set(),duplicates=[];
  for(const entity of seed.entities){if(ids.has(entity.id))duplicates.push(entity.id);ids.add(entity.id);}
  const maps=new Map(seed.maps.map(m=>[m.id,m]));
  const invalid=seed.entities.filter(e=>!Number.isInteger(e.x)||!Number.isInteger(e.y)||!maps.get(e.map)?.ascii?.[e.y]?.[e.x]);
  const error=document.getElementById('moduleErrors')?.textContent.trim();
  stamp.textContent='State '+latest.stateRevision+' · source '+latest.revision+' · '+seed.entities.length+' entities';
  findings.replaceChildren(...[
   duplicates.length?'Duplicate entity IDs: '+duplicates.slice(0,10).join(', '):'Entity identifiers are unique.',
   invalid.length?'Invalid positions: '+invalid.slice(0,10).map(e=>e.id).join(', '):'Entity positions are within map bounds.',
   error?'Displayed error: '+error:'No runtime error currently displayed.',
   'Structural checks do not establish gameplay correctness. Verify movement, combat and shared updates in both browsers.'
  ].map(text=>el('li',text)));
 }
 if(sourceSection.open){if(!scanned)scan();else if(needsRender)renderCode();}
}
select.addEventListener('change',()=>{selected=Number(select.value);needsRender=true;renderCode();});
let searchTimer=null;
search.addEventListener('input',()=>{cancel();needsRender=true;clearTimeout(searchTimer);searchTimer=setTimeout(renderCode,180);});
sourceSection.addEventListener('toggle',()=>{if(!sourceSection.open){needsRender=true;cancel();}else refresh();});
panel.addEventListener('toggle',refresh);
new MutationObserver(refresh).observe(board,{subtree:true,attributes:true,attributeFilter:['hidden','data-selecting']});
document.addEventListener('visibilitychange',refresh);
Gulch.register('build-intelligence',{snapshot(s){latest=s;refresh();}});
})();
