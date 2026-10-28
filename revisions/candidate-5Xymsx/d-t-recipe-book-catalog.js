(function(){
'use strict';
const base=window.GulchItemCatalog;
if(!base)return;
const ranks=['Common','Uncommon','Rare','Epic','Legendary'];
const values={scrap:2,fiber:2,bone:3,hide:4,chitin:4,ichor:4,spark:6,spore:3,wire:3,glass:4,alloy:12,lens:15,gel:5,circuit:14,cell:12,core:70,relic:25,image_coin:5,image_pouch:12,image_fang:4,image_ring:22,image_necklace:25,image_scroll:18,image_parchment:16,image_emerald:30,image_ruby:36,image_crystals:24,image_gold_bar:28,image_silver_bar:12,image_satchel:18};
const resources={wood:2,stone:2,copper:4,iron:5,crystal:8};
const items={};
for(const [id,item] of Object.entries(base.items)){
 let value=values[id];
 if(value===undefined){
  if(item.slot==='weapon')value=[0,12,28,55,95,180][item.bonus]||12;
  else if(item.slot==='armor')value=[0,18,45,90][item.armor]||18;
  else if(item.heal)value=Math.max(5,Math.ceil(item.heal*1.5));
  else if(id.endsWith('_pure'))value=(values[id.slice(0,-5)]||4)*9;
  else if(id.endsWith('_fine'))value=(values[id.slice(0,-5)]||4)*3;
  else value=5;
 }
 const rank=value>=150?4:value>=70?3:value>=25?2:value>=10?1:0;
 items[id]=Object.freeze({...item,rarity:ranks[rank],rarityRank:rank,craftValue:value});
}
const additions=[
 ['book_fang','Carve recovered fangs',{image_fang:2},{bone:2}],
 ['book_pouch','Unpick a coin pouch',{image_pouch:1},{hide:2,fiber:1}],
 ['book_scroll','Study a sealed scroll',{image_scroll:1},{spore:2,relic:0}],
 ['book_parchment','Recover parchment fibers',{image_parchment:1},{fiber:4}],
 ['book_ring','Recover amber fittings',{image_ring:1},{wire:2,glass:2}],
 ['book_pendant','Dismantle a sun pendant',{image_necklace:1},{wire:3,spark:1}],
 ['book_cloak','Sew a ranger cloak',{hide:2,fiber:6},{image_cloak:1}],
 ['book_bow','Bind a hunting bow',{'$wood':4,fiber:4},{image_bow:1}],
 ['book_sickle','Forge a harvest sickle',{'$iron':2,'$wood':2,scrap:2},{image_sickle:1}],
 ['book_pickaxe','Forge a miner pickaxe',{'$iron':4,'$wood':3,fiber:2},{image_pickaxe:1}],
 ['book_handaxe','Forge a woodcutter axe',{'$iron':4,'$wood':3,scrap:2},{image_handaxe:1}],
 ['book_shortsword','Forge a steel shortsword',{alloy:2,fiber:2,scrap:2},{image_shortsword:1}],
 ['book_roundshield','Bind an ironbound shield',{'$wood':5,'$iron':4,hide:3,fiber:4},{image_round_shield:1}],
 ['book_helm','Forge a knight helmet',{alloy:3,hide:2,scrap:2},{image_helmet:1}],
 ['book_mail','Link a chainmail coat',{'$iron':5,wire:4,hide:2,fiber:2},{image_mail:1}],
 ['book_longsword','Temper an azure longsword',{image_shortsword:1,alloy:2,image_crystals:1},{image_longsword:1}],
 ['book_towershield','Gild a tower shield',{image_round_shield:1,alloy:2,image_gold_bar:1,image_emerald:1},{image_tower_shield:1}],
 ['book_breastplate','Reinforce a steel breastplate',{image_mail:1,alloy:4,hide:2},{image_breastplate:1}],
 ['book_waraxe','Forge an ember war axe',{image_handaxe:1,alloy:3,image_ruby:1,cell:2},{image_waraxe:1}],
 ['book_redpotion','Brew a crimson potion',{gel:2,spore:2,glass:1},{image_red_potion:1}],
 ['book_bluepotion','Brew an azure potion',{gel:1,spore:2,glass:1},{image_blue_potion:1}]
];
const recipes=base.recipes.slice();
for(const [id,name,input,rawOutput] of additions){
 const output=Object.fromEntries(Object.entries(rawOutput).filter(([,n])=>n>0));
 if(recipes.some(r=>r.id===id))continue;
 if(!Object.entries(input).every(([key,n])=>Number.isInteger(n)&&n>0&&(items[key]||Object.prototype.hasOwnProperty.call(resources,key.slice(1))&&key.startsWith('$'))))continue;
 if(!Object.entries(output).every(([key,n])=>items[key]&&Number.isInteger(n)&&n>0))continue;
 recipes.push(Object.freeze({id,name,input:Object.freeze(input),output:Object.freeze(output)}));
}
const source=id=>id.startsWith('$')?'Gather outdoor deposits and seasonal supplies.':id.startsWith('image_')?'Random enemy treasure; some also appear in abandoned tools, traveler chests, buried caches and hidden vaults.':id==='relic'?'Creature remains, traveler chests and hidden vaults.':/^(chitin|ichor|fiber|hide|bone|spark|spore|scrap)(_|$)/.test(id)?'Collect creature remains; refined and pristine samples can be merged at the workbench.':'Craft from recovered materials using the recipes below.';
window.GulchItemCatalog=Object.freeze({items:Object.freeze(items),recipes:Object.freeze(recipes)});
window.GulchRecipeBook=Object.freeze({ranks:Object.freeze(ranks),resources:Object.freeze(resources),source,value(id){return id.startsWith('$')?resources[id.slice(1)]||0:items[id]?.craftValue||0;}});
})();
