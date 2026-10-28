(function(){
'use strict';
const items={};
function add(id,name,type,description,extra){items[id]={id,name,type,description,...extra};}
const materials=[['scrap','Salvaged scrap','Bent metal recovered from machinery and scavengers.'],['chitin','Chitin plates','Layered armor harvested from shelled creatures.'],['fiber','Tough fiber','Flexible organic strands suitable for bindings.'],['hide','Cured hide','Dense creature hide used in protective clothing.'],['bone','Dense bone','A useful structural material.'],['ichor','Mutant ichor','Reactive fluid used in medicines and synthesis.'],['spark','Charged mote','A small, contained electrical discharge.'],['spore','Luminous spores','Bioluminescent fungal particles.'],['wire','Copper wire','Conductive wire drawn from copper.'],['glass','Desert glass','Fused mineral glass with a sharp edge.'],['alloy','Tempered alloy','Refined metal for advanced tools.'],['lens','Prismatic lens','A crystal lens that concentrates energy.'],['gel','Stabilizing gel','A medium for medicines and energy cells.'],['circuit','Ancient circuit','Rebuilt circuitry from the old world.'],['core','Resonant core','A stable assembly of crystal and charged circuitry.']];
materials.forEach(([id,name,description])=>add(id,name,'Material',description));
add('bandage','Fiber dressing','Consumable','Restores 4 HP.',{heal:4});
add('salve','Regenerative salve','Consumable','Restores 9 HP.',{heal:9});
add('tonic','Vitality tonic','Consumable','Restores 16 HP.',{heal:16});
add('ration','Trail ration','Consumable','Restores 3 HP.',{heal:3});
add('cell','Chemical cell','Material','An energy component used in advanced fabrication.');
add('relic','Weathered data shard','Relic','A fragment of ancient knowledge. Salvage it into circuitry.');
const weapons=[['scrap_knife','Scrap knife',1],['bone_spear','Bone spear',1],['iron_blade','Iron longblade',2],['chitin_blade','Serrated chitin blade',2],['alloy_blade','Carbide-style blade',3],['crystal_blade','Prismatic blade',4],['resonance_blade','Resonance blade',5]];
weapons.forEach(([id,name,bonus])=>add(id,name,'Weapon','Adds '+bonus+' damage to sword and bump attacks.',{slot:'weapon',bonus}));
[['hide_vest','Hide vest',1],['chitin_mail','Chitin mail',2],['alloy_mail','Layered alloy mail',3]].forEach(([id,name,armor])=>add(id,name,'Armor','Reduces incoming attack damage by '+armor+' before difficulty scaling; attacks still deal at least 1 damage.',{slot:'armor',armor}));
for(const [base,label] of [['chitin','Chitin'],['scrap','Scrap'],['spark','Charged mote']]){
 add(base+'_fine','Refined '+label.toLowerCase(),'Material','Merge three ordinary samples into a refined sample.');
 add(base+'_pure','Pristine '+label.toLowerCase(),'Material','Merge three refined samples into a pristine sample.');
}
const recipes=[];
function recipe(id,name,input,output){recipes.push({id,name,input,output});}
recipe('wire','Draw copper wire',{'$copper':1},{wire:2});
recipe('glass','Fuse desert glass',{'$stone':2,'$crystal':1},{glass:2});
recipe('alloy','Temper alloy',{'$iron':2,scrap:2},{alloy:1});
recipe('lens','Polish a lens',{'$crystal':2,glass:1},{lens:1});
recipe('gel','Stabilize ichor',{ichor:2,spore:1},{gel:2});
recipe('circuit','Rebuild circuitry',{scrap:2,wire:2,spark:1},{circuit:1});
recipe('salvage','Decode a data shard',{relic:1},{circuit:2,spark:1});
recipe('cell','Assemble a chemical cell',{gel:1,wire:1,spark:1},{cell:1});
recipe('core','Build a resonant core',{circuit:2,lens:1,cell:2},{core:1});
recipe('bandage','Weave a dressing',{fiber:3},{bandage:1});
recipe('salve','Mix regenerative salve',{gel:1,fiber:1},{salve:1});
recipe('tonic','Distill vitality tonic',{gel:2,spore:2,cell:1},{tonic:1});
recipe('ration','Prepare trail rations',{fiber:1,ichor:1},{ration:2});
recipe('knife','Forge a scrap knife',{scrap:3,fiber:1},{scrap_knife:1});
recipe('spear','Bind a bone spear',{bone:3,'$wood':1,fiber:2},{bone_spear:1});
recipe('ironblade','Forge an iron longblade',{'$iron':3,scrap_knife:1},{iron_blade:1});
recipe('chitinblade','Shape a chitin blade',{chitin_fine:2,bone_spear:1},{chitin_blade:1});
recipe('alloyblade','Upgrade to an alloy blade',{alloy:3,iron_blade:1,scrap_fine:1},{alloy_blade:1});
recipe('crystalblade','Grow a prismatic blade',{lens:2,alloy_blade:1,spark_fine:1},{crystal_blade:1});
recipe('resonance','Merge a resonance blade',{crystal_blade:1,core:2,spark_pure:1},{resonance_blade:1});
recipe('hidevest','Stitch a hide vest',{hide:4,fiber:2},{hide_vest:1});
recipe('chitinmail','Layer chitin mail',{hide_vest:1,chitin_fine:2,fiber:2},{chitin_mail:1});
recipe('alloymail','Reinforce alloy mail',{chitin_mail:1,alloy:3,chitin_pure:1},{alloy_mail:1});
for(const id of ['chitin','scrap','spark']){
 recipe(id+'merge','Refine '+items[id].name,{[id]:3},{[id+'_fine']:1});
 recipe(id+'pure','Purify '+items[id].name,{[id+'_fine']:3},{[id+'_pure']:1});
}
window.GulchItemCatalog=Object.freeze({items:Object.freeze(items),recipes:Object.freeze(recipes)});
})();
