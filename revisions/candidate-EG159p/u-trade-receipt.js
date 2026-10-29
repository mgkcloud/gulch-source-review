(function(){
'use strict';
const originalCommit=Gulch.commit;
let latest=null,previous=null,proposal=null,returnFocus=null;
const epoch=d=>String(d?.respawnSettings?.token||'original');
const count=n=>Number.isFinite(n)?Math.max(0,Math.floor(n)):0;
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);return n;}
const style=el('style');style.textContent=`
#tradeReceipt{width:min(540px,calc(100% - 24px));max-height:85vh;overflow:auto;padding:0;border:3px double #bda174;border-radius:9px;background:#14272b;color:#e8e4d1;box-shadow:0 20px 70px #000a;font:12px/1.65 ui-monospace,monospace}
#tradeReceipt::backdrop{background:#030c10aa}
#tradeReceipt header{padding:18px;background:#263e38;border-bottom:1px solid #796e50}
#tradeReceipt h2{margin:0;color:#ffe1a2;font:24px Georgia,serif}
#tradeReceipt header p{margin:5px 0 0;color:#bdcfc0}
#tradeReceiptItems{padding:0 18px}
#tradeReceipt article{padding:18px 0;border-bottom:1px solid #465e50}
#tradeReceipt .receipt-heading{display:flex;align-items:center;gap:14px}
#tradeReceipt .receipt-art{display:grid;place-items:center;width:64px;height:64px;flex-shrink:0;background:#0b1b20;border:1px solid #68816b;border-radius:6px;font-size:28px}
#tradeReceipt .receipt-art canvas{width:56px;height:56px;image-rendering:pixelated}
#tradeReceipt h3{margin:0;color:#f6dfac;font-size:15px}
#tradeReceipt p{margin:8px 0;overflow-wrap:anywhere}
#tradeReceipt .receipt-stats{color:#bce0b6}
#tradeReceipt blockquote{margin:12px 0 0;padding:10px 12px;border-left:2px solid #c0a574;background:#1c3333;color:#d0d7bf;font-family:Georgia,serif;font-size:15px}
#tradeReceipt footer{padding:16px 18px}
#tradeReceipt button{width:100%;min-height:44px;background:#ad8756;color:#112523;border:1px solid #efd29a;border-radius:5px;font:inherit;font-weight:bold;cursor:pointer}
#tradeReceipt button:focus-visible{outline:3px solid #ffe5af;outline-offset:3px}
`;document.head.append(style);
const dialog=el('dialog');dialog.id='tradeReceipt';dialog.setAttribute('aria-labelledby','tradeReceiptTitle');
const header=el('header'),title=el('h2','Trade complete'),summary=el('p');title.id='tradeReceiptTitle';header.append(title,summary);
const contents=el('div');contents.id='tradeReceiptItems';
const footer=el('footer'),payment=el('p'),close=el('button','Continue trading');close.type='button';footer.append(payment,close);dialog.append(header,contents,footer);document.body.append(dialog);
function hide(){if(dialog.open)dialog.close();}
close.addEventListener('click',hide);
dialog.addEventListener('cancel',event=>{event.preventDefault();hide();});
dialog.addEventListener('close',()=>{if(returnFocus?.isConnected&&!returnFocus.closest('[hidden],[inert]'))returnFocus.focus({preventScroll:true});});
window.addEventListener('keydown',event=>{
 if(!dialog.open)return;
 if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();hide();return;}
 if(event.key==='Tab')return;
 if(event.target===close&&(event.key==='Enter'||event.key===' ')){event.preventDefault();event.stopImmediatePropagation();hide();return;}
 event.stopImmediatePropagation();
},true);
function lore(item){
 if(item.lore)return item.lore;
 if(item.type==='Weapon')return 'The merchant turns the weapon once in the lamplight. “Steel remembers the care it is given. Keep its edge true, and choose carefully when to draw it.”';
 if(item.type==='Armor')return 'A worn stitch inside the lining bears the mark of a roadside workshop. Its makers believed that every traveler deserved to come home.';
 if(item.type==='Consumable')return 'Wrapped for the road and sealed against the rain, this small provision carries a familiar promise: a little strength when the journey asks for more.';
 if(item.type==='Material')return 'The traders of Coppercross see possibility in every fragment. What looks ordinary on a market stall may become the finest part of a future creation.';
 return 'The merchant has heard three different stories about this treasure. With a quiet smile, they leave its next chapter to you.';
}
function show(receipt){
 const items=window.GulchItemCatalog?.items||{};
 returnFocus=document.activeElement;
 summary.textContent='Confirmed by the room · '+receipt.merchant;
 contents.replaceChildren();
 for(const [id,n] of receipt.bought){
  const item=items[id]||{id,name:id,type:'Item'},article=el('article'),heading=el('div');heading.className='receipt-heading';
  const art=el('span');art.className='receipt-art';art.setAttribute('aria-hidden','true');
  if(Number.isInteger(item.referenceSword)&&window.GulchReferenceSwordArt?.icon)window.GulchReferenceSwordArt.icon(art,item);
  else if(window.GulchItemPresentation?.icon)window.GulchItemPresentation.icon(art,item);
  else art.textContent=item.glyph||'◇';
  const label=el('div');label.append(el('h3',item.name+' ×'+n),el('p',[item.type,item.rarity].filter(Boolean).join(' · ')));heading.append(art,label);article.append(heading);
  const stats=[];
  if(item.bonus)stats.push('Melee damage +'+item.bonus);
  if(item.armor)stats.push('Armor '+item.armor);
  if(item.heal)stats.push('Restores up to '+item.heal+' HP');
  if(item.slot)stats.push('Equipment slot: '+item.slot);
  if(stats.length){const line=el('p',stats.join(' · '));line.className='receipt-stats';article.append(line);}
  article.append(el('p',item.description||'Added to your shared field pack.'),el('blockquote',lore(item)));
  if(item.magicAbility)article.append(el('p','Magic: '+item.magicAbility.name+' · '+item.magicAbility.cooldown+'-turn recharge.'));
  contents.append(article);
 }
 payment.textContent='Paid: '+receipt.paid.map(([id,n])=>n+' × '+(items[id]?.name||id)).join(', ')+'. Purchased items are in the shared pack [I].';
 if(!dialog.open)dialog.showModal();
 dialog.scrollTop=0;close.focus({preventScroll:true});
}
Gulch.commit=function(data,activity){
 if(dialog.open)return;
 const before=latest?.gameState,after=data?.merchantBarter;
 if(before&&epoch(before)===epoch(data)&&after?.receipt&&after.receipt!==before.merchantBarter?.receipt){
  proposal={base:latest.stateRevision,epoch:epoch(data),token:after.receipt};
 }
 return originalCommit(data,activity);
};
Gulch.register('merchant-purchase-receipt',{snapshot(s){
 const data=s.gameState,market=data.merchantBarter,token=epoch(data),old=previous;
 latest=s;
 previous={epoch:token,receipt:market?.epoch===token?market.receipt:null,bag:{...(data.itemEcosystem?.epoch===token?data.itemEcosystem.bag:{})},vendors:market?.epoch===token?market.vendors:{}};
 if(s.player.hp<=0||data.gulchPermanentGameOver?.ended||old&&old.epoch!==token){proposal=null;hide();return;}
 if(proposal&&s.stateRevision!==proposal.base)proposal=null;
 if(!old||old.epoch!==token||!previous.receipt||previous.receipt===old.receipt)return;
 const bought=[],paid=[];
 for(const id of new Set([...Object.keys(old.bag),...Object.keys(previous.bag)])){
  const delta=count(previous.bag[id])-count(old.bag[id]);
  if(delta>0)bought.push([id,delta]);else if(delta<0)paid.push([id,-delta]);
 }
 if(!bought.length||!paid.length)return;
 const vendorId=Object.keys(previous.vendors||{}).find(id=>{
  const before=old.vendors?.[id]?.stock,after=previous.vendors[id]?.stock;
  return before&&after&&bought.every(([key,n])=>count(before[key])-count(after[key])===n)&&paid.every(([key,n])=>count(after[key])-count(before[key])===n);
 });
 if(!vendorId)return;
 const merchant=s.seed.entities.find(e=>e.id===vendorId)?.name||'Merchant';
 show({bought,paid,merchant});
}});
})();
