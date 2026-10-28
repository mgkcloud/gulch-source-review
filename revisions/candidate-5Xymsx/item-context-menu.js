(function(){
'use strict';
let latest=null,origin=null,choices=[],selected=0;
const host=document.getElementById('left');
if(!host)return;
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
const style=el('style');style.textContent=`
#itemContext[hidden]{display:none!important}
#itemContext{position:absolute;z-index:110;width:290px;max-width:calc(100% - 16px);max-height:calc(100% - 16px);overflow:auto;padding:13px;background:#102127fa;color:#e5e6d4;border:1px solid #b6a476;border-radius:9px;box-shadow:0 8px 28px #0008;font:12px/1.55 ui-monospace,monospace}
#itemContext h2{font-size:14px;color:#ffe0a0;margin:0 0 7px}#itemContext p{margin:8px 0;overflow-wrap:anywhere}#itemContext .item-context-lore{border-left:2px solid #a9b48b;padding-left:10px;color:#c5d5c1}#itemContext small{display:block;color:#a4b9b0;font-size:10px}#itemContext select,#itemContext button,#itemContext input{font:inherit;color:#e9e6d2;background:#19332e;border:1px solid #718779;border-radius:4px;max-width:100%;padding:7px;min-height:36px}#itemContext select{width:100%;margin-bottom:8px}#itemContext input{width:100%;font-size:10px;margin-bottom:8px}#itemContext button{margin-top:8px}#itemContext :focus-visible{outline:2px solid #f1d299;outline-offset:2px}
`;document.head.append(style);
const panel=el('section');panel.id='itemContext';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','false');panel.setAttribute('aria-labelledby','itemContextTitle');
const title=el('h2');title.id='itemContextTitle';
const picker=el('select');picker.setAttribute('aria-label','Select an item at this location');
const focus=el('input');focus.readOnly=true;focus.value='Item selected · Esc to close';focus.setAttribute('aria-label','Item information. Escape closes this menu.');
const stats=el('p'),description=el('p'),lore=el('p');lore.className='item-context-lore';
const attribution=el('small','Original flavor text inspired by The Lord of the Rings; these game items are not canonical artifacts.');
const close=el('button','Close');close.type='button';
panel.append(title,picker,focus,stats,description,lore,attribution,close);host.append(panel);
function catalog(){return window.GulchItemCatalog?.items||{};}
function flavor(item){
 const text=[item.id,item.name,item.type,item.category].join(' ').toLowerCase();
 if(/sword|blade|knife/.test(text))return 'A traveler in Bree might judge this blade by the steadiness of its bearer. The roads beyond the Shire demand courage long before they demand a famous sword.';
 if(/bow|crossbow/.test(text))return 'Among the trees of Ithilien, a quiet bow would serve a patient ranger well. A snapped twig can betray more than a drawn blade.';
 if(/axe|pick|hammer|alloy|iron|silver|gold|copper|scrap/.test(text))return 'A Dwarven smith might turn this over in thoughtful silence, weighing its promise. The memory of Khazad-dûm lives as much in careful craft as in tales of treasure.';
 if(/armor|armour|shield|mail|helmet|gauntlet|boots|vest|cloak|belt/.test(text))return 'On a long road to Gondor, sound gear is a comfort beyond its price. Even the finest harness still needs someone willing to stand beside a friend.';
 if(/potion|salve|tonic|herb|bandage|dressing/.test(text))return 'The Houses of Healing in Minas Tirith remind travelers that care can be as brave as battle. Keep this for the companion whose strength begins to fail.';
 if(/food|ration|berries|mushroom|provision/.test(text))return 'A hobbit would insist that a journey improves after a proper meal. Pack a little extra: the road seldom ends where the map suggests.';
 if(/ring|necklace|pendant|crown/.test(text))return 'In the tales told at Rivendell, beautiful things sometimes carry difficult histories. Let this ornament recall friendship rather than the hunger for dominion.';
 if(/scroll|parchment|map|relic|shard|circuit/.test(text))return 'A keeper of records in Gondor might treasure even a damaged fragment. Forgotten words can reveal a safe road where stone walls offer none.';
 if(/crystal|gem|ruby|emerald|lens|spark|core/.test(text))return 'Its glimmer calls to mind the lamps of an Elven refuge seen through evening leaves. A small light can make the next step less lonely.';
 if(/wood|fiber|hide|bone|chitin|fang|spore/.test(text))return 'A wanderer near Fangorn would gather with care and leave the living woodland in peace. Useful things deserve gratitude, even when found beneath one’s feet.';
 return 'Around a fire in Bree, an ordinary possession can become the beginning of a remarkable tale. Its worth may lie in the journey it helps someone finish.';
}
function render(){
 const item=choices[selected];if(!item)return;
 title.textContent=String(item.name||item.id||'Item');
 picker.hidden=choices.length<2;picker.value=String(selected);
 const bits=[item.type||item.category||'Item'];
 if(Number.isFinite(Number(item.quantity)))bits.push('Quantity '+Number(item.quantity));
 if(item.slot)bits.push('Slot: '+item.slot);
 if(item.bonus)bits.push('Damage +'+item.bonus);
 if(item.armor)bits.push('Armor '+item.armor);
 if(item.heal)bits.push('Restores '+item.heal+' HP');
 stats.textContent=bits.join(' · ');
 description.textContent=item.description||item.desc||'A possession carried or discovered during this shared expedition.';
 lore.textContent=flavor(item);
}
function hide(restore){
 if(panel.hidden)return;
 panel.hidden=true;
 if(restore&&origin?.isConnected&&!origin.closest('[hidden],[inert]'))origin.focus({preventScroll:true});
}
function show(items,x,y,target){
 if(!items.length)return false;
 origin=target;choices=items;selected=0;
 picker.replaceChildren(...items.map((item,i)=>{const option=el('option',item.name||item.id);option.value=String(i);return option;}));
 panel.hidden=false;render();
 const rect=host.getBoundingClientRect();
 panel.style.left=Math.max(8,Math.min(x-rect.left,host.clientWidth-panel.offsetWidth-8))+'px';
 panel.style.top=Math.max(8,Math.min(y-rect.top,host.clientHeight-panel.offsetHeight-8))+'px';
 focus.focus({preventScroll:true});return true;
}
function resolve(value,key){
 if(value==null)return null;
 const record=typeof value==='object'?value:{},id=record.itemId||record.id||(typeof value==='string'?value:key);
 let definition=catalog()[id];
 for(const source of [latest?.seed.items,latest?.seed.itemDefinitions,latest?.gameState.items,latest?.seed.entities]){
  if(Array.isArray(source)){definition=source.find(v=>v?.id===id)||definition;}
  else if(source&&typeof source==='object')definition=source[id]||definition;
 }
 const nested=record.item&&typeof record.item==='object'?record.item:{};
 return {...definition,...nested,...record,id,name:record.name||nested.name||definition?.name||String(id||'Item'),quantity:record.quantity??record.count??(typeof value==='number'?value:1)};
}
function inventoryItem(button){
 const key=button.dataset.packKey||'',split=key.indexOf(':'),source=key.slice(0,split),id=key.slice(split+1),data=latest.gameState,p=latest.player;
 if(source==='field')return {...catalog()[id],id,quantity:data.itemEcosystem?.bag?.[id]||1};
 if(source==='resource')return {id,name:id,type:'Material',quantity:data.outsideWorld?.resources?.[id]||1,description:'Shared outdoor crafting resource.'};
 if(source==='quest')return {id,name:({blade:'Dawnsteel Blade',guard:'Sunfire Guard',hilt:'Oathbound Hilt'})[id]||id,type:'Quest',quantity:1,description:'A piece of the Sword of First Light. Bring the three pieces to the cathedral altar.'};
 const raw=p.inventory??data.inventory??latest.seed.inventory??[];
 if(source==='legacy')return resolve((raw.items||raw)[id],id);
 if(source==='native'){const equipment=p.equipment??p.equipped??raw.equipment??data.equipment??latest.seed.equipment??{};return resolve(equipment[id],id);}
 return null;
}
function ground(x,y){
 const rect=document.getElementById('board').getBoundingClientRect(),p=latest.player,v=window.GulchMovementState?.visual,camera=v?.map===p.map?v:p,ts=Math.max(20,Math.min(64,Number(latest.seed.meta?.tileSize)||32));
 const tx=Math.round(camera.x+(x-rect.left-rect.width/2)/ts),ty=Math.round(camera.y+(y-rect.top-rect.height/2)/ts);
 if(latest.lit[ty]?.[tx]!==1)return [];
 const items=[];
 for(const e of latest.seed.entities.filter(e=>e.map===p.map&&e.x===tx&&e.y===ty&&e.id!=='player')){
  if(e.ecosystemLoot){for(const [id,n] of Object.entries(e.contents||{}))if(n>0)items.push({...catalog()[id],id,name:catalog()[id]?.name||id,quantity:n});}
  else if(e.outsideResource||e.livingResource||e.regionFood||e.itemId||/^(item|weapon|armor|consumable|quest-relic)$/.test(e.kind||''))items.push(resolve(e,e.id));
 }
 return items.filter(Boolean);
}
function openAt(event){
 if(!latest||latest.player.hp<=0||!document.getElementById('respawnScreen')?.hidden)return;
 const target=event.target instanceof Element?event.target:null;
 if(!target||panel.contains(target))return;
 const button=target.closest('#inventoryPanel [data-pack-key]');
 let items=[];
 if(button){const item=inventoryItem(button);if(item)items=[item];}
 else if(target.id==='board')items=ground(event.clientX,event.clientY);
 if(items.length&&show(items,event.clientX,event.clientY,button||target)){event.preventDefault();event.stopImmediatePropagation();}
}
window.addEventListener('contextmenu',openAt,true);
window.addEventListener('keydown',event=>{
 if(!panel.hidden&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();hide(true);return;}
 if(panel.hidden&&(event.key==='ContextMenu'||(event.shiftKey&&event.key==='F10'))){
  const button=document.activeElement?.closest?.('#inventoryPanel [data-pack-key]');
  if(!button||!latest)return;
  const item=inventoryItem(button),rect=button.getBoundingClientRect();
  if(item){event.preventDefault();event.stopImmediatePropagation();show([item],rect.left+20,rect.top+20,button);}
 }
},true);
picker.addEventListener('change',()=>{selected=Number(picker.value);render();focus.focus({preventScroll:true});});
close.addEventListener('click',()=>hide(true));
document.addEventListener('pointerdown',event=>{if(!panel.hidden&&!panel.contains(event.target))hide(false);},true);
document.addEventListener('focusin',event=>{if(!panel.hidden&&!panel.contains(event.target))hide(false);});
window.addEventListener('resize',()=>hide(false));
Gulch.register('item-context-information',{snapshot(s){
 const changed=latest&&(latest.stateRevision!==s.stateRevision||latest.revision!==s.revision);
 latest=s;if(changed||s.player.hp<=0)hide(false);
}});
window.addEventListener('load',()=>{
 const guide=document.createElement('p');guide.textContent='Right-click an inventory item or visible ground loot for item details and Middle-earth-inspired lore. Keyboard: focus an inventory item and press Shift+F10.';
 document.getElementById('keyHelp')?.append(guide);
});
})();
