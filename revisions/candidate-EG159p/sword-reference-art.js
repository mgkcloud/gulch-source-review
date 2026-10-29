(function(){
'use strict';
const themes=[['#89929b','#eeebcf','#73574f'],['#ae6141','#ffc184','#653b43'],['#9692b5','#f0ffe2','#655575'],['#bb653f','#ffd292','#683e4b'],['#383243','#f2f1d7','#c14b45'],['#267ea8','#c5ffff','#323453'],['#24335a','#20bad3','#302940'],['#9b93af','#efffe5','#665877'],['#427e35','#b9e63d','#364b52'],['#c23e35','#fff0d9','#423342'],['#315c37','#8dc33b','#3f3347'],['#2784b1','#39e5ee','#e0d4b6'],['#dc4d2b','#ffe85e','#653843'],['#994f94','#ffd4ae','#473852'],['#5ca337','#c7ef4b','#88528f'],['#af613e','#ffc080','#623749']];
const cache=new Map();
function art(index){
 index=((index%16)+16)%16;if(cache.has(index))return cache.get(index);
 const canvas=document.createElement('canvas');canvas.width=48;canvas.height=48;
 const ctx=canvas.getContext('2d'),cells=new Map(),[main,light,dark]=themes[index];
 function put(t,n,color){const x=8+t+n,y=40-t+n;if(x>0&&y>0&&x<47&&y<47)cells.set(x+','+y,{x,y,color});}
 for(let t=0;t<25;t++)for(let n=-1;n<=1;n++)put(t,n,n===-1?'#bda17b':dark);
 for(let n=-2;n<=2;n++)put(0,n,light);
 for(let t=19;t<33;t++)for(let n=-2;n<=2;n++)put(t,n,n===-2?light:main);
 const dual=[2,3,5,8,9,12,13,14].includes(index);
 const sides=dual?[-1,1]:[1];
 for(const side of sides){
  for(let t=18;t<=32;t++){
   const bend=Math.sin((t-18)/14*Math.PI),reach=3+Math.round(bend*(index===12?8:6));
   for(let n=3;n<=reach;n++){
    if(index===4&&t>21&&t<29&&(n+t)%3===0)continue;
    if(index===7&&n<reach-1)continue;
    put(t,n*side,n===reach?light:n===3?dark:main);
   }
  }
 }
 if([0,1,4,6,10,11,15].includes(index))for(let t=21;t<30;t++)for(let n=-3;n>=-5;n--)put(t,n,t%3===0?light:dark);
 if(index===6)for(let t=18;t<32;t+=3){put(t,8,light);put(t+1,7,main);}
 if(index===10)for(let t=19;t<32;t+=4){put(t,-6,main);put(t+1,-7,light);}
 if(index===12)for(let t=17;t<34;t+=3)for(const side of [-1,1]){put(t,side*9,'#ffbb35');put(t+1,side*10,'#ffe777');}
 if(index===11)for(let t=22;t<=27;t++)for(let n=-4;n<=1;n++)put(t,n,(t===25&&(n===-3||n===0))?'#292839':'#e5dcc0');
 if(index===14)for(let t=23;t<=31;t++)for(let n=-2;n<=3;n++)put(t,n,n%2?'#bde82e':'#76ad37');
 for(const c of cells.values()){ctx.fillStyle='#30283e';for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]])ctx.fillRect(c.x+dx,c.y+dy,1,1);}
 for(const c of cells.values()){ctx.fillStyle=c.color;ctx.fillRect(c.x,c.y,1,1);}
 cache.set(index,canvas);return canvas;
}
function icon(node,item){
 if(!node||!Number.isInteger(item?.referenceSword))return false;
 const key='reference-magic:'+item.referenceSword;
 if(node.dataset.catalogIcon===key&&node.firstElementChild?.classList.contains('reference-sword-art'))return true;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=48;canvas.className='reference-sword-art';canvas.setAttribute('aria-hidden','true');canvas.getContext('2d').drawImage(art(item.referenceSword),0,0);
 node.dataset.catalogIcon=key;node.replaceChildren(canvas);return true;
}
window.GulchReferenceSwordArt=Object.freeze({icon});
const style=document.createElement('style');style.textContent='.reference-sword-art{display:inline-block;width:40px;height:40px;image-rendering:pixelated;vertical-align:middle;flex-shrink:0}.sword-reference-marker{display:inline-block;vertical-align:middle;margin-right:8px}#inventoryDetails .sword-reference-marker .reference-sword-art{width:80px;height:80px}#swordRecipeSection nav button{display:flex!important;align-items:center;gap:8px}#swordRecipeSection article h3 .reference-sword-art,#recipeBook .rb-detail>h3 .reference-sword-art{width:64px;height:64px}.sword-magic-caption{font:11px/1.6 monospace;color:#bde4db;margin:8px 0}';document.head.append(style);
function install(){
 const inventory=document.getElementById('inventoryPanel');if(!inventory)return;
 const previous=window.GulchItemPresentation?.icon;
 window.GulchItemPresentation=Object.freeze({...window.GulchItemPresentation,icon(node,item){if(!icon(node,item))previous?.(node,item);}});
 const items=window.GulchItemCatalog?.items||{},recipes=window.GulchItemCatalog?.recipes||[];
 function marker(node,item){
  if(!node||!Number.isInteger(item?.referenceSword))return;
  let span=Array.from(node.children).find(n=>n.classList.contains('sword-reference-marker'));
  if(!span){span=document.createElement('span');span.className='sword-reference-marker';span.setAttribute('aria-hidden','true');node.prepend(span);}
  icon(span,item);
 }
 function decorate(){
  if(inventory.hidden)return;
  inventory.querySelectorAll('[data-pack-key^="field:"]').forEach(row=>icon(row.classList.contains('equipment-box')?row:row.querySelector('.item-glyph'),items[row.dataset.packKey.slice(6)]));
  inventory.querySelectorAll('[data-sword-choice]').forEach(row=>marker(row,items[row.dataset.swordChoice]));
  inventory.querySelectorAll('.gear-slot').forEach(row=>icon(row.querySelector('.gear-slot-icon'),Object.values(items).find(i=>i.name===row.querySelector('.gear-slot-name')?.textContent)));
  inventory.querySelectorAll('[data-recipe]').forEach(row=>{const r=recipes.find(r=>r.id===row.dataset.recipe);if(r){const item=items[Object.keys(r.output)[0]];const target=row.querySelector('.repair-recipe-art');if(target)icon(target,item);else marker(row,item);}});
  inventory.querySelectorAll('#swordRecipeSection article h3,#inventoryDetails .pack-detail-title,#recipeBook .rb-detail>h3').forEach(node=>{
   const recipe=recipes.find(r=>r.name===node.textContent.trim());
   const item=Object.values(items).find(i=>i.name===node.textContent.trim())||(recipe&&items[Object.keys(recipe.output)[0]]);
   marker(node,item);
  });
  inventory.querySelectorAll('#fieldWorkbench .repair-recipe-art,#recipeBook .repair-recipe-art').forEach(node=>{
   const parent=node.parentElement;
   const label=parent.querySelector('span:not(.repair-recipe-art):not(.sword-reference-marker)');
   const item=Object.values(items).find(i=>i.name===(label?.textContent||parent.textContent).trim());if(item)icon(node,item);
  });
  const r=recipes.find(r=>r.id===document.getElementById('ecosystemRecipe')?.value);if(r)marker(document.getElementById('benchOutput'),items[Object.keys(r.output)[0]]);
 }
 let scheduled=false;function schedule(){if(scheduled||inventory.hidden)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;decorate();});}
 new MutationObserver(schedule).observe(inventory,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','data-inventory-page']});
 Gulch.register('reference-sword-presentation',{snapshot:schedule});schedule();
}
window.addEventListener('load',()=>setTimeout(install,0),{once:true});
})();
