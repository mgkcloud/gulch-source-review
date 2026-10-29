(function(){
'use strict';
let latest=null,canvas=null,frame=0,last=0,queued=false;
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
const marked=new Set();
const catalog=()=>window.GulchItemCatalog?.items||{};
const epoch=d=>String(d?.respawnSettings?.token||'original');
const supreme=item=>item?.letterTier?.letter==='S';
const style=document.createElement('style');
style.textContent=`
.gulch-s-radiance{position:relative;isolation:isolate;overflow:visible!important;filter:drop-shadow(0 0 4px #ffd467) drop-shadow(0 0 8px #e9ae4770)}
.gulch-s-radiance::before{content:'';position:absolute;inset:-3px;pointer-events:none;z-index:2;border-radius:inherit;background:linear-gradient(115deg,transparent 25%,#fff8d280 46%,#ffffffcc 50%,transparent 65%);background-size:260% 100%;animation:gulch-s-shine 3.8s ease-in-out infinite;mix-blend-mode:screen}
.gulch-s-radiance::after{content:'✦';position:absolute;right:-3px;top:-5px;pointer-events:none;z-index:3;color:#fff3bf;font:12px/1 monospace;text-shadow:0 0 5px #ffd15c,0 0 9px #ffd15c;animation:gulch-s-spark 2.4s ease-in-out infinite}
@keyframes gulch-s-shine{0%,20%{background-position:140% 0;opacity:0}35%{opacity:.85}58%{background-position:-40% 0;opacity:0}100%{background-position:-40% 0;opacity:0}}
@keyframes gulch-s-spark{0%,100%{opacity:.35;transform:scale(.65) rotate(0deg)}50%{opacity:1;transform:scale(1.15) rotate(45deg)}}
@media(prefers-reduced-motion:reduce){.gulch-s-radiance::before{animation:none;background:none}.gulch-s-radiance::after{animation:none;opacity:.8;transform:none}}
`;
document.head.append(style);
function decorate(){
 queued=false;
 const items=catalog(),wanted=new Set();
 function mark(node,item){if(node&&supreme(item))wanted.add(node);}
 for(const row of document.querySelectorAll('[data-pack-key^="field:"]'))mark(row.matches('.equipment-box')?row:row.querySelector('.item-glyph'),items[row.dataset.packKey.slice(6)]);
 for(const row of document.querySelectorAll('#merchantGoodsGrid button[data-item],#playerBarterGrid button[data-item]'))mark(row.querySelector('.merchant-goods-art,.player-barter-art'),items[row.dataset.item]);
 for(const row of document.querySelectorAll('[data-sword-choice]'))mark(row.querySelector('.sword-reference-marker'),items[row.dataset.swordChoice]);
 const recipes=window.GulchItemCatalog?.recipes||[];
 for(const row of document.querySelectorAll('[data-recipe]')){
  const recipe=recipes.find(r=>r.id===row.dataset.recipe);
  if(recipe)mark(row.querySelector('.repair-recipe-art,.sword-reference-marker'),items[Object.keys(recipe.output)[0]]);
 }
 const names=new Map(Object.values(items).map(item=>[item.name,item]));
 for(const node of document.querySelectorAll('.expanded-slot,.gear-slot')){
  const name=node.querySelector('.expanded-slot-name,.gear-slot-name')?.textContent;
  mark(node.querySelector('.expanded-slot-art,.gear-slot-icon'),names.get(name));
 }
 for(const node of document.querySelectorAll('#inventoryDetails .pack-detail-title,#swordRecipeSection article h3,#recipeBook .rb-detail>h3,#merchantItemInfoTitle,#chestRewardDetail h3,#tradeReceiptItems h3,#itemContextTitle')){
  const name=node.textContent.trim().replace(/\s*×\s*\d+\s*$/,'');
  const recipe=recipes.find(r=>r.name===name);
  const item=names.get(name)||(recipe&&items[Object.keys(recipe.output)[0]]);
  mark(node.querySelector('.sword-reference-marker'),item);
  const container=node.closest('#chestRewardDetail,article,#merchantItemInfo,#itemContext');
  if(container)mark(container.querySelector('.cr-preview,.receipt-art,.mi-art'),item);
  if(node.id==='itemContextTitle')mark(node,item);
 }
 for(const row of document.querySelectorAll('#chestRewardList button')){
  const label=row.querySelector('span:not(.cr-icon)');
  const name=label?Array.from(label.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim():'';
  mark(row.querySelector('.cr-icon'),names.get(name));
 }
 for(const node of marked)if(!wanted.has(node)){node.classList.remove('gulch-s-radiance');marked.delete(node);}
 for(const node of wanted){if(!marked.has(node)){node.classList.add('gulch-s-radiance');marked.add(node);}}
}
function schedule(){if(queued||document.hidden)return;queued=true;queueMicrotask(decorate);}
function points(){
 if(!latest||latest.player.hp<=0)return [];
 const items=catalog(),data=latest.gameState,p=latest.player;
 const pack=data.itemEcosystem?.epoch===epoch(data)?data.itemEcosystem:null;
 const result=[];
 if(pack&&Object.values(pack.equipment||{}).some(id=>supreme(items[id])&&Number(pack.bag?.[id])>0))result.push({x:p.x,y:p.y,player:true});
 for(const e of latest.seed.entities){
  if(e.id==='player'||e.map!==p.map||latest.lit[e.y]?.[e.x]!==1)continue;
  const ids=e.ecosystemLoot?Object.keys(e.contents||{}).filter(id=>Number(e.contents[id])>0):[e.itemId||e.landscapeTool||e.id];
  if(ids.some(id=>supreme(items[id])))result.push({x:e.x,y:e.y,player:false});
  if(result.length>=48)break;
 }
 return result;
}
function paint(now){
 if(!canvas||!latest||document.hidden)return;
 const host=canvas.parentElement,w=host.clientWidth,h=host.clientHeight,dpr=Math.min(window.devicePixelRatio||1,2);
 const cw=Math.max(1,Math.round(w*dpr)),ch=Math.max(1,Math.round(h*dpr));
 if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;canvas.style.width=w+'px';canvas.style.height=h+'px';}
 const c=canvas.getContext('2d');if(!c)return;
 c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
 const p=latest.player,v=window.GulchMovementState?.visual,cam=v?.map===p.map?v:p,ts=Math.max(20,Math.min(64,Number(latest.seed.meta?.tileSize)||32));
 const time=reduced.matches?0:now/1000;
 for(const q of points()){
  const x=q.player?w/2:w/2+(q.x-cam.x)*ts,y=q.player?h/2:h/2+(q.y-cam.y)*ts;
  if(x<-ts||y<-ts||x>w+ts||y>h+ts)continue;
  const pulse=reduced.matches?1:.85+.15*Math.sin(time*2.5+q.x);
  const r=ts*.72,g=c.createRadialGradient(x,y,ts*.12,x,y,r);
  g.addColorStop(0,'#ffe69a00');g.addColorStop(.48,'#ffce5938');g.addColorStop(1,'#ffd46600');
  c.globalAlpha=pulse;c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
  c.strokeStyle='#ffdf9380';c.lineWidth=1;c.beginPath();c.ellipse(x,y+ts*.3,ts*.42,ts*.16,0,0,Math.PI*2);c.stroke();
  for(let i=0;i<4;i++){
   const phase=(time*.42+i*.25+(q.x+q.y)*.031)%1;
   const angle=i*Math.PI/2+time*.35;
   const sx=x+Math.cos(angle)*ts*(.28+i*.055),sy=y+Math.sin(angle)*ts*.32-ts*phase*.42;
   const size=1.4+Math.sin(phase*Math.PI)*2;
   c.globalAlpha=reduced.matches?.7:Math.sin(phase*Math.PI)*.9;c.fillStyle='#fff5cb';
   c.fillRect(Math.round(sx-size),Math.round(sy),size*2+1,1);
   c.fillRect(Math.round(sx),Math.round(sy-size),1,size*2+1);
  }
 }
 c.globalAlpha=1;
}
function tick(now){frame=0;if(document.hidden||reduced.matches)return;if(now-last>=50){last=now;paint(now);}if(points().length)frame=requestAnimationFrame(tick);}
function wake(){paint(performance.now());if(!frame&&!document.hidden&&!reduced.matches&&points().length)frame=requestAnimationFrame(tick);}
Gulch.register('s-tier-radiance',{snapshot(s){latest=s;schedule();wake();},resize(){paint(performance.now());}});
function mount(){
 const host=document.getElementById('left');if(!host)return;
 canvas=document.createElement('canvas');canvas.id='sTierRadiance';canvas.setAttribute('aria-hidden','true');canvas.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:4';host.append(canvas);
 new MutationObserver(records=>{
  if(records.some(r=>!(r.target instanceof Element)||!r.target.closest('#sTierRadiance')))schedule();
 }).observe(document.body,{subtree:true,childList:true,characterData:true});
 schedule();wake();
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(frame)cancelAnimationFrame(frame);frame=0;}else{schedule();wake();}});
reduced.addEventListener('change',()=>{if(frame)cancelAnimationFrame(frame);frame=0;wake();});
if(document.readyState==='complete')mount();else window.addEventListener('load',mount,{once:true});
})();
