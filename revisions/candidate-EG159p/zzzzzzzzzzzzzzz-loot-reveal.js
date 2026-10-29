(function(){
'use strict';
const host=document.getElementById('left');
if(!host)return;
let baseline=null,lastReceipt=null,queue=[],timer=null,current=null;
const epoch=d=>String(d.respawnSettings?.token||'original');
const count=n=>Number.isFinite(n)?Math.max(0,Math.floor(n)):0;
const pack=d=>d.itemEcosystem?.epoch===epoch(d)?d.itemEcosystem:{bag:{}};
const panel=document.createElement('div');panel.id='lootReveal';panel.hidden=true;panel.setAttribute('role','status');panel.setAttribute('aria-live','polite');panel.setAttribute('aria-atomic','true');
const icon=document.createElement('span'),name=document.createElement('span'),hint=document.createElement('small');icon.className='pickup-icon';icon.setAttribute('aria-hidden','true');name.className='pickup-name';panel.append(icon,name,hint);host.append(panel);
const style=document.createElement('style');style.textContent=`
#enemyTreasureNotice{display:none!important}
#lootReveal[hidden]{display:none!important}
#lootReveal{position:absolute;left:50%;bottom:185px;transform:translateX(-50%);z-index:8;display:grid;grid-template-columns:28px minmax(0,1fr);gap:2px 9px;width:max-content;max-width:min(310px,calc(100% - 24px));padding:9px 12px;border:1px solid #bba77870;border-radius:8px;background:#0b181eee;color:#f5e9cc;box-shadow:0 4px 16px #0005;pointer-events:none;font:12px/1.4 ui-monospace,monospace}
#lootReveal .pickup-icon{grid-row:span 2;align-self:center;text-align:center;font-size:21px;color:#e8cd92}
#lootReveal .pickup-name{overflow-wrap:anywhere;font-weight:600}
#lootReveal small{color:#c1cec7;font-size:10px}
#lootReveal.pickup-enter{animation:pickup-arrive 180ms ease-out}
@keyframes pickup-arrive{from{opacity:0;translate:0 7px}to{opacity:1;translate:0 0}}
@media(max-width:700px){#lootReveal{bottom:185px;max-width:calc(100% - 24px);font-size:11px}}
@media(max-height:480px){#lootReveal{bottom:auto;top:82px;max-width:55%}}
@media(prefers-reduced-motion:reduce){#lootReveal.pickup-enter{animation:none}}
`;document.head.append(style);
function blocked(){return ['inventoryPanel','characterPanel','questBoard','workBoard','livingPanel','respawnScreen'].some(id=>{const n=document.getElementById(id);return n&&!n.hidden;});}
function clear(){clearTimeout(timer);timer=null;current=null;queue=[];panel.hidden=true;}
function next(){
 clearTimeout(timer);timer=null;
 if(blocked()){clear();return;}
 current=queue.shift();
 if(!current){panel.hidden=true;return;}
 const item=window.GulchItemCatalog?.items[current.id];
 if(!item){next();return;}
 if(window.GulchItemPresentation)window.GulchItemPresentation.icon(icon,item);else icon.textContent=(item.glyph||'◇')+'\uFE0E';
 name.textContent=item.name+' ×'+current.amount;
 hint.textContent=current.ground?'Dropped nearby · collect in Inventory [I]':'Collected · details in Inventory [I]';
 panel.classList.remove('pickup-enter');panel.hidden=false;
 requestAnimationFrame(()=>{if(!panel.hidden)panel.classList.add('pickup-enter');});
 timer=setTimeout(next,2300);
}
Gulch.register('enemy-loot-reveal',{snapshot(s){
 const data=s.gameState,v=pack(data),token=epoch(data),receipt=data.imageKillReward;
 const key=receipt?.epoch===token?token+':'+receipt.id:null;
 const reset=baseline&&baseline.epoch!==token;
 if(reset||s.player.hp<=0)clear();
 if(baseline&&!reset&&s.player.hp>0&&key&&key!==lastReceipt){
  const awards=[],catalog=window.GulchItemCatalog?.items||{};
  for(const [id,n] of Object.entries(v.bag||{})){
   const amount=count(n)-count(baseline.bag[id]);
   if(id.startsWith('image_')&&catalog[id]&&amount>0)awards.push({id,amount,ground:false});
  }
  for(const e of s.seed.entities){
   if(!e.ecosystemLoot||baseline.entities.has(e.id)||!String(e.id).startsWith('image-reward:'))continue;
   for(const [id,n] of Object.entries(e.contents||{}))if(id.startsWith('image_')&&catalog[id]&&count(n))awards.push({id,amount:count(n),ground:true});
  }
  if(!blocked()&&awards.length){queue.push(...awards);queue=queue.slice(-12);if(!timer)next();}
 }
 baseline={epoch:token,bag:{...v.bag},entities:new Set(s.seed.entities.map(e=>e.id))};lastReceipt=key;
 if(blocked())clear();
}});
new MutationObserver(()=>{if(!panel.hidden&&blocked())clear();}).observe(host,{subtree:true,attributes:true,attributeFilter:['hidden']});
})();
