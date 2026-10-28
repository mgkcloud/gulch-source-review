(function(){
'use strict';
let latest=null,previous=null,queue=[],current=null,selected=0,returnFocus=null;
const ranks=['Wooden','Silver','Golden','Royal'];
const colors=['#c19a70','#c3d8e8','#f5ce78','#f1b2b6'];
const stories=[
 'A roadkeeper hid this humble coffer beneath a weathered marker. Its contents were meant to help a traveler reach the next welcoming hearth.',
 'Silver bands bear the seal of a vanished caravan. Someone packed these goods carefully, expecting to return when the mountain passes opened.',
 'A small sun is stamped beneath the golden lock. The old guild stored its finest work here, trusting a patient explorer to give it purpose again.',
 'Beneath the crimson lining lies a faded royal decree: protect the roads, shelter the lost, and leave a light for those who follow. The kingdom is gone; its gifts remain.'
];
const epoch=d=>String(d?.respawnSettings?.token||'original');
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n;}
function button(text,fn){const b=el('button',text);b.type='button';b.addEventListener('click',fn);return b;}
const style=el('style');style.textContent=`
#chestRewardDialog{width:min(760px,calc(100% - 24px));max-height:88vh;padding:0;overflow:auto;color:#e6e9d9;background:#101f27;border:3px double var(--chest-trim,#c19a70);border-radius:10px;box-shadow:0 22px 75px #000b;font:12px/1.6 ui-monospace,monospace}
#chestRewardDialog::backdrop{background:#030c12c9}
#chestRewardDialog header{padding:20px;background:linear-gradient(115deg,#354238,#172832);border-bottom:1px solid var(--chest-trim)}
#chestRewardDialog h2{font:26px/1.2 Georgia,serif;color:var(--chest-trim);margin:5px 0 8px}
#chestRewardDialog p{margin:8px 0;overflow-wrap:anywhere}
#chestRewardDialog .cr-kicker{font-size:10px;letter-spacing:2px;color:#c1d1c6}
#chestRewardDialog .cr-layout{display:grid;grid-template-columns:minmax(170px,38%) minmax(0,1fr);gap:18px;padding:18px}
#chestRewardList{display:grid;gap:7px;align-content:start;max-height:390px;overflow:auto;padding:3px}
#chestRewardDialog button{font:inherit;min-height:44px;padding:9px 12px;color:#f2dfb5;background:#243c35;border:1px solid #718677;border-radius:5px}
#chestRewardList button{display:grid;grid-template-columns:42px minmax(0,1fr);gap:9px;align-items:center;text-align:left;width:100%}
#chestRewardList button[aria-pressed=true]{background:#3a4a37;border-color:var(--chest-trim);box-shadow:inset 3px 0 var(--chest-trim)}
#chestRewardList small{display:block;color:#bbcebf}
#chestRewardDialog .cr-icon{display:grid;place-items:center;width:40px;height:40px;background:#0b1820;border:1px solid #456154;border-radius:4px;font-size:25px}
#chestRewardDialog .cr-icon canvas,#chestRewardDialog .cr-icon img{width:36px;height:36px;image-rendering:pixelated;object-fit:contain}
#chestRewardDetail{min-width:0;padding:14px;background:#0a1820;border:1px solid #496358;border-radius:6px}
#chestRewardDetail .cr-preview{width:104px;height:104px;margin:0 auto 14px}
#chestRewardDetail .cr-preview canvas,#chestRewardDetail .cr-preview img{width:96px;height:96px}
#chestRewardDetail h3{font:22px/1.3 Georgia,serif;margin:0;color:#f3dfad}
#chestRewardDetail dl{display:grid;grid-template-columns:1fr auto;gap:5px 12px;font-variant-numeric:tabular-nums}
#chestRewardDetail dd{margin:0;text-align:right;color:var(--chest-trim)}
#chestRewardDetail dt{color:#abc2b4}
#chestRewardDialog blockquote{margin:14px 0 0;padding:10px 12px;border-left:2px solid var(--chest-trim);background:#23352d66;font:15px/1.65 Georgia,serif;color:#c8d7c1}
#chestRewardDialog footer{padding:0 18px 18px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
#chestRewardDialog footer p{flex:1;min-width:170px;color:#afc6b7;font-size:11px}
#chestRewardDialog :focus-visible{outline:2px solid var(--chest-trim);outline-offset:3px}
@media(max-width:560px){#chestRewardDialog .cr-layout{grid-template-columns:1fr;padding:12px;gap:12px}#chestRewardList{grid-template-columns:repeat(2,minmax(0,1fr));max-height:205px}#chestRewardList button{grid-template-columns:1fr;font-size:11px}#chestRewardDetail .cr-preview{float:left;margin:0 12px 8px 0;width:72px;height:72px}#chestRewardDetail .cr-preview canvas,#chestRewardDetail .cr-preview img{width:64px;height:64px}#chestRewardDetail dl{clear:both}#chestRewardDialog header{padding:14px}}
`;document.head.append(style);
const dialog=el('dialog');dialog.id='chestRewardDialog';dialog.setAttribute('aria-labelledby','chestRewardTitle');
const header=el('header'),title=el('h2');title.id='chestRewardTitle';
const subtitle=el('p'),story=el('p');
header.append(el('span','TREASURE RECOVERED','cr-kicker'),title,subtitle,story);
const layout=el('div',undefined,'cr-layout'),list=el('nav'),detail=el('article');list.id='chestRewardList';list.setAttribute('aria-label','Recovered items');detail.id='chestRewardDetail';detail.setAttribute('aria-label','Selected treasure details');layout.append(list,detail);
const footer=el('footer'),hint=el('p','Rewards are already in the shared pack. Select an item to inspect it; press I after closing to manage equipment.'),close=button('Return to expedition',()=>dialog.close());footer.append(hint,close);dialog.append(header,layout,footer);document.body.append(dialog);
function random(text){let h=2166136261;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619);return ()=>{h=(h+0x6d2b79f5)|0;let t=Math.imul(h^(h>>>15),h|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
function rewards(chest){
 const rank=Math.max(0,Math.min(3,chest.rank|0)),n=rank+1,rng=random(String(chest.lootSeed));
 const pools=[['scrap_knife','bone_spear'],['iron_blade','chitin_blade'],['alloy_blade','crystal_blade'],['ref_hearth_sun','ref_verdant_comet','ref_cinder_return']];
 const gear=pools[rank][Math.floor(rng()*pools[rank].length)];
 return Object.entries({scrap:3*n,fiber:2*n,image_coin:2*n*n,[['bandage','salve','tonic','tonic'][rank]]:n,[gear]:1,...(rank>=2?{image_gold_bar:n,lens:n}:{}),...(rank===3?{core:2,image_ruby:3}:{})});
}
function artwork(node,item){
 if(Number.isInteger(item.referenceSword)&&window.GulchReferenceSwordArt?.icon)window.GulchReferenceSwordArt.icon(node,item);
 else if(window.GulchItemPresentation?.icon)window.GulchItemPresentation.icon(node,item);
 else node.textContent=item.glyph||'◇';
}
function lore(item){
 if(item.lore)return item.lore;
 const lines={Weapon:'A narrow strip of cloth protects the edge. Whoever packed this weapon hoped its next bearer would find the courage to defend a friend.',Armor:'The worn outer surface hides careful repairs. Its former owner valued another safe journey more than a spotless suit of armor.',Consumable:'Wrapped against damp and darkness, this small reserve of strength has waited patiently for a traveler in need.',Material:'The coffer’s keeper saw a future in this fragment: a stronger blade, a repaired shelter, or a lamp that would burn through the night.',Relic:'A faint mark on its surface hints at a journey nobody wrote down. You are the next keeper of its unfinished story.'};
 return lines[item.type]||'A small discovery from a forgotten road. Its next story begins in your pack.';
}
function inspect(index){
 if(!current)return;selected=index;
 const [id,amount]=current.items[index],item=window.GulchItemCatalog?.items[id]||{id,name:id,type:'Item'};
 for(const [i,b] of Array.from(list.children).entries())b.setAttribute('aria-pressed',String(i===index));
 detail.replaceChildren();
 const art=el('span',undefined,'cr-icon cr-preview');art.setAttribute('aria-hidden','true');artwork(art,item);
 detail.append(art,el('h3',item.name),el('p',[item.type,item.rarity,'Received ×'+amount].filter(Boolean).join(' · ')));
 const stats=el('dl');
 function stat(label,value){stats.append(el('dt',label),el('dd',value));}
 if(item.slot)stat('Equipment slot',window.GulchEquipmentSlots?.labels?.[item.slot]||item.slot);
 if(Number.isFinite(item.bonus)){stat('Weapon bonus','+'+item.bonus);stat('Basic + weapon damage',2+item.bonus);}
 if(Number.isFinite(item.armor))stat('Armor',item.armor);
 if(item.heal)stat('Healing','Up to '+item.heal+' HP');
 if(item.craftValue)stat('Relative value',item.craftValue);
 if(item.swordStrength)stat('Specialist bonus','+'+item.swordStrength.extra+' vs '+item.swordStrength.target);
 detail.append(stats,el('p',item.description||'Recovered from this chest and added to the shared pack.'));
 if(item.magicAbility){const a=item.magicAbility;detail.append(el('p','Magic · '+a.name+' · '+a.cooldown+'-turn recharge.'));}
 const related=(window.GulchItemCatalog?.recipes||[]).filter(r=>r.input?.[id]||r.output?.[id]);
 if(related.length)detail.append(el('p','Crafting: '+related.slice(0,3).map(r=>r.name).join(' · ')+(related.length>3?' · '+(related.length-3)+' more in the recipe book.':'.')));
 detail.append(el('blockquote',lore(item)));
}
function showNext(){
 if(dialog.open||!queue.length||document.hidden||!latest||latest.player.hp<=0||latest.gameState.gulchPermanentGameOver?.ended)return;
 if(document.querySelector('dialog[open]'))return;
 current=queue.shift();selected=0;returnFocus=document.activeElement;
 dialog.style.setProperty('--chest-trim',colors[current.rank]);
 title.textContent=ranks[current.rank]+' chest opened';
 subtitle.textContent='Confirmed by the room · 1 key spent · '+current.items.reduce((n,r)=>n+r[1],0)+' item units recovered';
 story.textContent=stories[current.rank];
 list.replaceChildren();
 current.items.forEach(([id,n],i)=>{
  const item=window.GulchItemCatalog?.items[id]||{id,name:id,type:'Item'},b=button('',()=>inspect(i)),art=el('span',undefined,'cr-icon'),text=el('span',item.name);
  art.setAttribute('aria-hidden','true');artwork(art,item);text.append(el('small','×'+n+' · '+(item.rarity||item.type||'Treasure')));b.append(art,text);list.append(b);
 });
 inspect(0);Gulch.setMovement(0,0);dialog.showModal();dialog.scrollTop=0;list.firstElementChild?.focus({preventScroll:true});
}
function reset(){queue=[];current=null;if(dialog.open)dialog.close();}
dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.close();});
dialog.addEventListener('close',()=>{
 current=null;
 if(returnFocus?.isConnected&&!returnFocus.closest('[hidden],[inert]')&&returnFocus.getClientRects().length)returnFocus.focus({preventScroll:true});
 else{const board=document.getElementById('board');if(board&&latest?.player.hp>0){board.tabIndex=-1;board.focus({preventScroll:true});}}
 queueMicrotask(showNext);
});
window.addEventListener('keydown',event=>{
 if(!dialog.open)return;
 if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();dialog.close();return;}
 if(list.contains(event.target)&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
  event.preventDefault();const count=current.items.length;
  const index=event.key==='Home'?0:event.key==='End'?count-1:(selected+(['ArrowUp','ArrowLeft'].includes(event.key)?-1:1)+count)%count;
  inspect(index);list.children[index].focus({preventScroll:true});list.children[index].scrollIntoView({block:'nearest'});
 }
 if(event.key!=='Tab')event.stopImmediatePropagation();
},true);
Gulch.register('treasure-opening-menu',{snapshot(s){
 const old=previous;previous=s;latest=s;
 if(!old)return;
 if(old.revision!==s.revision||epoch(old.gameState)!==epoch(s.gameState)||s.player.hp<=0||s.gameState.gulchPermanentGameOver?.ended){reset();return;}
 if(s.stateRevision<=old.stateRevision)return;
 const before=new Map(old.seed.entities.filter(e=>e.rankedChest).map(e=>[e.id,e]));
 for(const e of s.seed.entities){
  const prior=before.get(e.id);
  if(!prior||prior.rankedChest.opened||!e.rankedChest?.opened)continue;
  queue.push({rank:Math.max(0,Math.min(3,e.rankedChest.rank|0)),items:rewards(e.rankedChest)});
 }
 queue=queue.slice(-8);queueMicrotask(showNext);
}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)showNext();});
document.addEventListener('close',()=>queueMicrotask(showNext),true);
})();
