(function(){
'use strict';
let latest=null,anchor=null,queued=false;
const letters=['Z','Y','X','W','V','U','T','R','Q','P','O','N','M','L','K','J','I','H','G','F','E','D','C','B','A','S'];
const colors=['#abb5bc','#abb5bc','#abb5bc','#abb5bc','#bdd0b3','#bdd0b3','#bdd0b3','#bdd0b3','#8fdaa7','#8fdaa7','#8fdaa7','#8fdaa7','#85cfee','#85cfee','#85cfee','#85cfee','#c2adff','#c2adff','#c2adff','#f3a4d0','#f3a4d0','#f3a4d0','#ffd482','#ffd482','#ffd482','#000000'];
const epoch=d=>String(d?.respawnSettings?.token||'original');
const tip=document.createElement('aside');tip.id='itemBiographyTooltip';tip.hidden=true;tip.setAttribute('role','tooltip');document.body.append(tip);
const style=document.createElement('style');style.textContent=`
#itemBiographyTooltip{position:fixed;z-index:2147483647;width:350px;max-width:calc(100vw - 16px);max-height:65vh;overflow:auto;pointer-events:none;padding:14px;background:#081c22fa;color:#e7e7cf;border:1px solid #d1bd86;border-radius:7px;box-shadow:0 8px 30px #0009;font:11px/1.55 monospace;white-space:pre-line;overflow-wrap:anywhere}
#itemBiographyTooltip[hidden]{display:none!important}
#itemBiographyTooltip strong{display:block;font-size:14px;color:#fff0c5;margin-bottom:7px}
#itemBiographyTooltip .bio-tier{display:inline-block;padding:4px 8px;margin-bottom:8px;background:var(--bio-tier);color:#101820;border:1px solid #ffffff80;border-radius:4px;font-weight:bold}
#itemBiographyTooltip .bio-tier[data-tier=S]{background:#000;color:#fff;border-color:#d9e2e7}
#mergeForge #fusionPowerGrid .fusion-grid-slot[data-bio-tier]{border-color:var(--bio-tier)!important;box-shadow:inset 0 -5px var(--bio-tier)}
#mergeForge #fusionPowerGrid .fusion-grid-slot[data-bio-tier=S]{border-color:#000!important;box-shadow:inset 0 0 0 1px #cbd5d9,inset 0 -6px #000;background:#101316}
#mergeForge #fusionPowerGrid .fusion-grid-slot[data-bio-tier]:focus-visible{outline:3px solid #ffe0a0;outline-offset:3px}
`;document.head.append(style);
function gridItem(row){
 if(!latest)return null;
 const d=latest.gameState,f=d.freeformForge,p=d.itemEcosystem,slot=Number(row.dataset.fusionGridSlot);
 if(f?.epoch!==epoch(d)||p?.epoch!==epoch(d)||!Number.isInteger(slot)||slot<0||slot>8)return null;
 const used=new Map();
 for(let i=0;i<=slot;i++){
  const id=f.grid?.[i],item=typeof id==='string'?f.definitions?.[id]:null,n=used.get(id)||0;
  const owned=Math.max(0,Math.min(999,Math.floor(Number(p.bag?.[id])||0)));
  if(!item||owned<=n){if(i===slot)return null;continue;}
  used.set(id,n+1);
  if(i===slot)return {row,item,id,slot,duplicate:n>0,remaining:Math.max(0,Math.max(Number(f.gridReady?.[id])||0,Number(f.readyTurn)||0)-(Number(d.turn)||0))};
 }
 return null;
}
function resolve(node){
 const items=window.GulchItemCatalog?.items||{};
 const row=node.closest('[data-fusion-grid-slot],[data-fusion-item],[data-pack-key],[data-item],[data-sword-choice],[data-recipe],.expanded-slot,.gear-slot');if(!row)return null;
 if(row.hasAttribute('data-fusion-grid-slot'))return gridItem(row);
 let item=items[row.dataset.fusionItem||row.dataset.item||row.dataset.swordChoice];
 const key=row.dataset.packKey;
 if(key?.startsWith('field:'))item=items[key.slice(6)];
 if(key?.startsWith('resource:'))item={name:key.slice(9),type:'Material',description:'Gathered outdoor crafting resource.'};
 if(key?.startsWith('legacy:')&&latest){const raw=latest.player.inventory??latest.gameState.inventory??latest.seed.inventory??[],v=(raw.items||raw)[key.slice(7)];if(v&&typeof v==='object')item=v;else if(v)item=items[v]||{name:String(v),description:'Carried expedition item.'};}
 if(row.dataset.recipe){const r=window.GulchItemCatalog?.recipes.find(r=>r.id===row.dataset.recipe);if(r)item=items[Object.keys(r.output)[0]];}
 if(!item){const name=row.querySelector('.expanded-slot-name,.gear-slot-name')?.textContent;item=Object.values(items).find(i=>i.name===name);}
 return item?{row,item}:null;
}
function tierOf(item){
 const tier=item.letterTier||window.GulchItemTiers?.info(item);
 if(!tier)return null;
 const index=letters.indexOf(tier.letter);
 return {...tier,color:colors[index]||'#abb5bc'};
}
function hide(){
 if(anchor){const ids=(anchor.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!==tip.id);if(ids.length)anchor.setAttribute('aria-describedby',ids.join(' '));else anchor.removeAttribute('aria-describedby');}
 anchor=null;tip.hidden=true;
}
function position(){
 if(!anchor?.isConnected||!anchor.getClientRects().length){hide();return;}
 const r=anchor.getBoundingClientRect(),width=tip.offsetWidth,height=tip.offsetHeight;
 const left=r.right+10+width<=innerWidth-8?r.right+10:r.left-width-10;
 tip.style.left=Math.max(8,Math.min(innerWidth-width-8,left))+'px';
 tip.style.top=Math.max(8,Math.min(innerHeight-height-8,r.top))+'px';
}
function show(node,force){
 const found=resolve(node);if(!found){hide();return;}
 const {row,item}=found;if(row===anchor&&!force)return;hide();anchor=row;
 const title=document.createElement('strong');title.textContent=item.name||item.id||'Merged creation';tip.replaceChildren(title);
 const tier=tierOf(item),lines=[item.type||item.category||'Item'];
 if(tier){const badge=document.createElement('span');badge.className='bio-tier';badge.dataset.tier=tier.letter;badge.style.setProperty('--bio-tier',tier.color);badge.textContent='TIER '+tier.letter+' · VALUE '+String(tier.value??item.craftValue??'—')+(tier.letter==='S'?' · MAXIMUM':'');tip.append(badge);}
 if(found.slot!==undefined){
  lines.push('Power slot '+(found.slot+1)+' · Generation '+(item.fusionGeneration||1));
  const power=item.fusionPower,strength=Math.max(0,Math.min(100,Number(power?.strength)||0));
  if(power){
   const descriptions={flare:'Flare: +'+strength+' damage to the surviving nearby hostile struck by melee.',mend:'Mend: restore up to '+strength+' HP after a nearby melee hit, if you survive retaliation.',ward:'Ward: prevent up to '+strength+' incoming damage if you survive, leaving at least 1 base damage.'};
   lines.push(descriptions[power.kind]||'No recognized grid power.');
   lines.push('Recharge: '+Math.max(2,Number(power.cooldown)||6)+' played turns');
   const dead=latest.player.hp<=0||latest.gameState.gulchPermanentGameOver?.ended;
   lines.push('Status: '+(dead?'Inactive after death':found.remaining?found.remaining+' turns remaining':'Ready'));
   if(found.duplicate)lines.push('Duplicate copy: shares its power and cooldown; no extra activation.');
   lines.push('Active while slotted. Healing is capped at maximum HP. Cannot revive you.');
  }
 }
 if(item.bonus)lines.push('Melee bonus +'+item.bonus+' · Basic + weapon '+(2+Number(item.bonus)));
 if(item.armor)lines.push('Armor '+item.armor);
 if(item.heal)lines.push('Healing '+item.heal+' HP');
 if(item.magicAbility)lines.push(item.magicAbility.name+' · '+item.magicAbility.damage+' damage · '+item.magicAbility.cooldown+' turn recharge');
 lines.push('',item.lore||'Recovered along the frontier, this item carries the marks of its journey.');
 if(found.slot===undefined)lines.push(item.description||item.desc||'No additional statistics recorded.');
 if(found.slot!==undefined)lines.push('','Tier order · '+letters.join(' → '),'Z is lowest · S is highest (black). Value measures crafting investment, not guaranteed combat damage.');
 const body=document.createElement('div');body.textContent=lines.join('\n');tip.append(body);tip.hidden=false;
 const ids=new Set((row.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean));ids.add(tip.id);row.setAttribute('aria-describedby',Array.from(ids).join(' '));position();
}
function decorate(){
 queued=false;
 for(const row of document.querySelectorAll('#fusionPowerGrid [data-fusion-grid-slot]')){
  const found=gridItem(row),tier=found&&tierOf(found.item);
  if(tier){if(row.dataset.bioTier!==tier.letter)row.dataset.bioTier=tier.letter;if(row.style.getPropertyValue('--bio-tier')!==tier.color)row.style.setProperty('--bio-tier',tier.color);}
  else{row.removeAttribute('data-bio-tier');row.style.removeProperty('--bio-tier');}
 }
 if(anchor){if(anchor.closest('[hidden]')||!anchor.isConnected)hide();else show(anchor,true);}
}
function schedule(){if(queued)return;queued=true;queueMicrotask(decorate);}
function mount(){
 const panel=document.getElementById('inventoryPanel');if(panel)new MutationObserver(schedule).observe(panel,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','data-inventory-page']});
 schedule();
}
document.addEventListener('pointerover',e=>{if(e.pointerType!=='touch'&&e.target instanceof Element)show(e.target);});
document.addEventListener('pointerout',e=>{if(anchor&&(!(e.relatedTarget instanceof Node)||!anchor.contains(e.relatedTarget)))hide();});
document.addEventListener('focusin',e=>{if(e.target instanceof Element)show(e.target);});
document.addEventListener('focusout',hide);
document.addEventListener('scroll',e=>{if(e.target!==tip&&!tip.contains(e.target))hide();},true);
window.addEventListener('resize',hide);
window.addEventListener('keydown',e=>{if(e.key==='Escape')hide();},true);
document.addEventListener('visibilitychange',hide);
Gulch.register('item-hover-biography',{snapshot(s){latest=s;schedule();}});
if(document.readyState==='complete')mount();else window.addEventListener('load',mount,{once:true});
})();
