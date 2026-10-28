(function(){
'use strict';
const panel=document.getElementById('inventoryPanel');
const toggle=document.getElementById('inventoryToggle');
if(!panel||!toggle)return;
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
const style=el('style');
style.textContent=`
#inventoryToggle,#interfaceDock #inventoryToggle{display:none!important}
#inventoryPanel:not([hidden]){display:flex!important;inset:24px;max-width:1080px;max-height:820px;margin:auto;z-index:100!important;border:1px solid #7f9488;border-radius:16px;background:#101e23;box-shadow:0 0 0 100vmax #03090ccf,0 24px 90px #000b;overflow:hidden;color:#e1e9de}
#inventoryPanel[hidden]{display:none!important}
#inventoryPanel:after{display:none}
#inventoryPanel .inventory-header{padding:20px 24px;background:#182c30;border-bottom:1px solid #405653}
#inventoryPanel .inventory-header h1{font:600 21px/1.2 system-ui,sans-serif;letter-spacing:1px;color:#f3e2bb}
#inventoryPanel .inventory-key-guide{display:none}
#inventoryPanel .new-inventory-nav{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:12px 20px;background:#122329;border-bottom:1px solid #405653;flex-shrink:0}
#inventoryPanel .new-inventory-nav button{min-height:42px;padding:10px 16px;background:#192f32;border:1px solid #4e6862;color:#c8d6ca;border-radius:7px}
#inventoryPanel .new-inventory-nav button[aria-pressed=true]{background:#d9c490;color:#152522;border-color:#e8d5a4;font-weight:bold}
#inventoryPanel .new-inventory-meta{margin-left:auto;font-size:11px;color:#adc1b4}
#inventoryPanel .inventory-body{flex:1 1 auto;min-height:0;grid-template-columns:minmax(175px,27%) minmax(0,1fr)}
#inventoryPanel .inventory-equipment{padding:20px;background:#0c191e;border-right:1px solid #405653}
#inventoryPanel .inventory-items{padding:20px;min-height:0}
#inventoryPanel #equipmentSlots{grid-template-columns:repeat(2,minmax(0,1fr));gap:18px 8px}
#inventoryPanel .equipment-box{width:62px;height:62px;border-radius:10px;background:#1b3032;border:1px solid #667e70;box-shadow:none}
#inventoryPanel #inventorySearch{min-height:44px;border-radius:8px;background:#09171c;border-color:#536f65}
#inventoryPanel #inventoryList{min-height:70px;overflow:auto}
#inventoryPanel .inventory-item{min-height:52px;margin:4px 0;border:1px solid transparent;border-radius:7px;background:#15282b}
#inventoryPanel .inventory-item[aria-pressed=true]{background:#30463b;border-color:#c1b684;box-shadow:inset 3px 0 #e3cd96}
#inventoryPanel #inventoryDetails{min-height:105px;max-height:230px;padding:14px;border:1px solid #405c51;border-radius:9px;background:#0b1a1e;margin-top:10px}
#inventoryPanel .pack-detail-title{font:600 17px system-ui,sans-serif;color:#f0dcac}
#inventoryPanel .inventory-footer{flex-shrink:0;padding:12px 20px;background:#0a171c;color:#adbeae;border-color:#405653;letter-spacing:.5px}
#inventoryPanel[data-inventory-page=gear] #itemWorkshop{display:none!important}
#inventoryPanel[data-inventory-page=craft] .inventory-body{display:none!important}
#inventoryPanel[data-inventory-page=craft] #itemWorkshop{display:block!important;flex:1 1 auto;min-height:0;max-height:none;overflow:auto;padding:22px;border:0;background:#101e23}
#inventoryPanel #itemWorkshop>summary{display:none}
#inventoryPanel #itemWorkshop .item-columns{gap:24px}
#inventoryPanel #itemWorkshop button{min-height:44px}
#inventoryPanel #itemWorkshop select{min-height:44px;border-radius:6px}
#inventoryPanel .new-loot-shortcut{margin-left:auto}
@media(max-width:600px){#inventoryPanel:not([hidden]){inset:8px;border-radius:10px}#inventoryPanel .inventory-header{padding:14px}#inventoryPanel .inventory-header h1{font-size:17px}#inventoryPanel .new-inventory-nav{padding:10px;gap:6px}#inventoryPanel .new-inventory-meta{width:100%;margin:0}#inventoryPanel .inventory-body{grid-template-columns:112px minmax(0,1fr)}#inventoryPanel .inventory-equipment,#inventoryPanel .inventory-items{padding:10px}#inventoryPanel #equipmentSlots{grid-template-columns:1fr}#inventoryPanel #inventoryDetails{padding:10px;max-height:180px}#inventoryPanel[data-inventory-page=craft] #itemWorkshop{padding:14px}}
@media(max-height:550px){#inventoryPanel:not([hidden]){overflow:auto!important}#inventoryPanel[data-inventory-page=gear] .inventory-body{flex:none;min-height:370px}#inventoryPanel[data-inventory-page=craft] #itemWorkshop{flex:none;overflow:visible}#inventoryPanel .inventory-footer{display:block}}
`;
document.head.append(style);
toggle.hidden=true;
toggle.tabIndex=-1;
toggle.setAttribute('aria-hidden','true');
const title=document.getElementById('inventoryTitle');
if(title)title.textContent='INVENTORY';
const close=document.getElementById('inventoryClose');
if(close)close.textContent='Close · I / Esc';
const footer=panel.querySelector('.inventory-footer');
if(footer)footer.textContent='I / ESC · CLOSE   |   ARROWS · BROWSE ITEMS   |   SHARED EXPEDITION';
const nav=el('nav');nav.className='new-inventory-nav';nav.setAttribute('aria-label','Inventory sections');
const buttons=[];
function page(id){
 panel.dataset.inventoryPage=id;
 buttons.forEach(entry=>entry.button.setAttribute('aria-pressed',String(entry.id===id)));
 const workshop=document.getElementById('itemWorkshop');
 if(id==='craft'&&workshop){workshop.open=true;document.getElementById('ecosystemItem')?.dispatchEvent(new Event('change'));}
}
for(const [id,label] of [['gear','Gear & Items'],['craft','Crafting & Loot']]){
 const button=el('button',label);button.type='button';button.addEventListener('click',()=>page(id));nav.append(button);buttons.push({id,button});
}
const meta=el('span','Shared inventory');meta.className='new-inventory-meta';nav.append(meta);
panel.querySelector('.inventory-header').after(nav);
const shortcut=el('button','Collect loot');shortcut.type='button';shortcut.className='new-loot-shortcut';shortcut.addEventListener('click',()=>{
 page('craft');
 const gather=document.querySelector('#itemWorkshop .item-tools button');
 if(gather&&!gather.disabled)gather.click();
 document.getElementById('ecosystemItem')?.focus({preventScroll:true});
});
nav.insertBefore(shortcut,meta);
page('gear');
function visible(id){const n=document.getElementById(id);return Boolean(n&&!n.hidden);}
function dismissConflicts(){
 for(const [id,selector] of [['interfaceMenu','header button'],['livingPanel','header button'],['characterPanel','#characterClose'],['questBoard','header button'],['workSelector','.ws-header button'],['workBoard','.bb-head button']]){
  const n=document.getElementById(id);if(n&&!n.hidden)n.querySelector(selector)?.click();
 }
}
document.addEventListener('click',event=>{
 if(!(event.target instanceof Element)||event.target.closest('#inventoryToggle')!==toggle)return;
 if(visible('respawnScreen')){event.preventDefault();event.stopImmediatePropagation();return;}
 if(panel.hidden)dismissConflicts();
},true);
let wasOpen=false;
new MutationObserver(()=>{
 const open=!panel.hidden;
 if(open&&!wasOpen)page('gear');
 wasOpen=open;
 toggle.setAttribute('aria-expanded',String(open));
 if(!open&&document.activeElement===toggle){
  const board=document.getElementById('board');
  if(board){board.tabIndex=-1;board.focus({preventScroll:true});}
 }
}).observe(panel,{attributes:true,attributeFilter:['hidden']});
window.addEventListener('load',()=>{
 const loot=document.querySelector('#lootReveal .loot-actions button:last-child');
 if(loot)loot.textContent='Inspect inventory [I]';
});
Gulch.register('inventory-access',{snapshot(s){
 meta.textContent=String(s.player.name||'Adventurer')+' · '+s.player.hp+' / '+s.player.maxHp+' HP';
 shortcut.disabled=s.player.hp<=0||Boolean(window.GulchMovementState?.inFlight);
 toggle.hidden=true;
}});
})();
