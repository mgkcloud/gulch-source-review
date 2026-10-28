(function(){
'use strict';
const original=window.GulchItemCatalog;
if(!original)return;
const definitions=[
 ['cloak','Ranger cloak','Armor','Green hooded traveling cloak.',{armor:1}],
 ['bow','Hunting bow','Weapon','A curved wooden bow.',{bonus:1}],
 ['flail','Iron flail','Weapon','A heavy iron ball on a chain.',{bonus:2}],
 ['crossbow','Woodland crossbow','Weapon','A compact wooden crossbow.',{bonus:2}],
 ['belt','Crimson belt','Armor','A sturdy red leather belt.',{armor:1}],
 ['fang','Ivory fang','Material','A curved ivory fang.'],
 ['shortsword','Steel shortsword','Weapon','A broad steel blade.',{bonus:2}],
 ['longsword','Azure longsword','Weapon','A bright blue steel longsword.',{bonus:3}],
 ['waraxe','Ember war axe','Weapon','A dark axe with a glowing ember inset.',{bonus:4}],
 ['star','Iron throwing star','Weapon','A four-pointed iron star.',{bonus:2}],
 ['crown','Golden crown','Armor','A jeweled golden crown.',{armor:2}],
 ['boomerang','Steel boomerang','Weapon','A hooked dark steel weapon.',{bonus:2}],
 ['satchel','Leather satchel','Relic','A buckled travel satchel. A collectible; the shared pack already has unlimited weight capacity.'],
 ['pouch','Coin pouch','Relic','A small leather pouch with a gold clasp.'],
 ['ring','Amber ring','Relic','A golden ring set with an amber stone.'],
 ['necklace','Sun pendant','Relic','A silver necklace with a golden pendant.'],
 ['gauntlet','Iron gauntlet','Armor','An articulated iron glove.',{armor:2}],
 ['scroll','Sealed scroll','Relic','A rolled parchment tied with crimson ribbon.'],
 ['helmet','Knight helmet','Armor','A steel helm with a barred visor.',{armor:2}],
 ['tower_shield','Gilded tower shield','Armor','A blue shield edged in gold.',{armor:3}],
 ['breastplate','Steel breastplate','Armor','Heavy plate protection.',{armor:3}],
 ['mail','Chainmail coat','Armor','Interlocking rings over padded clothing.',{armor:2}],
 ['boots','Iron boots','Armor','Reinforced traveling boots.',{armor:1}],
 ['parchment','Ancient parchment','Relic','An unfolded page of old inscriptions.'],
 ['red_potion','Crimson healing potion','Consumable','Restores 9 HP.',{heal:9}],
 ['blue_potion','Azure restorative potion','Consumable','Restores 6 HP.',{heal:6}],
 ['emerald','Verdant emerald','Material','A polished green gemstone.'],
 ['gold_bar','Gold ingot','Material','A warm golden metal bar.'],
 ['silver_bar','Silver ingot','Material','A cool silver metal bar.'],
 ['crystals','Azure crystal cluster','Material','A cluster of bright blue crystals.'],
 ['handaxe','Woodcutter axe','Weapon','A steel axe with a wooden handle.',{bonus:2}],
 ['sickle','Harvest sickle','Weapon','A curved steel harvesting blade.',{bonus:1}],
 ['pickaxe','Miner pickaxe','Weapon','A pointed steel mining tool.',{bonus:2}],
 ['round_shield','Ironbound round shield','Armor','A wooden shield reinforced with iron.',{armor:2}],
 ['coin','Golden coin','Relic','A large stamped gold coin.'],
 ['ruby','Scarlet ruby','Material','A deep red cut gemstone.']
];
const icons={Weapon:'⚔',Armor:'▣',Consumable:'✚',Material:'◆',Relic:'◈'};
const items={...original.items};
const rewardIds=[];
for(const [key,name,type,description,stats] of definitions){
 const id='image_'+key,extra=stats||{};
 let detail=description;
 if(type==='Weapon')detail+=' Equip in the weapon slot for +'+extra.bonus+' sword and bump damage. Uses the existing melee attack; no ranged attack.';
 if(type==='Armor')detail+=' Equip in the single armor slot to reduce incoming damage by '+extra.armor+' before difficulty scaling. Attacks still deal at least 1 damage.';
 if(type==='Material'||type==='Relic')detail+=' Collectible treasure; no crafting recipe or special ability yet.';
 items[id]=Object.freeze({id,name,type,description:detail,glyph:icons[type],...extra,...(type==='Weapon'?{slot:'weapon'}:type==='Armor'?{slot:'armor'}:{})});
 rewardIds.push(id);
}
window.GulchItemCatalog=Object.freeze({items:Object.freeze(items),recipes:original.recipes});
const baseCommit=Gulch.commit;
let latest=null,lastReceipt=null;
const epoch=data=>String(data.respawnSettings?.token||'original');
function quantity(value){return Number.isFinite(value)?Math.max(0,Math.floor(value)):0;}
function enemy(e){return e.id!=='player'&&e.faction==='hostile'&&Number.isFinite(e.hp)&&e.hp>0&&!e.practiceTarget&&!e.isPlayer&&!e.playerId&&!e.ownerId&&!e.clientId&&!e.loreSpeaker&&!e.swordQuestLandmark&&e.itemId==null&&!/item|weapon|armor|armour|equipment|consumable|loot|object|prop/i.test([e.kind,e.type,e.species].join(' '));}
Gulch.commit=function(data,activity){
 if(!latest||!data?.seed||epoch(data)!==epoch(latest.gameState)||!(Number(data.turn)>Number(latest.turn)))return baseCommit(data,activity);
 const before=latest.player,after=new Map(data.seed.entities.map(e=>[e.id,e]));
 const defeated=latest.seed.entities.filter(e=>enemy(e)&&e.map===before.map&&Math.max(Math.abs(e.x-before.x),Math.abs(e.y-before.y))<=1&&data.seed.maps.some(m=>m.id===e.map)&&(!after.has(e.id)||after.get(e.id).hp<=0));
 if(!defeated.length)return baseCommit(data,activity);
 const old=data.itemEcosystem;
 const pack=old?.epoch===epoch(data)?{...old,bag:{...old.bag},equipment:{...old.equipment},known:Array.isArray(old.known)?old.known.slice():[],crafted:Array.isArray(old.crafted)?old.crafted.slice():[],log:Array.isArray(old.log)?old.log.slice():[]}:{epoch:epoch(data),bag:{},equipment:{},known:[],crafted:[],log:[]};
 const entities=data.seed.entities.slice(),awards=[];
 for(const victim of defeated){
  const available=rewardIds.filter(id=>quantity(pack.bag[id])<999);
  const pool=available.length?available:rewardIds;
  const id=pool[Math.floor(Math.random()*pool.length)];
  const name=items[id].name;
  if(available.length){
   pack.bag[id]=quantity(pack.bag[id])+1;
   if(!pack.known.includes(id))pack.known.push(id);
   awards.push(name);
  }else{
   let cacheId='image-reward:'+victim.id+':'+String(latest.stateRevision);
   while(entities.some(e=>e.id===cacheId))cacheId+='x';
   entities.push({id:cacheId,name:'Treasure: '+name,kind:'loot',map:victim.map,x:victim.x,y:victim.y,glyph:'♦',color:'#ffe09a',ecosystemLoot:true,contents:{[id]:1}});
   awards.push(name+' (pack stacks full; left on ground)');
  }
 }
 const text='Enemy treasure: '+awards.join(', ')+'.';
 pack.log=[text,...pack.log].slice(0,12);
 const receipt={epoch:epoch(data),id:String(latest.stateRevision)+':'+String(data.turn),text};
 const next={...data,seed:{...data.seed,entities},itemEcosystem:pack,imageKillReward:receipt};
 return baseCommit(next,(activity?activity+' ':'')+text);
};
const notice=document.createElement('div');notice.id='enemyTreasureNotice';notice.hidden=true;notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
const style=document.createElement('style');style.textContent='#enemyTreasureNotice{position:absolute;left:50%;top:92px;transform:translateX(-50%);z-index:5;max-width:min(420px,70%);padding:10px 14px;border:1px solid #d7b778;border-radius:7px;background:#122823f5;color:#ffe4ab;box-shadow:0 5px 24px #0008;font:12px/1.6 monospace;pointer-events:none}#enemyTreasureNotice[hidden]{display:none}';
document.head.append(style);document.getElementById('left').append(notice);
let timer=null,initialized=false;
Gulch.register('random-image-kill-rewards',{snapshot(s){
 const changedEpoch=latest&&epoch(latest.gameState)!==epoch(s.gameState);
 latest=s;
 const receipt=s.gameState.imageKillReward;
 const key=receipt?receipt.epoch+':'+receipt.id:null;
 if(changedEpoch){clearTimeout(timer);notice.hidden=true;}
 if(initialized&&key&&key!==lastReceipt&&receipt.epoch===epoch(s.gameState)){
  notice.textContent=receipt.text+' Open Inventory [I] to inspect.';notice.hidden=false;
  clearTimeout(timer);timer=setTimeout(()=>{notice.hidden=true;},5500);
 }
 lastReceipt=key;initialized=true;
}});
})();
