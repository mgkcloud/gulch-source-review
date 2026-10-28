(function(){
'use strict';
const catalog=window.GulchItemCatalog,items=catalog.items,recipes=catalog.recipes,baseCommit=Gulch.commit;
const KEY='itemEcosystem',MAX=999;
let snapshot=null,pending=null;
function epoch(data){return String(data.respawnSettings?.token||'original');}
function count(value){return Number.isFinite(value)?Math.max(0,Math.min(MAX,Math.floor(value))):0;}
function state(data){const old=data[KEY];if(!old||old.epoch!==epoch(data))return {epoch:epoch(data),bag:{},equipment:{},known:[],crafted:[],log:[]};return {epoch:old.epoch,bag:{...old.bag},equipment:{...old.equipment},known:Array.isArray(old.known)?old.known.filter(id=>items[id]).slice(0,80):[],crafted:Array.isArray(old.crafted)?old.crafted.slice(0,80):[],log:Array.isArray(old.log)?old.log.slice(0,12):[]};}
function note(v,text){v.log=[text,...v.log].slice(0,12);}
function add(v,id,amount){if(!items[id])return 0;const before=count(v.bag[id]),after=Math.min(MAX,before+amount);v.bag[id]=after;if(!v.known.includes(id))v.known.push(id);return after-before;}
function hash(text){let n=2166136261;for(const c of text)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
function prey(e){return e.id!=='player'&&!e.isPlayer&&!e.playerId&&!e.ownerId&&!e.clientId&&!e.practiceTarget&&!e.loreSpeaker&&!e.swordQuestLandmark&&!e.itemId&&!e.ecosystemLoot&&(e.faction==='hostile'||e.kind==='animal')&&Number.isFinite(e.hp)&&e.hp>0;}
function loot(e,data){
 const n=hash(epoch(data)+':'+e.id),identity=[e.name,e.kind,e.species,e.caveSprite].join(' ').toLowerCase(),result={};
 const put=(id,amount)=>{result[id]=(result[id]||0)+amount;};
 if(/beetle|crab|shell/.test(identity)){put('chitin',2+n%3);put('ichor',1);}
 else if(/wisp|electric|spark/.test(identity)){put('spark',2+n%2);put('spore',1);}
 else if(/crawler|worm|slime|ooze/.test(identity)){put('ichor',2+n%3);put('fiber',1+n%2);}
 else if(/deer|rabbit|sheep|fox|animal|rat/.test(identity)){put('hide',1+n%3);put('bone',1+n%2);put('fiber',1);}
 else {put('scrap',2+n%3);put('fiber',1);put('bone',1);}
 if(n%4===0)put('scrap',2);
 if(n%5===0)put('relic',1);
 if(n%7===0)put('salve',1);
 if(n%11===0)put('chitin_fine',1);
 return result;
}
function drops(data,before){
 let v=state(data),entities=data.seed.entities.slice();
 const oldState=state(before),weapon=items[oldState.equipment.weapon],armor=items[oldState.equipment.armor];
 const old=new Map(before.seed.entities.map(e=>[e.id,e]));
 const turnAdvanced=Number(data.turn)>Number(before.turn);
 if(turnAdvanced){
  entities=entities.map(e=>{
   const prev=old.get(e.id);
   if(!prev)return e;
   if(e.id==='player'&&armor?.armor&&Number.isFinite(e.hp)&&e.hp<prev.hp)return {...e,hp:Math.max(0,prev.hp-Math.max(1,prev.hp-e.hp-armor.armor))};
   if(weapon?.bonus&&prey(prev)&&e.faction==='hostile'&&Number.isFinite(e.hp)&&e.hp<prev.hp)return {...e,hp:Math.max(0,e.hp-weapon.bonus)};
   return e;
  });
 }
 const next=new Map(entities.map(e=>[e.id,e])),maps=new Set(data.seed.maps.map(m=>m.id));
 const defeated=before.seed.entities.filter(e=>prey(e)&&maps.has(e.map)&&(!next.has(e.id)||next.get(e.id).hp<=0));
 if(!turnAdvanced||!defeated.length)return {...data,seed:{...data.seed,entities:entities.filter(e=>!old.has(e.id)||!prey(old.get(e.id))||e.hp>0)}};
 const ids=new Set(entities.map(e=>e.id));
 for(const e of defeated){
  entities=entities.filter(n=>n.id!==e.id);
  const contents=loot(e,data),at=entities.find(n=>n.ecosystemLoot&&n.map===e.map&&n.x===e.x&&n.y===e.y);
  if(at){entities=entities.map(n=>{if(n.id!==at.id)return n;const merged={...n.contents};for(const [id,amount] of Object.entries(contents))merged[id]=Math.min(MAX,count(merged[id])+amount);return {...n,contents:merged};});}
  else{
   const piles=entities.filter(n=>n.ecosystemLoot);
   if(piles.length>=48){for(const [id,amount] of Object.entries(contents))add(v,id,amount);note(v,'Field pack recovered '+e.name+' loot; ground cache limit reached.');continue;}
   let id='loot:'+e.id;while(ids.has(id))id+='x';ids.add(id);
   entities.push({id,name:'Remains of '+(e.name||'creature'),kind:'loot',map:e.map,x:e.x,y:e.y,glyph:'♦',color:'#e8cb85',ecosystemLoot:true,contents});
  }
  note(v,'Loot left by '+(e.name||'a creature')+'.');
 }
 return {...data,seed:{...data.seed,entities},[KEY]:v};
}
Gulch.commit=function(data,activity){
 if(!snapshot||!data?.seed)return baseCommit(data,activity);
 if(epoch(data)!==epoch(snapshot.gameState)){const next={...data};delete next[KEY];return baseCommit(next,activity);}
 const next=drops(data,snapshot.gameState);
 if(new TextEncoder().encode(JSON.stringify(next)).length>350000){message.textContent='Item update exceeds the shared world size limit. No action was submitted.';pending=null;return;}
 return baseCommit(next,activity);
};
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
function button(text,fn){const b=el('button',text);b.type='button';b.addEventListener('click',fn);return b;}
const style=el('style');style.textContent='#itemWorkshop{flex:0 1 44%;min-height:90px;overflow:auto;border-top:1px solid #718365;padding:10px 16px;background:#102623}#itemWorkshop summary{cursor:pointer;color:#f0d39c;padding:5px;font-weight:bold}#itemWorkshop p{font-size:11px;line-height:1.6;margin:7px 0}#itemWorkshop select{max-width:100%;width:100%;background:#09201d;color:#e1e6cd;padding:8px;border:1px solid #69836b;font:12px monospace}#itemWorkshop .item-tools{display:flex;flex-wrap:wrap;gap:7px;margin:8px 0}#itemWorkshop button{min-height:38px}#itemWorkshop button:disabled{opacity:.45;cursor:default}#itemWorkshop .item-columns{display:grid;grid-template-columns:1fr 1fr;gap:16px}#itemWorkshop label{display:block;font-size:11px;margin:6px 0}#itemWorkshop output{display:block;white-space:pre-wrap;font-size:11px;margin:8px 0}#itemWorkshop details details{margin:8px 0}#itemWorkshop ul{font-size:11px;line-height:1.6;padding-left:18px}@media(max-width:600px){#itemWorkshop .item-columns{grid-template-columns:1fr}#itemWorkshop{padding:8px;flex-basis:48%}}';document.head.append(style);
const panel=el('details');panel.id='itemWorkshop';panel.open=true;panel.append(el('summary','LOOT · CRAFTING · ITEM DATABASE'));
const intro=el('p','A shared field pack for creature parts, old-world salvage and crafted gear. Inspired by Qud’s scavenging and tinkering; this is an original catalog, not its complete official database. Gear bonuses stack with Living World blade upgrades.');
const message=el('p','Open a cache beside you to collect creature drops.');message.setAttribute('role','status');
const lootButton=button('Collect nearby loot',collect),tools=el('div');tools.className='item-tools';tools.append(lootButton);
const columns=el('div');columns.className='item-columns';const left=el('div'),right=el('div');
const itemSelect=el('select');itemSelect.id='ecosystemItem';const itemLabel=el('label','Field pack / item database');itemLabel.htmlFor=itemSelect.id;
const recipeSelect=el('select');recipeSelect.id='ecosystemRecipe';const recipeLabel=el('label','Recipes and merging');recipeLabel.htmlFor=recipeSelect.id;
const itemInfo=el('output'),recipeInfo=el('output'),equipment=el('p'),resources=el('p');
const use=button('Use / equip',useItem),unequip=button('Unequip selected slot',unequipItem),craft=button('Craft one batch',craftItem);
const itemActions=el('div');itemActions.className='item-tools';itemActions.append(use,unequip);
left.append(itemLabel,itemSelect,itemInfo,itemActions,equipment);right.append(recipeLabel,recipeSelect,recipeInfo,craft,resources);columns.append(left,right);
const history=el('details'),historyList=el('ul');history.append(el('summary','Item chronicle'),historyList);
panel.append(intro,tools,columns,message,history);document.getElementById('inventoryPanel').append(panel);
Object.values(items).forEach(item=>{const o=el('option',item.name);o.value=item.id;itemSelect.append(o);});
recipes.forEach(r=>{const o=el('option',r.name);o.value=r.id;recipeSelect.append(o);});
function active(){const m=window.GulchMovementState;return snapshot&&snapshot.player.hp>0&&m?.focused&&!m.inFlight&&!pending&&!['respawnScreen','livingPanel','characterPanel','questBoard','workBoard'].some(id=>{const n=document.getElementById(id);return n&&!n.hidden;});}
function available(v,data,id){return id.startsWith('$')?count(data.outsideWorld?.resources?.[id.slice(1)]):Math.max(0,count(v.bag[id])-Object.values(v.equipment).filter(e=>e===id).length);}
function label(id){return id.startsWith('$')?id.slice(1)+' (outdoor pack)':items[id]?.name||id;}
function near(){if(!snapshot)return [];const p=snapshot.player,map=snapshot.seed.maps.find(m=>m.id===p.map);return snapshot.seed.entities.filter(e=>e.ecosystemLoot&&e.map===p.map&&Math.abs(e.x-p.x)+Math.abs(e.y-p.y)<=1&&Boolean(map.ascii[e.y]?.[e.x]));}
function submit(data,text){if(!active())return;pending={base:snapshot.stateRevision,text};message.textContent='Waiting for shared confirmation…';Gulch.commit(data,text);render();}
function collect(){
 if(!active())return;
 const piles=near();if(!piles.length){message.textContent='Stand on or directly beside a loot cache.';return;}
 const v=state(snapshot.gameState),remaining=new Map();let total=0;
 for(const pile of piles){const contents={};for(const [id,n] of Object.entries(pile.contents||{})){const amount=count(n),taken=add(v,id,amount);total+=taken;if(amount>taken)contents[id]=amount-taken;}remaining.set(pile.id,contents);}
 if(!total){message.textContent='These stacks are full (999 per item). Craft or consume items first.';return;}
 const entities=snapshot.seed.entities.flatMap(e=>{if(!remaining.has(e.id))return [e];const contents=remaining.get(e.id);return Object.keys(contents).length?[{...e,contents}]:[];});
 note(v,'Collected '+total+' item units.');submit({...snapshot.gameState,seed:{...snapshot.seed,entities},[KEY]:v},'Collected '+total+' creature loot items.');
}
function craftItem(){
 if(!active())return;const r=recipes.find(r=>r.id===recipeSelect.value),v=state(snapshot.gameState);if(!r)return;
 if(Object.entries(r.input).some(([id,n])=>available(v,snapshot.gameState,id)<n)){message.textContent='Missing ingredients. Equipped items must be unequipped before merging.';return;}
 if(Object.entries(r.output).some(([id,n])=>count(v.bag[id])+n>MAX)){message.textContent='Output stack would exceed 999.';return;}
 const stock={...snapshot.gameState.outsideWorld?.resources};
 for(const [id,n] of Object.entries(r.input)){if(id.startsWith('$'))stock[id.slice(1)]=count(stock[id.slice(1)])-n;else v.bag[id]=count(v.bag[id])-n;}
 for(const [id,n] of Object.entries(r.output))add(v,id,n);
 if(!v.crafted.includes(r.id))v.crafted.push(r.id);note(v,r.name+'.');
 const data={...snapshot.gameState,[KEY]:v};if(Object.keys(r.input).some(id=>id.startsWith('$')))data.outsideWorld={...data.outsideWorld,resources:stock};
 submit(data,'Crafted: '+r.name+'.');
}
function useItem(){
 if(!active())return;const item=items[itemSelect.value],v=state(snapshot.gameState);if(!item||!count(v.bag[item.id]))return;
 let seed=snapshot.seed;
 if(item.slot){v.equipment[item.slot]=item.id;note(v,'Equipped '+item.name+'.');}
 else if(item.heal){const p=snapshot.player;if(!Number.isFinite(p.maxHp)||p.hp>=p.maxHp)return;v.bag[item.id]=count(v.bag[item.id])-1;seed={...seed,entities:seed.entities.map(e=>e.id==='player'?{...e,hp:Math.min(e.maxHp,e.hp+item.heal)}:e)};note(v,'Used '+item.name+'.');}
 else return;
 submit({...snapshot.gameState,seed,[KEY]:v},(item.slot?'Equipped ':'Used ')+item.name+'.');
}
function unequipItem(){if(!active())return;const item=items[itemSelect.value],v=state(snapshot.gameState);if(!item?.slot||!v.equipment[item.slot])return;delete v.equipment[item.slot];submit({...snapshot.gameState,[KEY]:v},'Unequipped '+item.slot+'.');}
function render(){
 if(!snapshot||document.getElementById('inventoryPanel').hidden)return;
 const v=state(snapshot.gameState),item=items[itemSelect.value],r=recipes.find(r=>r.id===recipeSelect.value);
 for(const o of itemSelect.options){const i=items[o.value];const text=i.name+' · '+count(v.bag[i.id])+(v.known.includes(i.id)?'':' · undiscovered');if(o.textContent!==text)o.textContent=text;}
 itemInfo.textContent=item.type+' · '+item.description+'\nOwned: '+count(v.bag[item.id])+' · available for crafting: '+available(v,snapshot.gameState,item.id);
 equipment.textContent='Equipped: '+['weapon','armor'].map(slot=>slot+' — '+(items[v.equipment[slot]]?.name||'none')).join(' · ');
 recipeInfo.textContent='Requires:\n'+Object.entries(r.input).map(([id,n])=>label(id)+': '+available(v,snapshot.gameState,id)+' / '+n).join('\n')+'\nCreates: '+Object.entries(r.output).map(([id,n])=>n+' × '+label(id)).join(', ')+(v.crafted.includes(r.id)?'\nPreviously crafted.':'\nRecipe available to discover by crafting.');
 resources.textContent='Crafting and consumables do not advance turns. Equipped components are reserved. Outdoor resources are spent directly from the existing shared pack.';
 const ready=active();use.textContent=item.slot?'Equip '+item.type:item.heal?'Use · restore '+item.heal+' HP':'Material / relic';
 use.disabled=!ready||!count(v.bag[item.id])||(!item.slot&&!item.heal)||(Boolean(item.heal)&&snapshot.player.hp>=snapshot.player.maxHp);
 unequip.disabled=!ready||!item.slot||!v.equipment[item.slot];
 craft.disabled=!ready||Object.entries(r.input).some(([id,n])=>available(v,snapshot.gameState,id)<n)||Object.entries(r.output).some(([id,n])=>count(v.bag[id])+n>MAX);
 const piles=near();lootButton.disabled=!ready||!piles.length;lootButton.textContent=piles.length?'Collect '+piles.length+' nearby loot caches':'Stand beside a creature loot cache';
 historyList.replaceChildren(...v.log.map(text=>el('li',text)));
}
itemSelect.addEventListener('change',render);recipeSelect.addEventListener('change',render);
Gulch.register('item-ecosystem',{snapshot(s){snapshot=s;if(pending&&pending.base!==s.stateRevision){pending=null;message.textContent='Room updated. Check your item counts and equipment; concurrent changes may have won.';}render();},action(a){if(a?.type==='collect-loot')collect();}});
new MutationObserver(render).observe(document.getElementById('inventoryPanel'),{attributes:true,attributeFilter:['hidden']});
setInterval(()=>{if(!document.hidden)render();},500);
})();
