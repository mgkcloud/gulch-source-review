(function(){
'use strict';
const base=window.GulchItemCatalog,book=window.GulchRecipeBook;
if(!base)return;
const definitions={
 scrap_knife:[1,'crawler',1,'Scavenger edge'],
 bone_spear:[2,'beetle',2,'Shell splitter'],
 iron_blade:[3,'brute',2,'Tempered edge'],
 chitin_blade:[4,'crawler',4,'Serrated edge'],
 alloy_blade:[6,'brute',4,'Heavy breaker'],
 crystal_blade:[8,'spirit',5,'Prismatic edge'],
 resonance_blade:[15,'giant',9,'Resonant executioner'],
 image_shortsword:[3,'skitter',2,'Quick steel'],
 image_longsword:[7,'spirit',4,'Azure edge'],
 ref_waywatch:[1,'skitter',3,'Roadwarden’s quick cut'],
 ref_copper_oath:[2,'beetle',4,'Copper shellbreaker'],
 ref_winter_bell:[3,'spirit',5,'Winter resonance'],
 ref_foxfire:[5,'crawler',6,'Foxfire serration'],
 ref_widow_gate:[6,'brute',6,'Gatebreaker'],
 ref_twin_tide:[8,'spirit',7,'Twin resonance'],
 ref_deep_fin:[9,'beetle',8,'Deepfin sawteeth'],
 ref_moon_hook:[4,'skitter',7,'Moonhook precision'],
 ref_briar_vow:[5,'crawler',8,'Briar thorns'],
 ref_red_verdict:[10,'brute',8,'Crushing verdict'],
 ref_moss_crown:[8,'beetle',10,'Rootbound splitter'],
 ref_last_ferryman:[9,'spirit',10,'Spirit passage'],
 ref_hearth_sun:[16,'giant',12,'Hearthsun giantbreaker'],
 ref_rose_requiem:[11,'spirit',12,'Requiem resonance'],
 ref_verdant_comet:[17,'beetle',14,'Comet shellbreaker'],
 ref_cinder_return:[18,'brute',14,'Cinder’s crushing return']
};
const targets={crawler:'crawlers',beetle:'ordinary beetles',brute:'Ironhide chargers',spirit:'wisps and Storm lanterns',giant:'Dreadmaws and Colossi',skitter:'Needle skitterers'};
const items={...base.items},traits={};
for(const [id,[bonus,target,extra,title]] of Object.entries(definitions)){
 const old=items[id];if(!old)continue;
 traits[id]=Object.freeze({target,extra,title});
 const description='Crafted melee weapon · '+(2+bonus)+' total base attack damage (2 basic + '+bonus+' weapon). '+title+': +'+extra+' additional damage against '+targets[target]+'. Living World blade upgrades add separately. Works with sword slashes and bump attacks. '+(old.lore||'');
 items[id]=Object.freeze({...old,bonus,description,swordStrength:traits[id]});
}
const values=new Map();
function cost(id,trail){
 if(values.has(id))return values.get(id);
 if(trail.has(id))return book?.value(id)||items[id]?.craftValue||1;
 const next=new Set(trail);next.add(id);
 const recipe=base.recipes.find(r=>r.output[id]&&Object.keys(r.output).length===1);
 let value=book?.value(id)||items[id]?.craftValue||1;
 if(recipe&&definitions[id])value=Math.ceil(Object.entries(recipe.input).reduce((sum,[input,n])=>sum+n*cost(input,next),0)/recipe.output[id]*1.2);
 values.set(id,value);return value;
}
for(const id of Object.keys(definitions)){
 if(!items[id])continue;
 const value=cost(id,new Set()),rank=value>=150?4:value>=70?3:value>=25?2:value>=10?1:0;
 items[id]=Object.freeze({...items[id],craftValue:value,rarityRank:rank,rarity:['Common','Uncommon','Rare','Epic','Legendary'][rank]});
}
window.GulchCraftedSwordStrengths=Object.freeze(traits);
window.GulchItemCatalog=Object.freeze({items:Object.freeze(items),recipes:base.recipes});
if(book)window.GulchRecipeBook=Object.freeze({...book,value(id){return items[id]?.craftValue??book.value(id);}});
})();
