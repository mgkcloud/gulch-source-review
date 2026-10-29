(function(){
'use strict';
const base=window.GulchItemCatalog;if(!base)return;
const definitions=[
 ['ref_waywatch','Waywarden’s Pulse',3,2,1,0,'A successful melee hit releases a 2-damage pulse against nearby enemies.'],
 ['ref_copper_oath','Copper Thunder',4,4,2,0,'A successful melee hit chains 4 magic damage to enemies within two tiles of the target.'],
 ['ref_winter_bell','Winter Chime',4,5,1,2,'A successful melee hit bursts for 5 magic damage nearby and restores up to 2 HP.'],
 ['ref_foxfire','Foxfire Bloom',3,7,1,0,'A successful melee hit erupts for 7 fire damage around the target.'],
 ['ref_widow_gate','Gatebreaker',5,12,0,0,'A successful melee hit crushes its target for 12 additional magic damage.'],
 ['ref_twin_tide','Returning Tide',4,6,2,3,'A successful melee hit sends a 6-damage wave through nearby enemies and restores up to 3 HP.'],
 ['ref_deep_fin','Abyssal Rend',4,14,0,0,'A successful melee hit tears its target for 14 extra damage, doubled against a target already below half health.'],
 ['ref_moon_hook','Moonlit Reaping',3,8,0,4,'A successful melee hit deals 8 extra lunar damage and restores up to 4 HP.'],
 ['ref_briar_vow','Thorn Circle',4,8,2,0,'A successful melee hit scatters thorns for 8 damage to nearby enemies.'],
 ['ref_red_verdict','Final Sentence',5,16,0,0,'A successful melee hit deals 16 extra damage, doubled against a target already below half health.'],
 ['ref_moss_crown','Forest Renewal',5,5,1,8,'A successful melee hit releases a 5-damage spore pulse and restores up to 8 HP.'],
 ['ref_last_ferryman','Soul Passage',4,10,0,6,'A successful melee hit deals 10 spirit damage and restores up to 6 HP.'],
 ['ref_hearth_sun','Dawn Nova',6,18,2,4,'A successful melee hit detonates an 18-damage sunburst and restores up to 4 HP.'],
 ['ref_rose_requiem','Rose Crescendo',4,12,2,3,'A successful melee hit releases a 12-damage rose storm and restores up to 3 HP.'],
 ['ref_verdant_comet','Starfall',7,22,3,0,'A successful melee hit calls a 22-damage comet burst across a three-tile radius.'],
 ['ref_cinder_return','Phoenix Return',6,15,1,10,'A successful melee hit releases 15 ember damage and restores up to 10 HP. Cannot revive a fallen adventurer.']
];
const abilities={},items={...base.items};
for(const [id,name,cooldown,damage,radius,heal,text] of definitions){
 const item=items[id];if(!item)continue;
 const execute=id==='ref_deep_fin'||id==='ref_red_verdict';
 abilities[id]=Object.freeze({name,cooldown,damage,radius,heal,execute,color:['#d9dca7','#edaa65','#d6eaff','#ffae68','#cf8799','#8cecff','#39c6dc','#e7ddff','#b8dc65','#fa847c','#a8dd83','#79e4ed','#ffe783','#f0a4d1','#c6f574','#ffbd83'][item.referenceSword]||'#ffe0a0'});
 items[id]=Object.freeze({...item,magicAbility:abilities[id],description:item.description+' MAGIC — '+name+': '+text+' Recharges after '+cooldown+' played turns. Triggers automatically on sword slashes and bump hits while equipped. Bursts respect walls and spare friendly characters. Healing only applies if you survived retaliation.'});
}
const fallback=['ref_waywatch','ref_copper_oath','ref_winter_bell','ref_foxfire','ref_widow_gate','ref_twin_tide','ref_deep_fin','ref_moon_hook'];
let index=0;
for(const [id,item] of Object.entries(items)){
 if(item.slot!=='weapon'||Number.isInteger(item.referenceSword)||!/sword|blade|knife|spear/i.test(item.name+' '+id))continue;
 if(!base.recipes.some(r=>r.output[id]))continue;
 const source=items[fallback[index++%fallback.length]];
 items[id]=Object.freeze({...item,referenceSword:source.referenceSword});
}
window.GulchSwordMagic=Object.freeze(abilities);
window.GulchItemCatalog=Object.freeze({items:Object.freeze(items),recipes:base.recipes});
})();
