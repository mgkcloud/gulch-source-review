(function(){
'use strict';
const $=id=>document.getElementById(id);
const panel=$('inventoryPanel'),toggle=$('inventoryToggle'),search=$('inventorySearch');
let snapshot=null,selected=null,pending=null,previousFocus=null,category='all',sort='name';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const entries=v=>Array.isArray(v)?v.map((item,i)=>[String(i),item]):object(v)?Object.entries(v):[];
const count=v=>Number.isFinite(Number(v))?Math.max(0,Math.min(999,Math.floor(Number(v)))):0;
const epoch=d=>String(d.respawnSettings?.token||'original');
const db=()=>window.GulchItemCatalog?.items||{};
const title=v=>String(v??'').replace(/[_-]/g,' ').replace(/^./,c=>c.toUpperCase());
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n;}
function button(text,fn){const n=el('button',text);n.type='button';n.addEventListener('click',fn);return n;}
function shown(id){const n=$(id);return Boolean(n&&!n.hidden);}
function pack(){const v=snapshot?.gameState.itemEcosystem;return v&&v.epoch===epoch(snapshot.gameState)?{...v,bag:object(v.bag)?v.bag:{},equipment:object(v.equipment)?v.equipment:{}}:{epoch:snapshot?epoch(snapshot.gameState):'original',bag:{},equipment:{},known:[],crafted:[],log:[]};}
const style=el('style');style.textContent=`
#inventoryPanel:not([hidden]){display:flex!important;z-index:100!important;isolation:isolate;pointer-events:auto;min-height:0}
#inventoryPanel[hidden]{display:none!important}
#inventoryPanel .inventory-body{flex:1 1 55%;min-height:160px;grid-template-columns:minmax(140px,28%) minmax(0,1fr)}
#inventoryPanel .inventory-items{min-height:0;overflow:hidden}
#inventoryPanel #inventoryList{min-height:65px;overflow:auto}
#inventoryPanel #inventoryDetails{flex:0 1 auto;min-height:70px;max-height:190px;overflow:auto;white-space:normal}
#inventoryPanel #equipmentSlots{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 6px}
#inventoryPanel .equipment-box{width:48px;height:48px;padding:0;font-size:22px}
#inventoryPanel .pack-tools,#inventoryPanel .pack-actions{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}
#inventoryPanel .pack-tools select{min-width:0;max-width:100%;background:#102923;color:#e3e8d5;border:1px solid #718365;padding:7px;font:11px monospace}
#inventoryPanel .pack-actions button{min-height:40px}
#inventoryPanel .pack-detail-title{font-size:15px;color:#f3d49b;margin:3px 0}
#inventoryPanel .pack-detail-text{font-size:11px;line-height:1.6;white-space:pre-wrap;margin:6px 0}
#packStatus{min-height:18px;margin:6px 0;font-size:11px;color:#efd193}
#packLoadout{font-size:11px;line-height:1.7;margin-top:15px;white-space:pre-line}
#inventoryPanel #itemWorkshop{flex:0 1 35%;min-height:42px;overflow:auto}
#inventoryPanel #itemWorkshop:not([open]){flex:0 0 auto}
@media(max-width:600px){#inventoryPanel .inventory-body{grid-template-columns:105px minmax(0,1fr)}#inventoryPanel #equipmentSlots{grid-template-columns:1fr}#inventoryPanel .inventory-items,#inventoryPanel .inventory-equipment{padding:8px}}
@media(max-height:550px){#inventoryPanel:not([hidden]){overflow:auto!important}#inventoryPanel .inventory-body{flex:none;min-height:360px}#inventoryPanel #itemWorkshop{flex:none;max-height:none}#inventoryPanel .inventory-footer{display:none}}
`;document.head.append(style);
const filters=el('div',undefined,'pack-tools'),categorySelect=el('select'),sortSelect=el('select');
categorySelect.setAttribute('aria-label','Filter inventory category');sortSelect.setAttribute('aria-label','Sort inventory');
for(const value of ['all','Weapon','Armor','Consumable','Material','Relic','Quest','Other']){const o=el('option',value==='all'?'All categories':value);o.value=value;categorySelect.append(o);}
for(const [value,label] of [['name','Name'],['quantity','Largest stacks'],['power','Equipment strength']]){const o=el('option',label);o.value=value;sortSelect.append(o);}
filters.append(categorySelect,sortSelect,button('Clear filters',()=>{search.value='';category='all';categorySelect.value='all';render();}));search.after(filters);
const status=el('p');status.id='packStatus';status.setAttribute('role','status');$('inventoryDetails').after(status);
const loadout=el('div');loadout.id='packLoadout';$('equipmentSlots').after(loadout);
$('inventoryTitle').textContent='EQUIPMENT & SHARED PACK';
function categoryOf(item){const raw=String(item.category||item.type||item.kind||'');if(item.id==='legendary-sword-first-light'||/quest/i.test(raw))return 'Quest';if(/weapon|sword|blade/i.test(raw))return 'Weapon';if(/armor|armour/i.test(raw))return 'Armor';if(/consumable|food|potion/i.test(raw))return 'Consumable';if(/material|resource/i.test(raw))return 'Material';if(/relic/i.test(raw))return 'Relic';return 'Other';}
function glyph(item){return String(item.glyph||({Weapon:'⚔',Armor:'▣',Consumable:'✚',Material:'◆',Relic:'◈',Quest:'✦'}[item.category])||'◇');}
function model(){
 const data=snapshot.gameState,p=snapshot.player,seed=snapshot.seed,definitions=new Map(),items=[],slots=[];
 for(const source of [seed.items,seed.itemDefinitions,data.items,seed.entities])for(const [key,v] of entries(source))if(object(v))definitions.set(String(v.id??key),v);
 function resolve(value,key,sourceKey){
  const record=object(value)?value:{},ref=record.itemId??record.id??(typeof record.item==='string'?record.item:typeof value==='string'?value:key);
  const item={...definitions.get(String(ref)),...(object(record.item)?record.item:{}),...record};
  item.id=String(item.id??ref);item.name=String(item.name??item.label??ref??'Unnamed item');
  item.quantity=record.quantity!==undefined||record.count!==undefined?count(record.quantity??record.count):typeof value==='number'?count(value):1;
  item.category=categoryOf(item);item.source='legacy';item.key=sourceKey;return item;
 }
 const raw=p.inventory??data.inventory??seed.inventory??[],contents=object(raw)&&Object.prototype.hasOwnProperty.call(raw,'items')?raw.items:raw;
 for(const [key,value] of entries(contents)){if(value==null||value===false)continue;const item=resolve(value,key,'legacy:'+key);if(item.quantity)items.push(item);}
 const native=p.equipment??p.equipped??(object(raw)?raw.equipment:null)??data.equipment??seed.equipment??{};
 for(const [key,value] of entries(native)){if(value==null||value===false)continue;slots.push({name:title(key),item:resolve(value,key,'native:'+key)});}
 const v=pack(),catalog=db();
 for(const [id,quantity] of Object.entries(v.bag)){if(!count(quantity))continue;const definition=catalog[id]||{id,name:title(id),type:'Other',description:'An item recorded in the shared field pack.'};items.push({...definition,id,key:'field:'+id,quantity:count(quantity),category:definition.type||'Other',source:'field',equipped:Boolean(definition.slot&&v.equipment[definition.slot]===id)});}
 for(const slot of ['weapon','armor']){const id=v.equipment[slot],item=items.find(i=>i.key==='field:'+id);slots.unshift({name:'Active '+slot,item:item||null});}
 for(const [id,n] of entries(data.outsideWorld?.resources))if(count(n))items.push({id:'$'+id,key:'resource:'+id,name:title(id),quantity:count(n),category:'Material',source:'outdoor',description:'Shared outdoor crafting resource. Recipes spend it directly from this pack.'});
 const quest=data.legendarySwordQuest;
 if(quest?.epoch===epoch(data))for(const id of Array.isArray(quest.pieces)?quest.pieces:[])items.push({id:String(id),key:'quest:'+id,name:({blade:'Dawnsteel Blade',guard:'Sunfire Guard',hilt:'Oathbound Hilt'})[id]||title(id),quantity:1,category:'Quest',source:'quest',description:quest.forged?'Recovered and reforged into the Sword of First Light.':'Bring all three pieces to the cathedral altar.'});
 return {items,slots};
}
function ready(){const movement=window.GulchMovementState;return Boolean(snapshot&&snapshot.player.hp>0&&movement?.focused&&!movement.inFlight&&!pending&&!shown('respawnScreen'));}
function transact(kind,id){
 if(!ready())return;
 const item=db()[id],old=pack();if(!item||!count(old.bag[id]))return;
 const v={...old,bag:{...old.bag},equipment:{...old.equipment},log:Array.isArray(old.log)?old.log.slice(0,11):[]};
 let seed=snapshot.seed,text;
 if(kind==='equip'&&item.slot){v.equipment[item.slot]=id;text='Equipped '+item.name+'.';}
 else if(kind==='unequip'&&item.slot&&v.equipment[item.slot]===id){delete v.equipment[item.slot];text='Unequipped '+item.name+'.';}
 else if(kind==='use'&&item.heal){const p=snapshot.player;if(!Number.isFinite(p.maxHp)||p.hp>=p.maxHp)return;const healed=Math.min(item.heal,p.maxHp-p.hp);v.bag[id]=count(v.bag[id])-1;seed={...seed,entities:seed.entities.map(e=>e.id==='player'?{...e,hp:e.hp+healed}:e)};text='Used '+item.name+' · restored '+healed+' HP.';}
 else return;
 v.log=[text,...v.log];pending={base:snapshot.stateRevision,epoch:epoch(snapshot.gameState),id,quantity:v.bag[id],slot:item.slot,equipped:v.equipment[item.slot],hp:seed.entities.find(e=>e.id==='player').hp,text};
 status.textContent='Waiting for the room to confirm…';
 try{Gulch.commit({...snapshot.gameState,seed,itemEcosystem:v},text);}catch(error){pending=null;status.textContent='Unable to submit: '+String(error.message||error);}
 if(pending&&!window.GulchMovementState?.inFlight){pending=null;status.textContent='The room is not ready for this update. Try again.';}
 render();
}
function inspect(item){
 const detail=$('inventoryDetails');detail.replaceChildren();
 if(!item){detail.append(el('p','Select an item or equipped slot to inspect it.','pack-detail-text'));return;}
 detail.append(el('h2',item.name,'pack-detail-title'),el('p',item.category+' · '+item.quantity+' owned'+(item.equipped?' · EQUIPPED':''),'pack-detail-text'),el('p',item.description||item.desc||'No description recorded.','pack-detail-text'));
 const actions=el('div',undefined,'pack-actions'),v=pack();
 if(item.source==='field'&&item.slot){
  const old=db()[v.equipment[item.slot]],key=item.slot==='weapon'?'bonus':'armor',amount=Number(item[key])||0,delta=amount-(Number(old?.[key])||0);
  detail.append(el('p',(item.slot==='weapon'?'Weapon damage bonus: +':'Armor reduction: ')+amount+'\nCompared with '+(old?.name||'empty slot')+': '+(delta>0?'+':'')+delta,'pack-detail-text'));
  const b=button(item.equipped?'Unequip':'Equip',()=>transact(item.equipped?'unequip':'equip',item.id));b.disabled=!ready();actions.append(b);
 }
 if(item.source==='field'&&item.heal){const amount=Math.min(item.heal,Math.max(0,snapshot.player.maxHp-snapshot.player.hp));const b=button('Use · heal '+amount+' HP',()=>transact('use',item.id));b.disabled=!ready()||!(amount>0);actions.append(b);}
 if(item.source==='legacy')detail.append(el('p','Original expedition item. Active equipment bonuses use the field pack weapon and armor slots.','pack-detail-text'));
 if(item.source==='quest')detail.append(el('p','Manage this relic through Main quest.','pack-detail-text'));
 const recipes=window.GulchItemCatalog?.recipes||[],related=recipes.filter(r=>r.input?.[item.id]||r.output?.[item.id]);
 if(related.length){detail.append(el('p','Recipes: '+related.map(r=>r.name).join(', '),'pack-detail-text'));actions.append(button('Open recipe',()=>{const workshop=$('itemWorkshop'),select=$('ecosystemRecipe');if(!workshop||!select)return;workshop.open=true;select.value=related[0].id;select.dispatchEvent(new Event('change'));select.focus();select.scrollIntoView({block:'nearest'});}));}
 detail.append(actions);
}
function render(){
 if(panel.hidden)return;
 if(!snapshot){$('inventorySummary').textContent='Waiting for shared inventory…';return;}
 const focused=document.activeElement,focusKey=focused?.dataset?.packKey,oldScroll=$('inventoryList').scrollTop;
 try{
  const {items,slots}=model(),v=pack(),catalog=db();
  const equipment=$('equipmentSlots');equipment.replaceChildren();
  for(const slot of slots){const wrapper=el('div',undefined,'equipment-slot'),b=button(slot.item?glyph(slot.item):'·',()=>{selected=slot.item?.key||null;inspect(slot.item);});b.className='equipment-box';b.disabled=!slot.item;b.dataset.packKey=slot.item?.key||'';b.setAttribute('aria-label',slot.name+': '+(slot.item?.name||'empty'));wrapper.append(b,el('div',slot.name),el('div',slot.item?.name||'Empty','equipment-name'));equipment.append(wrapper);}
  const living=snapshot.gameState.livingWorld,forge=living?.epoch===epoch(snapshot.gameState)?Math.min(3,Math.max(0,Number(living.forge)||0)):0;
  loadout.textContent='ACTIVE LOADOUT\nAttack: '+(2+(Number(catalog[v.equipment.weapon]?.bonus)||0)+forge)+'\nArmor: '+(Number(catalog[v.equipment.armor]?.armor)||0)+'\nHealth: '+snapshot.player.hp+' / '+snapshot.player.maxHp+'\nOne shared weapon and armor slot.';
  const query=search.value.trim().toLowerCase();
  const visible=items.filter(i=>(category==='all'||i.category===category)&&(i.name+' '+i.category+' '+String(i.description||'')).toLowerCase().includes(query));
  visible.sort((a,b)=>sort==='quantity'?b.quantity-a.quantity||a.name.localeCompare(b.name):sort==='power'?((Number(b.bonus)||Number(b.armor)||0)-(Number(a.bonus)||Number(a.armor)||0))||a.name.localeCompare(b.name):a.name.localeCompare(b.name));
  $('inventorySummary').textContent=visible.length+' / '+items.length+' stacks · shared pack · no weight limit';
  const list=$('inventoryList');list.replaceChildren();
  for(const item of visible){const b=button('',()=>{selected=item.key;list.querySelectorAll('.inventory-item').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));inspect(item);});b.className='inventory-item';b.dataset.packKey=item.key;b.setAttribute('aria-pressed',String(item.key===selected));b.append(el('span',glyph(item),'item-glyph'),el('span',item.name+(item.quantity>1?' ×'+item.quantity:''),'item-title'),el('span',item.equipped?'EQUIPPED':item.category,'item-meta'));list.append(b);}
  if(!visible.length)list.append(el('div',items.length?'No items match these filters.':'Your pack is empty. Collect creature loot or gather supplies.','inventory-empty'));
  inspect(items.find(i=>i.key===selected)||slots.find(s=>s.item?.key===selected)?.item);
  list.scrollTop=oldScroll;
  if(focused&&panel.contains(focused)===false&&!focused.isConnected){const replacement=Array.from(panel.querySelectorAll('[data-pack-key]')).find(n=>n.dataset.packKey===focusKey);(replacement||$('inventoryClose')).focus({preventScroll:true});}
 }catch(error){
  $('inventorySummary').textContent='Some inventory data could not be displayed.';
  status.textContent='Inventory remains open. '+String(error?.message||error).slice(0,180);
 }
}
function dismissConflicts(){
 for(const [id,selector] of [['interfaceMenu','header button'],['livingPanel','header button'],['characterPanel','#characterClose'],['questBoard','header button'],['workSelector','.ws-header button'],['workBoard','.bb-head button']]){const n=$(id);if(n&&!n.hidden)n.querySelector(selector)?.click();}
}
function open(value){
 if(value){
  if(shown('respawnScreen'))return;
  previousFocus=document.activeElement;
  dismissConflicts();
  panel.inert=false;
  panel.hidden=false;toggle.setAttribute('aria-expanded','true');
  render();$('inventoryClose').focus({preventScroll:true});
 }else{
  panel.hidden=true;toggle.setAttribute('aria-expanded','false');
  const target=previousFocus?.isConnected&&previousFocus.getClientRects().length&&!previousFocus.closest('[hidden],[inert]')?previousFocus:toggle;
  target.focus({preventScroll:true});
 }
}
toggle.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();open(panel.hidden);},true);
$('inventoryClose').addEventListener('click',()=>open(false));
search.addEventListener('input',render);
categorySelect.addEventListener('change',()=>{category=categorySelect.value;render();});
sortSelect.addEventListener('change',()=>{sort=sortSelect.value;render();});
window.addEventListener('keydown',event=>{
 const typing=event.target instanceof HTMLElement&&(event.target.matches('input,textarea,select')||event.target.isContentEditable);
 const key=String(event.key).toLowerCase();
 if(key==='i'&&!typing&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&window.GulchMovementState?.focused&&!shown('respawnScreen')){
  event.preventDefault();event.stopImmediatePropagation();if(!event.repeat)open(panel.hidden);return;
 }
 if(panel.hidden)return;
 if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();open(false);return;}
 if(event.key==='Tab'){
  const controls=Array.from(panel.querySelectorAll('button,input,select,textarea,summary,[tabindex="0"]')).filter(n=>!n.disabled&&!n.closest('[hidden],[inert]')&&n.getClientRects().length),first=controls[0],last=controls[controls.length-1];
  if(event.shiftKey&&(document.activeElement===first||!panel.contains(document.activeElement))){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&(document.activeElement===last||!panel.contains(document.activeElement))){event.preventDefault();first?.focus();}
 }
 if(!typing&&['ArrowUp','ArrowDown','Home','End'].includes(event.key)){
  const items=Array.from($('inventoryList').querySelectorAll('.inventory-item'));
  if(items.length){event.preventDefault();const old=items.indexOf(document.activeElement),index=event.key==='Home'?0:event.key==='End'?items.length-1:old<0?(event.key==='ArrowUp'?items.length-1:0):Math.max(0,Math.min(items.length-1,old+(event.key==='ArrowUp'?-1:1)));items[index].focus();items[index].click();items[index].scrollIntoView({block:'nearest'});}
 }
 event.stopImmediatePropagation();
},true);
Gulch.register('inventory',{snapshot(s){
 snapshot=s;
 if(pending&&s.stateRevision!==pending.base){const v=pack(),confirmed=epoch(s.gameState)===pending.epoch&&count(v.bag[pending.id])===count(pending.quantity)&&(!pending.slot||v.equipment[pending.slot]===pending.equipped)&&s.player.hp===pending.hp;status.textContent=confirmed?pending.text:'Another room update arrived. Check your items before retrying.';pending=null;}
 if(s.player.hp<=0&&!panel.hidden){panel.hidden=true;toggle.setAttribute('aria-expanded','false');return;}
 render();
}});
})();
