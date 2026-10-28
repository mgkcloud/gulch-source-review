(function(){
'use strict';
const style=document.createElement('style');
style.textContent=`
:root{--ink:#080f13;--panel:#101f22;--line:#30433e;--fg:#d9e1d3;--dim:#91a69b;--amber:#e9c58c}
#left{background:#080f13}
#hud{top:14px;left:14px;right:14px;padding:12px 16px;gap:20px;align-items:center;border:1px solid #a2bfa024;border-radius:7px;background:linear-gradient(125deg,#162a2bef,#0c191ded);box-shadow:0 6px 24px #0004,inset 0 1px #ffffff08;font-size:9px;letter-spacing:1.4px;color:#8fa69c;backdrop-filter:blur(12px)}
#hud span{display:flex;flex-direction:column;gap:3px;min-width:0}#hud b{font-size:13px;letter-spacing:.3px;color:#e5d9b6;font-weight:500}#hud span:nth-child(2){flex:1}#hud span:nth-child(2) b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:42vw}
#focusHint{top:84px;left:18px;color:#a3b6a8;font-size:10px;text-shadow:0 2px 5px #000;background:#081317a8;padding:5px 8px;border-radius:3px;pointer-events:none}
#moduleErrors:empty{display:none}#moduleErrors{height:auto;max-height:110px;bottom:40px;right:160px;background:#101b20ed;border-left:2px solid #d3a879;left:16px;padding:10px 14px;border-radius:3px;color:#d6b798}
#controls{bottom:40px;right:18px;grid-template-columns:repeat(3,40px);gap:5px;padding:9px;border:1px solid #adc39b24;background:#0a171cdb;border-radius:10px;box-shadow:0 8px 30px #0005;backdrop-filter:blur(8px)}
#controls button{height:40px;padding:0;border:1px solid #52685a80;border-radius:5px;background:linear-gradient(#253a38,#142826);color:#e3d3ae;font-size:19px;box-shadow:inset 0 1px #ffffff0b,0 2px 3px #0003;touch-action:manipulation}
#controls button:hover{background:#314c43;border-color:#a2b58a}#controls button:active{transform:translateY(1px);background:#3a5547}button:focus-visible{outline:2px solid #e9c58c;outline-offset:3px}
#inventoryToggle,#keyHelpToggle{right:18px;top:84px;background:linear-gradient(120deg,#1a302ded,#102321f5);border:1px solid #879c6e66;border-radius:5px;color:#dedabd;padding:9px 13px;font-size:11px;letter-spacing:.3px;box-shadow:0 4px 14px #0004}
#keyHelpToggle{top:127px}#keyHelp{top:170px;right:18px;border:1px solid #71866c;border-radius:7px;background:#0c1e21f5;line-height:1.7;box-shadow:0 12px 40px #0008}#keyHelp h2{color:#e3c792}#keyHelp button{border-radius:4px}
#inventoryPanel{inset:18px;max-width:1050px;margin:auto;border:1px solid #788d70;border-radius:9px;overflow:hidden;background:linear-gradient(135deg,#122c2afc,#081b20fc);box-shadow:0 0 0 100vmax #030a0dbb,0 20px 80px #000b;color:#bfd0bd}
.inventory-header{padding:18px 20px;background:linear-gradient(100deg,#254137b3,#12272b);border-bottom:1px solid #7f926e50}.inventory-header h1{color:#e8d4a9;font-size:14px;letter-spacing:2px}.inventory-label{color:#a3b390;font-size:10px;letter-spacing:2px}
.inventory-equipment{background:#081b1b66;border-right-color:#62785b40;padding:22px 16px}.inventory-items{padding:20px}.equipment-box{border:1px solid #71836588;border-radius:6px;background:linear-gradient(135deg,#18302b,#0a1b1c);box-shadow:inset 0 0 0 4px #091a1980,0 3px 8px #0003;color:#e3cf97}.equipment-slot{color:#93ab98}.equipment-name{color:#d3d4b8}
#inventoryPanel button{border-radius:4px}#inventorySearch{border:1px solid #667e6588;border-radius:5px;background:#08191d;min-height:38px}#inventorySearch:focus{outline:2px solid #d5bc85}#inventorySummary{color:#9bb09c;border-color:#6a81543d;padding:13px 0}
.inventory-category{background:#273e303d;color:#d4c79d;font-size:10px;letter-spacing:1.7px;border-bottom:1px solid #69815c40;border-radius:3px;padding:8px 10px}#inventoryPanel .inventory-item{padding:12px 10px;border-color:#6f885225}#inventoryPanel .inventory-item:hover{background:#7b9b6830}#inventoryPanel .inventory-item[aria-pressed=true]{background:linear-gradient(90deg,#687f4c4d,#35503a33);box-shadow:inset 2px 0 #dec68d;color:#f0dfaf}.item-glyph{color:#d3be83}.item-meta{color:#99b09c}
#inventoryDetails{border-color:#73865d55;color:#bdcbbb;line-height:1.7;padding:14px 4px 0}.inventory-footer{background:#07171a70;color:#9aad94;padding:12px 18px;border-color:#75855c44}.inventory-key-guide{color:#9fb098;border-color:#73855b40;background:#11272488}
*{scrollbar-width:thin;scrollbar-color:#536c56 #0b1c1e}
@media(max-width:700px){#hud{top:8px;left:8px;right:8px;gap:12px;padding:10px;flex-wrap:nowrap;font-size:8px}#hud b{font-size:11px}#hud span:nth-child(2) b{max-width:30vw}#focusHint{top:72px;left:8px;max-width:calc(100% - 145px);font-size:9px}#inventoryToggle{top:72px;right:10px}#keyHelpToggle{top:113px;right:10px}#keyHelp{top:155px;right:10px}#controls{right:10px;bottom:34px;grid-template-columns:repeat(3,36px);padding:7px}#controls button{height:36px}#inventoryPanel{inset:8px}.inventory-header{padding:12px}.inventory-header h1{font-size:11px;letter-spacing:1px}.inventory-items,.inventory-equipment{padding:10px}.inventory-footer{font-size:9px;letter-spacing:0;padding:9px}.inventory-key-guide{font-size:10px;padding:8px 10px}#moduleErrors{right:150px}}
@media(max-width:390px){#hud{gap:8px;letter-spacing:.4px}#hud b{font-size:10px}#hud span:nth-child(3){display:none}.inventory-header h1{max-width:160px}.inventory-body{grid-template-columns:120px minmax(0,1fr)}}
`;
document.head.append(style);
document.querySelectorAll('[data-move]').forEach(button=>{const names={'0,-1':'Move north','0,1':'Move south','-1,0':'Move west','1,0':'Move east'};button.setAttribute('aria-label',names[button.dataset.move]||'Move');button.title=button.getAttribute('aria-label');});
const descend=document.getElementById('descendBtn');descend.setAttribute('aria-label','Use exit');descend.title='Use exit [>]';
})();
