(function(){
'use strict';
function mount(){
 const panel=document.getElementById('tradePanel');
 if(!panel)return;
 let latest=null,pending=null,vendorId='',wanted='',quantity=1,offers={},signature='';
 const epoch=d=>String(d?.respawnSettings?.token||'original');
 const count=n=>Number.isFinite(Number(n))?Math.max(0,Math.min(999,Math.floor(Number(n)))):0;
 const items=()=>window.GulchItemCatalog?.items||{};
 const value=id=>Math.max(1,Number(window.GulchRecipeBook?.value(id)||items()[id]?.craftValue)||1);
 function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
 function button(text,fn){const n=el('button',text);n.type='button';n.addEventListener('click',fn);return n;}
 const style=el('style');style.textContent='#tradePanel> :not(header):not(#basketShop){display:none!important}#basketShop{display:block;color:#e9e3cd}#basketShop .shop-columns{display:grid;grid-template-columns:1fr 1fr;gap:16px}#basketShop .shop-list{display:grid;gap:8px;max-height:300px;overflow:auto;padding:3px}#basketShop .shop-card{display:flex;align-items:center;gap:9px;padding:9px;border:1px solid #627869;background:#14262c;min-width:0}#basketShop .shop-card>span{flex:1;overflow-wrap:anywhere}#basketShop .shop-card canvas{width:32px;height:32px;image-rendering:pixelated}#basketShop .shop-card small{display:block;color:#c0d5b6}#basketShop .shop-card button{min-height:44px}#basketShop .shop-total{padding:12px;border:2px solid #d3b77e;background:#13252a;white-space:pre-line;font-variant-numeric:tabular-nums}#basketShop .shop-total[data-covered=true]{border-color:#a8d698}#basketShop h3{color:#f3d39b}#basketShop input{width:90px}#basketShop .shop-buy{width:100%;margin-top:10px;background:#a27851;color:#fff2cd;font-weight:bold}#basketShop [role=status]{min-height:24px}#basketShop button[aria-pressed=true]{border-color:#ffe0a0;background:#354b39}@media(max-width:550px){#basketShop .shop-columns{grid-template-columns:1fr}}';document.head.append(style);
 const root=el('section');root.id='basketShop';root.setAttribute('aria-label','Merchant store and payment basket');
 const merchant=el('p'),intro=el('p','Choose store goods, then place items from your pack into the payment basket. Prices include a 20% merchant markup. Equipped copies are reserved. Items stay in your pack until the purchase is confirmed.');
 const columns=el('div');columns.className='shop-columns';const store=el('section'),payment=el('section');
 const goods=el('div');goods.className='shop-list';goods.setAttribute('aria-label','Store goods');
 const qtyLabel=el('label','Quantity to buy'),qty=el('input');qty.id='shopBuyQuantity';qtyLabel.htmlFor=qty.id;qty.type='number';qty.min='1';qty.max='99';qty.step='1';qty.value='1';
 const description=el('p');store.append(el('h3','Store'),goods,qtyLabel,qty,description);
 const wealth=el('p'),carried=el('div'),basket=el('div');carried.className=basket.className='shop-list';
 carried.setAttribute('aria-label','Items available to offer');basket.setAttribute('aria-label','Payment basket');
 payment.append(el('h3','Your available items'),wealth,carried,el('h3','Payment basket'),basket,button('Clear basket',()=>{if(pending)return;offers={};render(true);}));columns.append(store,payment);
 const totals=el('p');totals.className='shop-total';totals.setAttribute('aria-live','polite');
 const buy=button('Buy',purchase);buy.className='shop-buy';
 const status=el('p');status.setAttribute('role','status');
 root.append(merchant,intro,columns,totals,buy,status);panel.append(root);
 function market(){const m=latest?.gameState.merchantBarter;return m?.epoch===epoch(latest?.gameState)?m:null;}
 function pack(){const p=latest?.gameState.itemEcosystem;return p?.epoch===epoch(latest?.gameState)?p:{epoch:epoch(latest?.gameState),bag:{},equipment:{},known:[],crafted:[],log:[]};}
 function free(id){const p=pack();return Math.max(0,count(p.bag?.[id])-Object.values(p.equipment||{}).filter(v=>v===id).length);}
 function nearby(e){const p=latest?.player;return Boolean(p&&e&&e.map===p.map&&Math.abs(e.x-p.x)+Math.abs(e.y-p.y)<=1&&(!Number.isFinite(e.hp)||e.hp>0));}
 function vendor(){return market()?.vendors?.[vendorId];}
 function ready(){return latest&&latest.player.hp>0&&!latest.gameState.gulchPermanentGameOver?.ended&&window.GulchMovementState?.focused&&!window.GulchMovementState.inFlight&&!pending&&!document.querySelector('dialog[open]')&&!panel.hidden&&nearby(latest.seed.entities.find(e=>e.id===vendorId));}
 function quote(){const offered=Object.entries(offers).filter(([,n])=>n>0),due=items()[wanted]&&Number.isInteger(quantity)&&quantity>0&&quantity<=99?Math.ceil(value(wanted)*quantity*1.2):null,total=offered.reduce((sum,[id,n])=>sum+value(id)*n,0),v=vendor(),p=pack();const valid=Boolean(v&&due!==null&&quantity<=count(v.stock?.[wanted])&&count(p.bag?.[wanted])+quantity<=999&&offered.length&&offered.every(([id,n])=>items()[id]&&id!==wanted&&Number.isInteger(n)&&n>0&&n<=free(id)&&count(v.stock?.[id])+n<=999)&&total>=due);return {offered,due,total,valid};}
 function icon(item){const n=el('span');n.style.flex='0 0 32px';n.setAttribute('aria-hidden','true');if(window.GulchItemPresentation?.icon)window.GulchItemPresentation.icon(n,item);else n.textContent=item.glyph||'◇';return n;}
 function card(item,text){const row=el('div');row.className='shop-card';const label=el('span',item.name);label.append(el('small',text));row.append(icon(item),label);return row;}
 function render(force){
  if(panel.hidden||!latest)return;
  const id=document.getElementById('barterVendor')?.value||'';
  if(id!==vendorId){vendorId=id;offers={};wanted='';status.textContent='';}
  const db=items(),v=vendor(),p=pack();
  if(!db[wanted]||!count(v?.stock?.[wanted]))wanted=Object.keys(v?.stock||{}).find(id=>db[id]&&count(v.stock[id]))||'';
  if(!pending)for(const id of Object.keys(offers)){offers[id]=id===wanted?0:Math.min(count(offers[id]),free(id),Math.max(0,999-count(v?.stock?.[id])));if(!offers[id])delete offers[id];}
  const key=JSON.stringify([latest.revision,latest.stateRevision,vendorId,wanted,quantity,offers,Boolean(pending),ready()]);if(!force&&key===signature)return;signature=key;
  merchant.textContent=(latest.seed.entities.find(e=>e.id===vendorId)?.name||'No merchant selected')+(nearby(latest.seed.entities.find(e=>e.id===vendorId))?' · Nearby':' · Stand directly beside this merchant');
  const active=document.activeElement,focusId=active?.dataset.shopFocus,scrolls=[goods.scrollTop,carried.scrollTop,basket.scrollTop];
  goods.replaceChildren();carried.replaceChildren();basket.replaceChildren();
  for(const [id,n] of Object.entries(v?.stock||{})){
   if(!db[id]||!count(n))continue;const row=card(db[id],'Stock '+count(n)+' · unit cost '+Math.ceil(value(id)*1.2));
   const choose=button('Select',()=>{if(pending)return;wanted=id;delete offers[id];status.textContent='';render(true);});choose.dataset.shopFocus='goods:'+id;choose.disabled=Boolean(pending);choose.setAttribute('aria-label','Select '+db[id].name);choose.setAttribute('aria-pressed',String(id===wanted));row.append(choose);goods.append(row);
  }
  if(!goods.children.length)goods.append(el('p','This merchant has no goods in stock.'));
  let availableWealth=0;
  for(const [id,n] of Object.entries(p.bag||{})){
   if(!db[id])continue;const available=free(id);availableWealth+=available*value(id);if(!available||id===wanted)continue;
   const row=card(db[id],available+' available · value '+value(id)+' each');
   const add=button('Place +1',()=>{if(pending)return;offers[id]=(offers[id]||0)+1;render(true);});add.dataset.shopFocus='add:'+id;add.setAttribute('aria-label','Place one '+db[id].name+' in payment basket');add.disabled=Boolean(pending)||(offers[id]||0)>=Math.min(available,999-count(v?.stock?.[id]));row.append(add);carried.append(row);
  }
  wealth.textContent='Available pack wealth: '+availableWealth+' value (excluding equipped copies).';
  if(!carried.children.length)carried.append(el('p','No eligible payment items. Collect supplies or select different goods.'));
  for(const [id,n] of Object.entries(offers)){
   const row=card(db[id],'×'+n+' · total value '+(n*value(id)));
   const minus=button('−1',()=>{if(pending)return;if(--offers[id]<=0)delete offers[id];render(true);});minus.dataset.shopFocus='minus:'+id;minus.disabled=Boolean(pending);minus.setAttribute('aria-label','Remove one '+db[id].name+' from basket');row.append(minus);basket.append(row);
  }
  if(!basket.children.length)basket.append(el('p','Place items here to pay.'));
  qty.disabled=Boolean(pending);description.textContent=db[wanted]?db[wanted].description:'Select goods to inspect them.';
  const q=quote();totals.dataset.covered=String(q.valid);
  totals.textContent='Total cost due: '+(q.due===null?'Enter a quantity from 1 to 99':q.due)+'\nBasket wealth: '+q.total+(q.due===null?'':q.total<q.due?'\nStill needed: '+(q.due-q.total):q.total===q.due?'\nExact payment.':'\nSurplus: '+(q.total-q.due)+' — no change returned.');
  buy.textContent=pending?'Awaiting confirmation…':'Buy'+(db[wanted]?' '+quantity+' × '+db[wanted].name:'');buy.disabled=!ready()||!q.valid;
  if(q.due!==null&&count(p.bag?.[wanted])+quantity>999)totals.textContent+='\nNot enough room in the purchased item stack (maximum 999).';
  if(q.due!==null&&quantity>count(v?.stock?.[wanted]))totals.textContent+='\nThe merchant does not have enough stock.';
  [goods,carried,basket].forEach((n,i)=>{n.scrollTop=scrolls[i];});
  if(focusId&&!active.isConnected)Array.from(root.querySelectorAll('[data-shop-focus]')).find(n=>n.dataset.shopFocus===focusId)?.focus({preventScroll:true});
 }
 function purchase(){
  if(!ready())return;const q=quote();if(!q.valid)return;
  const data=latest.gameState,m=market(),p=pack(),v=vendor(),bag={...p.bag},stock={...v.stock},db=items();
  for(const [id,n] of q.offered){bag[id]=count(bag[id])-n;stock[id]=count(stock[id])+n;}
  bag[wanted]=count(bag[wanted])+quantity;stock[wanted]=count(stock[wanted])-quantity;
  const text='Bought '+quantity+' × '+db[wanted].name+' for '+q.offered.map(([id,n])=>n+' × '+db[id].name).join(', ')+'. Cost '+q.due+'; offered value '+q.total+(q.total>q.due?'; surplus '+(q.total-q.due)+' given without change':'')+'.';
  const token=latest.stateRevision+':basket:'+Date.now()+':'+Math.random().toString(36).slice(2);
  const next={...data,itemEcosystem:{...p,bag,known:Array.from(new Set([...(p.known||[]),wanted])),log:[text,...(p.log||[])].slice(0,12)},merchantBarter:{...m,vendors:{...m.vendors,[vendorId]:{...v,stock}},receipt:token}};
  if(new TextEncoder().encode(JSON.stringify(next)).length>350000){status.textContent='Shared world capacity reached. No items exchanged.';return;}
  pending={base:latest.stateRevision,source:latest.revision,epoch:epoch(data),token,text};
  try{Gulch.commit(next,text);}catch(error){pending=null;status.textContent='Purchase failed: '+String(error.message||error);}
  if(pending&&!window.GulchMovementState?.inFlight){pending=null;status.textContent='Purchase was not submitted. Your items remain unchanged.';}
  else if(pending)status.textContent='Waiting for shared purchase confirmation…';
  render(true);
 }
 qty.addEventListener('input',()=>{quantity=Number(qty.value);render(true);});
 Gulch.register('merchant-payment-basket',{snapshot(s){
  const reset=latest&&(latest.revision!==s.revision||epoch(latest.gameState)!==epoch(s.gameState));latest=s;
  if(pending&&(reset||s.stateRevision!==pending.base)){
   const r=pending;pending=null;
   const confirmed=!reset&&market()?.receipt===r.token;
   status.textContent=confirmed?r.text+' Added to shared inventory.':'The room changed. Check your pack and merchant stock before retrying.';
   if(confirmed||reset)offers={};
  }
  if(reset){offers={};wanted='';vendorId='';}
  render(true);
 }});
 new MutationObserver(()=>render()).observe(panel,{attributes:true,attributeFilter:['hidden']});
 document.getElementById('barterVendor')?.addEventListener('change',()=>render(true));
 window.addEventListener('gulch:recovered',()=>queueMicrotask(()=>{if(pending&&!window.GulchMovementState?.inFlight){pending=null;status.textContent='Update finished without a matching purchase receipt. Check your pack before retrying.';}render();}));
 setInterval(()=>{if(!document.hidden){if(pending&&!window.GulchMovementState?.inFlight){pending=null;status.textContent='No purchase confirmation received. Check your inventory before retrying.';}render();}},350);
}
if(document.readyState==='complete')mount();else window.addEventListener('load',mount,{once:true});
})();
