(function(){
'use strict';
const panel=document.getElementById('inventoryPanel'),gear=document.getElementById('advancedGear');
if(!panel||!gear)return;
let latest=null,slot='weapon',selected=null,signature='',scheduled=false;
const epoch=d=>String(d.respawnSettings?.token||'original');
const count=n=>Number.isFinite(Number(n))?Math.max(0,Math.floor(Number(n))):0;
const db=()=>window.GulchItemCatalog?.items||{};
function pack(){const v=latest?.gameState.itemEcosystem;return v?.epoch===epoch(latest.gameState)?v:{bag:{},equipment:{}};}
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function button(text,fn){const b=el('button',text);b.type='button';b.addEventListener('click',fn);return b;}
const style=el('style');style.textContent=`
#gearDossier{margin-top:16px;border-top:3px double #668d78;padding-top:12px;font:11px/1.65 ui-monospace,monospace;color:#c1d3bb}
#gearDossier h3{margin:12px 0 7px;color:#ead9aa;font-size:11px;letter-spacing:1.5px}
#gearDossier p{margin:7px 0;overflow-wrap:anywhere}
#gearDossier .gd-tabs{display:flex;gap:5px}
#gearDossier .gd-tabs button{flex:1;min-height:38px;padding:5px;font-size:10px}
#gearDossier button[aria-pressed=true]{border-color:#dfcf90;background:#354c35;color:#f2e5ba}
#gearDossier table{border-collapse:collapse;width:100%;font-size:10px;font-variant-numeric:tabular-nums}
#gearDossier caption{text-align:left;color:#dfd0a1;padding:6px 0}
#gearDossier th,#gearDossier td{padding:6px 3px;border-bottom:1px solid #335647;text-align:right;vertical-align:top}
#gearDossier th:first-child,#gearDossier td:first-child{text-align:left}
#gearDossier th{color:#a8c19f;font-weight:normal}
#gearDossier .gd-positive{color:#b9e9a3}#gearDossier .gd-negative{color:#edac94}
#gearDossier .gd-candidates{max-height:240px;overflow:auto;margin:8px 0}
#gearDossier .gd-choice{display:block;width:100%;text-align:left;margin:5px 0;border-radius:2px;padding:8px;font-size:11px;min-height:44px}
#gearDossier .gd-choice span{display:block;color:#adc4a6;font-size:10px;margin-top:3px}
#gearDossier details{border-top:1px solid #335647;margin-top:12px;padding-top:8px}
#gearDossier summary{cursor:pointer;color:#ddcf9f;padding:5px 0}
#gearDossier ul{padding-left:16px;margin:6px 0}#gearDossier li{margin:6px 0}
#gearDossier .gd-note{color:#9eb7ab;font-size:10px}
@media(max-width:460px){#gearDossier table{font-size:9px}#gearDossier .gd-tabs{flex-direction:column}#gearDossier .gd-choice{font-size:10px;padding:6px}}
`;document.head.append(style);
const root=el('section');root.id='gearDossier';root.setAttribute('aria-label','Detailed equipment comparison');
const tabs=el('div',undefined,'gd-tabs'),tabButtons={};
for(const [key,label] of [['weapon','Weapons'],['armor','Armor']]){const b=button(label,()=>{slot=key;selected=pack().equipment?.[key]||null;signature='';render();});tabButtons[key]=b;tabs.append(b);}
const summary=el('div'),comparison=el('div'),candidates=el('div',undefined,'gd-candidates'),recipes=el('details'),recipeBody=el('div'),rules=el('details');
recipes.append(el('summary','Crafting paths & ingredients'),recipeBody);
rules.append(el('summary','How this loadout works'),el('p','One weapon and one armor item are active for both room members. Equipping replaces that slot without consuming the previous item. Equipped copies are reserved from crafting.'),el('p','Weapon bonuses add to the basic 2-damage slash and bump attack. Living World blade upgrades add another 0–3 damage. Bows, crossbows and throwing weapons currently use the same melee attacks.'),el('p','Armor reduces the combined incoming health loss before the expedition difficulty multiplier. A damaging attack still deals at least 1 base damage. Recovery actions can combine healing and enemy retaliation, so their final health change may differ.'),el('p','A lethal hit can trigger the expedition death latch before armor is processed. The estimates here apply to surviving hits; armor is not a guarantee against lethal damage.','gd-note'));
root.append(el('h3','EQUIPMENT DOSSIER'),tabs,summary,comparison,el('h3','OWNED ALTERNATIVES'),candidates,recipes,rules);gear.append(root);
function inspect(id){
 const item=db()[id];if(!item)return;
 selected=id;slot=item.slot||slot;
 panel.querySelector('.new-inventory-nav button')?.click();
 const search=document.getElementById('inventorySearch');if(search){search.value='';search.dispatchEvent(new Event('input'));}
 const filter=panel.querySelector('.pack-tools select');if(filter){filter.value=item.type;filter.dispatchEvent(new Event('change'));}
 const row=Array.from(panel.querySelectorAll('.inventory-item')).find(n=>n.dataset.packKey==='field:'+id);
 if(row){row.click();row.focus({preventScroll:true});row.scrollIntoView({block:'nearest'});}
 signature='';render();
}
function table(caption,headers,rows){const t=el('table');t.append(el('caption',caption));const head=el('thead'),tr=el('tr');headers.forEach(text=>{const th=el('th',text);th.scope='col';tr.append(th);});head.append(tr);t.append(head);const body=el('tbody');rows.forEach(values=>{const row=el('tr');values.forEach((value,i)=>{const cell=el(i===0?'th':'td',String(value));if(i===0)cell.scope='row';row.append(cell);});body.append(row);});t.append(body);return t;}
function render(){
 if(panel.hidden||!latest)return;
 const p=pack(),items=db(),equipped=p.equipment||{},current=items[equipped[slot]],candidate=items[selected]?.slot===slot?items[selected]:current;
 const living=latest.gameState.livingWorld,forge=living?.epoch===epoch(latest.gameState)?Math.min(3,count(living.forge)):0;
 const mode=latest.gameState.respawnSettings?.difficulty||'hard',multiplier=({easy:.5,normal:1,hard:2,nightmare:3})[mode]||2;
 const key=JSON.stringify([slot,selected,p.bag,equipped,forge,mode,latest.player.hp,latest.player.maxHp,latest.gameState.outsideWorld?.resources]);
 if(key===signature)return;signature=key;
 tabButtons.weapon.setAttribute('aria-pressed',String(slot==='weapon'));tabButtons.armor.setAttribute('aria-pressed',String(slot==='armor'));
 summary.replaceChildren(el('h3',candidate?candidate.name.toUpperCase():'EMPTY '+slot.toUpperCase()),el('p',candidate?.description||'Select a carried item below to inspect its capabilities.'));
 if(candidate){const reserved=Object.values(equipped).filter(id=>id===candidate.id).length;summary.append(el('p',count(p.bag?.[candidate.id])+' owned · '+reserved+' equipped · '+Math.max(0,count(p.bag?.[candidate.id])-reserved)+' available for recipes'));}
 comparison.replaceChildren();
 if(slot==='weapon'){
  const before=Number(current?.bonus)||0,after=Number(candidate?.bonus)||0;
  comparison.append(table('Attack calculation',['Source','Active','Selected'],[['Basic attack',2,2],['Weapon bonus',before,after],['Blade upgrade',forge,forge],['Total damage',2+before+forge,2+after+forge]]));
  const damage=2+after+forge;
  comparison.append(el('p','Against 8 / 20 / 40 HP: '+[8,20,40].map(hp=>Math.ceil(hp/damage)).join(' / ')+' hits. Assumes every attack connects; retaliation still occurs.','gd-note'));
 }else{
  const before=Number(current?.armor)||0,after=Number(candidate?.armor)||0;
  comparison.append(table('Incoming damage · '+mode+' ×'+multiplier,['Base hit','Active','Selected'],[1,3,5,8,12].map(hit=>[hit,Math.max(1,hit-before)*multiplier,Math.max(1,hit-after)*multiplier])));
  comparison.append(el('p','Surviving-hit estimates. Armor is subtracted once from combined damage, not once per creature. See the lethal-hit limitation below.','gd-note'));
 }
 candidates.replaceChildren();
 const stat=slot==='weapon'?'bonus':'armor',owned=Object.values(items).filter(i=>i.slot===slot&&count(p.bag?.[i.id])>0).sort((a,b)=>(Number(b[stat])||0)-(Number(a[stat])||0)||a.name.localeCompare(b.name));
 for(const item of owned){const value=Number(item[stat])||0,delta=value-(Number(current?.[stat])||0),active=item.id===equipped[slot];const b=button(item.name,()=>inspect(item.id));b.className='gd-choice';b.setAttribute('aria-pressed',String(item.id===candidate?.id));b.append(el('span',(active?'EQUIPPED · ':'')+(slot==='weapon'?'Damage +':'Armor ')+value+' · '+count(p.bag[item.id])+' owned'),el('span',active?'Current loadout':(delta>0?'+':'')+delta+' versus active',delta>0?'gd-positive':delta<0?'gd-negative':''));candidates.append(b);}
 if(!owned.length)candidates.append(el('p','No '+(slot==='weapon'?'weapons':'armor')+' in the field pack yet. Collect caches or craft equipment.'));
 recipeBody.replaceChildren();
 const related=(window.GulchItemCatalog?.recipes||[]).filter(r=>candidate&&(r.input[candidate.id]||r.output[candidate.id]));
 for(const recipe of related){
  recipeBody.append(el('h3',recipe.name));const list=el('ul');
  for(const [id,needed] of Object.entries(recipe.input)){
   const outdoor=id.startsWith('$'),available=outdoor?count(latest.gameState.outsideWorld?.resources?.[id.slice(1)]):Math.max(0,count(p.bag?.[id])-Object.values(equipped).filter(v=>v===id).length);
   list.append(el('li',(outdoor?id.slice(1):items[id]?.name||id)+' · '+available+' / '+needed+(available<needed?' · need '+(needed-available):' · ready'),available<needed?'gd-negative':'gd-positive'));
  }
  recipeBody.append(list,el('p','Produces '+Object.entries(recipe.output).map(([id,n])=>n+' × '+(items[id]?.name||id)).join(', ')));
  recipeBody.append(button('View recipe',()=>{panel.querySelectorAll('.new-inventory-nav button')[1]?.click();const select=document.getElementById('ecosystemRecipe');if(select){select.value=recipe.id;select.dispatchEvent(new Event('change'));select.focus();select.scrollIntoView({block:'nearest'});}}));
 }
 if(!related.length)recipeBody.append(el('p',candidate?'No crafting recipe uses or produces this item. Find it through exploration or enemy treasure.':'Select an item to see its recipes.'));
}
panel.addEventListener('click',event=>{const row=event.target instanceof Element?event.target.closest('[data-pack-key]'):null;if(!row)return;const key=row.dataset.packKey||'',item=key.startsWith('field:')?db()[key.slice(6)]:null;if(item?.slot){selected=item.id;slot=item.slot;render();}});
function schedule(){if(scheduled||panel.hidden)return;scheduled=true;queueMicrotask(()=>{scheduled=false;render();});}
new MutationObserver(schedule).observe(panel,{attributes:true,attributeFilter:['hidden','data-inventory-page']});
Gulch.register('detailed-gear-dossier',{snapshot(s){const reset=latest&&epoch(latest.gameState)!==epoch(s.gameState);latest=s;if(reset){selected=null;signature='';}render();}});
})();
