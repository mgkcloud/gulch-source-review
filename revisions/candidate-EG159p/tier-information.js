(function(){
'use strict';
let latest=null,queued=false;
const api=window.GulchItemTiers;if(!api)return;
const style=document.createElement('style');style.textContent='.item-tier-information{clear:both;margin:9px 0;padding:10px 12px;background:#091b22;border:1px solid var(--tier-color);border-left:4px solid var(--tier-color);border-radius:5px;color:#dde6d5;font:11px/1.6 monospace}.item-tier-information strong{display:block;color:var(--tier-color);font-size:15px;letter-spacing:1px}.item-tier-information p{margin:5px 0!important}.item-tier-information details{margin-top:6px}.item-tier-information summary{cursor:pointer;color:#c5d7c5}.item-tier-chip{display:inline-block;padding:1px 5px;border:1px solid currentColor;border-radius:3px;font:bold 10px/1.5 monospace;margin-right:5px}';document.head.append(style);
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
function definitions(){
 const catalog=window.GulchItemCatalog?.items||{},all=new Map(Object.entries(catalog));
 function add(source){if(!source||typeof source!=='object')return;for(const [key,v] of Object.entries(source)){if(v&&typeof v==='object'&&!Array.isArray(v)){const id=String(v.itemId||v.id||key);if(!all.has(id))all.set(id,{...v,id});}}}
 add(latest?.seed.items);add(latest?.seed.itemDefinitions);add(latest?.gameState.items);
 const raw=latest?.player.inventory??latest?.gameState.inventory??latest?.seed.inventory;add(raw?.items||raw);
 for(const e of latest?.seed.entities||[])if(e.itemId||/^(item|weapon|armor|armour|consumable|material|relic|quest-relic)$/.test(e.kind||'')){
  const id=String(e.itemId||e.id);if(!all.has(id))all.set(id,{...e,id});
 }
 return all;
}
function nameOf(node){return Array.from(node.childNodes).filter(n=>!(n instanceof Element&&n.matches('.item-tier-information,.item-tier-chip'))).map(n=>n.textContent).join('').trim().replace(/\s*×\s*\d+\s*$/,'');}
function decorate(){
 queued=false;if(document.hidden)return;
 const all=definitions(),byName=new Map(Array.from(all.values()).map(i=>[i.name||i.id,i]));
 const selectors=['#itemContextTitle','#merchantItemInfoTitle','#chestRewardDetail h3','#tradeReceiptItems h3','#inventoryDetails .pack-detail-title','#swordRecipeSection article h3','#recipeBook .rb-detail>h3'];
 for(const node of document.querySelectorAll(selectors.join(','))){
  if(node.closest('[hidden]')||node.closest('dialog:not([open])'))continue;
  const name=nameOf(node),recipe=window.GulchItemCatalog?.recipes.find(r=>r.name===name);
  const item=byName.get(name)||(recipe&&all.get(Object.keys(recipe.output)[0]));
  let box=node.nextElementSibling?.classList.contains('item-tier-information')?node.nextElementSibling:null;
  if(!item){if(box)box.remove();continue;}
  const tier=api.info(item),key=JSON.stringify([item.id,tier,item.bonus,item.armor,item.heal]);
  if(box?.dataset.tierKey===key)continue;
  if(!box){box=el('section');box.className='item-tier-information';node.after(box);}
  box.dataset.tierKey=key;box.style.setProperty('--tier-color',tier.color);box.setAttribute('aria-label','Item tier and powers');
  const stats=[];if(item.slot==='weapon')stats.push('Weapon bonus +'+item.bonus);if(item.armor)stats.push('Armor '+item.armor);if(item.heal)stats.push('Healing '+item.heal+' HP');if(item.quickThrow)stats.push('Blast '+item.quickThrow.damage);
  box.replaceChildren(el('strong','TIER '+tier.letter+(tier.letter==='S'?' · MAXIMUM':'')),el('p','Relative value: '+tier.value+(stats.length?' · '+stats.join(' · '):'')),el('p',tier.skill));
  if(!item.letterTier)box.append(el('p','Legacy item: estimated tier and comparison value. Its existing mechanics and trade eligibility are unchanged.'));
  const guide=el('details');guide.append(el('summary','Tier order & rare powers'),el('p',api.order),el('p','Z is lowest; A is the highest ordinary letter; S is maximum. Tiers derive from original item value and crafting investment, not drop chance. I-tier and higher weapons unlock magic; B, A and S weapons gain stronger new spell profiles when they have no existing named spell. Existing named spells are strengthened. Armor, medicine and thrown consumables gain type-specific potency. Materials and relics gain value for crafting and barter. Inventory quantities do not affect tier.'));
  box.append(guide);
 }
}
function schedule(){if(queued||document.hidden)return;queued=true;queueMicrotask(decorate);}
function mount(){
 for(const id of ['itemContext','merchantItemInfo','chestRewardDialog','tradeReceipt','inventoryPanel']){
  const node=document.getElementById(id);if(!node)continue;
  new MutationObserver(records=>{if(records.some(r=>!r.target.closest?.('.item-tier-information')))schedule();}).observe(node,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','open','data-inventory-page']});
 }
 schedule();
}
Gulch.register('item-tier-information',{snapshot(s){latest=s;schedule();}});
document.addEventListener('visibilitychange',schedule);
if(document.readyState==='complete')mount();else window.addEventListener('load',mount,{once:true});
})();
