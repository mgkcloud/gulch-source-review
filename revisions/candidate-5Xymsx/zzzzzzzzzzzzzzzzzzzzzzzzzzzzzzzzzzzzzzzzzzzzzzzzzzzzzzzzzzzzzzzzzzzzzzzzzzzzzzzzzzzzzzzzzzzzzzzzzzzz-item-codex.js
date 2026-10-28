(function(){
'use strict';
const panel=document.getElementById('inventoryPanel'),nav=panel?.querySelector('.new-inventory-nav');
if(!panel||!nav)return;
let latest=null,page='classes',selected='',signature='';
const epoch=d=>String(d?.respawnSettings?.token||'original');
const catalog=()=>window.GulchItemCatalog?.items||{};
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
function button(text,fn){const b=el('button',text);b.type='button';b.addEventListener('click',fn);return b;}
const style=el('style');style.textContent=`
#inventoryPanel[data-inventory-page=classes] .inventory-body,#inventoryPanel[data-inventory-page=codex] .inventory-body,#inventoryPanel[data-inventory-page=itemmap] .inventory-body,#inventoryPanel[data-inventory-page=classes] #itemWorkshop,#inventoryPanel[data-inventory-page=codex] #itemWorkshop,#inventoryPanel[data-inventory-page=itemmap] #itemWorkshop{display:none!important}
#itemArchive[hidden],#itemArchive [hidden]{display:none!important}
#itemArchive{flex:1;min-height:0;overflow:auto;padding:18px;color:#dce5d5;background:#0b2024;font:12px/1.65 monospace}
#itemArchive h2,#itemArchive h3{color:#f0d49d}#itemArchive h2{margin-top:0}#itemArchive p{max-width:850px}#itemArchive button,#itemArchive select,#itemArchive input{min-height:44px;padding:8px;background:#19342f;color:#e8dfc3;border:1px solid #708674;font:inherit;border-radius:4px}#itemArchive :focus-visible{outline:2px solid #ffe0a0;outline-offset:2px}
.ia-tools{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.ia-tools input{flex:1;min-width:120px}.ia-layout{display:grid;grid-template-columns:minmax(160px,40%) minmax(0,1fr);gap:16px}.ia-list{max-height:440px;overflow:auto;display:grid;gap:6px;align-content:start}#itemArchive .ia-list button{text-align:left;display:flex;gap:10px;align-items:center}#itemArchive .ia-list button[aria-pressed=true]{border-color:#f0d49d;background:#354b37}#itemArchive .ia-list .ia-locked{background:#111b20;border-color:#34443e;color:#78867c}.ia-art{display:grid;place-items:center;flex:0 0 36px;width:36px;height:36px;background:#09171b}.ia-art canvas{width:32px;height:32px;image-rendering:pixelated}.ia-detail{padding:14px;background:#10282a;border:1px solid #526f5e;min-width:0}.ia-detail p{white-space:pre-line;overflow-wrap:anywhere}.ia-detail blockquote{margin:12px 0;padding-left:12px;border-left:2px solid #b9a16c;font:16px/1.7 Georgia,serif;color:#cbd9c1}#itemClassTable{width:100%;border-collapse:collapse}#itemClassTable th,#itemClassTable td{text-align:left;padding:7px;border-bottom:1px solid #365447}#itemLocationMap{display:block;max-width:100%;height:auto;image-rendering:pixelated;background:#17211e;border:2px solid #8a8059}#itemArchive .ia-map-wrap{overflow:auto;max-height:430px}#itemMapLocations{padding-left:20px}#itemArchive .ia-rare{color:#ffe0a0}
@media(max-width:600px){#itemArchive{padding:10px}.ia-layout{grid-template-columns:1fr}.ia-list{max-height:230px}}
`;
document.head.append(style);
const root=el('section');root.id='itemArchive';root.hidden=true;panel.querySelector('.inventory-footer').before(root);
const classPage=el('section'),codexPage=el('section'),mapPage=el('section');root.append(classPage,codexPage,mapPage);
const tabs={};
for(const [id,label] of [['classes','Item Class'],['codex','Item Codex'],['itemmap','Item Map']]){
 const b=button(label,()=>open(id));b.setAttribute('aria-controls','itemArchive');b.setAttribute('aria-pressed','false');nav.append(b);tabs[id]=b;
}
function open(id){page=id;panel.dataset.inventoryPage=id;for(const b of nav.querySelectorAll('button[aria-pressed]'))b.setAttribute('aria-pressed','false');tabs[id].setAttribute('aria-pressed','true');sync();}
function sync(){const id=panel.dataset.inventoryPage;root.hidden=!Object.hasOwn(tabs,id);if(root.hidden){for(const b of Object.values(tabs))b.setAttribute('aria-pressed','false');return;}page=id;classPage.hidden=id!=='classes';codexPage.hidden=id!=='codex';mapPage.hidden=id!=='itemmap';render();}
classPage.append(el('h2','Item Class · Z → A → S'),el('p','Z is the lowest tier. Letters climb toward A, then S is the maximum. Tier measures an item’s original value and crafting investment. It is not its drop probability: a high tier does not by itself mean a lower spawn chance.'),el('p',window.GulchItemTiers?.order||'Z → Y → X → W → V → U → T → R → Q → P → O → N → M → L → K → J → I → H → G → F → E → D → C → B → A → S'),el('p','The current game has no separate U-to-S alphabetical sequence: S is reserved for the top rank, so the progression skips S between T and R. Quantities do not change tier.'));
const table=el('table');table.id='itemClassTable';table.append(el('caption','Tier thresholds · original comparison value'));
const head=el('thead'),hr=el('tr');for(const t of ['Tier','Minimum value'])hr.append(el('th',t));head.append(hr);table.append(head);
const letters=window.GulchItemTiers?.letters||[],thresholds=[0,2,3,4,5,6,8,10,12,15,18,22,28,35,45,55,70,90,115,145,180,225,280,350,450,600],tbody=el('tbody');letters.forEach((letter,i)=>{const tr=el('tr');tr.append(el('td',letter),el('td',String(thresholds[i])));tbody.append(tr);});table.append(tbody);
classPage.append(table,el('h3','What the tier changes'));
const rules=el('ul');for(const text of ['Weapons gain +1 melee bonus per six tier steps. I-tier and higher weapons unlock magic or strengthen an existing spell. Newly granted B/A/S spells have stronger profiles; S is the maximum.','Armor gains +1 protection per eight tier steps. Healing consumables gain +1 healing per three steps. Thrown consumables gain +1 blast damage per two steps.','Relative trade value rises by 8% per tier step, rounded up. Materials and relics gain value without passive combat powers.','The Item Codex shows final item statistics, including tier bonuses. Named sword spells and specialist bonuses remain conditional. Armor follows the existing hardcore lethal-hit rules.'])rules.append(el('li',text));classPage.append(rules);
codexPage.append(el('h2','Item Codex'));
const progress=el('p');progress.setAttribute('role','status');const tools=el('div');tools.className='ia-tools';const search=el('input');search.type='search';search.placeholder='Search discovered items';search.setAttribute('aria-label','Search discovered item names');const filter=el('select');filter.setAttribute('aria-label','Discovery filter');for(const [value,label] of [['all','Every item'],['known','Discovered'],['unknown','Undiscovered']]){const o=el('option',label);o.value=value;filter.append(o);}tools.append(search,filter);
const layout=el('div');layout.className='ia-layout';const list=el('div');list.className='ia-list';list.setAttribute('aria-label','All game items');const detail=el('article');detail.className='ia-detail';layout.append(list,detail);codexPage.append(progress,tools,layout);
mapPage.append(el('h2','Item Map'),el('p','Locations use the current shared world and explored terrain. Select a discovered item, or survey known rare items. Unexplored locations and undiscovered item identities stay concealed. These are current supplies and stock, not guaranteed future drops.'));
const mapTools=el('div');mapTools.className='ia-tools';const region=el('select'),itemSelect=el('select'),rareLabel=el('label'),rare=el('input');region.setAttribute('aria-label','Item map region');itemSelect.setAttribute('aria-label','Discovered item to locate');rare.type='checkbox';rareLabel.append(rare,document.createTextNode(' Rare / Epic / Legendary only'));mapTools.append(region,itemSelect,rareLabel);
const mapCaption=el('p'),canvas=el('canvas');canvas.id='itemLocationMap';canvas.setAttribute('role','img');const wrap=el('div');wrap.className='ia-map-wrap';wrap.append(canvas);const locations=el('ul');locations.id='itemMapLocations';const sourceText=el('p');mapPage.append(mapTools,mapCaption,wrap,locations,sourceText);
function model(){
 const all=new Map(Object.entries(catalog())),known=new Set(),data=latest?.gameState;
 if(!data)return {all,known};
 const token=epoch(data),pack=data.itemEcosystem?.epoch===token?data.itemEcosystem:null;
 for(const id of pack?.known||[])known.add(id);
 for(const [id,n] of Object.entries(pack?.bag||{}))if(Number(n)>0)known.add(id);
 for(const recipe of window.GulchItemCatalog?.recipes||[])if(pack?.crafted?.includes(recipe.id))for(const id of Object.keys(recipe.output))known.add(id);
 function definitions(source){if(!source||typeof source!=='object')return;for(const [key,v] of Object.entries(source))if(v&&typeof v==='object'){const id=String(v.itemId||v.id||key);if(!all.has(id))all.set(id,{...v,id,name:v.name||id});}}
 definitions(latest.seed.items);definitions(latest.seed.itemDefinitions);definitions(data.items);
 const raw=latest.player.inventory??data.inventory??latest.seed.inventory??[];
 for(const [key,value] of Object.entries(raw.items||raw)){
  if(value==null||value===false)continue;
  const v=typeof value==='object'?value:{},id=String(v.itemId||v.id||(typeof value==='string'?value:key));
  if(!all.has(id))all.set(id,{...v,id,name:v.name||id});
  if(Number(v.quantity??v.count??(typeof value==='number'?value:1))>0)known.add(id);
 }
 for(const e of latest.seed.entities)if(e.itemId||/^(item|weapon|armor|armour|consumable|material|relic)$/.test(e.kind||'')){const id=String(e.itemId||e.id);if(!all.has(id))all.set(id,{...e,id,name:e.name||id});}
 for(const id of ['wood','stone','copper','iron','crystal']){const key='$'+id;all.set(key,{id:key,name:id[0].toUpperCase()+id.slice(1),type:'Material',description:'Outdoor crafting resource. Recipes consume it directly from the shared resource pack.'});if(Number(data.outsideWorld?.resources?.[id])>0)known.add(key);}
 all.set('@herb',{id:'@herb',name:'Healing herbs',type:'Consumable',description:'Stored in Living world. Using an herb restores up to 6 HP and advances one enemy turn.'});
 all.set('@food',{id:'@food',name:'Provisions',type:'Consumable',description:'Stored in regional supplies. Eating restores up to 6 HP and advances one enemy turn.'});
 all.set('@key',{id:'@key',name:'Treasure key',type:'Key',description:'A universal key consumed when opening a ranked treasure chest.'});
 if(data.livingWorld?.epoch===token&&data.livingWorld.herbs>0)known.add('@herb');if(data.regionSupplies?.epoch===token&&data.regionSupplies.food>0)known.add('@food');if(data.rankedTreasure?.epoch===token&&(data.rankedTreasure.keys>0||data.rankedTreasure.opened>0))known.add('@key');
 return {all,known};
}
function tier(item){return item.letterTier||(!item.id.startsWith('@')&&!item.id.startsWith('$')?window.GulchItemTiers?.info(item):null);}
function lore(item){return item.lore||({Weapon:'The roadwardens judged a weapon by the journeys it helped someone finish. Each repaired edge carries a little of that quiet promise.',Armor:'A careful maker reinforced the places most likely to fail. The finest part of this protection is the hope that its wearer will return.',Consumable:'Packed against rain and hard miles, this small provision waits for the moment another step feels impossible.',Material:'A village craftsperson sees a future in this fragment: a repaired shelter, a useful tool, or a light above an open door.',Relic:'Its previous keeper left no account of the journey. The next chapter belongs to the traveler who carries it onward.',Key:'A small piece of worked metal, waiting for the lock that will turn a forgotten promise into a gift.'}[item.type]||'Recovered along the frontier, this object carries a story that has not yet reached its ending.');}
function source(item){
 if(item.id==='$wood'||item.id.startsWith('$'))return 'Gather outdoor deposits or seasonal supply patches. Current known patches appear on this map.';
 if(item.id==='@herb')return 'Wild silverleaf plants, seasonal herbs and exploration milestones.';
 if(item.id==='@food')return 'Berry bushes, edible mushrooms, provision patches and village harvest baskets.';
 if(item.id==='@key')return 'Keys accompany ranked treasure in eligible regions. New regions have a 10% ranked-treasure spawn chance; existing treasure is preserved.';
 const recipes=(window.GulchItemCatalog?.recipes||[]).filter(r=>r.output[item.id]);
 return (window.GulchRecipeBook?.source(item.id)||'Find this item through its existing expedition rules.')+(recipes.length?' Craft via: '+recipes.map(r=>r.name).join(' · ')+'.':'')+' Enemy rewards are random or creature-dependent. Unopened chests are not treated as confirmed item locations.';
}
function drawDetail(m){
 detail.replaceChildren();const item=m.all.get(selected);if(!item){detail.append(el('p','Select an entry. Shaded entries unlock when the shared expedition acquires or crafts that item.'));return;}
 if(!m.known.has(selected)){detail.append(el('h3','Undiscovered item'),el('p','Its identity, biography, lore and locations are concealed. Acquire or craft it during this expedition to reveal this entry.'));return;}
 const t=tier(item);detail.append(el('h3',item.name),el('p',(item.type||item.category||'Item')+(t?' · Tier '+t.letter:'')+(item.rarity?' · '+item.rarity:'')),el('h3','Item biography'),el('p',item.description||item.desc||'An item recovered during the shared expedition.'),el('h3','Frontier lore'),el('blockquote',lore(item)),el('p',source(item)),button('Locate this item',()=>{open('itemmap');itemSelect.value=selected;rare.checked=false;drawMap(model());}));
}
function renderList(m){
 const scroll=list.scrollTop,focus=document.activeElement?.dataset.codexId,q=search.value.trim().toLowerCase();list.replaceChildren();let unlocked=0,index=0;
 for(const [id,item] of m.all){index++;const known=m.known.has(id);if(known)unlocked++;if(filter.value==='known'&&!known||filter.value==='unknown'&&known||q&&(!known||!(item.name+' '+(item.type||'')).toLowerCase().includes(q)))continue;
  const b=button('',()=>{selected=id;for(const n of list.children)n.setAttribute('aria-pressed',String(n===b));drawDetail(m);});b.dataset.codexId=id;b.setAttribute('aria-pressed',String(id===selected));
  const art=el('span');art.className='ia-art';art.setAttribute('aria-hidden','true');
  if(known){window.GulchItemPresentation?.icon(art,item);if(!art.childNodes.length)art.textContent=item.glyph||'◇';}else{art.textContent='?';b.className='ia-locked';}
  b.append(art,el('span',known?item.name:'Undiscovered · '+String(index).padStart(3,'0')));list.append(b);
 }
 progress.textContent=unlocked+' / '+m.all.size+' entries discovered by the shared expedition. Discovery uses retained acquisition and crafting records; new expeditions reset it.';
 if(!list.children.length)list.append(el('p','No matching entries.'));list.scrollTop=scroll;if(focus)Array.from(list.children).find(n=>n.dataset.codexId===focus)?.focus({preventScroll:true});drawDetail(m);
}
function options(select,rows){const value=select.value;select.replaceChildren(...rows.map(([id,label])=>{const o=el('option',label);o.value=id;return o;}));if(rows.some(r=>r[0]===value))select.value=value;}
function charted(map,x,y){if(!Number.isInteger(x)||!Number.isInteger(y)||!map.ascii[y]?.[x])return false;if(map.id===latest.mapId&&latest.lit[y]?.[x]===1)return true;const api=window.GulchCartographyEffects;if(!api)return false;const record=api.memory(latest.gameState)[map.id];return Boolean(record&&api.seen(api.read(map,record),api.shape(map).w,x,y));}
function mapOptions(m){const maps=latest.seed.maps.filter(map=>map.id===latest.mapId||Boolean(window.GulchCartographyEffects?.memory(latest.gameState)[map.id]));options(region,maps.map(v=>[v.id,v.name||v.id]));if(!region.value)region.value=latest.mapId;options(itemSelect,[['','All discovered items'],...Array.from(m.all).filter(([id])=>m.known.has(id)).map(([id,i])=>[id,i.name])]);}
function drawMap(m){
 if(!latest)return;const map=latest.seed.maps.find(v=>v.id===region.value);if(!map)return;
 const w=Math.max(1,...map.ascii.map(r=>r.length)),h=map.ascii.length,u=Math.max(1,Math.min(9,Math.floor(760/w))),pad=14;cSize(w*u+pad*2,h*u+pad*2);
 const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;c.fillStyle='#17211e';c.fillRect(0,0,canvas.width,canvas.height);
 for(let y=0;y<h;y++)for(let x=0;x<map.ascii[y].length;x++){if(!charted(map,x,y))continue;const ch=map.ascii[y][x],kind=latest.seed.legend[ch]?.[0];c.fillStyle=kind==='wall'||ch==='#'?'#596054':kind==='water'||ch==='~'?'#507b88':'#aaa77a';c.fillRect(pad+x*u,pad+y*u,u,u);}
 const found=[];function add(e,id,n,merchant){const item=m.all.get(id);if(!item||!m.known.has(id)||!(Number(n)>0)||itemSelect.value&&itemSelect.value!==id||rare.checked&&!(Number(item.rarityRank)>=2))return;found.push({e,item,n,merchant});}
 const market=latest.gameState.merchantBarter,validMarket=market?.epoch===epoch(latest.gameState);
 for(const e of latest.seed.entities){if(e.map!==map.id||!charted(map,e.x,e.y))continue;
  if(e.ecosystemLoot)for(const [id,n] of Object.entries(e.contents||{}))add(e,id,n,false);
  else if(e.treasureKey)add(e,'@key',1,false);
  else if(e.regionFood)add(e,'@food',e.quantity||1,false);
  else if(e.livingResource==='herb')add(e,'@herb',e.quantity||1,false);
  else if(e.outsideResource||e.livingResource)add(e,'$'+(e.outsideResource||e.livingResource),e.quantity||1,false);
  else if(e.itemId||/^(item|weapon|armor|armour|consumable|material|relic)$/.test(e.kind||''))add(e,e.itemId||e.id,e.quantity||1,false);
  if(validMarket)for(const [id,n] of Object.entries(market.vendors?.[e.id]?.stock||{}))add(e,id,n,true);
 }
 const groups=new Map();for(const row of found){const key=row.e.x+','+row.e.y;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
 locations.replaceChildren();let marker=0;
 for(const rows of groups.values()){marker++;const e=rows[0].e,x=pad+(e.x+.5)*u,y=pad+(e.y+.5)*u,isRare=rows.some(r=>Number(r.item.rarityRank)>=2);c.fillStyle=isRare?'#ffe091':'#8be0cd';c.fillRect(x-4,y-4,8,8);c.strokeStyle='#18251f';c.strokeRect(x-4,y-4,8,8);if(u>=5){c.fillStyle='#10231b';c.font='bold 9px monospace';c.textAlign='center';c.fillText(String(marker),x,y+3);}
  const li=el('li',marker+'. '+e.x+', '+e.y+' · '+(rows[0].merchant?'Merchant '+e.name:'Ground supply')+' · '+rows.map(r=>r.item.name+' ×'+r.n+(Number(r.item.rarityRank)>=2?' ['+r.item.rarity+']':'')).join('; '));if(isRare)li.className='ia-rare';locations.append(li);
 }
 if(latest.mapId===map.id){const p=latest.player;c.strokeStyle='#fff';c.lineWidth=2;c.strokeRect(pad+p.x*u-2,pad+p.y*u-2,u+4,u+4);}
 if(!found.length)locations.append(el('li','No matching known supplies on explored terrain in this region. Try another charted region, a merchant, crafting or further exploration.'));
 mapCaption.textContent=(map.name||map.id)+' · '+groups.size+' known locations. Gold: Rare/Epic/Legendary stock or loot. Teal: other supplies. White outline: you. Dark: unexplored.';canvas.setAttribute('aria-label',mapCaption.textContent+' Coordinates and contents are listed below.');
 const selectedItem=m.all.get(itemSelect.value);sourceText.textContent=selectedItem?source(selectedItem):'Rare means the catalog’s Rare, Epic or Legendary rarity labels; letter tiers are explained in Item Class. Locations reflect retained maps only. Regenerated frontier regions can contain different supplies; no rare drop or unopened chest reward is guaranteed here.';
}
function cSize(w,h){if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}}
function render(){if(panel.hidden||root.hidden)return;const m=model();if(page==='codex')renderList(m);if(page==='itemmap'){mapOptions(m);drawMap(m);}}
search.addEventListener('input',()=>renderList(model()));filter.addEventListener('change',()=>renderList(model()));for(const n of [region,itemSelect,rare])n.addEventListener('change',()=>drawMap(model()));
new MutationObserver(sync).observe(panel,{attributes:true,attributeFilter:['hidden','data-inventory-page']});
Gulch.register('item-class-codex-map',{snapshot(s){latest=s;const key=s.revision+':'+s.stateRevision;if(signature!==key){signature=key;render();}}});
sync();
})();
