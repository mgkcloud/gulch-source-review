(function(){
'use strict';
const base=window.GulchItemCatalog;
if(!base)return;
const recipes=base.recipes.slice(),notes={};
const additions=[
 ['field_wire','Draw silver wire',{image_silver_bar:1},{wire:3},'Cold-work a recovered silver ingot into conductive wire. Find silver in traveler chests, buried treasure and enemy drops.'],
 ['field_contacts','Recover gold contacts',{image_gold_bar:1,scrap:1},{circuit:2},'Fit gold contacts to a salvaged frame. Gold occurs in buried treasure and hidden vaults.'],
 ['field_crystals','Separate azure crystals',{image_crystals:1},{spark:2,glass:2},'Separate charged fragments from their glassy matrix. Azure crystal clusters can drop as enemy treasure.'],
 ['field_lens','Polish an emerald lens',{image_emerald:1,image_silver_bar:1},{lens:2},'Mount recovered emerald in silver. Search marked buried treasure for emeralds.'],
 ['field_cell','Assemble ruby cells',{image_ruby:1,wire:2},{cell:2},'Bind a ruby conductor into compact energy cells. Hidden vaults contain rubies.'],
 ['field_cloak','Unpick a ranger cloak',{image_cloak:1},{fiber:4,hide:2},'Recover cloth and leather from enemy treasure. Consumes the cloak; unequip it first.'],
 ['field_satchel','Salvage a leather satchel',{image_satchel:1},{hide:3,fiber:2},'Unpick an abandoned satchel into leather panels and bindings. Consumes the satchel.'],
 ['field_bow','Salvage a hunting bow',{image_bow:1},{fiber:3,scrap:1},'Recover bowstring and fittings from a found bow. Consumes the bow; unequip it first.'],
 ['field_tools','Reforge abandoned tools',{image_handaxe:1,image_pickaxe:1},{alloy:3,scrap:2},'Rework two recovered tool heads into metal stock. Both tools are consumed and must be unequipped.'],
 ['field_sickle','Prepare field dressings',{image_sickle:1,fiber:3},{bandage:3,scrap:1},'Prepare fiber strips and salvage the worn sickle. The sickle is consumed; unequip it first.'],
 ['field_medicine','Blend recovered medicines',{image_blue_potion:1,image_red_potion:1},{tonic:1,salve:1},'Combine two found medicines into field treatments. Both input potions are consumed.'],
 ['field_blade','Reforge a steel shortsword',{image_shortsword:1,alloy:2},{alloy_blade:1},'Rebuild a recovered blade around a tempered edge. Consumes the shortsword; unequip it first.']
];
for(const [id,name,input,output,note] of additions){
 if(recipes.some(r=>r.id===id))continue;
 if(!Object.keys(input).every(k=>base.items[k])||!Object.keys(output).every(k=>base.items[k]))continue;
 recipes.push(Object.freeze({id,name,input,output}));notes[id]=note;
}
window.GulchItemCatalog=Object.freeze({items:base.items,recipes:Object.freeze(recipes)});
window.GulchFieldRecipeNotes=Object.freeze(notes);
})();
