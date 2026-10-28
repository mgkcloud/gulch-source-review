(function(){
'use strict';
const host=document.getElementById('left');
if(!host)return;
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
const style=el('style');
style.textContent=`
#interfaceDock{position:absolute;right:14px;top:84px;z-index:6;display:flex;gap:6px;padding:6px;background:#102321f5;border:1px solid #688474;border-radius:10px;box-shadow:0 6px 22px #0006}
#interfaceDock button{width:44px;height:44px;padding:0;border:1px solid #536e60;border-radius:7px;background:#19332e;color:#f0d8a5;font:23px ui-monospace,monospace}
#interfaceDock button[aria-expanded=true]{background:#3b5341;border-color:#efd095}
#interfaceMenu[hidden]{display:none}
#interfaceMenu{position:absolute;right:14px;top:148px;z-index:6;width:min(350px,calc(100% - 28px));max-height:calc(100% - 170px);overflow:auto;padding:16px;border:1px solid #829777;border-radius:10px;background:#0c2023fa;color:#dce7d6;box-shadow:0 16px 45px #0009;font:12px/1.6 ui-monospace,monospace}
#interfaceMenu header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
#interfaceMenu h2{margin:0;color:#f0d8a5;font-size:16px}
#interfaceMenu p{color:#a9c0b1;margin:8px 0 12px}
#interfaceMenu button{min-height:44px;padding:10px 12px;border:1px solid #536e60;border-radius:6px;background:#19332e;color:#e8dfc5;font:inherit}
#interfaceMenu details{margin:9px 0;border:1px solid #3f6054;border-radius:7px;padding:8px}
#interfaceMenu summary{cursor:pointer;padding:5px;color:#e6d2a8;font-weight:bold}
#interfaceMenu .interface-actions{display:grid;gap:8px;margin-top:10px}
#interfaceMenu .interface-actions>button{position:static!important;inset:auto!important;width:100%!important;max-width:none!important;margin:0!important;z-index:auto!important;text-align:left;font:12px/1.6 ui-monospace,monospace!important;box-shadow:none!important}
#interfaceMenu :focus-visible,#interfaceDock :focus-visible{outline:2px solid #f0d09a;outline-offset:3px}
@media(max-width:700px){#interfaceDock{right:10px;top:110px;gap:4px;padding:4px}#interfaceDock button{width:40px;height:40px}#interfaceMenu{right:10px;top:166px;max-height:calc(100% - 180px)}}
@media(max-height:480px){#interfaceMenu{top:78px;max-height:calc(100% - 90px)}#interfaceDock{top:22px}}
`;
document.head.append(style);
const dock=el('nav');dock.id='interfaceDock';dock.setAttribute('aria-label','Game menus');
const panel=el('section');panel.id='interfaceMenu';panel.hidden=true;panel.setAttribute('aria-labelledby','interfaceMenuTitle');
const header=el('header'),title=el('h2');title.id='interfaceMenuTitle';
const close=el('button','Close ×');close.type='button';header.append(title,close);
const description=el('p'),body=el('div');panel.append(header,description,body);host.append(dock,panel);
const groups=[
 {id:'character',icon:'♙',label:'Character & pack',description:'Manage your shared adventurer and equipment.',sections:[['Adventurer',['characterToggle']],['Equipment & controls',['inventoryToggle','keyHelpToggle']]]},
 {id:'adventure',icon:'⚑',label:'Adventure',description:'Follow the main quest and speak with nearby travelers.',sections:[['Quests & conversations',['questToggle','loreToggle']]]},
 {id:'project',icon:'▦',label:'Project tools',description:'Expand a section to select work or inspect the running project.',sections:[['Choose your next change',['selectWorkToggle']],['Inspect & expand project',['workToggle']]]}
];
let active=null,opener=null;
function hide(restore){panel.hidden=true;active=null;groups.forEach(g=>g.button.setAttribute('aria-expanded','false'));if(restore&&opener?.isConnected)opener.focus();}
function show(group){
 if(active===group.id&&!panel.hidden){hide(true);return;}
 active=group.id;opener=group.button;title.textContent=group.label;description.textContent=group.description;
 groups.forEach(g=>{g.container.hidden=g!==group;g.button.setAttribute('aria-expanded',String(g===group));});
 panel.hidden=false;close.focus({preventScroll:true});
}
groups.forEach(group=>{
 const b=el('button',group.icon);b.type='button';b.title=group.label;b.setAttribute('aria-label',group.label);b.setAttribute('aria-controls','interfaceMenu');b.setAttribute('aria-expanded','false');b.addEventListener('click',()=>show(group));group.button=b;dock.append(b);
 const container=el('div');container.hidden=true;group.container=container;body.append(container);
 group.sections.forEach(([label,ids],index)=>{
  const section=el('details');section.open=index===0;section.append(el('summary',label));
  const actions=el('div');actions.className='interface-actions';section.append(actions);
  ids.forEach(id=>{
   const control=document.getElementById(id);if(!control)return;
   // Retain original nodes so their event handlers and state remain intact.
   control.addEventListener('click',()=>hide(false),true);
   actions.append(control);
  });
  if(actions.children.length)container.append(section);
 });
});
close.addEventListener('click',()=>hide(true));
window.addEventListener('keydown',event=>{
 if(panel.hidden)return;
 if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();hide(true);return;}
 const target=event.target;
 if(!panel.contains(target)&&!dock.contains(target))return;
 // Keep navigation inside this menu from also moving the shared character.
 if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D','i','I','>',' '].includes(event.key))event.stopImmediatePropagation();
},true);
document.addEventListener('pointerdown',event=>{if(!panel.hidden&&!panel.contains(event.target)&&!dock.contains(event.target))hide(false);},true);
document.addEventListener('focusin',event=>{if(!panel.hidden&&!panel.contains(event.target)&&!dock.contains(event.target))hide(false);});
Gulch.register('interface-icon-menu',{snapshot(){
 const modal=['inventoryPanel','characterPanel','questBoard','workBoard','respawnScreen'].some(id=>{const n=document.getElementById(id);return n&&!n.hidden;});
 if(modal&&!panel.hidden)hide(false);
}});
})();
