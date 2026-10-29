(function(){
'use strict';
const panel=document.getElementById('inventoryPanel');
const sidebar=panel?.querySelector('.inventory-equipment');
const slots=document.getElementById('equipmentSlots');
if(!panel||!sidebar||!slots)return;
let latest=null,selectedId=null,scheduled=false,lastSignature='';
const epoch=d=>String(d.respawnSettings?.token||'original');
const catalog=()=>window.GulchItemCatalog?.items||{};
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function button(text,fn){const b=el('button',text);b.type='button';b.addEventListener('click',fn);return b;}
function pack(){const p=latest?.gameState.itemEcosystem;return p&&p.epoch===epoch(latest.gameState)?p:{bag:{},equipment:{}};}
function quantity(v){return Number.isFinite(Number(v))?Math.max(0,Math.floor(Number(v))):0;}
const style=el('style');style.textContent=`
#inventoryPanel:not([hidden]){width:min(1060px,calc(100% - 32px));max-width:1060px;max-height:850px;inset:16px;margin:auto;background:#091e20f7;border:3px double #739c8d;border-radius:3px;color:#d1e0cb;box-shadow:0 12px 44px #0008}
#inventoryPanel .inventory-header{background:#10302f;padding:14px 18px;border-bottom:1px solid #55786b}
#inventoryPanel .inventory-header h1{font:600 16px ui-monospace,monospace;letter-spacing:2px;color:#e4d8a7}
#inventoryPanel .new-inventory-nav{background:#0b2527;border-bottom-color:#55786b;border-radius:0;padding:8px 14px}
#inventoryPanel .new-inventory-nav button{border-radius:2px;background:#123432;color:#c0d4c1}
#inventoryPanel .new-inventory-nav button[aria-pressed=true]{background:#b9c28a;color:#102a26;border-color:#d8dda6}
#inventoryPanel .inventory-body{grid-template-columns:minmax(245px,31%) minmax(0,1fr);min-height:0}
#inventoryPanel .inventory-equipment{padding:16px;background:#081b1d;border-right:1px solid #55786b}
#inventoryPanel .inventory-items{padding:14px 18px;background:#0b2122;min-width:0}
#inventoryPanel .inventory-label{color:#9db79b;letter-spacing:2px;font-size:10px}
#advancedGear{margin-bottom:16px}
#advancedGear header{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:12px}
#advancedGear header strong{font-size:11px;letter-spacing:2px;color:#e0d5a5}
#advancedGear header span{font-size:10px;color:#9eb79e}
#gearPortrait{width:90px;height:90px;image-rendering:pixelated;background:#0c2728;border:3px double #55786b;margin:0 auto 12px;display:block}
#inventoryPanel .gear-slot{width:100%;display:grid;grid-template-columns:38px minmax(0,1fr);gap:4px 10px;align-items:center;text-align:left;margin:9px 0;padding:12px;border:1px solid #577d6a;border-radius:2px;background:#102d2b;min-height:82px}
#inventoryPanel .gear-slot:hover{background:#1c3d32;border-color:#c8cb92}
#inventoryPanel .gear-slot[data-selected=true]{border-color:#e2d598;box-shadow:inset 3px 0 #d6cc8d}
.gear-slot-icon{grid-row:span 3;text-align:center;font-size:27px;color:#e4d6a3}
.gear-slot-label{font-size:10px;letter-spacing:2px;color:#92b49b}
.gear-slot-name{font-size:12px;color:#e2e7cc;overflow-wrap:anywhere}
.gear-slot-stat{font-size:10px;color:#b7c791}
#gearSlotHelp{font-size:10px;line-height:1.6;color:#9bb5a5;margin:10px 0}
#gearComparison{border-top:1px solid #55786b;margin-top:14px;padding-top:12px;font-size:11px;line-height:1.6}
#gearComparison h3{font-size:11px;letter-spacing:1px;color:#e0d5a5;margin:0 0 8px}
#gearComparison p{margin:6px 0;overflow-wrap:anywhere}
#gearComparison dl{display:grid;grid-template-columns:1fr auto;gap:5px;margin:10px 0}
#gearComparison dt{color:#a6c1ac}#gearComparison dd{margin:0;text-align:right;color:#e0d5a5}
#gearComparison .gear-better{color:#b5e2a0}#gearComparison .gear-worse{color:#edaa91}
#gearLegacy{border-top:1px solid #3b5a50;padding-top:10px;margin-top:16px;color:#a4bdab;font-size:11px}
#gearLegacy summary{cursor:pointer;padding:6px 0}
#inventoryPanel #equipmentSlots{grid-template-columns:repeat(2,minmax(0,1fr));margin-top:12px}
#inventoryPanel #packLoadout{border-top:1px solid #3b5a50;padding-top:12px;font-size:11px;line-height:1.8;color:#bad0b8}
#inventoryPanel #inventorySearch{border-radius:2px;background:#06191b;border-color:#577d6a}
#inventoryPanel .pack-tools select{border-radius:2px;background:#102d2b;border-color:#577d6a;min-height:34px}
#inventoryPanel #inventorySummary{font-size:11px;padding:8px 0;color:#9fbc9f}
#gearListLegend{display:flex;justify-content:space-between;font-size:9px;letter-spacing:2px;color:#8fae98;border-bottom:1px solid #55786b;padding:8px 10px}
#inventoryPanel .inventory-item{border-radius:0;margin:0;min-height:46px;background:transparent;border:0;border-bottom:1px solid #294b40;padding:8px 10px}
#inventoryPanel .inventory-item:nth-child(even){background:#112b2870}
#inventoryPanel .inventory-item:hover{background:#284332}
#inventoryPanel .inventory-item[aria-pressed=true]{background:#344b35;border-color:#8da975;box-shadow:inset 3px 0 #d6cc8d;color:#f3e6b9}
#inventoryPanel .inventory-item[data-gear-equipped=true] .item-title:before{content:'◆ ';color:#c8d79b}
#inventoryPanel .item-glyph{width:30px;color:#cfca90}
#inventoryPanel .item-meta{white-space:pre-line;line-height:1.5;color:#a8c5a8;min-width:85px;font-size:10px}
#inventoryPanel #inventoryDetails{border-radius:2px;background:#071b1d;border:1px solid #577d6a;max-height:230px;min-height:110px;margin-top:10px}
#inventoryPanel .pack-detail-title{font-family:ui-monospace,monospace;color:#e4d8a7}
#inventoryPanel .pack-actions button{border-radius:2px;min-height:42px;border-color:#789879;background:#1c3b30}
#inventoryPanel .inventory-footer{background:#092123;border-color:#55786b;color:#a8bc9c}
#inventoryPanel[data-inventory-page=craft] #itemWorkshop{background:#0b2122;padding:18px}
#inventoryPanel :focus-visible{outline:2px solid #e0d5a5;outline-offset:2px}
@media(max-width:700px){
 #inventoryPanel:not([hidden]){inset:6px;width:calc(100% - 12px);height:calc(100% - 12px);max-height:none;max-width:none;margin:0;border-radius:2px}
 #inventoryPanel .inventory-body{grid-template-columns:170px minmax(0,1fr)}
 #inventoryPanel .inventory-equipment,#inventoryPanel .inventory-items{padding:9px}
 #inventoryPanel .gear-slot{grid-template-columns:24px minmax(0,1fr);padding:8px;gap:4px 6px;min-height:78px}
 .gear-slot-icon{font-size:21px}.gear-slot-name{font-size:11px}.gear-slot-label{font-size:9px;letter-spacing:1px}
 #inventoryPanel .item-meta{min-width:58px;font-size:9px}
 #inventoryPanel .new-inventory-nav{padding:7px;gap:5px}
 #inventoryPanel #inventoryDetails{max-height:200px;min-height:85px}
 #inventoryPanel .inventory-footer{display:block;font-size:9px;padding:7px}
}
@media(max-width:460px){
 #inventoryPanel .inventory-body{grid-template-columns:118px minmax(0,1fr)}
 #advancedGear header{display:block}#advancedGear header span{display:block;margin-top:4px}
 #gearPortrait{width:64px;height:64px}
 #inventoryPanel .gear-slot{display:block;min-height:0;padding:9px}
 .gear-slot-icon{display:none}.gear-slot-label,.gear-slot-name,.gear-slot-stat{display:block;margin:3px 0}
 #gearComparison dl{display:block}#gearComparison dd{text-align:left;margin-bottom:8px}
 #inventoryPanel .item-meta{min-width:0;max-width:58px}
 #inventoryPanel .item-glyph{width:18px}#inventoryPanel .inventory-item{gap:6px;padding:8px 6px;font-size:11px}
 #inventoryPanel .inventory-header h1{font-size:13px;letter-spacing:1px}
 #gearListLegend{letter-spacing:1px;padding:8px 4px}
}
@media(max-height:550px) and (min-width:701px){
 #inventoryPanel:not([hidden]){overflow:hidden!important}
 #inventoryPanel[data-inventory-page=gear] .inventory-body{flex:1 1 auto;min-height:0}
 #inventoryPanel .inventory-equipment{overflow:auto}
 #inventoryPanel[data-inventory-page=craft] #itemWorkshop{flex:1 1 auto;min-height:0;overflow:auto}
}
`;
document.head.append(style);
const gear=el('section');gear.id='advancedGear';gear.setAttribute('aria-label','Active equipment selection');
const head=el('header');const owner=el('span','Shared player');head.append(el('strong','LOADOUT'),owner);
const portrait=el('canvas');portrait.id='gearPortrait';portrait.width=90;portrait.height=90;portrait.setAttribute('role','img');portrait.setAttribute('aria-label','Equipped adventurer');gear.append(head,portrait);
const slotNodes={};
function chooseSlot(slot){
 const filter=panel.querySelector('.pack-tools select');
 const search=document.getElementById('inventorySearch');
 if(search){search.value='';search.dispatchEvent(new Event('input'));}
 if(filter){filter.value=slot==='weapon'?'Weapon':'Armor';filter.dispatchEvent(new Event('change'));}
 const id=pack().equipment?.[slot];
 const rows=Array.from(panel.querySelectorAll('.inventory-item[data-pack-key]'));
 const row=rows.find(n=>n.dataset.packKey==='field:'+id)||rows[0];
 if(row){row.click();row.focus({preventScroll:true});row.scrollIntoView({block:'nearest'});}
 else{selectedId=null;render();document.getElementById('inventorySearch')?.focus();}
}
for(const [slot,label,mark] of [['weapon','WIELDED WEAPON','⚔'],['armor','WORN ARMOR','▣']]){
 const b=button('',()=>chooseSlot(slot));b.className='gear-slot';
 const icon=el('span',mark,'gear-slot-icon');icon.setAttribute('aria-hidden','true');
 const name=el('strong','Empty','gear-slot-name'),stat=el('span','','gear-slot-stat');
 b.append(icon,el('span',label,'gear-slot-label'),name,stat);gear.append(b);slotNodes[slot]={b,icon,name,stat};
}
gear.append(el('p','Select a slot to browse matching gear. Choose an item, compare its stats, then use Equip in its details. One active weapon and one armor item are shared by the room.',''));
gear.lastChild.id='gearSlotHelp';
const comparison=el('section');comparison.id='gearComparison';comparison.setAttribute('aria-label','Selected gear comparison');gear.append(comparison);
sidebar.prepend(gear);
const legacy=el('details');legacy.id='gearLegacy';legacy.append(el('summary','All equipment records'));slots.before(legacy);legacy.append(slots);
const legend=el('div');legend.id='gearListLegend';legend.append(el('span','CARRIED ITEM'),el('span','TYPE / STATS'));
document.getElementById('inventoryList').before(legend);
function render(){
 if(panel.hidden||!latest)return;
 const db=catalog(),p=pack(),equipped=p.equipment||{};
 owner.textContent=String(latest.player.name||'Adventurer');
 const ctx=portrait.getContext('2d');ctx.clearRect(0,0,90,90);ctx.imageSmoothingEnabled=false;
 window.GulchPlayerSprite?.(ctx,latest.player,45,44,78);
 for(const slot of ['weapon','armor']){
  const n=slotNodes[slot],item=db[equipped[slot]],valid=item&&quantity(p.bag?.[item.id])>0;
  n.name.textContent=valid?item.name:'Empty slot';
  n.stat.textContent=valid?(slot==='weapon'?'+'+(Number(item.bonus)||0)+' attack damage':(Number(item.armor)||0)+' damage reduction'):'Browse '+(slot==='weapon'?'weapons':'armor')+' →';
  n.b.setAttribute('aria-label',(slot==='weapon'?'Wielded weapon: ':'Worn armor: ')+n.name.textContent+'. Browse matching items.');
  n.b.dataset.selected=String(Boolean(selectedId&&db[selectedId]?.slot===slot));
  if(valid&&window.GulchItemPresentation)window.GulchItemPresentation.icon(n.icon,item);
  else{delete n.icon.dataset.catalogIcon;n.icon.textContent=slot==='weapon'?'⚔':'▣';}
 }
 const item=db[selectedId];
 const signature=JSON.stringify([selectedId,item?.slot,item?.bonus,item?.armor,item?.heal,equipped,quantity(p.bag?.[selectedId])]);
 if(signature!==lastSignature){
  lastSignature=signature;comparison.replaceChildren(el('h3','GEAR COMPARISON'));
  if(!item)comparison.append(el('p','Select a carried weapon or armor item to compare it with your active loadout.'));
  else if(item.slot){
   const old=db[equipped[item.slot]],stat=item.slot==='weapon'?'bonus':'armor',value=Number(item[stat])||0,current=Number(old?.[stat])||0,delta=value-current;
   comparison.append(el('p',item.name),el('p','Against: '+(old?.name||'empty slot')));
   const dl=el('dl');dl.append(el('dt',item.slot==='weapon'?'Damage bonus':'Armor reduction'),el('dd',current+' → '+value));
   dl.append(el('dt','Difference'),el('dd',(delta>0?'+':'')+delta,delta>0?'gear-better':delta<0?'gear-worse':''));comparison.append(dl);
   comparison.append(el('p',equipped[item.slot]===item.id?'Currently equipped.':quantity(p.bag?.[item.id])?'Use Equip in the item details to replace this slot.':'You do not currently own this item.'));
   if(item.slot==='armor')comparison.append(el('p','Armor applies before difficulty scaling; attacks still deal at least 1 damage.'));
  }else comparison.append(el('p',item.heal?'Restores up to '+item.heal+' HP. Use it from the item details.':'This item does not occupy an active equipment slot.'));
 }
 decorateRows();
}
function decorateRows(){
 const db=catalog(),equipment=pack().equipment||{};
 panel.querySelectorAll('.inventory-item[data-pack-key]').forEach(row=>{
  const key=row.dataset.packKey;if(!key.startsWith('field:'))return;
  const item=db[key.slice(6)];if(!item)return;
  const active=Boolean(item.slot&&equipment[item.slot]===item.id);
  const flag=String(active);if(row.dataset.gearEquipped!==flag)row.dataset.gearEquipped=flag;
  const meta=row.querySelector('.item-meta');
  const stat=item.slot==='weapon'?'DMG +'+(Number(item.bonus)||0):item.slot==='armor'?'ARM '+(Number(item.armor)||0):item.heal?'HEAL '+item.heal:'';
  const text=(active?'EQUIPPED':item.type)+(stat?'\n'+stat:'');if(meta&&meta.textContent!==text)meta.textContent=text;
 });
}
panel.addEventListener('click',event=>{
 const row=event.target instanceof Element?event.target.closest('[data-pack-key]'):null;
 if(!row)return;
 const key=row.dataset.packKey||'';selectedId=key.startsWith('field:')?key.slice(6):null;render();
});
function schedule(){if(scheduled||panel.hidden)return;scheduled=true;queueMicrotask(()=>{scheduled=false;render();});}
new MutationObserver(schedule).observe(document.getElementById('inventoryList'),{childList:true,subtree:true});
new MutationObserver(()=>{if(!panel.hidden){selectedId=null;lastSignature='';schedule();}}).observe(panel,{attributes:true,attributeFilter:['hidden']});
Gulch.register('advanced-gear-layout',{snapshot(s){latest=s;render();}});
})();
