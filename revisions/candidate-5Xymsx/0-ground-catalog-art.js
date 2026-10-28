(function(){
'use strict';
const register=Gulch.register;
let latest=null,ready=false,groundItems=[],occupied=new Set();
const views=new Map(),images=new Map();
function ground(e){return e&&e.id!=='player'&&(e.ecosystemLoot||e.outsideResource||e.livingResource||e.regionFood||e.atlasChart||e.kind==='quest-relic'||e.itemId!=null||/^(item|weapon|armor|armour|consumable|material|relic)$/.test(e.kind||''));}
function projected(name,s){
 if(!ready)return s;
 const entities=name==='renderer'?s.seed.entities.filter(e=>!ground(e)):s.seed.entities.map(e=>e.landscapeTool?{...e,landscapeTool:null}:e);
 return {...s,seed:{...s.seed,entities}};
}
Gulch.register=function(name,callbacks){
 if(!['renderer','landscape-life'].includes(name)||typeof callbacks.snapshot!=='function')return register(name,callbacks);
 const entry={callbacks,snapshot:null};views.set(name,entry);
 return register(name,{...callbacks,snapshot(s){entry.snapshot=s;callbacks.snapshot(projected(name,s));}});
};
const host=document.getElementById('left');if(!host)return;
const canvas=document.createElement('canvas');canvas.id='catalogGroundItems';canvas.setAttribute('aria-hidden','true');canvas.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:2';host.append(canvas);
function definition(id,e){
 const items=window.GulchItemCatalog?.items||{};if(items[id])return items[id];
 for(const source of [latest?.seed.items,latest?.seed.itemDefinitions,latest?.gameState.items]){
  const found=Array.isArray(source)?source.find(v=>v?.id===id):source?.[id];
  if(found&&typeof found==='object')return {...found,id};
 }
 return {id,name:e?.name||id,type:e?.regionFood?'Consumable':e?.kind==='quest-relic'?'Weapon':'Material'};
}
function contents(e){
 if(e.ecosystemLoot)return Object.entries(e.contents||{}).filter(([,n])=>Number(n)>0).map(([id])=>definition(id,e));
 const id=e.outsideResource||e.livingResource||(e.regionFood?'ration':null)||(e.atlasChart?'image_parchment':null)||e.itemId||(e.kind==='quest-relic'?'quest_'+String(e.swordQuestLandmark||e.id):e.id);
 return [definition(id,e)];
}
function artwork(item){
 const key=JSON.stringify([item.id,item.referenceSword,item.type,item.glyph]);
 if(images.has(key))return images.get(key);
 const node=document.createElement('span');
 if(Number.isInteger(item.referenceSword)&&window.GulchReferenceSwordArt)window.GulchReferenceSwordArt.icon(node,item);
 else window.GulchItemPresentation?.icon(node,item);
 let art=node.querySelector('canvas');
 if(!art){art=document.createElement('canvas');art.width=art.height=16;const c=art.getContext('2d');c.fillStyle='#302b39';c.fillRect(3,4,10,9);c.fillStyle='#d5aa68';c.fillRect(4,5,8,7);c.fillStyle='#ffe2a0';c.fillRect(5,5,6,2);c.fillStyle='#806143';c.fillRect(4,9,8,1);}
 if(images.size>=256)images.delete(images.keys().next().value);
 images.set(key,art);return art;
}
function index(){
 groundItems=[];occupied=new Set();if(!latest)return;
 for(const e of latest.seed.entities){
  if(e.map!==latest.mapId)continue;
  if(ground(e)){if(latest.lit[e.y]?.[e.x]===1)groundItems.push({entity:e,items:contents(e)});}
  else occupied.add(e.x+','+e.y);
 }
}
function paint(){
 const w=host.clientWidth,h=host.clientHeight,dpr=Math.min(window.devicePixelRatio||1,2),cw=Math.max(1,Math.round(w*dpr)),ch=Math.max(1,Math.round(h*dpr));
 if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;canvas.style.width=w+'px';canvas.style.height=h+'px';}
 const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.imageSmoothingEnabled=false;
 if(!ready||!latest)return;
 const p=latest.player,v=window.GulchMovementState?.visual,camera=v?.map===p.map?v:p,ts=Math.max(20,Math.min(64,Number(latest.seed.meta?.tileSize)||32));
 for(const entry of groundItems){
  const e=entry.entity,x=w/2+(e.x-camera.x)*ts,y=h/2+(e.y-camera.y)*ts;
  if(x<-ts||x>w+ts||y<-ts||y>h+ts)continue;
  const items=entry.items,shown=items.slice(0,3);if(!shown.length)continue;
  const shared=occupied.has(e.x+','+e.y),size=Math.max(10,Math.floor(ts*(shared?.42:.8)));
  shown.forEach((item,i)=>{const offset=(i-(shown.length-1)/2)*Math.max(3,Math.floor(ts*.13)),xx=x+offset+(shared?ts*.28:0),yy=y+(shown.length-1-i)*2+(shared?ts*.28:0);ctx.drawImage(artwork(item),Math.round(xx-size/2),Math.round(yy-size/2),size,size);});
  if(items.length>1){const bx=Math.round(x+ts*.23),by=Math.round(y+ts*.24);ctx.fillStyle='#162325';ctx.fillRect(bx,by,15,11);ctx.fillStyle='#ffe2a0';ctx.font='9px monospace';ctx.textAlign='center';ctx.textBaseline='top';ctx.fillText(String(items.length),bx+7,by+1);}
 }
}
// Runtime drawMovement already invokes this component's resize on every camera step.
function redraw(){paint();}
register('ground-catalog-art',{snapshot(s){latest=s;index();redraw();},resize:redraw});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)redraw();});
function install(){
 if(!window.GulchItemPresentation?.icon)return;
 ready=true;images.clear();index();
 for(const [name,entry] of views){if(!entry.snapshot)continue;try{entry.callbacks.snapshot(projected(name,entry.snapshot));}catch(error){const box=document.getElementById('moduleErrors');if(box)box.textContent='Ground art: '+String(error.message||error).slice(0,200);}}
 redraw();
 const panel=document.getElementById('itemContext'),title=document.getElementById('itemContextTitle');
 if(panel&&title){
  const preview=document.createElement('canvas');preview.width=preview.height=48;preview.setAttribute('aria-hidden','true');preview.style.cssText='width:48px;height:48px;image-rendering:pixelated';
  const recipes=document.createElement('p');title.after(preview);panel.append(recipes);
  function update(){
   if(panel.hidden)return;
   const catalog=window.GulchItemCatalog,items=catalog?.items||{};
   let item=Object.values(items).find(i=>i.name===title.textContent),recipeId=item?.id;
   if(!item&&latest){const e=latest.seed.entities.find(e=>ground(e)&&e.name===title.textContent);if(e&&!e.ecosystemLoot){item=contents(e)[0];recipeId=e.outsideResource||e.livingResource?('$'+(e.outsideResource||e.livingResource)):e.regionFood||e.atlasChart||e.kind==='quest-relic'?null:item?.id;}}
   preview.hidden=!item;if(!item){recipes.textContent='';return;}
   const ctx=preview.getContext('2d');ctx.clearRect(0,0,48,48);ctx.imageSmoothingEnabled=false;ctx.drawImage(artwork(item),0,0,48,48);
   const related=recipeId?(catalog?.recipes||[]).filter(r=>r.input[recipeId]||r.output[recipeId]):[];
   const text=related.length?'Recipe book: '+related.map(r=>r.name).join(' · '):'No crafting recipe uses or produces this item. Its existing collection and use rules still apply.';
   if(recipes.textContent!==text)recipes.textContent=text;
  }
  new MutationObserver(update).observe(title,{childList:true,characterData:true,subtree:true});new MutationObserver(update).observe(panel,{attributes:true,attributeFilter:['hidden']});
 }
 const help=document.getElementById('keyHelp');if(help){const p=document.createElement('p');p.textContent='Ground items use the pack and recipe-book artwork. Mixed caches display up to three icons and their distinct item count. Right-click to inspect contents and recipes.';help.append(p);}
}
window.addEventListener('load',()=>setTimeout(install,0),{once:true});
})();
