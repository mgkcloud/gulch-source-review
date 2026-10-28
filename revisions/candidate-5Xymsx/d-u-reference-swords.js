(function(){
'use strict';
const base=window.GulchItemCatalog,book=window.GulchRecipeBook;
if(!base)return;
const definitions=[
 ['waywatch','Waywatch Falchion',1,12,0,{scrap:3,fiber:2},'The first roadwardens forged these hooked blades to cut travelers free from collapsed wagons. The notch in the spine measures a promise: no companion left behind.'],
 ['copper_oath','Copper Oath',2,28,1,{'$copper':4,'$wood':2,scrap:2},'A village smith made this broad copper-colored sword after refusing a king’s levy. Its orange fuller bears the names of the neighbors she chose to defend instead.'],
 ['winter_bell','Winter Bell',2,34,2,{alloy:2,glass:2,fiber:2},'Its pale, forked guard once held a tiny silver bell. The bell is gone, but frost gathers in its empty cradle whenever its bearer remembers someone far from home.'],
 ['foxfire','Foxfire Saber',3,58,3,{alloy:3,image_ruby:1,wire:2},'A charcoal burner followed an orange fox through a burning forest and emerged with this sword. Its hooked tip recalls the tail that vanished into the smoke.'],
 ['widow_gate','Widowgate Greatsword',3,64,4,{alloy:3,chitin_fine:2,image_ruby:1},'Black iron fills the lattice of its broad blade. Each opening represents a gate held during the siege of Hollowmere; the red rivet marks the one that finally opened to refugees.'],
 ['twin_tide','Twin-Tide Sword',4,98,5,{alloy_blade:1,lens:2,spark_fine:1},'Two crescent edges curve around a dark central spine. Sailors say they remember the two tides that carried a lost fleet home on a moonless night.'],
 ['deep_fin','Deepfin Sawblade',4,105,6,{chitin_blade:1,image_crystals:2,alloy:2},'Blue teeth run down one edge like the fins of an abyssal fish. A diver found its pattern carved into a drowned lighthouse, beside the words: even darkness has a shore.'],
 ['moon_hook','Moonhook Longsword',3,60,7,{image_silver_bar:3,alloy:2,glass:2},'The slender silver hook catches moonlight before it catches steel. Its maker shaped the blade for a watch captain who refused to draw a weapon beneath a peaceful roof.'],
 ['briar_vow','Briar Vow',3,65,8,{chitin_fine:2,image_emerald:1,fiber:4},'Green crescent guards protect a narrow, thorned blade. The orchard keepers buried their swords each spring; this one returned wrapped in living roots after their last harvest.'],
 ['red_verdict','Red Verdict',4,100,9,{iron_blade:1,alloy:3,image_ruby:2},'White edges frame a scarlet central channel. Once carried by an executioner, it was reforged after its owner broke the prison locks and walked away with the condemned.'],
 ['moss_crown','Moss-Crowned Blade',4,110,10,{chitin_blade:1,image_emerald:2,spore:4},'A green stone rests inside its tangled iron guard. A forgotten ruler laid this sword down at the forest’s edge; the forest accepted the steel and declined the crown.'],
 ['last_ferryman','Last Ferryman',4,118,11,{image_silver_bar:2,bone:5,lens:2,alloy:3},'An ivory mask watches over a turquoise cutting edge. It belonged to the ferryman who kept crossing the river after the bridge fell, charging each passenger only a story.'],
 ['hearth_sun','Hearthsun Greatsword',5,180,12,{ref_foxfire:1,core:2,image_gold_bar:2},'Gold and ember-colored steel surround a small, dark heart. It was made from the last hearth of a ruined town, so that its survivors could carry a little of home into every winter.'],
 ['rose_requiem','Rose Requiem',4,125,13,{ref_moon_hook:1,image_ruby:1,spark_fine:2},'Rose-colored crescents shelter the violet blade. A traveling musician commissioned it after losing her instrument; she carved the final verse into the guard rather than forgetting the song.'],
 ['verdant_comet','Verdant Comet',5,190,14,{ref_briar_vow:1,core:2,image_emerald:2},'Lime-green facets shine inside a purple frame. The smith called it a fallen star. His daughter called it a seed, and planted a tree wherever the sword helped end a battle.'],
 ['cinder_return','Cinder’s Return',5,195,15,{ref_copper_oath:1,alloy:4,core:2,image_ruby:1},'Its copper hook turns back toward the hand that holds it. Forged for an exile’s return, it bears no family crest: only a little doorway, open on both sides.']
];
const items={...base.items},recipes=base.recipes.slice();
const ranks=['Common','Uncommon','Rare','Epic','Legendary'];
for(const [key,name,bonus,value,design,input,lore] of definitions){
 const id='ref_'+key,rank=value>=150?4:value>=70?3:value>=25?2:value>=10?1:0;
 items[id]=Object.freeze({id,name,type:'Weapon',slot:'weapon',bonus,glyph:'⚔',referenceSword:design,rarity:ranks[rank],rarityRank:rank,craftValue:value,lore,description:'Sword · +'+bonus+' melee damage when equipped. '+lore+' Crafted from the reference-inspired sword collection; uses the shared weapon slot.'});
 recipes.push(Object.freeze({id:'forge_'+id,name:'Forge '+name,input:Object.freeze(input),output:Object.freeze({[id]:1})}));
}
window.GulchItemCatalog=Object.freeze({items:Object.freeze(items),recipes:Object.freeze(recipes)});
if(book)window.GulchRecipeBook=Object.freeze({...book,value(id){return items[id]?.craftValue??book.value(id);},source(id){return id.startsWith('ref_')?'Forge this sword in the recipe book. Its recipe is available from the start; equipped ingredients must be unequipped before reforging.':book.source(id);}});
})();
