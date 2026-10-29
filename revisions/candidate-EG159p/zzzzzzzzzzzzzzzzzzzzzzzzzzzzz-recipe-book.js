(function(){
'use strict';
const inventory=document.getElementById('inventoryPanel'),workshop=document.getElementById('itemWorkshop'),selector=document.getElementById('ecosystemRecipe');
const catalog=window.GulchItemCatalog,book=window.GulchRecipeBook;
if(!inventory||!workshop||!selector||!catalog||!book)return;
const nativeCraft=selector.parentElement.querySelector('button');
let latest=null,pending=null,selected=catalog.recipes[0]?.id,lastSignature='';
const epoch=d=>String(d.respawnSettings?.token||'original');
const count=n=>Number.isFinite(n)?Math.max(0,Math.min(999,Math.floor(n))):0;
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);return n;}
function button(text,fn){const b=el('button',text);b.type='button';b.addEventListener('click',fn);return b;}
function pack(){const v=latest?.gameState.itemEcosystem;return v?.epoch===epoch(latest.gameState)?v:{bag:{},equipment:{},crafted:[]};}
function owned(id){return id.startsWith('$')?count(latest?.gameState.outsideWorld?.resources?.[id.slice(1)]):count(pack().bag?.[id]);}
function reserved(id){return id.startsWith('$')?0:Object.values(pack().equipment||{}).filter(v=>v===id).length;}
function available(id){return Math.max(0,owned(id)-reserved(id));}
function name(id){return id.startsWith('$')?id.slice(1):catalog.items[id]?.name||id;}
function rank(r){return Math.max(...Object.keys(r.output).map(id=>catalog.items[id]?.rarityRank||0));}
function batches(r){return Math.max(0,Math.min(...Object.entries(r.input).map(([id,n])=>Math.floor(available(id)/n)),...Object.entries(r.output).map(([id,n])=>Math.floor((999-owned(id))/n))));}
function ready(){const m=window.GulchMovementState;return latest&&latest.player.hp>0&&!latest.gameState.gulchPermanentGameOver?.ended&&m?.focused&&!m.inFlight&&!pending&&!['respawnScreen','livingPanel','characterPanel','questBoard','workBoard','interfaceMenu'].some(id=>{const n=document.getElementById(id);return n&&!n.hidden;});}
const style=el('style');style.textContent=`
#recipeBook{border:1px solid #6d8875;background:#0b2024;margin:12px 0;padding:14px;color:#dce7d3}
#recipeBook>summary{cursor:pointer;color:#efd7a0;font-size:16px;padding:6px;font-weight:bold}
#recipeBook .rb-tools{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0;align-items:center}
#recipeBook .rb-tools input{flex:1;min-width:120px;background:#08181d;color:#eee5cf;padding:10px;border:1px solid #6d8875}
#recipeBook .rb-tools select{width:auto;flex:1;min-width:110px}
#recipeBook .rb-layout{display:grid;grid-template-columns:minmax(145px,35%) minmax(0,1fr);gap:14px}
#recipeBook .rb-list{max-height:480px;overflow:auto}
#recipeBook .rb-list button{display:block;width:100%;text-align:left;margin-bottom:6px;white-space:normal}
#recipeBook button[aria-pressed=true]{border-color:#ecd39b;background:#344a35}
#recipeBook h3{color:#efd7a0;margin:4px 0 10px;font-size:15px}
#recipeBook table{border-collapse:collapse;width:100%;font-size:11px}
#recipeBook th,#recipeBook td{padding:7px 4px;border-bottom:1px solid #3b5b4b;text-align:right}
#recipeBook th:first-child{text-align:left}
#recipeBook .rb-missing{color:#f3b09b}
#recipeBook .rb-ready{color:#b7dda1}
#recipeBook .rb-detail{min-width:0}
#recipeBook p,#recipeBook li{line-height:1.65;font-size:11px;overflow-wrap:anywhere}
#recipeBook :focus-visible{outline:2px solid #efd7a0;outline-offset:2px}
@media(max-width:600px){#recipeBook .rb-layout{grid-template-columns:1fr}#recipeBook .rb-list{max-height:180px}}
`;document.head.append(style);
const root=el('details');root.id='recipeBook';root.open=true;
root.append(el('summary','RECIPE BOOK · RARITY & CRAFTING'),el('p','Turn recovered treasure into useful equipment. Higher-value gear requires more materials or rarer treasure. Rarity is a crafting tier based on utility and relative value, not an enemy drop probability: random enemy treasure currently uses equal selection chances. Values are comparison points, not currency or sale prices.'));
const tools=el('div');tools.className='rb-tools';
const search=el('input');search.type='search';search.placeholder='Search recipe, ingredient or output';search.setAttribute('aria-label','Search recipe book');
const rarity=el('select');rarity.setAttribute('aria-label','Output rarity');
for(const text of ['All rarities',...book.ranks]){const o=el('option',text);o.value=text;rarity.append(o);}
const filter=el('select');filter.setAttribute('aria-label','Recipe availability');
for(const text of ['All recipes','Ready to craft','Previously crafted']){const o=el('option',text);filter.append(o);}
tools.append(search,rarity,filter);
const summary=el('p'),layout=el('div'),list=el('nav'),detail=el('section');layout.className='rb-layout';list.className='rb-list';list.setAttribute('aria-label','Recipes');detail.className='rb-detail';
const heading=el('h3'),output=el('p'),valuation=el('p'),ledger=el('table'),sources=el('ul'),capacity=el('p');
const craft=button('Craft one batch',submit),notice=el('p');notice.setAttribute('role','status');
detail.append(heading,output,valuation,ledger,capacity,craft,notice,el('h3','Where to find ingredients'),sources);
layout.append(list,detail);root.append(tools,summary,layout,el('p','Crafting consumes every listed ingredient, including equipment. Equipped copies are reserved. Unequip them first. Each click makes one batch without advancing turns; outputs are capped at 999 per item. Both room members share the recipe book progress and supplies.'));
workshop.querySelector('summary').after(root);
const nav=inventory.querySelector('.new-inventory-nav');
if(nav){const jump=button('Recipe book',()=>{const tabs=nav.querySelectorAll('button');tabs[1]?.click();workshop.open=true;root.open=true;render(true);root.scrollIntoView({block:'start'});search.focus({preventScroll:true});});nav.append(jump);}
function render(force){
 if(inventory.hidden||!root.open)return;
 const m=window.GulchMovementState,q=search.value.trim().toLowerCase();
 const signature=JSON.stringify([latest?.stateRevision,latest?.revision,m?.focused,m?.inFlight,pending?.base,selected,q,rarity.value,filter.value,ready()]);
 if(!force&&signature===lastSignature)return;lastSignature=signature;
 const rows=catalog.recipes.filter(r=>(rarity.value==='All rarities'||book.ranks[rank(r)]===rarity.value)&&(filter.value!=='Ready to craft'||batches(r)>0)&&(filter.value!=='Previously crafted'||pack().crafted?.includes(r.id))&&[r.name,...Object.keys(r.input).map(name),...Object.keys(r.output).map(name)].join(' ').toLowerCase().includes(q)).sort((a,b)=>rank(a)-rank(b)||a.name.localeCompare(b.name));
 const focus=document.activeElement?.dataset.recipe,scroll=list.scrollTop;
 list.replaceChildren();
 for(const r of rows){const n=batches(r),b=button(r.name+' · '+book.ranks[rank(r)]+' · '+(n?n+' ready':'missing supplies'),()=>{selected=r.id;render(true);});b.dataset.recipe=r.id;b.setAttribute('aria-pressed',String(r.id===selected));list.append(b);}
 if(!rows.length)list.append(el('p','No recipes match. Change the filters or search.'));
 list.scrollTop=scroll;
 if(focus)Array.from(list.querySelectorAll('button')).find(b=>b.dataset.recipe===focus)?.focus({preventScroll:true});
 summary.textContent=rows.length+' / '+catalog.recipes.length+' recipes · '+(pack().crafted?.length||0)+' recorded crafts';
 const r=catalog.recipes.find(r=>r.id===selected);if(!r)return;
 heading.textContent=r.name;
 output.textContent='Produces: '+Object.entries(r.output).map(([id,n])=>n+' × '+name(id)+' · '+catalog.items[id].rarity).join('; ')+(pack().crafted?.includes(r.id)?' · Previously crafted':'');
 const inputValue=Object.entries(r.input).reduce((sum,[id,n])=>sum+book.value(id)*n,0),outputValue=Object.entries(r.output).reduce((sum,[id,n])=>sum+book.value(id)*n,0);
 valuation.textContent='Relative material value: '+inputValue+' input → '+outputValue+' output. Salvage can lose value; assembly can add utility. Existing recipes remain available.';
 ledger.replaceChildren();const thead=el('thead'),tr=el('tr');
 for(const text of ['Ingredient','Need','Free','Reserved']){const th=el('th',text);th.scope='col';tr.append(th);}thead.append(tr);ledger.append(thead);
 const body=el('tbody');sources.replaceChildren();
 for(const [id,n] of Object.entries(r.input)){
  const row=el('tr');row.className=available(id)<n?'rb-missing':'rb-ready';
  [name(id),n,available(id),reserved(id)].forEach((value,i)=>{const cell=el(i?'td':'th',value);if(!i)cell.scope='row';row.append(cell);});body.append(row);
  const producers=catalog.recipes.filter(other=>other.id!==r.id&&other.output[id]);
  const li=el('li',name(id)+' · '+(id.startsWith('$')?'Common':catalog.items[id]?.rarity||'Material')+' · '+book.value(id)+' value each. '+book.source(id));
  if(producers.length){li.append(el('p','Craft via:'));for(const producer of producers){li.append(button(producer.name,()=>{selected=producer.id;search.value='';rarity.value='All rarities';filter.value='All recipes';render(true);}));}}
  sources.append(li);
 }
 ledger.append(body);capacity.textContent=batches(r)+' batches available · inventory stacks limited to 999';
 craft.disabled=!ready()||batches(r)<1||!nativeCraft;craft.textContent='Craft · '+r.name;
 if(pending)notice.textContent='Waiting for shared confirmation…';
}
function submit(){
 const r=catalog.recipes.find(r=>r.id===selected);
 if(!r||!ready()||!batches(r)||!nativeCraft)return;
 selector.value=r.id;selector.dispatchEvent(new Event('change'));
 if(nativeCraft.disabled){notice.textContent='Craft unavailable. Check the ingredient counts and room focus.';return;}
 const expected={};for(const id of new Set([...Object.keys(r.input),...Object.keys(r.output)]))expected[id]=owned(id)-(r.input[id]||0)+(r.output[id]||0);
 pending={base:latest.stateRevision,epoch:epoch(latest.gameState),id:r.id,name:r.name,expected};
 nativeCraft.click();
 if(!window.GulchMovementState?.inFlight){pending=null;notice.textContent='Craft was not submitted. Review the workshop status and retry.';}
 render(true);
}
search.addEventListener('input',()=>render(true));rarity.addEventListener('change',()=>render(true));filter.addEventListener('change',()=>render(true));root.addEventListener('toggle',()=>render(true));
new MutationObserver(()=>render(true)).observe(inventory,{attributes:true,attributeFilter:['hidden','data-inventory-page']});
Gulch.register('recipe-book',{snapshot(s){const reset=latest&&epoch(latest.gameState)!==epoch(s.gameState);latest=s;if(reset){pending=null;notice.textContent='New expedition: recipe progress and ingredients reset.';}if(pending&&pending.base!==s.stateRevision){const request=pending;pending=null;const confirmed=epoch(s.gameState)===request.epoch&&pack().crafted?.includes(request.id)&&Object.entries(request.expected).every(([id,n])=>owned(id)===n);notice.textContent=confirmed?'Confirmed: '+request.name+'. Outputs are in your shared pack.':'Another room update arrived. Check counts before retrying.';}render();}});
setInterval(()=>{if(!document.hidden)render();},400);
})();
