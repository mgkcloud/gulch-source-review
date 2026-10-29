(function(){
'use strict';
const base=window.GulchItemCatalog;if(!base)return;
const letters=['Z','Y','X','W','V','U','T','R','Q','P','O','N','M','L','K','J','I','H','G','F','E','D','C','B','A','S'];
const thresholds=[0,2,3,4,5,6,8,10,12,15,18,22,28,35,45,55,70,90,115,145,180,225,280,350,450,600];
const colors=['#abb5bc','#abb5bc','#abb5bc','#abb5bc','#bdd0b3','#bdd0b3','#bdd0b3','#bdd0b3','#8fdaa7','#8fdaa7','#8fdaa7','#8fdaa7','#85cfee','#85cfee','#85cfee','#85cfee','#c2adff','#c2adff','#c2adff','#f3a4d0','#f3a4d0','#f3a4d0','#ffd482','#ffd482','#ffd482','#fff0b2'];
const book=window.GulchRecipeBook,items={},abilities={...window.GulchSwordMagic};
function rank(value){let n=0;for(let i=1;i<thresholds.length;i++)if(value>=thresholds[i])n=i;return n;}
function originalValue(item){
 if(Number.isFinite(item.craftValue))return Math.max(1,item.craftValue);
 return Math.max(1,(Number(item.bonus)||Number(item.damage)||0)*18,(Number(item.armor)||0)*24,(Number(item.heal)||0)*2,item.type==='Relic'?16:2);
}
function info(item){
 if(item?.letterTier)return item.letterTier;
 const value=originalValue(item||{}),index=rank(value);
 return {letter:letters[index],index,color:colors[index],baseValue:value,value:Math.ceil(value*(1+index*.08)),skill:'No innate skill; usable through its existing item rules.'};
}
for(const [id,old] of Object.entries(base.items)){
 const tier=info(old),i=tier.index;
 let item={...old},skill='Crafting stock: its tier increases barter value. No passive power while carried.';
 if(old.slot==='weapon'){
  const increase=Math.floor(i/6);
  item.bonus=(Number(old.bonus)||0)+increase;
  skill='Honed edge: +'+increase+' melee damage included in the weapon bonus.';
  if(i>=16){
   const existing=abilities[id];
   const power=existing?{...existing,damage:existing.damage+Math.floor(i/5),heal:existing.heal+(i===25?2:0)}:{name:(i===25?'Sovereign Dawn':i>=22?'Astral Reprisal':'Runic Echo')+' · '+old.name,cooldown:i===25?4:i>=22?5:6,damage:Math.floor(i*.65),radius:i===25?3:i>=22?2:1,heal:i>=22?3:0,execute:i===25,color:tier.color};
   abilities[id]=Object.freeze(power);item.magicAbility=abilities[id];
   skill+=' '+power.name+': '+power.damage+' magic damage, radius '+power.radius+', up to '+power.heal+' healing; '+power.cooldown+' played-turn recharge.';
   if(power.execute)skill+=' Direct magic damage doubles against a target already below half health.';
   skill+=' Activates on a successful melee hit, respects walls, spares allies and cannot revive you.';
  }
 }else if(old.type==='Armor'){
  const increase=Math.floor(i/8);item.armor=(Number(old.armor)||0)+increase;
  skill='Tempered protection: +'+increase+' armor included in its rating. Worn slots combine before difficulty scaling; existing lethal-hit rules apply.';
 }else if(Number(old.heal)>0){
  const increase=Math.floor(i/3);item.heal=Number(old.heal)+increase;
  skill='Restorative potency: heals up to '+item.heal+' HP when consumed.';
 }else if(old.quickThrow){
  item.quickThrow={...old.quickThrow,damage:old.quickThrow.damage+Math.floor(i/2)};
  skill='Alchemical potency: '+item.quickThrow.damage+' blast damage, radius '+item.quickThrow.radius+', range '+item.quickThrow.range+'. Consumed on use; advances one enemy turn.';
 }else if(old.type==='Relic')skill='Collector’s treasure: higher barter value. Recipe uses remain available; carrying it grants no passive combat effect.';
 const letterTier=Object.freeze({...tier,skill});
 let description=old.description||'';
 if(old.slot==='weapon')description=description.replace(/Adds \d+ damage/g,'Adds '+item.bonus+' damage').replace(/\+\d+ melee damage when equipped/g,'+'+item.bonus+' melee damage when equipped').replace(/\d+ total base attack damage \(2 basic \+ \d+ weapon\)/g,(2+item.bonus)+' total base attack damage (2 basic + '+item.bonus+' weapon)').replace(/for \+\d+ sword and bump damage/g,'for +'+item.bonus+' sword and bump damage');
 if(item.heal)description=description.replace(/Restores \d+ HP/g,'Restores '+item.heal+' HP');
 if(old.type==='Armor')description=description.replace(/Reduces incoming attack damage by \d+/g,'Reduces incoming attack damage by '+item.armor).replace(/reduce incoming damage by \d+/g,'reduce incoming damage by '+item.armor).replace(/Adds \d+ armor/g,'Adds '+item.armor+' armor');
 if(old.quickThrow)description=description.replace(/Deals \d+ damage/g,'Deals '+item.quickThrow.damage+' damage');
 const magicAt=description.indexOf(' MAGIC — ');if(magicAt>=0)description=description.slice(0,magicAt);
 items[id]=Object.freeze({...item,craftValue:tier.value,letterTier,description:'TIER '+tier.letter+' · Value '+tier.value+'. '+skill+'\n\n'+description});
}
window.GulchItemCatalog=Object.freeze({items:Object.freeze(items),recipes:base.recipes});
window.GulchSwordMagic=Object.freeze(abilities);
window.GulchItemTiers=Object.freeze({letters:Object.freeze(letters),info,order:'Z → Y → X → W → V → U → T → R → Q → P → O → N → M → L → K → J → I → H → G → F → E → D → C → B → A → S'});
if(book)window.GulchRecipeBook=Object.freeze({...book,value(id){return items[id]?.craftValue??book.value(id);}});
})();
