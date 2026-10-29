(function(){
'use strict';
const panel=document.getElementById('inventoryPanel');
if(!panel)return;
const style=document.createElement('style');style.textContent=`
#inventoryPanel:not([hidden]){inset:12px 12px 12px auto;width:min(680px,calc(100% - 24px));max-width:680px;max-height:680px;margin:auto 0;background:#0b171eea;border:1px solid #77908480;border-radius:10px;box-shadow:0 8px 28px #0006;color:#e4ece5;backdrop-filter:none}
#inventoryPanel .inventory-header{padding:10px 12px;background:#172a30d9}
#inventoryPanel .inventory-header h1{font-size:15px;letter-spacing:.5px}
#inventoryPanel .new-inventory-nav{padding:7px 10px;gap:6px;background:#10212ac9}
#inventoryPanel .new-inventory-nav button{min-height:40px;padding:7px 10px;font-size:11px}
#inventoryPanel .new-inventory-meta{font-size:10px;color:#d0dbd4}
#inventoryPanel .inventory-body{grid-template-columns:120px minmax(0,1fr);min-height:0}
#inventoryPanel .inventory-equipment,#inventoryPanel .inventory-items{padding:10px;background:transparent}
#inventoryPanel #equipmentSlots{grid-template-columns:1fr;gap:10px}
#inventoryPanel .equipment-box{width:44px;height:44px;border-radius:6px;background:#152a30c9}
#inventoryPanel .inventory-label{margin-bottom:8px;color:#baccc0;letter-spacing:1px}
#inventoryPanel #inventorySearch{min-height:40px;padding:7px 9px}
#inventoryPanel .pack-tools{gap:5px;margin:6px 0}
#inventoryPanel .pack-tools select{padding:5px;font-size:10px}
#inventoryPanel #inventorySummary{padding:6px 0;color:#c3d4c9}
#inventoryPanel .inventory-item{min-height:44px;padding:7px 8px;margin:2px 0;background:#14262ba8;font-size:12px}
#inventoryPanel .item-meta,#inventoryPanel .equipment-slot,#inventoryPanel .equipment-name{color:#c5d6cb}
#inventoryPanel #inventoryDetails{min-height:70px;max-height:175px;padding:9px;margin-top:6px;background:#08171bd9;line-height:1.45}
#inventoryPanel .pack-detail-title{font-size:14px}
#inventoryPanel .pack-detail-text{margin:5px 0;color:#d4e0d7}
#inventoryPanel .pack-actions{margin:5px 0}
#inventoryPanel .inventory-footer{padding:7px 10px;font-size:9px;background:#0b171cc9;color:#c4d3c8}
#inventoryPanel #packStatus{margin:4px 0;min-height:14px}
#inventoryPanel #packLoadout{margin-top:10px;font-size:10px;color:#d3dfd5}
#inventoryPanel[data-inventory-page=craft] #itemWorkshop{padding:12px;background:transparent}
#inventoryPanel #itemWorkshop .item-columns{gap:12px}
#inventoryPanel #itemWorkshop p{color:#d1ddd3}
#keyHelp,#lorePanel{background:#0b191eee;border:1px solid #78918688;box-shadow:0 6px 22px #0005;backdrop-filter:none;padding:12px;font-size:12px;color:#e0e8df}
#characterPanel{background:transparent}
#characterPanel .character-card{padding:14px;background:#0d2025ed;box-shadow:0 8px 24px #0005}
#characterPreview{width:96px;height:96px}
#questBoard,#livingPanel{inset:12px 12px 12px auto;width:min(580px,calc(100% - 24px));max-height:660px;margin:auto 0;padding:14px;background:#0c1b22ed;box-shadow:0 8px 28px #0006;font-size:12px;backdrop-filter:none}
#questBoard h2,#livingPanel h2{font-size:17px}
#outsideTools,#regionPanel,#swordQuestTracker,#vitalPanel{background:#0c1d24df;color:#e1e9dd;box-shadow:0 3px 12px #0003;backdrop-filter:none}
.gulch-item-image{display:block;width:26px;height:26px;object-fit:contain;image-rendering:pixelated;margin:auto}
#inventoryPanel .equipment-box .gulch-item-image{width:32px;height:32px}
@media(max-width:700px){
 #inventoryPanel:not([hidden]){inset:auto 6px 6px;width:calc(100% - 12px);max-width:none;height:66%;max-height:620px;overflow:hidden!important;border-radius:9px}
 #inventoryPanel .inventory-body{flex:1 1 auto!important;min-height:0!important;grid-template-columns:86px minmax(0,1fr)}
 #inventoryPanel .inventory-equipment,#inventoryPanel .inventory-items{padding:7px}
 #inventoryPanel .inventory-header{padding:8px 10px}
 #inventoryPanel .inventory-header h1{font-size:14px}
 #inventoryPanel .new-inventory-meta{display:none}
 #inventoryPanel #inventoryDetails{min-height:55px;max-height:120px;flex-shrink:1}
 #inventoryPanel #inventoryList{min-height:44px}
 #inventoryPanel .inventory-footer{display:none}
 #inventoryPanel[data-inventory-page=craft] #itemWorkshop{flex:1 1 auto;min-height:0;overflow:auto}
 #questBoard,#livingPanel{inset:auto 6px 6px;width:calc(100% - 12px);max-height:65%;margin:0}
 #characterPanel{inset:auto 6px 6px;max-height:68%;padding:0}
 #characterPanel .character-card{max-height:60vh;overflow:auto}
 #lorePanel{max-height:55%;bottom:8px}
}
@media(prefers-reduced-motion:reduce){#inventoryPanel *,#lootReveal{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
`;document.head.append(style);
function icon(node,item){
 const candidates=[item.image,item.icon,item.imageUrl,item.iconUrl,item.asset];
 const source=candidates.map(v=>typeof v==='string'?v:v&&typeof v==='object'?v.src:null).find(v=>typeof v==='string'&&/^data:image\/(png|webp|gif|jpeg);base64,/i.test(v));
 const signature=item.id+':'+(source||item.glyph||'◇');
 if(node.dataset.catalogIcon===signature)return;
 node.dataset.catalogIcon=signature;node.replaceChildren();
 if(source){const image=document.createElement('img');image.className='gulch-item-image';image.alt='';image.src=source;image.addEventListener('error',()=>{node.textContent=(item.glyph||'◇')+'\uFE0E';},{once:true});node.append(image);}
 else node.textContent=(item.glyph||'◇')+'\uFE0E';
}
window.GulchItemPresentation=Object.freeze({icon});
function decorate(){
 if(panel.hidden)return;
 const items=window.GulchItemCatalog?.items||{};
 panel.querySelectorAll('[data-pack-key^="field:"]').forEach(button=>{
  const item=items[button.dataset.packKey.slice(6)];if(!item)return;
  const target=button.classList.contains('equipment-box')?button:button.querySelector('.item-glyph');
  if(target)icon(target,item);
 });
}
let scheduled=false;
new MutationObserver(()=>{if(scheduled||panel.hidden)return;scheduled=true;queueMicrotask(()=>{scheduled=false;decorate();});}).observe(panel,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
decorate();
})();
