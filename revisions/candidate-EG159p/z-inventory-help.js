(function(){
'use strict';
const panel=document.getElementById('inventoryPanel');
const list=document.getElementById('inventoryList');
const toggle=document.getElementById('inventoryToggle');
const style=document.createElement('style');
style.textContent='#keyHelpToggle{position:absolute;right:12px;top:96px;z-index:4;background:#092724;color:#c5d8bc;border:1px solid #557d70;padding:7px 12px;font:12px monospace}#keyHelp{position:absolute;right:12px;top:137px;z-index:5;width:min(320px,calc(100% - 24px));padding:16px;background:#051c1bf5;border:3px double #56786f;color:#b6cbc1;box-shadow:0 8px 30px #000;font-size:12px}#keyHelp[hidden]{display:none}#keyHelp h2{font-size:13px;color:#d4ddad;letter-spacing:2px;margin:0 0 12px}#keyHelp p{margin:8px 0}#keyHelp button{background:#0b2926;color:#c0d1bd;border:1px solid #46695e;padding:6px 10px}#keyHelpToggle:focus-visible,#keyHelp button:focus-visible{outline:2px solid #c6cf83;outline-offset:2px}.inventory-key-guide{margin:0;padding:8px 16px;border-bottom:1px solid #42645b;color:#9db7a7;font-size:11px}';
document.head.append(style);
const button=document.createElement('button');
button.id='keyHelpToggle';button.type='button';button.textContent='Keys / Q & F';
button.setAttribute('aria-controls','keyHelp');button.setAttribute('aria-expanded','false');
const help=document.createElement('section');
help.id='keyHelp';help.hidden=true;help.setAttribute('aria-label','Game controls');
const title=document.createElement('h2');title.textContent='GAME CONTROLS';help.append(title);
[
 'WASD / Arrow keys — move. Walk into a creature to interact or attack.',
 '> / center movement button — use an exit beneath you.',
 'I — open or close inventory. Select a carried item or equipment slot to inspect it.',
 'Inventory: ↑ / ↓, Home / End — browse carried items. Type in Search to filter.',
 'Q and F — unassigned. Neither key currently performs a game action.',
 'Esc — close inventory, or return keyboard focus to chat.'
].forEach(text=>{const p=document.createElement('p');p.textContent=text;help.append(p);});
const close=document.createElement('button');close.type='button';close.textContent='Close help';help.append(close);
function show(open){help.hidden=!open;button.setAttribute('aria-expanded',String(open));if(open)close.focus();else button.focus();}
button.addEventListener('click',()=>show(help.hidden));
close.addEventListener('click',()=>show(false));
help.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();show(false);}});
document.getElementById('left').append(button,help);
const guide=document.createElement('p');guide.className='inventory-key-guide';
guide.textContent='Select an item to inspect · ↑ / ↓ browse items · Q / F unassigned';
panel.querySelector('.inventory-header').after(guide);
// Capture on window so inventory's modal key guard can still block game movement.
window.addEventListener('keydown',event=>{
 if(panel.hidden||event.altKey||event.ctrlKey||event.metaKey)return;
 const target=event.target;
 if(target instanceof HTMLElement&&(target.matches('input,textarea,select')||target.isContentEditable))return;
 if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
 const items=Array.from(list.querySelectorAll('button.inventory-item'));
 if(!items.length)return;
 event.preventDefault();event.stopImmediatePropagation();
 const index=items.indexOf(document.activeElement);
 let next=event.key==='Home'?0:event.key==='End'?items.length-1:index<0?(event.key==='ArrowUp'?items.length-1:0):Math.max(0,Math.min(items.length-1,index+(event.key==='ArrowUp'?-1:1)));
 items[next].focus();items[next].click();items[next].scrollIntoView({block:'nearest'});
},true);
Gulch.register('inventory-help',{
 snapshot(){
  toggle.title='Open shared inventory [I]. Inspect equipment and search carried items.';
  if(!panel.hidden){
   const empty=list.querySelector('.inventory-empty');
   if(empty&&empty.textContent==='No carried items in the game state.')empty.textContent='Your shared pack is empty. Equipped items appear on the left; carried items appear here when present in the game state.';
  }
 }
});
})();
