(function(){
'use strict';
const workshop=document.getElementById('itemWorkshop');
const inventory=document.getElementById('inventoryPanel');
const selector=document.getElementById('ecosystemRecipe');
const catalog=window.GulchItemCatalog;
if(!workshop||!inventory||!selector||!catalog)return;
const recipes=catalog.recipes,items=catalog.items;
const nativeCraft=selector.parentElement.querySelector('button');
let latest=null,pending=null,lastBridge='';
const epoch=d=>String(d.respawnSettings?.token||'original');
const count=n=>Number.isFinite(n)?Math.max(0,Math.min(999,Math.floor(n))):0;
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);return n;}
function name(id){return id.startsWith('$')?id.slice(1)+' (outdoor)':items[id]?.name||id;}
function pack(){const p=latest?.gameState.itemEcosystem;return p&&p.epoch===epoch(latest.gameState)?p:{bag:{},equipment:{},crafted:[]};}
function owned(id){if(!latest)return 0;return id.startsWith('$')?count(latest.gameState.outsideWorld?.resources?.[id.slice(1)]):count(pack().bag?.[id]);}
function reserved(id){return id.startsWith('$')?0:Object.values(pack().equipment||{}).filter(v=>v===id).length;}
function available(id){return Math.max(0,owned(id)-reserved(id));}
function recipe(){return recipes.find(r=>r.id===selector.value)||recipes[0];}
function ready(){const m=window.GulchMovementState;return latest&&latest.player.hp>0&&!latest.gameState.gulchPermanentGameOver?.ended&&m?.focused&&!m.inFlight&&!pending&&!['respawnScreen','livingPanel','characterPanel','questBoard','workBoard','interfaceMenu'].some(id=>{const n=document.getElementById(id);return n&&!n.hidden;});}
const style=el('style');style.textContent=`
#fieldWorkbench{padding:14px;margin:12px 0;border:1px solid #688771;background:#0a1c20;color:#dce7d3}
#fieldWorkbench h3{margin:0 0 8px;color:#eed7a2;font-size:15px}
#fieldWorkbench .bench-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}
#fieldWorkbench .bench-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin:10px 0}
#fieldWorkbench .bench-cell{display:flex;flex-direction:column;justify-content:center;min-height:76px;padding:6px;border:3px ridge #6d8275;background:#19322f;font:10px/1.5 monospace;text-align:center;overflow-wrap:anywhere}
#fieldWorkbench .bench-cell[data-missing=true]{border-color:#b67d69}
#fieldWorkbench .bench-cell strong{font-size:13px;color:#eed7a2}
#fieldWorkbench label{display:block;margin:8px 0}
#fieldWorkbench table{width:100%;border-collapse:collapse;font-size:11px;margin:10px 0}
#fieldWorkbench caption{text-align:left;padding:8px 0;color:#eed7a2}
#fieldWorkbench th,#fieldWorkbench td{padding:7px 4px;border-bottom:1px solid #3e5b4b;text-align:right}
#fieldWorkbench th:first-child{text-align:left;overflow-wrap:anywhere}
#fieldWorkbench .bench-missing{color:#f2ad94}
#benchOutput{padding:12px;border:3px ridge #879977;white-space:pre-line;background:#203932;color:#f3dfb0}
#benchNotice{min-height:22px;color:#ecd09a}
#fieldWorkbench button{min-height:44px}
#fieldWorkbench details{margin-top:12px}
#fieldWorkbench summary{cursor:pointer}
@media(max-width:600px){#fieldWorkbench .bench-layout{grid-template-columns:1fr}#fieldWorkbench{padding:10px}}
`;document.head.append(style);
const root=el('section');root.id='fieldWorkbench';root.setAttribute('aria-label','Scavenger crafting bench');
root.append(el('h3','SCAVENGER WORKBENCH'),el('p','An original scavenging and tinkering catalog inspired by Caves of Qud. Choose a blueprint to assemble recovered treasure using a Minecraft-style 3 × 3 crafting table.'));
const label=el('label','Recipe blueprint');label.htmlFor='benchRecipe';
const select=el('select');select.id='benchRecipe';
for(const r of recipes){const option=el('option',r.name);option.value=r.id;select.append(option);}
const layout=el('div');layout.className='bench-layout';
const left=el('div'),right=el('div'),grid=el('div');grid.className='bench-grid';grid.setAttribute('role','group');grid.setAttribute('aria-label','Three by three recipe blueprint');
const cells=[];
for(let i=0;i<9;i++){const cell=el('div');cell.className='bench-cell';grid.append(cell);cells.push(cell);}
const output=el('div');output.id='benchOutput';
left.append(el('p','ASSEMBLY → OUTPUT'),grid,output,el('p','Each square shows one ingredient stack. Counts are required units, not items moved out of your pack. Placement is automatic; these recipes are shapeless.'));
const description=el('p'),table=el('table'),capacity=el('p'),paths=el('p');
const craft=el('button','Craft one batch');craft.type='button';
const notice=el('p');notice.id='benchNotice';notice.setAttribute('role','status');
right.append(description,table,capacity,craft,notice,paths);layout.append(left,right);
const guide=el('details');guide.append(el('summary','Salvaging, discovery & crafting rules'),el('p','Collect abandoned tools and chest contents from the map, or collect enemy treasure beside a defeated creature. Use Inventory → Collect loot or the ground item context menu. Find wood, stone, copper, iron and crystal through gathering.'),el('p','Every input is consumed, including listed tools and equipment. Equipped copies are reserved: unequip them before salvaging. Outputs enter the shared field pack, limited to 999 per item. Crafting does not advance turns.'),el('p','Blueprints are available immediately. Successful crafting records the recipe in the item chronicle. Both room members share ingredients, equipment and results; wait for room confirmation before crafting again.'));
root.append(label,select,layout,guide);workshop.querySelector('summary').after(root);
function render(){
 if(inventory.hidden)return;
 const r=recipe();if(!r)return;
 select.value=r.id;
 const inputs=Object.entries(r.input),outputs=Object.entries(r.output);
 cells.forEach((cell,i)=>{
  const entry=inputs[i];cell.replaceChildren();
  if(!entry){cell.textContent='·';cell.removeAttribute('data-missing');cell.setAttribute('aria-label','Empty blueprint square');return;}
  const [id,n]=entry,missing=Math.max(0,n-available(id));
  cell.dataset.missing=String(missing>0);
  cell.append(el('span',name(id)),el('strong','× '+n),el('span',available(id)+' available'));
  cell.setAttribute('aria-label',name(id)+': '+n+' required, '+available(id)+' available');
 });
 output.textContent='OUTPUT\n'+outputs.map(([id,n])=>n+' × '+name(id)).join('\n');
 description.textContent=(window.GulchFieldRecipeNotes?.[r.id]||'Assemble '+outputs.map(([id,n])=>n+' × '+name(id)).join(', ')+' from the components below.')+' '+(pack().crafted?.includes(r.id)?'Previously crafted this expedition.':'Not yet crafted this expedition.');
 table.replaceChildren(el('caption','Ingredient ledger'));
 const head=el('thead'),header=el('tr');
 for(const text of ['Ingredient','Need','Owned','Reserved','Missing']){const th=el('th',text);th.scope='col';header.append(th);}
 head.append(header);table.append(head);
 const body=el('tbody');
 for(const [id,n] of inputs){
  const missing=Math.max(0,n-available(id)),row=el('tr');if(missing)row.className='bench-missing';
  [name(id),n,owned(id),reserved(id),missing].forEach((value,i)=>{const cell=el(i===0?'th':'td',value);if(i===0)cell.scope='row';row.append(cell);});body.append(row);
 }
 table.append(body);
 const ingredientBatches=Math.min(...inputs.map(([id,n])=>Math.floor(available(id)/n)));
 const outputBatches=Math.min(...outputs.map(([id,n])=>Math.floor((999-owned(id))/n)));
 const batches=Math.max(0,Math.min(ingredientBatches,outputBatches));
 capacity.textContent='Craftable batches: '+batches+' · Each click crafts one batch.';
 paths.textContent='';
 const related=recipes.filter(other=>other.id!==r.id&&outputs.some(([id])=>other.input[id])).slice(0,5);
 if(related.length)paths.textContent='Next crafting steps: '+related.map(v=>v.name).join(' · ');
 craft.disabled=!ready()||batches<1||!nativeCraft||inputs.length>9;
 craft.textContent='Craft · '+r.name;
 if(pending)notice.textContent='Waiting for shared confirmation…';
 else if(!latest)notice.textContent='Waiting for shared inventory.';
 else if(inputs.length>9)notice.textContent='This blueprint exceeds nine ingredient types. Use the standard recipe controls below.';
 else if(ingredientBatches<1)notice.textContent='Missing ingredients. Collect supplies or unequip reserved equipment.';
 else if(outputBatches<1)notice.textContent='An output stack is full. Use or craft items first.';
 else if(!ready())notice.textContent='Focus the game and wait for any pending room update.';
 else if(!notice.dataset.receipt)notice.textContent='Ready. All listed inputs are consumed.';
}
select.addEventListener('change',()=>{delete notice.dataset.receipt;selector.value=select.value;selector.dispatchEvent(new Event('change'));render();});
selector.addEventListener('change',()=>{delete notice.dataset.receipt;render();});
craft.addEventListener('click',()=>{
 if(!ready()||!nativeCraft)return;
 const r=recipe();selector.dispatchEvent(new Event('change'));
 if(nativeCraft.disabled){notice.textContent='The workshop cannot craft this recipe yet. Check ingredients and output space.';return;}
 const expected={};
 for(const id of new Set([...Object.keys(r.input),...Object.keys(r.output)]))expected[id]=owned(id)-(r.input[id]||0)+(r.output[id]||0);
 pending={base:latest.stateRevision,epoch:epoch(latest.gameState),id:r.id,name:r.name,expected};
 delete notice.dataset.receipt;
 nativeCraft.click();
 if(!window.GulchMovementState?.inFlight){pending=null;notice.dataset.receipt='true';notice.textContent='No craft was submitted. Check the workshop status below.';}
 render();
});
Gulch.register('scavenger-crafting-bench',{snapshot(s){
 const changed=latest&&epoch(latest.gameState)!==epoch(s.gameState);latest=s;
 if(changed){pending=null;delete notice.dataset.receipt;}
 if(pending&&s.stateRevision!==pending.base){
  const request=pending;pending=null;
  const confirmed=epoch(s.gameState)===request.epoch&&pack().crafted?.includes(request.id)&&Object.entries(request.expected).every(([id,n])=>owned(id)===n);
  notice.dataset.receipt='true';notice.textContent=confirmed?'Confirmed: '+request.name+'.':'The room changed. Review ingredient and output counts before retrying.';
 }
 render();
}});
new MutationObserver(render).observe(inventory,{attributes:true,attributeFilter:['hidden','data-inventory-page']});
setInterval(()=>{if(document.hidden||inventory.hidden)return;const m=window.GulchMovementState;const key=String(m?.focused)+':'+String(m?.inFlight);if(key!==lastBridge){lastBridge=key;render();}},300);
})();
