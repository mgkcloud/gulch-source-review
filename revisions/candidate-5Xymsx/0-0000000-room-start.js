(function(){
'use strict';
const host=document.getElementById('left'),board=document.getElementById('board');
if(!host||!board)return;
const request=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window);
let latest=null,opened=true,loaded=document.readyState==='complete',granted=false;
let frame=null,timer=null,generation=0,requested=false,rendererSeen=false;
const epoch=s=>String(s?.gameState?.respawnSettings?.token||'original');
const dialog=document.createElement('dialog');dialog.id='roomStartGate';
dialog.setAttribute('aria-labelledby','roomStartTitle');dialog.setAttribute('aria-describedby','roomStartDescription');
const title=document.createElement('h2');title.id='roomStartTitle';title.textContent='Preparing your expedition';
const description=document.createElement('p');description.id='roomStartDescription';description.textContent='Loading the world and preparing movement. Your companion can join whenever they are ready.';
const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
const detail=document.createElement('p');detail.className='room-start-detail';
const enter=document.createElement('button');enter.type='button';enter.textContent='Enter expedition';enter.hidden=true;
const focus=document.createElement('div');focus.tabIndex=-1;focus.append(title,description,status,detail,enter);dialog.append(focus);document.body.append(dialog);
const style=document.createElement('style');style.textContent='#roomStartGate{width:min(470px,calc(100% - 32px));max-height:85vh;overflow:auto;padding:28px;border:3px double #bca579;border-radius:10px;background:#10252b;color:#e4e9d9;box-shadow:0 20px 70px #0009;font:14px/1.65 ui-monospace,monospace}#roomStartGate::backdrop{background:#051015}#roomStartGate h2{margin:0 0 14px;color:#f4dba7;font:26px Georgia,serif}#roomStartGate [role=status]{padding:12px;background:#193731;border:1px solid #657e69;border-radius:5px;color:#f1d99e}#roomStartGate .room-start-detail{font-size:12px;color:#aec5bb}#roomStartGate button{min-height:44px;padding:10px 16px;border:1px solid #c7b17f;border-radius:5px;background:#294738;color:#fff0c6;font:inherit;cursor:pointer}#roomStartGate button[hidden]{display:none}#roomStartGate button:focus-visible{outline:2px solid #f4dba7;outline-offset:4px}';document.head.append(style);
function valid(){return Boolean(latest?.gameState?.seed&&latest.player&&Number.isSafeInteger(latest.stateRevision)&&Number.isSafeInteger(latest.revision));}
function dead(){return valid()&&(latest.player.hp<=0||latest.gameState.gulchPermanentGameOver?.ended);}
function rendered(){
 const stream=window.GulchRenderStream?.report();
 return rendererSeen&&board.width>0&&board.height>0&&board.getBoundingClientRect().width>0&&(!stream||stream.paints>0);
}
function sceneReady(){return loaded&&valid()&&rendered()&&!window.GulchMovementState?.inFlight;}
function ready(){return sceneReady()&&(dead()||granted&&window.GulchMovementState?.focused);}
function text(node,value){if(node.textContent!==value)node.textContent=value;}
function update(){
 const scene=sceneReady();
 text(status,!loaded?'Loading game components…':!valid()?'Receiving the shared world…':!rendered()?'Drawing the world and adventurer…':window.GulchMovementState?.inFlight?'Finishing the current room update…':!granted&&!dead()?'World ready · enabling movement…':'Ready to explore');
 text(detail,scene&&!granted&&!dead()?'If the expedition does not open automatically, select Enter expedition to give the game keyboard focus.':'The loading screen clears after this browser has drawn the scene and can accept movement.');
 enter.hidden=!scene||granted||dead();
 dialog.setAttribute('aria-busy',String(!scene));
}
function requestFocus(){
 if(!opened||!loaded||document.hidden||dead())return;
 requested=true;parent.postMessage({type:'gulch:request-focus'},'*');
}
function stop(){generation++;if(frame!==null)cancel(frame);frame=null;clearTimeout(timer);timer=null;}
function schedule(){
 if(!opened||document.hidden||frame!==null||timer!==null)return;
 timer=setTimeout(check,80);
}
function check(){
 timer=null;if(!opened||document.hidden)return;
 update();
 if(sceneReady()&&!granted&&!requested)requestFocus();
 if(!ready()){schedule();return;}
 const token=generation,source=latest.revision,run=epoch(latest);
 frame=request(()=>{
  frame=null;
  if(token!==generation||!opened||document.hidden)return;
  if(!ready()||latest.revision!==source||epoch(latest)!==run){schedule();return;}
  frame=request(()=>{
   frame=null;
   if(token!==generation||!opened||document.hidden)return;
   if(!ready()||latest.revision!==source||epoch(latest)!==run){schedule();return;}
   opened=false;dialog.close();
   if(dead()){
    const screen=document.getElementById('respawnScreen');
    if(screen&&!screen.hidden)(screen.querySelector('select,button:not(:disabled)')||screen).focus({preventScroll:true});
   }else{board.tabIndex=-1;board.focus({preventScroll:true});}
  });
 });
}
function show(){
 opened=true;Gulch.setMovement(0,0);
 if(!dialog.open){dialog.showModal();focus.focus({preventScroll:true});}
 update();schedule();
}
enter.addEventListener('click',()=>{requestFocus();schedule();});
dialog.addEventListener('cancel',event=>event.preventDefault());
dialog.addEventListener('close',()=>{if(opened)show();});
window.addEventListener('keydown',event=>{
 if(!opened)return;
 if(event.key==='Tab'||event.target===enter&&(event.key==='Enter'||event.key===' '))return;
 event.preventDefault();event.stopImmediatePropagation();
},true);
const register=Gulch.register;
Gulch.register=function(name,callbacks){
 if(!callbacks||typeof callbacks!=='object')return register(name,callbacks);
 const wrapped={...callbacks};
 if(typeof callbacks.action==='function')wrapped.action=function(a){if(!opened)return callbacks.action.call(callbacks,a);};
 if(name==='renderer'&&typeof callbacks.snapshot==='function')wrapped.snapshot=function(s){
  const result=callbacks.snapshot.call(callbacks,s);rendererSeen=true;schedule();return result;
 };
 return register(name,wrapped);
};
register('expedition-entry',{snapshot(s){
 const reset=latest&&(latest.revision!==s.revision||epoch(latest)!==epoch(s));latest=s;
 if(opened&&reset){stop();requested=false;}
 if(opened){update();schedule();}
}});
window.addEventListener('message',event=>{
 if(event.source!==parent||event.data?.type!=='gulch:focus'||typeof event.data.granted!=='boolean')return;
 granted=event.data.granted;
 if(opened){update();schedule();}
});
window.addEventListener('blur',()=>{granted=false;if(opened){stop();requested=false;}});
window.addEventListener('focus',()=>{if(opened){requested=false;schedule();}});
window.addEventListener('gulch:recovered',schedule);
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){stop();granted=false;requested=false;}
 else if(opened){show();}
});
if(!loaded)window.addEventListener('load',()=>{loaded=true;schedule();},{once:true});
show();
})();
