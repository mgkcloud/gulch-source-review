(function(){
'use strict';
function install(){
 const inventory=document.getElementById('inventoryPanel');
 if(!inventory)return;
 const palette={o:'#302b39',s:'#657985',m:'#a5bbc3',h:'#e5e3cb',w:'#91613e',t:'#dbad70',g:'#dfa746',y:'#ffe29a',r:'#b94559',p:'#ed8990',b:'#408ba7',c:'#8cdae0',v:'#765b97',l:'#b6a1d2',f:'#427859',n:'#96bd73'};
 const patterns={
 blade:['...........oo','..........omo','.........omho','........omho.','.......omho..','......omho...','...ooomho....','...ogmho.....','....ogo......','...owogo.....','..owoo.go....','.ogo.........','..o..........'],
 axe:['......oooo...','.....omhhmo..','.....ommmmo..','......ommo...','.....owoo....','....owto.....','...owto......','..owto.......','.owto........','..oo.........'],
 bow:['....oooo.....','...owttoo....','..owoo.owo...','.owo....owo..','.owo.....owo.','.oyo.....owo.','.oyo....owo..','..oyo..owo...','...oyoowo....','....oooo.....'],
 armor:['...oo...oo...','..ofno.onfo..','.ofnnooonnfo.','ofnnnnnnnnnfo','ofnofffffonfo','.ooofnnnfooo.','...ofnnnfo...','...ofnnnfo...','...owgggwo...','...ofnnnfo...','...ooooooo...'],
 shield:['..ooooooooo..','.ogyyyyyyygo.','.ogybbbyygo..','.ogybbbbygo..','.ogybbbbygo..','..ogybbygo...','..ogybbygo...','...ogy ygo...','....ogygo....','.....ogo.....','......o......'],
 potion:['....oooo.....','....owwo.....','...oshhso....','....ocbo.....','....ocbo.....','...ocbbbo....','..ocbbbbbo...','.ocbppprrbo..','.ocbprrrrbo..','.ocbrrrrrbo..','..obrrrrbo...','...oooooo....'],
 gem:['....oooo.....','...obccbo....','..obccccbo...','.obccbcc cbo.','obcccbccbbbo.','obccbbb b bbo','obbbbbbbbbbo.','.obbbbbbbo...','..obbbbbo....','...obbbo.....','....ooo......'],
 scroll:['..oooooooo...','.othhhhhhhto.','.otoooooooto.','..ohhhhhho...','..ohttthho...','..ohhhhhho...','..ohr rrho...','..ohr rrho...','..ohhhhhho...','.otoooooooto.','.ottttttttto.','..oooooooo...'],
 coin:['....oooo.....','..oogyygoo...','.ogyhhhygo...','.ogyhghygo...','ogyhhghhygo..','ogyhhghhygo..','.ogyhghygo...','.ogyhhhygo...','..oogyygoo...','....oooo.....'],
 log:['.......ooo...','.....oowwto..','...oowwttwo..','.oowwttwwwo..','ottttwwwwwo..','otyytwwwo....','otyytwo......','otttwo.......','.oooo........'],
 leaf:['........ooo..','......oofno..','....oofnnfo..','...ofnnnnfo..','..ofnnfnfo...','.ofnnfnfo....','.ofnfnfo.....','..ofnfo......','...owo.......','..owo........'],
 ingot:['....oooooo...','...omhhhhmo..','..omhhhhhmmo.','.omhhhhhmmmo.','omhhhhhmmsso.','osmmmmmmssso.','ossssssssso..','.ooooooooo...'],
 bag:['....ooooo....','...owtttwo...','...owooowo...','..oowwwwwoo..','.owtttttttwo.','owtttttttttwo','owwwwwggwwwwo','owtttwyywttwo','owtttwggwttwo','owtttttttttwo','.ooooooooooo.']
 };
 const cache=new Map();
 function design(item){
  const id=String(item.id||item.name||'').toLowerCase();
  if(/shield/.test(id))return 'shield';
  if(/axe|sickle/.test(id))return 'axe';
  if(/bow/.test(id))return 'bow';
  if(/blade|sword|knife|spear|flail|star|boomerang/.test(id)||item.type==='Weapon')return 'blade';
  if(item.type==='Armor')return 'armor';
  if(/potion|tonic|salve|ichor|gel|cell/.test(id)||item.type==='Consumable')return 'potion';
  if(/scroll|parchment|bandage|relic/.test(id))return 'scroll';
  if(/coin|ring|crown|pendant/.test(id))return 'coin';
  if(/wood/.test(id))return 'log';
  if(/fiber|herb|spore/.test(id))return 'leaf';
  if(/scrap|alloy|iron|copper|wire|bar|circuit/.test(id))return 'ingot';
  if(/satchel|pouch|hide/.test(id))return 'bag';
  return 'gem';
 }
 function sprite(item){
  const kind=design(item),id=String(item.id||'');
  const tint=/red|ruby/.test(id)?'red':/emerald/.test(id)?'green':'normal';
  const key=kind+':'+tint;
  if(cache.has(key))return cache.get(key);
  const canvas=document.createElement('canvas');canvas.width=16;canvas.height=16;
  const ctx=canvas.getContext('2d');
  const colors=Object.assign({},palette);
  if(tint==='red'){colors.b=palette.r;colors.c=palette.p;}
  if(tint==='green'){colors.b=palette.f;colors.c=palette.n;}
  patterns[kind].forEach(function(row,y){
   Array.from(row).forEach(function(pixel,x){
    if(colors[pixel]){ctx.fillStyle=colors[pixel];ctx.fillRect(x+1,y+1,1,1);}
   });
  });
  cache.set(key,canvas);return canvas;
 }
 function icon(node,item){
  if(!node||!item)return;
  const key='repair156:'+String(item.id||item.name||'')+':'+design(item);
  if(node.dataset.catalogIcon===key&&node.firstElementChild&&node.firstElementChild.classList.contains('repaired-item-art'))return;
  const canvas=document.createElement('canvas');canvas.width=16;canvas.height=16;canvas.className='repaired-item-art';canvas.setAttribute('aria-hidden','true');
  canvas.getContext('2d').drawImage(sprite(item),0,0);
  node.dataset.catalogIcon=key;node.replaceChildren(canvas);
 }
 window.GulchItemPresentation=Object.freeze(Object.assign({},window.GulchItemPresentation||{},{icon:icon}));
 const style=document.createElement('style');
 style.textContent='.repaired-item-art{display:inline-block;width:32px;height:32px;image-rendering:pixelated;vertical-align:middle;flex-shrink:0}#inventoryPanel .equipment-box .repaired-item-art{width:32px;height:32px}.repair-recipe-art{display:inline-block;margin-right:7px;vertical-align:middle;pointer-events:none}.repair-recipe-art .repaired-item-art{width:24px;height:24px}#fieldWorkbench .bench-cell .repair-recipe-art{margin:0 auto 4px}#lootReveal .repaired-item-art{width:24px;height:24px}';
 document.head.append(style);
 function mark(node,item){
  if(!node||!item)return;
  let marker=Array.from(node.children).find(function(n){return n.classList.contains('repair-recipe-art');});
  if(!marker){marker=document.createElement('span');marker.className='repair-recipe-art';marker.setAttribute('aria-hidden','true');node.prepend(marker);}
  icon(marker,item);
 }
 function decorate(){
  if(inventory.hidden)return;
  const catalog=window.GulchItemCatalog;
  if(!catalog)return;
  const items=catalog.items;
  inventory.querySelectorAll('[data-pack-key]').forEach(function(row){
   const key=row.dataset.packKey||'';
   const id=key.indexOf('field:')===0?key.slice(6):key.indexOf('resource:')===0?key.slice(9):null;
   if(!id)return;
   const target=row.classList.contains('equipment-box')?row:row.querySelector('.item-glyph');
   icon(target,items[id]||{id:id,type:'Material'});
  });
  inventory.querySelectorAll('.gear-slot').forEach(function(row){
   const label=row.querySelector('.gear-slot-name');
   const item=Object.values(items).find(function(i){return label&&i.name===label.textContent;});
   if(item)icon(row.querySelector('.gear-slot-icon'),item);
  });
  const names=new Map(Object.values(items).map(function(i){return [i.name,i];}));
  ['wood','stone','iron','copper','crystal'].forEach(function(id){
   const item={id:id,type:'Material'};names.set(id,item);names.set(id+' (outdoor)',item);
  });
  inventory.querySelectorAll('#recipeBook tbody th,#fieldWorkbench tbody th').forEach(function(cell){
   const item=names.get(cell.textContent.trim());if(item)mark(cell,item);
  });
  inventory.querySelectorAll('#fieldWorkbench .bench-cell').forEach(function(cell){
   const label=Array.from(cell.children).find(function(n){return n.tagName==='SPAN'&&!n.classList.contains('repair-recipe-art');});
   const item=label&&names.get(label.textContent.trim());if(item)mark(cell,item);
  });
  inventory.querySelectorAll('#recipeBook [data-recipe]').forEach(function(row){
   const recipe=catalog.recipes.find(function(r){return r.id===row.dataset.recipe;});
   if(recipe)mark(row,items[Object.keys(recipe.output)[0]]);
  });
  const selected=inventory.querySelector('#recipeBook [data-recipe][aria-pressed=true]');
  const recipe=selected&&catalog.recipes.find(function(r){return r.id===selected.dataset.recipe;});
  if(recipe)mark(inventory.querySelector('#recipeBook .rb-detail > p'),items[Object.keys(recipe.output)[0]]);
  const selector=document.getElementById('ecosystemRecipe');
  const blueprint=selector&&catalog.recipes.find(function(r){return r.id===selector.value;});
  if(blueprint)mark(document.getElementById('benchOutput'),items[Object.keys(blueprint.output)[0]]);
 }
 let scheduled=false;
 function schedule(){
  if(scheduled||inventory.hidden)return;
  scheduled=true;
  requestAnimationFrame(function(){scheduled=false;decorate();});
 }
 new MutationObserver(schedule).observe(inventory,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','data-inventory-page']});
 Gulch.register('repaired-inventory-pixel-art',{snapshot:schedule});
 schedule();
}
if(document.readyState==='complete')install();else window.addEventListener('load',install,{once:true});
})();
