(function(){
'use strict';
const toggle=document.getElementById('tradeToggle');
const panel=document.getElementById('tradePanel');
const selector=document.getElementById('barterVendor');
if(!toggle||!panel||!selector)return;
let latest=null,refreshing=false;
const conflictIds=new Set(['inventoryPanel','characterPanel','questBoard','workBoard','livingPanel','respawnScreen','interfaceMenu','travelMapPanel','pilgrimJournal']);
const epoch=data=>String(data?.respawnSettings?.token||'original');
function nearby(){
 if(!latest?.player||latest.player.hp<=0||latest.gameState.gulchPermanentGameOver?.ended)return [];
 const market=latest.gameState.merchantBarter;
 if(!market||market.epoch!==epoch(latest.gameState))return [];
 const p=latest.player;
 return latest.seed.entities.filter(e=>market.vendors?.[e.id]&&e.map===p.map&&Math.abs(e.x-p.x)+Math.abs(e.y-p.y)<=1&&(!Number.isFinite(e.hp)||e.hp>0));
}
function conflict(){return Array.from(conflictIds).some(id=>{const n=document.getElementById(id);return n&&!n.hidden;});}
function selectMerchant(merchant){
 if(selector.value===merchant.id)return;
 if(!Array.from(selector.options).some(o=>o.value===merchant.id)){
  const option=document.createElement('option');option.value=merchant.id;option.textContent=merchant.name||'Merchant';selector.append(option);
 }
 selector.value=merchant.id;
 selector.dispatchEvent(new Event('change',{bubbles:true}));
}
function refresh(){
 if(refreshing)return;
 refreshing=true;
 try{
  const list=nearby(),hidden=!list.length||conflict();
  if(toggle.hidden!==hidden)toggle.hidden=hidden;
  const disabled=hidden||Boolean(window.GulchMovementState?.inFlight);
  if(toggle.disabled!==disabled)toggle.disabled=disabled;
  const text=list.length?'Trade · '+String(list[0].name||'Merchant'):'Trade';
  if(toggle.textContent!==text)toggle.textContent=text;
  if(!panel.hidden){
   if(hidden)panel.querySelector('header button')?.click();
   else if(!list.some(e=>e.id===selector.value))selectMerchant(list[0]);
  }
 }finally{refreshing=false;}
}
toggle.addEventListener('click',event=>{
 const list=nearby();
 if(!list.length||conflict()||window.GulchMovementState?.inFlight){event.preventDefault();event.stopImmediatePropagation();return;}
 if(panel.hidden){
  const merchant=list.find(e=>e.id===selector.value)||list[0];
  selectMerchant(merchant);
 }
},true);
const style=document.createElement('style');
style.textContent=`
#tradeToggle[hidden],#tradePanel[hidden]{display:none!important}
#tradeToggle{position:absolute;left:50%;right:auto;top:auto;bottom:110px;transform:translateX(-50%);z-index:6;min-height:46px;max-width:calc(100% - 24px);padding:10px 18px;border:3px double #d8b778;border-radius:3px;background:#273d38;color:#ffe5b2;font:12px monospace;box-shadow:0 4px 0 #101e22}
#tradePanel{inset:58px 12px 12px auto;width:min(590px,calc(100% - 24px));z-index:96;border:4px double #bb9470;border-radius:3px;background:#202a30;color:#e8dfc8;padding:18px;box-shadow:0 14px 45px #0008;scrollbar-color:#ad916c #18272c}
#tradePanel header{padding:12px;margin:-18px -18px 14px;background:#38504a;border-bottom:4px ridge #a58a67}
#tradePanel h2{margin:0;color:#f3d39b;font:600 21px Georgia,serif;letter-spacing:1px}
#tradePanel label{color:#f0d29b;font-size:11px;letter-spacing:1px;margin-top:16px}
#tradePanel select,#tradePanel input{background:#14262c;color:#efe4c7;border:2px solid #75877a;border-radius:2px;min-height:44px}
#tradePanel output{background:#13252a;color:#f3dfac;border:3px double #af9470;padding:16px;font-size:13px;line-height:1.7}
#tradePanel button{background:#3c5045;color:#ffe2ae;border:2px solid #9b8a68;border-radius:2px;min-height:44px}
#tradePanel button:hover:not(:disabled){background:#526349;border-color:#e3c28b}
#tradePanel>button{width:100%;background:#a27851;color:#fff2cd;font-weight:bold;border-color:#dfbc82}
#tradePanel button:disabled{opacity:.45}
#tradePanel>p{color:#c1d0c2;font-size:11px}
#tradePanel ul{padding-left:18px}
#tradePanel li button{width:100%;text-align:left}
#tradePanel :focus-visible,#tradeToggle:focus-visible{outline:3px solid #f6d396;outline-offset:3px}
@media(max-width:600px){#tradePanel{inset:8px;width:auto;padding:14px}#tradePanel header{margin:-14px -14px 12px;padding:12px}#tradePanel h2{font-size:18px}#tradeToggle{bottom:110px;font-size:11px}}
`;
document.head.append(style);
toggle.hidden=true;
panel.querySelector('h2').textContent='THE BARTER COUNTER';
const caption=document.createElement('p');caption.textContent='Choose goods from the merchant, then offer items from your pack. Equipped copies stay reserved. Review the quoted quantities before confirming.';panel.querySelector('header').after(caption);
Gulch.register('merchant-shop-repair',{snapshot(s){latest=s;refresh();}});
new MutationObserver(records=>{
 if(records.some(record=>record.target===panel||conflictIds.has(record.target.id)))refresh();
}).observe(document.getElementById('left'),{subtree:true,attributes:true,attributeFilter:['hidden']});
setInterval(()=>{if(!document.hidden)refresh();},400);
})();
