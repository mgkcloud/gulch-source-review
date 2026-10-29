(function(){
'use strict';
const base=window.GulchItemCatalog;if(!base)return;
const labels={weapon:'Sword',shield:'Shield',hat:'Hat',chest:'Chest',pants:'Pants',boots:'Boots',cloak:'Cloak',gloves:'Gloves'};
const armorSlots=['shield','hat','chest','pants','boots','cloak','gloves'];
function slot(item){
 if(item.type!=='Armor')return item.slot;
 const id=item.id;
 if(/shield/.test(id))return 'shield';
 if(/helmet|crown|hat/.test(id))return 'hat';
 if(/boots/.test(id))return 'boots';
 if(/cloak/.test(id))return 'cloak';
 if(/gauntlet|gloves/.test(id))return 'gloves';
 if(/pants|belt/.test(id))return 'pants';
 return 'chest';
}
const items={};
for(const [id,item] of Object.entries(base.items)){
 const nextSlot=slot(item);
 let description=item.description||'';
 if(item.type==='Armor')description=description.replace(/single armor slot/g,labels[nextSlot].toLowerCase()+' slot').replace(/Equip in the armor slot/g,'Equip in the '+labels[nextSlot].toLowerCase()+' slot')+' Worn armor combines across all seven protective slots.';
 items[id]=Object.freeze({...item,slot:nextSlot,description});
}
items.trail_pants=Object.freeze({id:'trail_pants',name:'Reinforced trail pants',type:'Armor',slot:'pants',armor:1,rarity:'Uncommon',rarityRank:1,craftValue:18,glyph:'▣',description:'Reinforced traveling trousers. Adds 1 armor while worn in the pants slot.'});
const recipes=[...base.recipes,Object.freeze({id:'sew_trail_pants',name:'Sew reinforced trail pants',input:Object.freeze({hide:3,fiber:3}),output:Object.freeze({trail_pants:1})})];
window.GulchItemCatalog=Object.freeze({items:Object.freeze(items),recipes:Object.freeze(recipes)});
const epoch=d=>String(d?.respawnSettings?.token||'original');
function equipment(pack){
 const result={...pack?.equipment};
 if(result.sword&&!result.weapon)result.weapon=result.sword;
 delete result.sword;
 const legacy=items[result.armor];
 if(legacy&&armorSlots.includes(legacy.slot)&&!result[legacy.slot])result[legacy.slot]=legacy.id;
 delete result.armor;
 return result;
}
function protection(pack){
 const worn=equipment(pack);let total=0;
 for(const key of armorSlots){const item=items[worn[key]];if(item?.slot===key&&Number(pack?.bag?.[item.id])>0)total+=Math.max(0,Number(item.armor)||0);}
 return total;
}
window.GulchEquipmentSlots=Object.freeze({labels:Object.freeze(labels),equipment,protection});
let latest=null;
const commit=Gulch.commit;
Gulch.register('expanded-equipment-rules',{snapshot(s){latest=s;}});
Gulch.commit=function(data,activity){
 if(!data?.seed||!latest)return commit(data,activity);
 const same=epoch(data)===epoch(latest.gameState),pack=data.itemEcosystem;
 let next=data;
 if(pack?.epoch===epoch(data))next={...next,itemEcosystem:{...pack,equipment:equipment(pack)}};
 const old=latest.gameState.itemEcosystem;
 if(same&&old?.epoch===epoch(data)&&Number(data.turn)>Number(latest.turn)){
  const before=latest.player,after=data.seed.entities.find(e=>e.id==='player');
  // The existing ecosystem already subtracts legacy armor before this wrapper.
  const legacy=items[old.equipment?.armor];
  const already=legacy?Math.max(0,Number(legacy.armor)||0):0;
  const extra=Math.max(0,protection(old)-already);
  if(extra&&after&&Number.isFinite(after.hp)&&Number.isFinite(before.hp)&&after.hp<before.hp){
   const hp=Math.max(0,before.hp-Math.max(1,before.hp-after.hp-extra));
   next={...next,seed:{...next.seed,entities:next.seed.entities.map(e=>e.id==='player'?{...e,hp}:e)}};
  }
 }
 return commit(next,activity);
};
})();
