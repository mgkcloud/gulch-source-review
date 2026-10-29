(function(){
'use strict';
let latest=null,queued=false;
const epoch=d=>String(d?.respawnSettings?.token||'original');
const targets={crawler:'crawlers',beetle:'ordinary beetles',brute:'Ironhide chargers',spirit:'wisps and Storm lanterns',giant:'Dreadmaws and Colossi',skitter:'Needle skitterers'};
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
function catalog(){return window.GulchItemCatalog?.items||{};}
function weapon(item){return item&&(item.slot==='weapon'||item.type==='Weapon');}
function bonus(item){return Number.isFinite(Number(item.bonus))?Math.max(0,Number(item.bonus)):0;}
function forge(){const d=latest?.gameState,v=d?.livingWorld;return v?.epoch===epoch(d)?Math.max(0,Math.min(3,Number(v.forge)||0)):0;}
function set(node,text){if(node.textContent!==text)node.textContent=text;}
function detail(host,item){
 let box=host.querySelector(':scope > .weapon-damage-info');
 if(!weapon(item)){box?.remove();return;}
 if(!box){box=el('section');box.className='weapon-damage-info';box.setAttribute('aria-label','Weapon damage statistics');host.append(box);}
 const b=bonus(item),upgrade=forge(),trait=item.swordStrength,magic=item.magicAbility||window.GulchSwordMagic?.[item.id];
 const lines=['WEAPON DAMAGE','Basic attack: 2','Weapon bonus: +'+b,'Basic + weapon: '+(2+b),'Living World blade upgrade: +'+upgrade,'Melee total when equipped: '+(2+b+upgrade)];
 if(trait)lines.push(trait.title+': +'+trait.extra+' against '+(targets[trait.target]||trait.target)+' (matching-target melee total '+(2+b+upgrade+trait.extra)+').');
 if(magic){
  lines.push('Magic — '+magic.name+': '+magic.damage+' additional damage per affected enemy; radius '+magic.radius+'; '+magic.cooldown+' played-turn recharge.');
  if(magic.execute)lines.push('Direct magic damage doubles against a target already below half health.');
  if(magic.heal)lines.push('Magic healing: up to '+magic.heal+' HP if you survive retaliation.');
 }
 lines.push('Uses sword slashes and bump attacks. Bows and crossbows currently use melee attacks. Magic and specialist bonuses are conditional; the melee total is not a guarantee of damage on every action.');
 set(box,lines.join('\n'));
}
function selectedInventory(items){
 const row=document.querySelector('#inventoryList [data-pack-key][aria-pressed="true"]');
 const key=row?.dataset.packKey;
 const title=document.querySelector('#inventoryDetails .pack-detail-title')?.textContent.trim();
 const selected=key?.startsWith('field:')?items[key.slice(6)]:null;
 if(selected&&selected.name===title)return selected;
 return Object.values(items).find(i=>i.name===title);
}
function refresh(){
 queued=false;
 const items=catalog(),inventory=document.getElementById('inventoryPanel'),trade=document.getElementById('tradePanel');
 if(inventory&&!inventory.hidden){
  for(const row of inventory.querySelectorAll('#inventoryList [data-pack-key^="field:"]')){
   const item=items[row.dataset.packKey.slice(6)];
   let label=row.querySelector('.weapon-damage-chip');
   if(!weapon(item)){label?.remove();continue;}
   if(!label){label=el('span');label.className='weapon-damage-chip';row.append(label);}
   set(label,(2+bonus(item))+' melee\n+'+bonus(item)+' weapon');
  }
  const host=document.getElementById('inventoryDetails');if(host)detail(host,selectedInventory(items));
 }
 if(trade&&!trade.hidden){
  for(const row of trade.querySelectorAll('#merchantGoodsGrid button[data-item]')){
   const item=items[row.dataset.item];let label=row.querySelector('.weapon-damage-chip');
   if(!weapon(item)){label?.remove();continue;}
   if(!label){label=el('span');label.className='weapon-damage-chip';row.append(label);}
   set(label,'Melee '+(2+bonus(item))+' · weapon +'+bonus(item));
  }
  const item=items[document.getElementById('barterReceive')?.value];
  let summary=document.getElementById('merchantWeaponDamage');
  if(!summary){summary=el('div');summary.id='merchantWeaponDamage';const quote=trade.querySelector('output');if(quote)quote.after(summary);else trade.append(summary);}
  detail(summary,item);summary.hidden=!weapon(item);
 }
 const info=document.getElementById('merchantItemInfo');
 if(info?.open){const name=document.getElementById('merchantItemInfoTitle')?.textContent.trim();detail(info,Object.values(items).find(i=>i.name===name));}
}
function schedule(){if(queued||document.hidden)return;queued=true;queueMicrotask(refresh);}
function mount(){
 const style=el('style');style.textContent='.weapon-damage-info{white-space:pre-line;padding:10px 12px;margin:10px 0;border:1px solid #a58d64;border-left:3px solid #e9cb86;background:#0c2026;color:#eddfb9;font:11px/1.65 ui-monospace,monospace;overflow-wrap:anywhere}.weapon-damage-chip{display:block;flex-shrink:0;white-space:pre-line;color:#ffe0a0;font:bold 10px/1.5 ui-monospace,monospace}#inventoryList .weapon-damage-chip{text-align:right;max-width:90px}#merchantGoodsGrid .weapon-damage-chip{border-top:1px solid #647560;padding-top:5px;width:100%}@media(max-width:460px){#inventoryList .weapon-damage-chip{font-size:9px;max-width:65px}}';document.head.append(style);
 for(const id of ['inventoryPanel','tradePanel','merchantItemInfo']){
  const host=document.getElementById(id);if(!host)continue;
  new MutationObserver(records=>{
   if(records.some(r=>!r.target.closest?.('.weapon-damage-info,.weapon-damage-chip')))schedule();
  }).observe(host,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','open','aria-pressed']});
 }
 document.getElementById('barterReceive')?.addEventListener('change',schedule);
 document.getElementById('barterVendor')?.addEventListener('change',schedule);
 schedule();
}
Gulch.register('weapon-damage-information',{snapshot(s){latest=s;schedule();}});
document.addEventListener('visibilitychange',schedule);
if(document.readyState==='complete')mount();else window.addEventListener('load',mount,{once:true});
})();
