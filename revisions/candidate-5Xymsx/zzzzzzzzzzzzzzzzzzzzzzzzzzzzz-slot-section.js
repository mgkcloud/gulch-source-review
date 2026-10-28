(function(){
'use strict';
const api=window.GulchEquipmentSlots,panel=document.getElementById('inventoryPanel'),sidebar=panel?.querySelector('.inventory-equipment');
if(!api||!sidebar)return;
let latest=null,pending=null,selected='weapon',signature='';
const epoch=d=>String(d?.respawnSettings?.token||'original');
const items=window.GulchItemCatalog.items;
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
const style=el('style');style.textContent=`
#inventoryPanel #advancedGear,#inventoryPanel #packLoadout{display:none!important}
#expandedEquipment{margin-bottom:16px}#expandedEquipment h2{font-size:13px;letter-spacing:1px;color:#ead9aa;margin:0 0 10px}
#expandedEquipmentGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
#inventoryPanel .expanded-slot{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:5px;min-width:0;min-height:110px;padding:8px 5px;background:#102d2b;border:1px solid #577d6a;text-align:center}
#inventoryPanel .expanded-slot[aria-pressed=true]{border-color:#ead49b;background:#304735}
.expanded-slot-art{display:grid;place-items:center;width:36px;height:36px;color:#cbbb89;font-size:26px}.expanded-slot-art canvas{width:36px;height:36px;image-rendering:pixelated}
.expanded-slot-label{font-size:10px;color:#d8c89a}.expanded-slot-name{font-size:10px;overflow-wrap:anywhere}
#expandedEquipment select{width:100%;min-height:42px;background:#102d2b;color:#e5dfc9;border:1px solid #789879;font:11px monospace;margin:8px 0}
#expandedEquipment p{font:11px/1.6 monospace;overflow-wrap:anywhere}#expandedEquipmentActions{display:flex;flex-wrap:wrap;gap:6px}#expandedEquipmentActions button{min-height:40px}
@media(max-width:460px){#expandedEquipmentGrid{grid-template-columns:1fr}#inventoryPanel .expanded-slot{min-height:90px}}
`;document.head.append(style);
const section=el('section');section.id='expandedEquipment';section.setAttribute('aria-label','Eight equipment slots');
const grid=el('div');grid.id='expandedEquipmentGrid';
const totals=el('p'),label=el('label','Choose carried equipment'),select=el('select');select.id='expandedEquipmentChoice';label.htmlFor=select.id;
const detail=el('p'),actions=el('div');actions.id='expandedEquipmentActions';
const equip=el('button','Equip'),remove=el('button','Unequip');equip.type=remove.type='button';actions.append(equip,remove);
const status=el('p');status.setAttribute('role','status');
section.append(el('h2','EQUIPMENT · 8 SLOTS'),grid,totals,label,select,detail,actions,status,el('p','One item per slot. Protective bonuses combine before difficulty scaling. Equipped copies remain reserved for crafting and trading. Existing hardcore lethal-hit rules still apply.'));
sidebar.prepend(section);
const nodes={};
for(const [key,name] of Object.entries(api.labels)){
 const b=el('button');b.type='button';b.className='expanded-slot';
 const art=el('span');art.className='expanded-slot-art';art.setAttribute('aria-hidden','true');
 const title=el('span',name);title.className='expanded-slot-label';
 const value=el('span','Empty');value.className='expanded-slot-name';b.append(title,art,value);
 b.addEventListener('click',()=>{selected=key;signature='';render();select.focus({preventScroll:true});});grid.append(b);nodes[key]={b,art,value};
}
function pack(){const p=latest?.gameState.itemEcosystem;return p?.epoch===epoch(latest.gameState)?p:{epoch:epoch(latest?.gameState),bag:{},equipment:{},known:[],crafted:[],log:[]};}
function ready(){const m=window.GulchMovementState;return latest&&latest.player.hp>0&&!latest.gameState.gulchPermanentGameOver?.ended&&m?.focused&&!m.inFlight&&!pending;}
function render(){
 if(panel.hidden||!latest)return;
 const p=pack(),worn=api.equipment(p),key=JSON.stringify([p.bag,worn,selected]);
 if(key!==signature){
  signature=key;
  for(const [slot,n] of Object.entries(nodes)){
   const item=items[worn[slot]],valid=item&&Number(p.bag[item.id])>0;
   n.value.textContent=valid?item.name:'Empty';n.b.setAttribute('aria-pressed',String(slot===selected));n.b.setAttribute('aria-label',api.labels[slot]+': '+n.value.textContent);
   if(valid&&window.GulchItemPresentation?.icon)window.GulchItemPresentation.icon(n.art,item);
   else{n.art.replaceChildren();delete n.art.dataset.catalogIcon;n.art.textContent=valid?(item.glyph||'◇'):'·';}
  }
  const old=select.value;
  const choices=Object.values(items).filter(i=>i.slot===selected&&Number(p.bag[i.id])>0).sort((a,b)=>a.name.localeCompare(b.name));
  select.replaceChildren(...choices.map(i=>{const o=el('option',i.name+' ×'+p.bag[i.id]);o.value=i.id;return o;}));
  if(choices.some(i=>i.id===old))select.value=old;else if(choices.some(i=>i.id===worn[selected]))select.value=worn[selected];
  if(!choices.length){const o=el('option','No carried '+api.labels[selected].toLowerCase()+' equipment');o.value='';select.append(o);}
  label.textContent='Choose '+api.labels[selected].toLowerCase()+' equipment';
 }
 const living=latest.gameState.livingWorld,forge=living?.epoch===epoch(latest.gameState)?Math.min(3,Math.max(0,Number(living.forge)||0)):0;
 totals.textContent='Melee: '+(2+(Number(items[worn.weapon]?.bonus)||0)+forge)+' · Combined armor: '+api.protection(p);
 const item=items[select.value];detail.textContent=item?item.description:'';
 equip.disabled=!ready()||!item||worn[selected]===item.id;remove.disabled=!ready()||!worn[selected];select.disabled=Boolean(pending);
}
function save(clear){
 if(!ready())return;
 const p=pack(),equipment=api.equipment(p),id=select.value,item=items[id];
 if(clear){if(!equipment[selected])return;delete equipment[selected];}
 else{if(!item||item.slot!==selected||!(Number(p.bag[id])>0))return;equipment[selected]=id;}
 const text=clear?'Unequipped '+api.labels[selected].toLowerCase()+'.':'Equipped '+item.name+' in '+api.labels[selected].toLowerCase()+' slot.';
 pending={base:latest.stateRevision,epoch:epoch(latest.gameState),slot:selected,id:equipment[selected],text};status.textContent='Waiting for room confirmation…';
 try{Gulch.commit({...latest.gameState,itemEcosystem:{...p,equipment,log:[text,...(p.log||[])].slice(0,12)}},text);}catch(error){pending=null;status.textContent=String(error.message||error);}
 if(pending&&!window.GulchMovementState?.inFlight){pending=null;status.textContent='Update was not submitted. Try again when the room is ready.';}
 render();
}
equip.addEventListener('click',()=>save(false));remove.addEventListener('click',()=>save(true));select.addEventListener('change',render);
new MutationObserver(()=>{signature='';render();}).observe(panel,{attributes:true,attributeFilter:['hidden','data-inventory-page']});
Gulch.register('eight-slot-equipment',{snapshot(s){latest=s;if(pending&&s.stateRevision!==pending.base){const r=pending;pending=null;status.textContent=epoch(s.gameState)===r.epoch&&api.equipment(pack())[r.slot]===r.id?r.text:'Another room update arrived. Review equipment before retrying.';}render();}});
setInterval(()=>{if(!document.hidden&&!panel.hidden)render();},400);
})();
