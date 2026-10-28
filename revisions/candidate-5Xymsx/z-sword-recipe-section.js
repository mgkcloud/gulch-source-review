(function(){
'use strict';
let latest=null;
let refresh=function(){};
Gulch.register('sword-recipe-section',{snapshot(s){latest=s;refresh();}});
function install(){
 const book=document.getElementById('recipeBook'),inventory=document.getElementById('inventoryPanel'),catalog=window.GulchItemCatalog;
 if(!book||!inventory||!catalog)return;
 const recipes=catalog.recipes,items=catalog.items;
 const swords=Object.values(items).filter(item=>item.slot==='weapon'&&(Number.isInteger(item.referenceSword)||/sword|blade|falchion|saber/i.test(item.name+' '+item.id))).filter(item=>recipes.some(r=>r.output[item.id])).sort((a,b)=>(Number(a.bonus)||0)-(Number(b.bonus)||0)||a.name.localeCompare(b.name));
 const epoch=d=>String(d.respawnSettings?.token||'original');
 const count=n=>Number.isFinite(n)?Math.max(0,Math.min(999,Math.floor(n))):0;
 function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);return n;}
 function button(text,fn){const b=el('button',text);b.type='button';b.addEventListener('click',fn);return b;}
 function pack(){const p=latest?.gameState.itemEcosystem;return p?.epoch===epoch(latest.gameState)?p:{bag:{},equipment:{}};}
 function available(id){if(id.startsWith('$'))return count(latest?.gameState.outsideWorld?.resources?.[id.slice(1)]);const p=pack();return Math.max(0,count(p.bag?.[id])-Object.values(p.equipment||{}).filter(v=>v===id).length);}
 function name(id){return id.startsWith('$')?id.slice(1)+' (outdoor pack)':items[id]?.name||id;}
 const style=el('style');style.textContent='#swordRecipeSection{margin:14px 0;padding:14px;border:1px solid #a19366;background:#10272a}#swordRecipeSection>summary{display:list-item!important;cursor:pointer;color:#f0d69d;font-size:15px;padding:6px}#swordRecipeSection .srs-layout{display:grid;grid-template-columns:minmax(150px,35%) minmax(0,1fr);gap:14px}#swordRecipeSection nav{max-height:340px;overflow:auto}#swordRecipeSection nav button{display:block;width:100%;text-align:left;margin:5px 0;min-height:44px}#swordRecipeSection input{width:100%;padding:10px;margin:10px 0;background:#08191d;color:#e8e7d2;border:1px solid #718779;font:inherit}#swordRecipeSection article{min-width:0}#swordRecipeSection h3{color:#f0d69d}#swordRecipeSection ul{padding-left:20px}#swordRecipeSection li{margin:7px 0}#swordRecipeSection .srs-missing{color:#f2b098}#swordRecipeSection .srs-ready{color:#bdddab}#swordRecipeSection .srs-lore{border-left:2px solid #ad996b;padding-left:10px}#swordRecipeSection :focus-visible{outline:2px solid #f0d69d;outline-offset:2px}@media(max-width:600px){#swordRecipeSection .srs-layout{grid-template-columns:1fr}#swordRecipeSection nav{max-height:180px}}';document.head.append(style);
 const section=el('details');section.id='swordRecipeSection';section.open=true;
 const summary=el('summary','SWORDS · WEAPONS & RECIPES');
 const intro=el('p','Browse craftable swords, compare their damage, and inspect every recipe. Equipped ingredients must be unequipped before crafting.');
 const search=el('input');search.type='search';search.placeholder='Find a sword by name';search.setAttribute('aria-label','Search swords');
 const layout=el('div');layout.className='srs-layout';const list=el('nav');list.setAttribute('aria-label','Craftable swords');const detail=el('article');detail.setAttribute('aria-label','Selected sword and recipes');layout.append(list,detail);
 section.append(summary,intro,search,layout);book.querySelector('.rb-tools').before(section);
 let chosen=swords[0]?.id,signature='';
 function openRecipe(recipe){
  const tools=book.querySelector('.rb-tools'),query=tools?.querySelector('input'),filters=tools?.querySelectorAll('select');
  if(query){query.value='';query.dispatchEvent(new Event('input'));}
  if(filters?.[0]){filters[0].value='All rarities';filters[0].dispatchEvent(new Event('change'));}
  if(filters?.[1]){filters[1].value='All recipes';filters[1].dispatchEvent(new Event('change'));}
  const row=Array.from(book.querySelectorAll('.rb-list button[data-recipe]')).find(n=>n.dataset.recipe===recipe.id);
  if(row){row.click();const target=book.querySelector('.rb-detail');target.tabIndex=-1;target.focus({preventScroll:true});target.scrollIntoView({block:'start'});}
 }
 function render(force){
  if(inventory.hidden||!section.open)return;
  const p=pack(),query=search.value.trim().toLowerCase();
  const key=JSON.stringify([chosen,query,latest?.stateRevision,latest?.revision,p.bag,p.equipment,latest?.gameState.outsideWorld?.resources]);
  if(!force&&signature===key)return;signature=key;
  const focused=document.activeElement,focusId=focused?.dataset.swordChoice,scroll=list.scrollTop;
  const visible=swords.filter(i=>i.name.toLowerCase().includes(query));
  list.replaceChildren();
  for(const item of visible){const b=button(item.name+' · '+(2+(Number(item.bonus)||0))+' damage',()=>{chosen=item.id;render(true);});b.dataset.swordChoice=item.id;b.setAttribute('aria-pressed',String(chosen===item.id));list.append(b);}
  if(!visible.length)list.append(el('p','No swords match this name.'));
  list.scrollTop=scroll;
  if(focusId)Array.from(list.children).find(n=>n.dataset.swordChoice===focusId)?.focus({preventScroll:true});
  detail.replaceChildren();const item=items[chosen];if(!item)return;
  detail.append(el('h3',item.name),el('p',(item.rarity||'Weapon')+' · '+count(p.bag?.[item.id])+' owned'+(p.equipment?.weapon===item.id?' · EQUIPPED':'')),el('p','Base melee damage: '+(2+(Number(item.bonus)||0))+' (2 basic + '+(Number(item.bonus)||0)+' weapon). Living World upgrades and target-specific bonuses apply separately.'),el('p',item.description));
  if(item.lore){const lore=el('p',item.lore);lore.className='srs-lore';detail.append(lore);}
  for(const recipe of recipes.filter(r=>r.output[item.id])){
   detail.append(el('h3',recipe.name));const ingredients=el('ul');
   for(const [id,amount] of Object.entries(recipe.input)){const free=available(id),li=el('li',name(id)+' · '+amount+' required · '+free+' available'+(free<amount?' · need '+(amount-free):' · ready'));li.className=free<amount?'srs-missing':'srs-ready';ingredients.append(li);}
   const batches=Math.max(0,Math.min(...Object.entries(recipe.input).map(([id,n])=>Math.floor(available(id)/n)),...Object.entries(recipe.output).map(([id,n])=>Math.floor((999-count(p.bag?.[id]))/n))));
   detail.append(ingredients,el('p','Produces: '+Object.entries(recipe.output).map(([id,n])=>n+' × '+name(id)).join(', ')),el('p',latest?batches+' batches available with current supplies.':'Waiting for shared ingredient counts.'),button('View recipe & craft',()=>openRecipe(recipe)));
  }
 }
 refresh=()=>render(false);
 search.addEventListener('input',()=>render(true));section.addEventListener('toggle',()=>render(true));
 new MutationObserver(()=>render(true)).observe(inventory,{attributes:true,attributeFilter:['hidden','data-inventory-page']});
 book.addEventListener('toggle',()=>render(true));
 const nav=inventory.querySelector('.new-inventory-nav');
 if(nav){const shortcut=button('Swords',()=>{nav.querySelectorAll('button')[1]?.click();book.open=true;section.open=true;render(true);section.scrollIntoView({block:'start'});search.focus({preventScroll:true});});shortcut.setAttribute('aria-controls',section.id);nav.append(shortcut);}
 render(true);
}
if(document.readyState==='complete')install();else window.addEventListener('load',install,{once:true});
})();
