(function(){
'use strict';
const style=document.createElement('style');
style.textContent=`
#pilgrimToggle{width:48px!important;height:52px!important;min-height:52px!important;padding:4px!important;background:#17262ad9!important;border:1px solid #a89161!important;border-radius:7px!important;box-shadow:0 3px 9px #0005;display:grid;place-items:center}
#interfaceMenu .interface-actions>#questToggle{width:52px!important;height:52px!important;min-height:52px!important;padding:4px!important;display:grid;place-items:center;text-align:center!important;background:#17262a!important;border:1px solid #b99c64!important}
.quest-scroll-icon{display:block;width:40px;height:40px;image-rendering:pixelated;pointer-events:none}
#pilgrimToggle:hover,#interfaceMenu #questToggle:hover{background:#344234!important;border-color:#f1d69d!important}
#pilgrimToggle:focus-visible,#questToggle:focus-visible{outline:3px solid #ffe2a0!important;outline-offset:3px}
#pilgrimJournal,#questBoard{color:#39291d;background:linear-gradient(110deg,#bd8145 0%,#e8bf81 5%,#f1d49b 45%,#dfac6a 95%,#ae6e38 100%);border:6px double #49372b;border-radius:2px;box-shadow:0 14px 50px #0009,inset 0 0 35px #8c542c44;font-family:ui-monospace,monospace}
#pilgrimJournal header,#questBoard header{background:#dfb575;border-bottom:3px double #795436;color:#39291d}
#pilgrimJournal h2,#questBoard h2{font-family:Georgia,serif;color:#39291d;text-shadow:0 1px #f7e2b4}
#pilgrimJournal h3,#questBoard h3{color:#51351f}
#pilgrimJournal small,#pilgrimJournal .pilgrim-intro,#pilgrimJournal .pilgrim-lore,#pilgrimMapText,#questBoard p{color:#503923}
#pilgrimJournal .pilgrim-lore{font-family:Georgia,serif;font-size:17px}
#pilgrimJournal .pilgrim-chapter{border-left:3px solid #8c6038}
#pilgrimJournal .pilgrim-requirement{background:#f7dfaa85;border:2px solid #aa7946;box-shadow:inset 0 0 12px #b4824933}
#pilgrimJournal .pilgrim-requirement strong{color:#50331c}
#pilgrimJournal button,#questBoard button{background:#e9c38a;color:#3d2b1c;border:2px solid #89603b;border-radius:2px;box-shadow:0 2px #79503233}
#pilgrimJournal button:hover:not(:disabled),#questBoard button:hover:not(:disabled){background:#f4dba8;border-color:#49372b}
#pilgrimJournal button[aria-pressed=true]{background:#765030;color:#fff0c6;border-color:#49372b}
#pilgrimJournal button:disabled{opacity:.65}
#pilgrimJournal details,#questBoard li{border-color:#a77a49}
#pilgrimJournal summary{color:#51351f}
#pilgrimStatus{color:#683a1b;font-weight:bold}
#questBoard .quest-done{color:#35552e}
#pilgrimQuestMap{border:4px double #785735;background:#c7a46e}
#pilgrimJournal :focus-visible,#questBoard :focus-visible{outline:3px solid #315f69;outline-offset:3px}
@media(max-width:700px){#pilgrimJournal{border-width:4px}#pilgrimToggle{width:44px!important;height:48px!important;min-height:48px!important}.quest-scroll-icon{width:36px;height:36px}}
`;
document.head.append(style);
function scroll(){
 const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;canvas.className='quest-scroll-icon';canvas.setAttribute('aria-hidden','true');
 const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
 function box(color,x,y,w,h){c.fillStyle=color;c.fillRect(x,y,w,h);}
 const ink='#302b25';
 box(ink,6,2,20,2);box(ink,3,4,6,8);box(ink,2,6,2,5);box(ink,8,5,2,22);box(ink,25,4,2,23);box(ink,10,27,17,3);
 box('#9a602f',4,5,5,6);box('#d5a05a',5,4,4,4);box('#684024',7,9,2,2);
 box('#e4b374',10,4,15,22);box('#f6dfa0',10,4,15,2);box('#f1d08b',10,6,2,16);box('#c58a47',12,22,13,5);
 box('#eec77e',24,6,1,17);box('#a66a35',10,24,3,3);
 box(ink,14,9,8,2);box(ink,14,14,8,2);box(ink,14,19,8,2);
 box(ink,14,24,15,2);box(ink,13,26,2,3);box(ink,28,26,2,3);box('#f7dda0',16,26,12,2);box('#d9a25d',15,28,13,1);
 box('#f8dfa0',29,13,3,1);box('#f8dfa0',30,12,1,3);box('#d9ab68',1,22,3,1);box('#d9ab68',2,21,1,3);
 return canvas;
}
function install(id,label){
 const button=document.getElementById(id);if(!button)return;
 button.setAttribute('aria-label',label);button.title=label;
 function decorate(){
  if(button.children.length===1&&button.firstElementChild.classList.contains('quest-scroll-icon')&&button.childNodes.length===1)return;
  button.replaceChildren(scroll());
 }
 decorate();
 new MutationObserver(decorate).observe(button,{childList:true});
}
install('pilgrimToggle','Open quest journal — The Keeper’s Last Light');
install('questToggle','Open main quest — Sword of First Light');
})();
