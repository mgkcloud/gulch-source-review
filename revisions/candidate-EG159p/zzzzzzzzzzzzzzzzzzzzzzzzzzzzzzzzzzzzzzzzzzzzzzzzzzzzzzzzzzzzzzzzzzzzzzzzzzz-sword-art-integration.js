(function(){
'use strict';
function install(){
 const reference=window.GulchReferenceSwordArt;
 const presentation=window.GulchItemPresentation;
 if(!presentation?.icon)return;
 const native=Element.prototype.replaceChildren;
 const rendered=new WeakMap();
 let painting=false;
 function itemFor(node){
  const key=node.dataset?.catalogIcon;
  if(!key)return null;
  const items=window.GulchItemCatalog?.items||{};
  if(key.startsWith('repair156:')){
   const id=key.slice(10).split(':')[0];
   return items[id]||{id,type:'Material'};
  }
  if(key.startsWith('reference-magic:'))return null;
  for(const item of Object.values(items))if(key.startsWith(item.id+':'))return item;
  return null;
 }
 function paint(node,item){
  const previous=rendered.get(node);
  if(previous?.item===item&&node.childNodes.length===1&&node.firstChild===previous.child){
   node.dataset.catalogIcon=previous.key;
   return;
  }
  painting=true;
  try{
   if(Number.isInteger(item.referenceSword)&&reference)reference.icon(node,item);
   else presentation.icon(node,item);
   if(node.childNodes.length===1&&node.firstChild instanceof HTMLCanvasElement){
    rendered.set(node,{item,child:node.firstChild,key:node.dataset.catalogIcon});
   }else rendered.delete(node);
  }finally{painting=false;}
 }
 // Legacy decorators use private painters. Canonicalize only their marked icon
 // replacements, preserving an existing canvas instead of retriggering observers.
 Element.prototype.replaceChildren=function(){
  if(painting)return native.apply(this,arguments);
  const item=itemFor(this);
  const generic=arguments.length===1&&arguments[0] instanceof HTMLCanvasElement&&arguments[0].classList.contains('repaired-item-art');
  const legacy=arguments.length===0&&this.matches('.item-glyph,.equipment-box,.gear-slot-icon');
  if(item&&(generic||legacy)){
   const previous=rendered.get(this);
   if(previous?.item===item&&this.childNodes.length===1&&this.firstChild===previous.child){
    this.dataset.catalogIcon=previous.key;
    return;
   }
   if(Number.isInteger(item.referenceSword)&&reference){
    const expected='reference-magic:'+item.referenceSword;
    if(this.childNodes.length===1&&this.firstChild instanceof HTMLCanvasElement&&this.firstChild.classList.contains('reference-sword-art')&&this.firstChild.dataset.swordDesign===String(item.referenceSword)){
     this.dataset.catalogIcon=expected;
     rendered.set(this,{item,child:this.firstChild,key:expected});
     return;
    }
   }
   paint(this,item);
   return;
  }
  return native.apply(this,arguments);
 };
 window.GulchItemPresentation=Object.freeze({...presentation,icon(node,item){
  if(!node||!item)return;
  paint(node,item);
 }});
 const panel=document.getElementById('inventoryPanel');
 function stabilize(){
  if(!panel||panel.hidden)return;
  const items=window.GulchItemCatalog?.items||{};
  panel.querySelectorAll('[data-pack-key^="field:"]').forEach(row=>{
   const item=items[row.dataset.packKey.slice(6)];
   const target=row.classList.contains('equipment-box')?row:row.querySelector('.item-glyph');
   if(item&&target)paint(target,item);
  });
 }
 // Remove the competing glyph-only observer's incentive to rewrite icons:
 // its signature comparison now recognizes the canonical presentation key.
 const descriptor=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');
 if(descriptor?.set&&descriptor.get&&descriptor.configurable){
  Object.defineProperty(Node.prototype,'textContent',{
   ...descriptor,
   set(value){
    const previous=rendered.get(this);
    if(previous&&this instanceof Element&&this.matches('.item-glyph,.equipment-box,.gear-slot-icon')&&this.childNodes.length===1&&this.firstChild===previous.child&&String(value)===(previous.item.glyph||'◇')+'\uFE0E'){
     this.dataset.catalogIcon=previous.key;
     return;
    }
    descriptor.set.call(this,value);
   }
  });
 }
 const guide=document.createElement('p');guide.className='sword-magic-caption';
 guide.textContent='Enchanted collection: each named reference sword has its own automatic on-hit spell. Equip it to activate its magic. Cooldowns use shared played turns; menus do not recharge them.';
 document.getElementById('swordRecipeSection')?.append(guide);
 stabilize();
}
window.addEventListener('load',()=>setTimeout(install,0),{once:true});
})();
