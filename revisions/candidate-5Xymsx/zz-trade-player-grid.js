(function(){
'use strict';
const panel=document.getElementById('tradePanel'),offer=document.getElementById('barterOffer');
if(!panel||!offer)return;
let signature='',scheduled=false;
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
const style=el('style');style.textContent=`
#tradePanel #barterOffer{display:none!important}
#playerBarterHeading{margin:14px 0 4px;color:#f3d39b;font-size:13px}
#playerBarterHint{margin:4px 0 8px;color:#c1d0c2;font-size:10px}
#playerBarterGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(82px,1fr));gap:6px;max-height:210px;overflow:auto;padding:4px;scrollbar-gutter:stable}
#tradePanel #playerBarterGrid button{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0;width:100%;min-height:104px;padding:7px 5px;background:#14262c;color:#e9e3cd;border:1px solid #627869;border-radius:3px;font:10px/1.35 monospace;text-align:center;overflow-wrap:anywhere}
#tradePanel #playerBarterGrid button:hover{background:#294238;border-color:#d3b77e}
#tradePanel #playerBarterGrid button[aria-pressed=true]{background:#354b39;border-color:#ffe0a0;box-shadow:inset 0 0 0 1px #ffe0a0}
#tradePanel #playerBarterGrid button:focus-visible{outline:2px solid #ffe0a0;outline-offset:1px}
.player-barter-art{display:grid;place-items:center;width:34px;height:34px;background:#0c1b21;border:1px solid #455f54;border-radius:3px;flex-shrink:0}
#playerBarterGrid .player-barter-art canvas,#playerBarterGrid .player-barter-art img{display:block;width:32px;height:32px;margin:0;image-rendering:pixelated;object-fit:contain}
.player-barter-name{flex:1;color:#f2dfb5}
.player-barter-count{color:#c0d5b6;font-size:9px}
#playerBarterEmpty{font-size:11px;color:#d3c8ae}
@media(max-width:600px){#playerBarterGrid{grid-template-columns:repeat(auto-fill,minmax(76px,1fr));max-height:180px}}
`;document.head.append(style);
const heading=el('h3','Your items · pay with');heading.id='playerBarterHeading';
const hint=el('p','Select an item to offer. Counts exclude equipped copies. The item you are buying is excluded.');hint.id='playerBarterHint';
const grid=el('div');grid.id='playerBarterGrid';grid.setAttribute('role','group');grid.setAttribute('aria-labelledby',heading.id);grid.setAttribute('aria-describedby',hint.id);
const empty=el('p','No eligible items to offer. Collect supplies or choose different merchant goods.');empty.id='playerBarterEmpty';empty.hidden=true;
offer.after(heading,hint,grid,empty);
const label=panel.querySelector('label[for="barterOffer"]');if(label)label.hidden=true;
function icon(node,item){
 if(Number.isInteger(item.referenceSword)&&window.GulchReferenceSwordArt?.icon){window.GulchReferenceSwordArt.icon(node,item);return;}
 if(window.GulchItemPresentation?.icon){window.GulchItemPresentation.icon(node,item);if(node.querySelector('canvas,img'))return;}
 const canvas=el('canvas');canvas.width=canvas.height=16;canvas.setAttribute('aria-hidden','true');
 const c=canvas.getContext('2d');c.fillStyle='#302b39';c.fillRect(3,4,10,10);c.fillStyle='#91613e';c.fillRect(4,5,8,8);c.fillStyle='#dbad70';c.fillRect(4,5,8,3);c.fillStyle='#ffe29a';c.fillRect(7,8,2,3);node.replaceChildren(canvas);
}
function render(){
 scheduled=false;if(panel.hidden)return;
 const options=Array.from(offer.options),items=window.GulchItemCatalog?.items||{};
 const key=JSON.stringify([offer.value,options.map(o=>[o.value,o.textContent,o.disabled])]);
 if(key===signature)return;signature=key;
 const focused=document.activeElement,focusId=grid.contains(focused)?focused.closest('button')?.dataset.item:null,scroll=grid.scrollTop;
 const fragment=document.createDocumentFragment();
 for(const option of options){
  const id=option.value,item=items[id]||{id,name:option.textContent,type:'Item'},b=el('button');b.type='button';b.dataset.item=id;b.disabled=option.disabled;
  b.setAttribute('aria-pressed',String(id===offer.value));b.setAttribute('aria-label',option.textContent+'; offer for barter');b.title=item.description||item.name;
  const art=el('span');art.className='player-barter-art';art.setAttribute('aria-hidden','true');icon(art,item);
  const name=el('span',item.name);name.className='player-barter-name';
  const quantity=option.textContent.match(/ · (\d+) free/),value=option.textContent.match(/ · value (\d+)/);
  const count=el('span',(quantity?quantity[1]+' free':'Available')+(value?' · value '+value[1]:''));count.className='player-barter-count';
  b.append(art,name,count);b.addEventListener('click',()=>{
   if(!Array.from(offer.options).some(o=>o.value===id&&!o.disabled))return;
   offer.value=id;offer.dispatchEvent(new Event('change',{bubbles:true}));render();
  });fragment.append(b);
 }
 grid.replaceChildren(fragment);empty.hidden=options.length>0;
 if(focusId){const replacement=Array.from(grid.children).find(b=>b.dataset.item===focusId);if(replacement)replacement.focus({preventScroll:true});else{heading.tabIndex=-1;heading.focus({preventScroll:true});}}
 grid.scrollTop=scroll;
}
function schedule(){if(scheduled||panel.hidden)return;scheduled=true;queueMicrotask(render);}
new MutationObserver(schedule).observe(offer,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['disabled']});
new MutationObserver(schedule).observe(panel,{attributes:true,attributeFilter:['hidden']});
offer.addEventListener('change',schedule);
Gulch.register('merchant-player-item-grid',{snapshot:schedule});
function refreshArt(){setTimeout(()=>{signature='';schedule();},0);}
if(document.readyState==='complete')refreshArt();else window.addEventListener('load',refreshArt,{once:true});
})();
