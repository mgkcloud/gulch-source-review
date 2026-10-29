(function(){
'use strict';
const panel=document.getElementById('tradePanel'),grid=document.getElementById('merchantGoodsGrid');
if(!panel||!grid)return;
let latest=null,selected=null,opener=null;
const epoch=d=>String(d?.respawnSettings?.token||'original');
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);return n;}
const style=el('style');style.textContent=`
#merchantGoodsGrid .merchant-info-wrap{display:flex;flex-direction:column;min-width:0;gap:4px}
#tradePanel #merchantGoodsGrid .merchant-info-wrap>button:first-child{flex:1}
#tradePanel #merchantGoodsGrid .merchant-info-button{min-height:34px;height:auto;padding:6px;display:block;background:#30453e;color:#ffe2a0;font-size:11px}
#merchantItemInfo{width:min(390px,calc(100% - 24px));max-height:80vh;overflow:auto;padding:18px;background:#14262c;color:#e9e3cd;border:3px double #ba9d6e;border-radius:7px;box-shadow:0 14px 50px #0009;font:12px/1.6 monospace}
#merchantItemInfo::backdrop{background:#030c1077}
#merchantItemInfo header{display:flex;gap:12px;align-items:center}
#merchantItemInfo h2{font-size:17px;color:#ffe0a0;margin:0}
#merchantItemInfo .mi-art{width:56px;height:56px;flex-shrink:0;display:grid;place-items:center;font-size:30px}
#merchantItemInfo canvas{width:52px;height:52px;image-rendering:pixelated}
#merchantItemInfo dl{display:grid;grid-template-columns:1fr auto;gap:5px 12px}
#merchantItemInfo dd{margin:0;text-align:right;color:#efdaa8}
#merchantItemInfo p{overflow-wrap:anywhere}
#merchantItemInfo blockquote{margin:12px 0;padding-left:12px;border-left:2px solid #b69a68;color:#c9d6c0;font:15px/1.6 Georgia,serif}
#merchantItemInfo button{min-height:40px;width:100%;padding:8px;background:#354b3d;color:#ffe2ab;border:1px solid #a58d64;border-radius:4px;font:inherit}
#merchantItemInfo button:focus-visible{outline:2px solid #ffe2ab;outline-offset:3px}
`;document.head.append(style);
const dialog=el('dialog');dialog.id='merchantItemInfo';dialog.setAttribute('aria-labelledby','merchantItemInfoTitle');
const header=el('header'),art=el('span'),title=el('h2');art.className='mi-art';art.setAttribute('aria-hidden','true');title.id='merchantItemInfoTitle';header.append(art,title);
const stats=el('dl'),description=el('p'),magic=el('p'),lore=el('blockquote'),note=el('p'),close=el('button','Close info');close.type='button';
dialog.append(header,stats,description,magic,lore,note,close);document.body.append(dialog);
function hide(){if(dialog.open)dialog.close();}
close.addEventListener('click',hide);
dialog.addEventListener('cancel',e=>{e.preventDefault();hide();});
dialog.addEventListener('close',()=>{selected=null;const fallback=grid.querySelector('.merchant-info-button');if(!panel.hidden)(opener?.isConnected?opener:fallback)?.focus({preventScroll:true});});
function render(){
 const item=window.GulchItemCatalog?.items[selected];if(!item)return;
 title.textContent=item.name;art.replaceChildren();delete art.dataset.catalogIcon;
 if(Number.isInteger(item.referenceSword)&&window.GulchReferenceSwordArt)window.GulchReferenceSwordArt.icon(art,item);
 else if(window.GulchItemPresentation)window.GulchItemPresentation.icon(art,item);
 else art.textContent=item.glyph||'◇';
 stats.replaceChildren();
 function row(k,v){stats.append(el('dt',k),el('dd',v));}
 row('Type',item.type||'Item');row('Rarity',item.rarity||'Unspecified');
 if(item.slot)row('Equipment slot',item.slot);
 if(item.slot==='weapon'){row('Weapon bonus','+'+(Number(item.bonus)||0));row('Basic + weapon damage',2+(Number(item.bonus)||0));}
 if(item.armor)row('Armor reduction',item.armor);
 if(item.heal)row('Healing','Up to '+item.heal+' HP');
 row('Trade value',window.GulchRecipeBook?.value(item.id)||item.craftValue||1);
 const market=latest?.gameState.merchantBarter,vendor=document.getElementById('barterVendor')?.value;
 if(market?.epoch===epoch(latest?.gameState))row('Merchant stock',market.vendors?.[vendor]?.stock?.[item.id]||0);
 description.textContent=item.description||'A recovered item offered by this merchant.';
 const ability=item.magicAbility;magic.hidden=!ability;magic.textContent=ability?'Magic: '+ability.name+' · '+ability.damage+' damage · radius '+ability.radius+' · up to '+ability.heal+' healing · '+ability.cooldown+'-turn recharge.':'';
 lore.textContent=item.lore||({Weapon:'The Coppercross smith checks every edge before setting it on the counter. A dependable weapon is a promise made to the traveler who carries it.',Armor:'Its seams bear the quiet work of someone who hoped its wearer would return home.',Consumable:'Carefully sealed for the road, this provision waits for the moment a traveler needs a little strength.',Material:'The merchant sees the beginnings of a useful creation in this small piece of salvage.',Relic:'Its previous owner left no account of its travels. The next chapter belongs to whoever carries it onward.'}[item.type]||'Passed between travelers, this object carries another small story of the frontier.');
 note.textContent='Inspection does not buy or select this item. Weapon totals exclude blade upgrades and target bonuses; armor applies before difficulty. Barter quantities are shown in the trade quote.';
}
function show(id,button){if(!window.GulchItemCatalog?.items[id]||panel.hidden)return;selected=id;opener=button;render();if(!dialog.open)dialog.showModal();close.focus();}
function decorate(){
 if(panel.hidden)return;
 for(const card of Array.from(grid.querySelectorAll('button[data-item]'))){
  if(card.classList.contains('merchant-info-button')||card.parentElement.classList.contains('merchant-info-wrap'))continue;
  const id=card.dataset.item,wrap=el('div');wrap.className='merchant-info-wrap';card.before(wrap);wrap.append(card);
  const info=el('button','Info');info.type='button';info.className='merchant-info-button';info.setAttribute('aria-label','Information about '+(window.GulchItemCatalog?.items[id]?.name||id));info.setAttribute('aria-haspopup','dialog');info.setAttribute('aria-controls',dialog.id);
  info.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();show(id,info);});wrap.append(info);
 }
}
new MutationObserver(decorate).observe(grid,{childList:true});
new MutationObserver(()=>{if(panel.hidden)hide();else decorate();}).observe(panel,{attributes:true,attributeFilter:['hidden']});
window.addEventListener('keydown',e=>{
 if(!dialog.open)return;
 if(e.key==='Escape'){e.preventDefault();hide();}
 e.stopImmediatePropagation();
},true);
const commit=Gulch.commit;
Gulch.commit=function(data,activity){if(dialog.open)return;return commit(data,activity);};
Gulch.register('merchant-item-information',{snapshot(s){const reset=latest&&epoch(latest.gameState)!==epoch(s.gameState);latest=s;if(reset||s.player.hp<=0||panel.hidden)hide();else if(dialog.open)render();decorate();}});
decorate();
})();
