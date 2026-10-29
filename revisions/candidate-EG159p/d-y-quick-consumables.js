(function(){
'use strict';
const base=window.GulchItemCatalog;if(!base)return;
const items={...base.items};
items.fire_vial=Object.freeze({id:'fire_vial',name:'Fire vial',type:'Consumable',glyph:'♨',rarity:'Uncommon',rarityRank:1,craftValue:18,quickThrow:{damage:8,radius:1,range:4,color:'#ffab65'},description:'Equip in the Q slot and throw up to four tiles ahead. Deals 8 damage to hostiles within one tile of impact. Walls block the throw and blast. Consumed on use; throwing advances one enemy turn.'});
items.field_bomb=Object.freeze({id:'field_bomb',name:'Field bomb',type:'Consumable',glyph:'●',rarity:'Rare',rarityRank:2,craftValue:35,quickThrow:{damage:14,radius:2,range:4,color:'#ffe29b'},description:'Equip in the Q slot and throw up to four tiles ahead. Deals 14 damage to hostiles within two tiles of impact. Walls block the throw and blast. Consumed on use; throwing advances one enemy turn.'});
const recipes=[...base.recipes,
Object.freeze({id:'quick_fire_vial',name:'Bottle a fire vial',input:{glass:2,ichor:2,fiber:1},output:{fire_vial:1}}),
Object.freeze({id:'quick_field_bomb',name:'Assemble a field bomb',input:{scrap:3,spark:2,gel:1},output:{field_bomb:1}})];
window.GulchItemCatalog=Object.freeze({items:Object.freeze(items),recipes:Object.freeze(recipes)});
})();
