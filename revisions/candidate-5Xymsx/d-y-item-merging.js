(function(){
'use strict';
const base=window.GulchItemCatalog;if(!base)return;
const items={...base.items};
const definitions=[
 ['merge_twinfang','Twinfang Saber','Weapon',60,2,{slot:'weapon',bonus:5},'Two humble edges reforged into a balanced hunting saber.'],
 ['merge_emberglass','Emberglass Blade','Weapon',95,2,{slot:'weapon',bonus:7},'Steel threaded with bottled emberglass.'],
 ['merge_moonwell','Moonwell Elixir','Consumable',60,2,{heal:28},'Two field remedies distilled into one potent healing elixir.'],
 ['merge_starcutter','Starcutter','Weapon',250,3,{slot:'weapon',bonus:11},'Twinfang steel and a prismatic edge united beneath three binding runes.'],
 ['merge_dawnheart','Dawnheart Elixir','Consumable',180,3,{heal:55},'Moonwell essence stabilized with a vitality tonic.'],
 ['merge_crownless','Crownless Dawn','Weapon',650,4,{slot:'weapon',bonus:19},'A legendary blade forged from starlight and resonance, sworn to no throne.']
];
for(const [id,name,type,craftValue,rarityRank,stats,lore] of definitions){
 items[id]=Object.freeze({id,name,type,craftValue,rarityRank,rarity:['Common','Uncommon','Rare','Epic','Legendary'][rarityRank],glyph:type==='Weapon'?'⚔':'✚',...stats,lore,description:lore+' '+(stats.bonus?'Adds '+stats.bonus+' damage to sword and bump attacks.':'Restores '+stats.heal+' HP.')+' Created through the Merge Items rune forge.'});
}
const recipes=[
 {id:'twinfang',input:['scrap_knife','bone_spear'],output:'merge_twinfang'},
 {id:'emberglass',input:['iron_blade','fire_vial'],output:'merge_emberglass'},
 {id:'moonwell',input:['salve','salve'],output:'merge_moonwell'},
 {id:'starcutter',input:['merge_twinfang','crystal_blade'],output:'merge_starcutter'},
 {id:'dawnheart',input:['merge_moonwell','tonic'],output:'merge_dawnheart'},
 {id:'crownless',input:['merge_starcutter','resonance_blade'],output:'merge_crownless'}
];
window.GulchItemCatalog=Object.freeze({items:Object.freeze(items),recipes:base.recipes});
window.GulchMergeRecipes=Object.freeze(recipes.map(r=>Object.freeze({...r,input:Object.freeze(r.input)})));
})();

(function(){
'use strict';
const KEY='freeformForge',VERSION=1;
const letters=['Z','Y','X','W','V','U','T','R','Q','P','O','N','M','L','K','J','I','H','G','F','E','D','C','B','A','S'];
const triggers=['Trail','Crosswind','Duel','Defiance','Last Light','Heartbeat'];
const triggerText=['after moving one tile','after moving diagonally','after a nearby melee hit','after losing health','on a played turn while at or below half health','on any played turn'];
const effects=['Renewal','Needle','Shelter','Nova'];
const rhythms=['Quick','Steady','Deep','Grand'];
let latest=null,stats=null,notice=null;
const epoch=d=>String(d?.respawnSettings?.token||'original');
function hash(text){let h=2166136261;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619);h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);return (h^(h>>>16))>>>0;}
function forge(d){return d?.[KEY]?.epoch===epoch(d)?d[KEY]:null;}
function pack(d){return d?.itemEcosystem?.epoch===epoch(d)?d.itemEcosystem:null;}
function hostile(e){return e&&e.id!=='player'&&e.faction==='hostile'&&Number.isFinite(e.hp)&&e.hp>0&&!e.practiceTarget&&!e.isPlayer&&!e.playerId&&!e.ownerId&&!e.clientId&&!e.loreSpeaker&&!e.swordQuestLandmark&&!e.ecosystemLoot&&e.itemId==null&&!/item|loot|prop|resource|weapon|armor/i.test(e.kind||'');}
function active(d){
 const f=forge(d),p=pack(d),used=new Set(),result=[];
 if(!f||!p)return result;
 for(const id of (f.grid||[]).slice(0,9)){
  const item=f.definitions?.[id];
  if(!item||used.has(id)||!(Number(p.bag?.[id])>0)||item.fusionPower?.version!==VERSION)continue;
  used.add(id);result.push(item);
 }
 return result;
}
function describe(power){
 const effect=power.effect===0?'Restore up to '+power.strength+' HP':power.effect===1?'Deal '+power.strength+' damage to the nearest visible hostile within 3 tiles':power.effect===2?'Prevent up to '+power.strength+' health loss from this turn, leaving at least 1':'Deal '+power.strength+' damage to each visible hostile within 2 tiles';
 return power.title+': '+effect+' '+triggerText[power.trigger]+'. Recharges for '+power.cooldown+' played turns after an effective activation. Walls block damage. Requires surviving the turn; cannot revive you.';
}
function upgrade(data){
 const f=forge(data);if(!f?.definitions)return data;
 const entries=Object.entries(f.definitions),used=new Set();
 for(const [,item] of entries)if(item.fusionPower?.version===VERSION&&Number.isInteger(item.fusionPower.profile))used.add(item.fusionPower.profile);
 let changed=false;const definitions={...f.definitions};
 for(const [id,item] of entries){
  if(item.fusionPower?.version===VERSION)continue;
  if(used.size>=96)break;
  let profile=hash(epoch(data)+':passive:'+id)%96;
  while(used.has(profile))profile=(profile+1)%96;
  used.add(profile);
  const trigger=Math.floor(profile/16),effect=Math.floor(profile%16/4),rhythm=profile%4;
  const index=hash(epoch(data)+':rank:'+id)%letters.length,letter=letters[index];
  const strength=(index+1)*(rhythm+1),cooldown=[2,4,6,8][rhythm];
  const title=triggers[trigger]+' '+effects[effect]+' · '+rhythms[rhythm];
  const power={version:VERSION,kind:'ranked-passive',profile,trigger,effect,strength,cooldown,title};
  const skill=describe(power),value=(index+1)*25;
  const color=index===25?'#fff0b2':index>=22?'#ffd482':index>=16?'#c2adff':index>=8?'#85cfee':'#bdd0b3';
  definitions[id]={...item,freeformFusion:true,fusionPower:power,craftValue:value,letterTier:{letter,index,color,value,baseValue:value,skill},description:(item.lore||'A creation born from two travelers’ possessions.')+'\nRANDOM TIER '+letter+' · Value '+value+' · Generation '+(item.fusionGeneration||1)+'\n'+skill+'\nActive only in the shared 3 × 3 power grid. Waiting creations grant no powers.'};
  changed=true;
 }
 return changed?{...data,[KEY]:{...f,definitions}}:data;
}
function clear(seed,map,a,b){
 if(!map)return false;
 const floor=(x,y)=>{const c=map.ascii[y]?.[x];return Boolean(c)&&!['#','~'].includes(c)&&!['wall','water'].includes(seed.legend[c]?.[0]);};
 let x=a.x,y=a.y,dx=Math.abs(b.x-x),dy=-Math.abs(b.y-y),sx=x<b.x?1:-1,sy=y<b.y?1:-1,error=dx+dy;
 for(let i=0;i<32;i++){
  if(x===b.x&&y===b.y)return true;
  const twice=2*error;let nx=x,ny=y;
  if(twice>=dy){error+=dy;nx+=sx;}if(twice<=dx){error+=dx;ny+=sy;}
  if(!floor(nx,ny)||(nx!==x&&ny!==y&&(!floor(nx,y)||!floor(x,ny))))return false;
  x=nx;y=ny;
 }
 return false;
}
function apply(data){
 if(!latest||epoch(data)!==epoch(latest.gameState)||!(Number(data.turn)>Number(latest.turn)))return {data,names:[]};
 const f=forge(data),before=latest.player,after=data.seed.entities.find(e=>e.id==='player');
 if(!f||!after||after.hp<=0||before.hp<=0||data.gulchPermanentGameOver?.ended||before.map!==after.map)return {data,names:[]};
 const map=data.seed.maps.find(m=>m.id===after.map),dx=after.x-before.x,dy=after.y-before.y;
 const moved=Math.max(Math.abs(dx),Math.abs(dy))===1;
 const proposed=new Map(data.seed.entities.map(e=>[e.id,e]));
 const melee=latest.seed.entities.some(e=>hostile(e)&&e.map===before.map&&Math.max(Math.abs(e.x-before.x),Math.abs(e.y-before.y))<=1&&clear(data.seed,map,before,e)&&(!proposed.has(e.id)||proposed.get(e.id).hp<e.hp));
 const lost=after.hp<before.hp;
 const conditions=[moved,moved&&dx!==0&&dy!==0,melee,lost,after.hp<=after.maxHp/2,true];
 let entities=data.seed.entities,ready={...f.gridReady},names=[];
 const previousActive=active(latest.gameState);
 for(const old of previousActive){
  const item=f.definitions[old.id];if(!item)continue;
  const power=item.fusionPower,turn=Number(data.turn);
  if(!conditions[power.trigger]||Math.max(Number(ready[item.id])||0,Number(f.readyTurn)||0)>turn)continue;
  const player=entities.find(e=>e.id==='player');let applied=false;
  if(power.effect===0&&Number.isFinite(player.maxHp)&&player.hp<player.maxHp){
   entities=entities.map(e=>e.id==='player'?{...e,hp:Math.min(e.maxHp,e.hp+power.strength)}:e);applied=true;
  }else if(power.effect===2){
   const saved=Math.min(power.strength,Math.max(0,before.hp-player.hp-1));
   if(saved>0){entities=entities.map(e=>e.id==='player'?{...e,hp:Math.min(e.maxHp,e.hp+saved)}:e);applied=true;}
  }else if(power.effect===1||power.effect===3){
   const range=power.effect===1?3:2,radius=Number(data.seed.meta?.fov?.radius)||8;
   let targets=entities.filter(e=>hostile(e)&&e.map===player.map&&Math.hypot(e.x-player.x,e.y-player.y)<=Math.min(range,radius+.5)&&clear(data.seed,map,player,e));
   targets.sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y)||String(a.id).localeCompare(String(b.id)));
   if(power.effect===1)targets=targets.slice(0,1);
   if(targets.length){const ids=new Set(targets.map(e=>e.id));entities=entities.map(e=>ids.has(e.id)?{...e,hp:Math.max(0,e.hp-power.strength)}:e);applied=true;}
  }
  if(applied){ready[item.id]=turn+power.cooldown;names.push(power.title);}
 }
 return names.length?{data:{...data,seed:{...data.seed,entities},[KEY]:{...f,gridReady:ready}},names}:{data,names};
}
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
function render(){
 if(!stats||!latest)return;
 const panel=document.getElementById('inventoryPanel');if(panel.hidden||panel.dataset.inventoryPage!=='merge')return;
 const f=forge(latest.gameState),activeItems=active(latest.gameState);
 const key=JSON.stringify([latest.revision,latest.stateRevision,activeItems]);if(stats.dataset.signature===key)return;stats.dataset.signature=key;
 stats.replaceChildren(el('h3','ACTIVE PASSIVE POWERS'));
 if(!activeItems.length)stats.append(el('p','Place a merged creation in the grid to activate its passive. Older creations receive their unique power on the next saved action.'));
 for(const item of activeItems){
  const power=item.fusionPower,remaining=Math.max(0,Math.max(Number(f.gridReady?.[item.id])||0,Number(f.readyTurn)||0)-(Number(latest.turn)||0));
  const article=el('article');article.append(el('strong',item.name+' · Tier '+item.letterTier.letter),el('p',describe(power)),el('small',latest.player.hp<=0?'Inactive after death':remaining?remaining+' turns until ready':'Ready'));
  stats.append(article);
 }
}
function mount(){
 const commit=Gulch.commit;
 Gulch.commit=function(data,activity,options){
  if(!data?.seed)return commit.call(this,data,activity,options);
  const upgraded=upgrade(data),result=apply(upgraded);
  const next=result.data;
  if(new TextEncoder().encode(JSON.stringify(next)).length>350000){
   if(notice)notice.textContent='Passive update exceeds shared world capacity. Nothing was submitted.';
   return;
  }
  return commit.call(this,next,(activity||'')+(result.names.length?' Passive powers: '+result.names.join(', ')+'.':''),options);
 };
 // The forge mounts later in the same load event.
 queueMicrotask(()=>{
  const root=document.getElementById('mergeForge');if(!root)return;
  const style=el('style');style.textContent='#fusionPowerStats{display:none!important}#rankedPassiveStats{margin:14px 0;padding:12px;border:1px solid #bea878;background:#0b1c22;color:#e5dfc9}#rankedPassiveStats h3{color:#ffe0a0}#rankedPassiveStats article{margin:8px 0;padding:10px}#rankedPassiveStats p{font-size:11px}';document.head.append(style);
  notice=el('p','Each confirmed merge rolls one equally likely tier in the existing order: '+letters.join(' → ')+'. S is highest. Rank is independent of ingredient value. The ingredient preview shows ancestry; the final random rank and power appear after confirmation.');notice.setAttribute('role','status');root.querySelector('h2')?.after(notice);
  const guide=el('p','Every creation receives a different trigger, effect and recharge profile within this expedition (96 unique profiles). Higher ranks strengthen the same profile: Z has 1× potency, A 25× and S 26×. Quick / Steady / Deep / Grand profiles trade 2 / 4 / 6 / 8 turn recharge for 1× / 2× / 3× / 4× strength. Shelter requires health loss; other triggers must also occur. Powers use confirmed played turns, never menu time. Duplicate copies activate only once.');notice.after(guide);
  stats=el('section');stats.id='rankedPassiveStats';stats.setAttribute('aria-label','Active merged passive effects');root.append(stats);
  new MutationObserver(render).observe(document.getElementById('inventoryPanel'),{attributes:true,attributeFilter:['hidden','data-inventory-page']});render();
 });
}
Gulch.register('ranked-unique-merge-passives',{snapshot(s){latest=s;render();}});
if(document.readyState==='complete')mount();else window.addEventListener('load',mount,{once:true});
})();
