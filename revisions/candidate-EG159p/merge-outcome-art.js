(function(){
'use strict';
const cache=new Map();
const palettes={Ember:['#783b51','#e87551','#ffd494'],Moon:['#545278','#a6aee0','#f0f6df'],Thorn:['#33564d','#78b45e','#d4efa0'],Storm:['#394f80','#56b9d2','#c6fbef'],Dawn:['#956044','#eabc58','#fff2b7'],Frost:['#45647e','#93d6da','#efffff']};
const fixed={merge_twinfang:['blade','Thorn',1],merge_emberglass:['blade','Ember',2],merge_moonwell:['potion','Moon',1],merge_starcutter:['blade','Storm',3],merge_dawnheart:['potion','Dawn',3],merge_crownless:['blade','Dawn',4]};
const forms=['Reliquary','Heart','Prism','Sigil','Crown','Echo'];
function hash(text){let h=2166136261;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
function eligible(item){return Boolean(item&&(item.freeformFusion||fixed[item.id]));}
function model(item){
 const preset=fixed[item.id];
 const theme=preset?.[1]||Object.keys(palettes).find(t=>String(item.name).startsWith(t+' '))||'Moon';
 const form=preset?.[0]||forms.find(f=>String(item.name).includes(' '+f))||'Prism';
 const generation=Math.max(1,Math.min(99,Number(item.fusionGeneration)||preset?.[2]||1));
 const kind=item.fusionPower?.kind||(/restore|restorative/i.test(item.description||'')?'mend':'flare');
 const seed=hash([preset?item.id:theme,form,generation,kind,item.lore||''].join('|'));
 return {theme,form,generation,kind,seed,level:preset?.[2]||Math.min(4,1+Math.floor((Number(item.letterTier?.index)||0)/8)),preset:item.id};
}
function sprite(item){
 const m=model(item),key=JSON.stringify(m);
 if(cache.has(key))return {key,canvas:cache.get(key)};
 const canvas=document.createElement('canvas');canvas.width=canvas.height=32;
 const c=canvas.getContext('2d'),pixels=new Map(),ink='#392b40',metal='#b48b61',gold='#ecd095';
 const [dark,mid,light]=palettes[m.theme];
 function dot(x,y,color){x=Math.round(x);y=Math.round(y);if(x>=1&&x<31&&y>=1&&y<31)pixels.set(x+','+y,{x,y,color});}
 function box(x,y,w,h,color){for(let j=0;j<h;j++)for(let i=0;i<w;i++)dot(x+i,y+j,color);}
 function poly(points,color){
  for(let y=1;y<31;y++)for(let x=1;x<31;x++){
   let inside=false;
   for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[i],b=points[j];
    if((a[1]>y+.5)!==(b[1]>y+.5)&&(x+.5)<(b[0]-a[0])*(y+.5-a[1])/(b[1]-a[1])+a[0])inside=!inside;
   }
   if(inside)dot(x,y,color);
  }
 }
 function gem(x,y,r){poly([[x,y-r],[x+r,y],[x,y+r],[x-r,y]],dark);poly([[x,y-r],[x+r,y],[x,y+1],[x-r,y]],mid);poly([[x,y-r],[x,y],[x-r,y]],light);dot(x,y,light);}
 function ring(cx,cy,rx,ry,color){for(let y=1;y<31;y++)for(let x=1;x<31;x++){const d=((x-cx)/rx)**2+((y-cy)/ry)**2;if(d<=1&&d>=.62)dot(x,y,color);}}
 if(m.form==='blade'){
  poly([[5,26],[22,7],[27,3],[26,10],[9,28]],dark);
  poly([[8,23],[23,6],[26,5],[24,10],[10,25]],mid);
  poly([[9,23],[23,7],[25,6],[11,24]],light);
  poly([[4,27],[7,24],[9,26],[6,29]],metal);
  poly([[7,20],[13,26],[15,25],[8,18]],gold);
  if(m.preset==='merge_twinfang'){poly([[13,18],[21,15],[27,9],[24,16],[17,22]],mid);poly([[16,19],[24,14],[19,20]],light);}
  if(m.preset==='merge_emberglass'){gem(20,12,3);box(14,19,2,2,'#ffad65');box(17,16,2,2,'#ffad65');}
  if(m.preset==='merge_starcutter'){poly([[14,10],[19,10],[20,5],[21,10],[26,11],[21,12],[20,17],[19,12]],light);}
  if(m.preset==='merge_crownless'){poly([[7,18],[6,14],[10,17],[12,14],[13,20],[17,21],[17,24],[12,23]],mid);gem(11,21,3);box(19,5,2,3,gold);box(26,13,2,2,light);}
 }else if(m.form==='potion'){
  box(13,4,6,3,metal);box(12,7,8,2,gold);box(14,9,4,4,light);
  poly([[12,12],[19,12],[24,17],[25,24],[21,28],[11,28],[7,24],[8,17]],'#747c98');
  poly([[12,14],[19,14],[23,18],[23,24],[20,26],[12,26],[9,23],[10,18]],dark);
  poly([[10,19],[22,18],[23,24],[20,26],[12,26],[9,23]],mid);
  box(10,17,2,5,light);box(12,25,7,1,light);box(15,4,3,1,'#ffe8bf');
  if(m.preset==='merge_moonwell'){ring(17,21,4,4,light);box(18,17,4,5,mid);}
  else{gem(16,21,4);box(15,20,3,2,'#fff9d4');dot(16,18,'#fff9d4');}
 }else if(m.form==='Reliquary'){
  box(8,10,16,17,dark);box(10,11,12,14,mid);box(7,8,18,4,metal);box(9,7,14,2,gold);
  box(8,13,2,13,gold);box(22,13,2,13,metal);box(10,25,12,2,gold);box(13,13,6,9,dark);gem(16,17,4);
 }else if(m.form==='Heart'){
  poly([[16,10],[12,6],[7,7],[4,12],[6,19],[16,28],[26,19],[28,12],[24,7],[20,6]],dark);
  poly([[16,13],[12,8],[8,9],[6,13],[8,18],[16,25],[24,18],[26,13],[23,9],[20,8]],mid);
  poly([[8,10],[12,10],[14,14],[10,16],[7,14]],light);poly([[16,15],[19,19],[16,25],[13,20]],metal);gem(16,18,3);
 }else if(m.form==='Prism'){
  poly([[16,3],[25,11],[22,24],[16,29],[8,24],[6,11]],dark);
  poly([[16,4],[23,11],[16,14],[8,11]],light);poly([[8,12],[15,15],[16,27],[10,23]],mid);
  poly([[17,15],[23,12],[21,23],[17,27]],'#7699af');box(7,12,18,2,gold);dot(16,7,'#ffffff');
 }else if(m.form==='Sigil'){
  ring(16,17,11,11,metal);ring(16,17,9,9,gold);gem(16,17,8);box(15,5,3,3,light);box(15,27,3,2,mid);
  box(15,12,2,10,light);box(11,16,10,2,light);
 }else if(m.form==='Crown'){
  poly([[5,10],[11,15],[16,6],[21,15],[27,10],[24,25],[8,25]],metal);
  poly([[7,13],[11,18],[16,10],[21,18],[25,13],[22,23],[10,23]],mid);
  box(8,24,16,3,gold);gem(16,20,4);gem(6,10,2);gem(26,10,2);gem(16,6,2);box(10,25,3,1,light);
 }else{
  ring(16,18,10,10,dark);ring(16,18,8,9,mid);ring(16,18,6,7,gold);
  box(13,4,6,2,metal);box(15,6,2,3,gold);gem(16,18,4);box(15,13,1,5,light);box(16,18,4,1,light);
 }
 if(!fixed[item.id]){
  const rune=m.kind==='ward'?gold:m.kind==='mend'?'#c9efae':'#ffbb8f';
  const x=24,y=25;box(x-3,y-3,7,7,ink);gem(x,y,3);
  if(m.kind==='mend'){box(x-2,y,5,1,rune);box(x,y-2,1,5,rune);}
  else if(m.kind==='ward'){box(x-2,y-2,5,1,rune);box(x-2,y-1,1,3,rune);box(x+2,y-1,1,3,rune);dot(x,y+2,rune);}
  else{dot(x,y-2,rune);box(x-1,y-1,3,3,rune);dot(x,y+2,rune);}
  for(let i=0;i<5;i++)if((m.seed>>>i)&1)dot(10+i*2,29,light);
 }
 const body=Array.from(pixels.values());
 for(const p of body)for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]])if(!pixels.has((p.x+dx)+','+(p.y+dy))){c.fillStyle=ink;c.fillRect(p.x+dx,p.y+dy,1,1);}
 for(const p of body){c.fillStyle=p.color;c.fillRect(p.x,p.y,1,1);}
 c.fillStyle=light;
 for(let i=0;i<m.level;i++){const x=i%2?27:3,y=4+Math.floor(i/2)*12;c.fillRect(x,y,1,3);c.fillRect(x-1,y+1,3,1);}
 if(cache.size>=192)cache.delete(cache.keys().next().value);cache.set(key,canvas);return {key,canvas};
}
function icon(node,item){
 if(!node||!eligible(item))return false;
 const art=sprite(item),key='fusion-art:'+art.key;
 if(node.dataset.fusionArt===key&&node.childNodes.length===1&&node.firstChild.classList?.contains('fusion-outcome-icon'))return true;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=32;canvas.className='fusion-outcome-icon';canvas.setAttribute('aria-hidden','true');canvas.getContext('2d').drawImage(art.canvas,0,0);
 node.dataset.fusionArt=key;node.replaceChildren(canvas);return true;
}
window.GulchFusionArt=Object.freeze({icon});
function install(){
 const presentation=window.GulchItemPresentation||{},oldIcon=presentation.icon;
 window.GulchItemPresentation=Object.freeze({...presentation,icon(node,item){if(!icon(node,item))oldIcon?.(node,item);}});
 const reference=window.GulchReferenceSwordArt;
 if(reference)window.GulchReferenceSwordArt=Object.freeze({...reference,icon(node,item){return icon(node,item)||reference.icon(node,item);}});
 const style=document.createElement('style');style.textContent='.fusion-outcome-icon{display:block;width:40px;height:40px;image-rendering:pixelated;object-fit:contain;flex-shrink:0}.fusion-outcome-preview{display:block;float:left;width:80px;height:80px;margin:0 14px 10px 0;background:#302b3944;border:1px solid #a9947166;border-radius:5px}.fusion-outcome-preview .fusion-outcome-icon{width:100%;height:100%}#mergeForge article{display:flow-root}#mergeForge [data-fusion-item]>.fusion-outcome-preview{width:64px;height:64px}';document.head.append(style);
 let scheduled=false;
 function marker(host,item){
  if(!host)return;
  let node=host.querySelector(':scope > .fusion-outcome-preview');
  if(!eligible(item)){node?.remove();return;}
  if(!node){node=document.createElement('span');node.className='fusion-outcome-preview';node.setAttribute('aria-hidden','true');host.prepend(node);}
  icon(node,item);
 }
 function decorate(){
  scheduled=false;const items=window.GulchItemCatalog?.items||{};
  for(const row of document.querySelectorAll('[data-fusion-item],[data-pack-key^="field:"],[data-item],[data-sword-choice]')){
   const id=row.dataset.fusionItem||row.dataset.packKey?.slice(6)||row.dataset.item||row.dataset.swordChoice,item=items[id];
   if(!eligible(item))continue;
   if(row.matches('#mergeForge article'))marker(row,item);
   else icon(row.matches('.equipment-box')?row:row.querySelector('.merge-choice-art,.item-glyph,.merchant-goods-art,.player-barter-art,.sword-reference-marker'),item);
  }
  for(const row of document.querySelectorAll('[data-recipe]')){
   const recipe=window.GulchItemCatalog?.recipes.find(r=>r.id===row.dataset.recipe),item=items[Object.keys(recipe?.output||{})[0]];
   if(eligible(item))icon(row.querySelector('.repair-recipe-art,.sword-reference-marker'),item);
  }
  const preview=document.querySelector('#mergeForge > article');
  if(preview){
   const text=Array.from(preview.childNodes).filter(n=>!n.classList?.contains('fusion-outcome-preview')).map(n=>n.textContent).join('');
   const name=text.split('\n')[0],generation=Number(text.match(/Generation (\d+)/)?.[1])||1;
   const theme=Object.keys(palettes).find(t=>name.startsWith(t+' '));
   const lore=text.split('\n')[1]||'';
   marker(preview,theme?{name,freeformFusion:true,fusionGeneration:generation,lore,letterTier:{index:window.GulchItemTiers?.letters.indexOf(text.match(/Tier ([A-Z])/ )?.[1])||0},fusionPower:{kind:text.includes('prevent up to')?'ward':text.includes('restore up to')?'mend':'flare'}}:null);
  }
  for(const node of document.querySelectorAll('#inventoryDetails .pack-detail-title,#itemContextTitle,#merchantItemInfoTitle,#chestRewardDetail h3,#tradeReceiptItems h3')){
   const name=node.textContent.trim().replace(/\s*×\s*\d+\s*$/,'');const item=Object.values(items).find(i=>i.name===name);
   if(eligible(item))marker(node.parentElement,item);
  }
 }
 function schedule(){if(scheduled||document.hidden)return;scheduled=true;requestAnimationFrame(decorate);}
 new MutationObserver(schedule).observe(document.getElementById('left'),{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','data-inventory-page']});
 Gulch.register('fusion-outcome-art',{snapshot:schedule});
 document.addEventListener('visibilitychange',schedule);schedule();
}
function queueInstall(){setTimeout(()=>setTimeout(install,0),0);}
if(document.readyState==='complete')queueInstall();else window.addEventListener('load',queueInstall,{once:true});
})();
