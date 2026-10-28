(function(){
'use strict';
const board=document.getElementById('workBoard');
if(!board)return;
let files=[],selected=0,query='';
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function button(text,fn){const b=el('button',text);b.type='button';b.addEventListener('click',fn);return b;}
const style=el('style');style.textContent=`
#sourceResponse{flex-shrink:0;border-bottom:1px solid var(--world-line,#526f63);background:var(--world-bg,#09191f)}
#sourceResponse>summary{cursor:pointer;padding:14px 18px;color:var(--world-accent,#e4c68a);font-weight:bold;font-size:14px}
.source-response-body{padding:0 16px 16px;max-height:65vh;overflow:auto}
#sourceResponse p{font-size:12px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}
#sourceResponse textarea{width:100%;min-height:130px;resize:vertical;font:12px/1.5 monospace}
.source-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:10px 0}
#sourceResponse input{flex:1;min-width:150px;padding:10px;background:var(--world-card,#10272a);color:var(--world-text,#e1e8dd);border:1px solid var(--world-line,#526f63);border-radius:5px}
.source-files{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0}
#sourceResponse .source-files button{font:12px monospace;overflow-wrap:anywhere;text-align:left;max-width:100%}
.source-metrics{display:flex;gap:8px;flex-wrap:wrap}
.source-metrics span{background:var(--world-card,#10272a);border:1px solid var(--world-line,#526f63);padding:8px;border-radius:5px;font-size:12px}
.source-code{max-height:44vh;overflow:auto;border:1px solid var(--world-line,#526f63);background:var(--world-card,#10272a);padding:10px 0;tab-size:2;font:12px/1.7 monospace;counter-reset:line}
.source-line{display:flex;min-width:max-content;min-height:20px}
.source-number{display:inline-block;flex:0 0 60px;user-select:none;text-align:right;padding-right:16px;color:var(--world-muted,#9bb2a6)}
.source-text{white-space:pre;padding-right:18px;color:var(--world-text,#e1e8dd)}
.source-line.match{background:#bda64c30}.source-line mark{background:#e4c68a;color:#17251e}
#sourceResponse h3{font-size:14px;overflow-wrap:anywhere;color:var(--world-text,#e1e8dd)}
@media(max-width:700px){.source-response-body{padding:0 10px 12px}.source-number{flex-basis:42px}.source-code{font-size:11px}}
`;document.head.append(style);
const section=el('details');section.id='sourceResponse';section.open=true;
const heading=el('summary','Generated source response / full files');
const body=el('div',undefined,'source-response-body');
const intro=el('p','Inspect a generated response here alongside the build information. This sandbox cannot read or redirect editor chat; paste the response JSON below. Imported code is displayed as text and is never executed or applied. This view stays in this browser session.');
const importer=el('details');importer.open=true;importer.append(el('summary','Import generated response'));
const label=el('label','Generated response JSON');label.htmlFor='sourceResponseInput';
const input=el('textarea');input.id='sourceResponseInput';input.maxLength=2500000;input.spellcheck=false;input.placeholder='{"reply":"…","operations":[{"op":"update","path":"game-project/example.js","content":"…"}]}';
const status=el('p','Waiting for a generated response.');status.setAttribute('role','status');
const actions=el('div',undefined,'source-actions');
const metrics=el('div',undefined,'source-metrics'),reply=el('p'),tabs=el('nav',undefined,'source-files');tabs.setAttribute('aria-label','Generated files');
const tools=el('div',undefined,'source-actions'),search=el('input');search.type='search';search.placeholder='Find text in the selected file…';search.setAttribute('aria-label','Search generated source');
const matches=el('span'),fileTitle=el('h3'),facts=el('p'),code=el('div',undefined,'source-code');code.tabIndex=0;code.setAttribute('role','region');code.setAttribute('aria-label','Complete generated file with line numbers');
let matchRows=[],matchIndex=-1;
const next=button('Next match',()=>{if(!matchRows.length)return;matchIndex=(matchIndex+1)%matchRows.length;matchRows[matchIndex].scrollIntoView({block:'nearest',inline:'nearest'});matches.textContent=(matchIndex+1)+' / '+matchRows.length+' matching lines';});
next.disabled=true;tools.append(search,next,matches);
function bytes(text){return new TextEncoder().encode(text).length;}
function read(){
 try{
  let raw=input.value.trim();
  if(raw.startsWith('```'))raw=raw.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const data=JSON.parse(raw);
  if(!data||typeof data!=='object'||!Array.isArray(data.operations)||data.operations.length>24)throw new Error('Expected a response object with at most 24 operations.');
  const seen=new Set();let total=0;
  const parsed=data.operations.map((f,i)=>{
   if(!f||!['create','update','delete'].includes(f.op)||typeof f.path!=='string'||!/^game-project\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+$/.test(f.path)||f.path.split('/').some(v=>v==='.'||v==='..')||typeof f.content!=='string')throw new Error('Invalid file operation '+(i+1)+'.');
   if(seen.has(f.path))throw new Error('Duplicate file path: '+f.path);
   seen.add(f.path);
   const size=bytes(f.content);total+=size;
   if(size>100000||total>400000)throw new Error('Response exceeds file or project content limits.');
   if(f.op==='delete'&&f.content!=='')throw new Error('Delete operations must have empty content.');
   return {op:f.op,path:f.path,content:f.content,size};
  });
  files=parsed;selected=0;query='';search.value='';
  reply.textContent=typeof data.reply==='string'?data.reply.slice(0,20000):'No response explanation supplied.';
  metrics.replaceChildren();
  [files.length+' file operations',files.filter(f=>f.op==='create').length+' creates',files.filter(f=>f.op==='update').length+' updates',files.filter(f=>f.op==='delete').length+' deletes',total.toLocaleString()+' UTF-8 bytes'].forEach(t=>metrics.append(el('span',t)));
  status.textContent='Imported for inspection only. No game source or shared state was changed.';
  importer.open=false;render();
 }catch(error){status.textContent='Import failed: '+String(error.message||error);}
}
actions.append(button('Show full response',read),button('Clear response',()=>{files=[];selected=0;query='';input.value='';search.value='';reply.textContent='';metrics.replaceChildren();status.textContent='Response cleared from this view.';importer.open=true;render();}));
importer.append(label,input,actions);body.append(intro,importer,status,metrics,reply,tabs,tools,fileTitle,facts,code);section.append(heading,body);
const toolbar=board.querySelector('.bb-toolbar');toolbar.after(section);
const jump=button('Source response',()=>{section.open=true;section.scrollIntoView({block:'nearest'});if(!files.length){importer.open=true;input.focus();}else code.focus();});toolbar.append(jump);
function render(){
 tabs.replaceChildren();
 files.forEach((f,i)=>{const b=button(f.op.toUpperCase()+' · '+f.path,()=>{selected=i;render();});b.setAttribute('aria-pressed',String(i===selected));tabs.append(b);});
 const f=files[selected];code.replaceChildren();matchRows=[];matchIndex=-1;
 if(!f){fileTitle.textContent='No generated files loaded';facts.textContent='Full create/update contents appear here after import. Empty operation lists contain no source changes.';matches.textContent='';next.disabled=true;return;}
 fileTitle.textContent=f.op.toUpperCase()+' · '+f.path;
 if(f.op==='delete'){facts.textContent='Deletes this file. No replacement content supplied.';matches.textContent='';next.disabled=true;return;}
 const lines=f.content.split('\n');
 facts.textContent=lines.length.toLocaleString()+' lines · '+f.size.toLocaleString()+' UTF-8 bytes · Entire replacement file · Imported response, not verified installed source';
 const fragment=document.createDocumentFragment();
 lines.forEach((line,i)=>{
  const row=el('div',undefined,'source-line'),number=el('span',String(i+1),'source-number'),text=el('span',undefined,'source-text');
  const at=query?line.toLowerCase().indexOf(query):-1;
  if(at>=0){row.classList.add('match');matchRows.push(row);text.append(document.createTextNode(line.slice(0,at)),el('mark',line.slice(at,at+query.length)),document.createTextNode(line.slice(at+query.length)));}
  else text.textContent=line;
  row.append(number,text);fragment.append(row);
 });
 code.append(fragment);matches.textContent=query?matchRows.length+' matching lines':'';next.disabled=!matchRows.length;
}
search.addEventListener('input',()=>{query=search.value.toLowerCase();render();});
render();
Gulch.register('source-response-viewer',{snapshot(){}});
})();
