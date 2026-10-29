(function(){
'use strict';
function install(){
 const host=document.getElementById('left');if(!host)return;
 const style=document.createElement('style');
 style.textContent=`
#cornerNotifications{position:absolute;right:12px;top:58px;z-index:8;display:flex;flex-direction:column;gap:7px;width:min(310px,calc(100% - 24px));pointer-events:none}
#cornerNotifications .corner-notification{position:static!important;inset:auto!important;transform:none!important;width:100%!important;max-width:none!important;margin:0!important;padding:10px 12px!important;background:#102523f2!important;color:#eee1bd!important;border:1px solid #aa987266!important;border-radius:7px!important;box-shadow:0 4px 14px #0005!important;font:11px/1.5 ui-monospace,monospace!important;text-align:left!important;pointer-events:none!important;overflow-wrap:anywhere}
#cornerNotifications .corner-notification[hidden],#cornerNotifications .corner-notification.notification-expired{display:none!important}
@media(max-width:700px){#cornerNotifications{top:52px;right:8px;width:min(270px,calc(100% - 16px))}}
`;
 document.head.append(style);
 const stack=document.createElement('section');stack.id='cornerNotifications';stack.setAttribute('aria-label','Expedition notifications');host.append(stack);
 const tracked=new Map();
 const ids=['enemyThreatWarning','groundHazardStatus','interactKeyStatus'];
 function attach(node){
  if(!node||tracked.has(node))return;
  const entry={text:'',timer:null};tracked.set(node,entry);
  node.classList.add('corner-notification','notification-expired');
  stack.append(node);
  function update(){
   const text=node.textContent.trim();
   if(!text){clearTimeout(entry.timer);entry.timer=null;entry.text='';node.classList.add('notification-expired');return;}
   if(text===entry.text)return;
   entry.text=text;clearTimeout(entry.timer);
   node.classList.remove('notification-expired');
   entry.timer=setTimeout(()=>{entry.timer=null;node.classList.add('notification-expired');},4000);
  }
  new MutationObserver(update).observe(node,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['hidden']});
  update();
 }
 for(const id of ids)attach(document.getElementById(id));
 // The landscape encounter warning predates named notification elements.
 for(const node of Array.from(host.children)){
  if(node.tagName==='DIV'&&node.getAttribute('role')==='status'&&node.style.bottom==='220px')attach(node);
 }
 document.addEventListener('visibilitychange',()=>{
  if(!document.hidden)return;
  for(const [node,entry] of tracked){clearTimeout(entry.timer);entry.timer=null;node.classList.add('notification-expired');}
 });
 Gulch.register('corner-notifications',{snapshot(s){
  if(s.player.hp>0)return;
  for(const [node,entry] of tracked){clearTimeout(entry.timer);entry.timer=null;node.classList.add('notification-expired');}
 }});
}
if(document.readyState==='complete')install();else window.addEventListener('load',install,{once:true});
})();
