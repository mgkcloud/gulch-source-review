(function(){
'use strict';
const panel=document.getElementById('tradePanel');
const receive=document.getElementById('barterReceive');
const vendor=document.getElementById('barterVendor');
if(!panel||!receive||!vendor)return;
let signature='',scheduled=false,artReady=false;
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
const style=el('style');
style.textContent=`
#tradePanel{width:min(780px,calc(100% - 24px))}
#tradePanel #barterReceive{display:none!important}
#merchantGoodsHeading{margin:14px 0 5px;color:#f3d39b;font-size:14px}
#merchantGoodsHint{margin:5px 0 10px;font-size:11px;color:#c1d0c2}
#merchantGoodsGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(125px,1fr));gap:8px;max-height:390px;overflow:auto;padding:4px;scrollbar-gutter:stable}
#tradePanel #merchantGoodsGrid button{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:6px;min-width:0;min-height:146px;width:100%;padding:10px 7px;background:#14262c;color:#e9e3cd;border:2px solid #627869;border-radius:4px;text-align:center;font:11px/1.4 monospace;overflow-wrap:anywhere}
#tradePanel #merchantGoodsGrid button:hover{background:#294238;border-color:#d3b77e}
#tradePanel #merchantGoodsGrid button[aria-pressed=true]{background:#354b39;border-color:#ffe0a0;box-shadow:inset 0 0 0 1px #ffe0a0}
#tradePanel #merchantGoodsGrid button:focus-visible{outline:3px solid #ffe0a0;outline-offset:1px}
.merchant-goods-art{display:grid;place-items:center;width:52px;height:52px;flex-shrink:0;background:#0c1b21;border:1px solid #455f54;border-radius:3px}
#merchantGoodsGrid .merchant-goods-art canvas,#merchantGoodsGrid .merchant-goods-art img{display:block;width:48px;height:48px;margin:0;image-rendering:pixelated;object-fit:contain}
.merchant-goods-name{flex:1;color:#f2dfb5;font-weight:bold}
.merchant-goods-stock{color:#c0d5b6;font-size:10px}
.merchant-goods-value{color:#d6c396;font-size:10px}
#merchantGoodsEmpty{color:#d3c8ae;font-size:12px}
@media(max-width:600px){#tradePanel{width:auto}#merchantGoodsGrid{grid-template-columns:repeat(auto-fill,minmax(105px,1fr));max-height:45vh;gap:6px}#tradePanel #merchantGoodsGrid button{min-height:140px}}
`;
document.head.append(style);
const heading=el('h3','Merchant goods');heading.id='merchantGoodsHeading';
const hint=el('p','Select an item below, then choose the quantity and what to pay with.');hint.id='merchantGoodsHint';
const grid=el('div');grid.id='merchantGoodsGrid';grid.setAttribute('role','group');grid.setAttribute('aria-labelledby',heading.id);grid.setAttribute('aria-describedby',hint.id);
const empty=el('p','No goods currently in stock.');empty.id='merchantGoodsEmpty';empty.hidden=true;
receive.after(heading,hint,grid,empty);
const originalLabel=panel.querySelector('label[for="barterReceive"]');if(originalLabel)originalLabel.hidden=true;
function icon(node,item){
 if(Number.isInteger(item.referenceSword)&&window.GulchReferenceSwordArt?.icon){window.GulchReferenceSwordArt.icon(node,item);return;}
 if(window.GulchItemPresentation?.icon){window.GulchItemPresentation.icon(node,item);return;}
 node.textContent=item.glyph||'◇';
}
function render(){
 scheduled=false;
 if(panel.hidden)return;
 const items=window.GulchItemCatalog?.items||{};
 const options=Array.from(receive.options);
 const next=JSON.stringify([vendor.value,receive.value,artReady,options.map(o=>[o.value,o.textContent,o.disabled])]);
 if(next===signature)return;
 signature=next;
 const focused=document.activeElement;
 const focusId=grid.contains(focused)?focused.closest('button')?.dataset.item:null;
 const scroll=grid.scrollTop;
 const fragment=document.createDocumentFragment();
 for(const option of options){
  const item=items[option.value]||{id:option.value,name:option.textContent,type:'Item'};
  const b=el('button');b.type='button';b.dataset.item=option.value;b.disabled=option.disabled;
  b.setAttribute('aria-pressed',String(option.value===receive.value));
  b.setAttribute('aria-label',option.textContent+'; select for barter');
  b.title=item.description||item.name;
  const art=el('span');art.className='merchant-goods-art';art.setAttribute('aria-hidden','true');icon(art,item);
  const name=el('span',item.name);name.className='merchant-goods-name';
  const stockMatch=option.textContent.match(/ · stock (\d+)/);
  const valueMatch=option.textContent.match(/ · value (\d+)/);
  const stock=el('span',stockMatch?'Stock: '+stockMatch[1]:item.type||'Item');stock.className='merchant-goods-stock';
  const value=el('span',valueMatch?'Value: '+valueMatch[1]:'');value.className='merchant-goods-value';
  b.append(art,name,stock,value);
  b.addEventListener('click',()=>{
   if(!Array.from(receive.options).some(o=>o.value===item.id&&!o.disabled))return;
   receive.value=item.id;
   receive.dispatchEvent(new Event('change',{bubbles:true}));
   render();
  });
  fragment.append(b);
 }
 grid.replaceChildren(fragment);empty.hidden=options.length>0;
 if(focusId){const replacement=Array.from(grid.children).find(b=>b.dataset.item===focusId);if(replacement)replacement.focus({preventScroll:true});else heading.tabIndex=-1,heading.focus({preventScroll:true});}
 grid.scrollTop=scroll;
}
function schedule(){if(scheduled||panel.hidden)return;scheduled=true;queueMicrotask(render);}
new MutationObserver(schedule).observe(receive,{childList:true,subtree:true,characterData:true});
new MutationObserver(schedule).observe(panel,{attributes:true,attributeFilter:['hidden']});
receive.addEventListener('change',schedule);vendor.addEventListener('change',schedule);
Gulch.register('merchant-item-grid',{snapshot:schedule});
function finish(){setTimeout(()=>{artReady=true;signature='';schedule();},0);}
if(document.readyState==='complete')finish();else window.addEventListener('load',finish,{once:true});
})();
