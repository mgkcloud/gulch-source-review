(function(){
'use strict';
const host=document.getElementById('left'),board=document.getElementById('board');
if(!host||!board)return;
const mobile=window.matchMedia('(any-pointer: coarse) and (max-width: 1100px)');
const style=document.createElement('style');style.textContent=`
#mobileStick{position:absolute;width:116px;height:116px;border-radius:50%;border:2px solid #e6d9ad66;background:#122b304d;pointer-events:none;z-index:7;transform:translate(-50%,-50%)}
#mobileStick[hidden],#mobileStickHint[hidden]{display:none!important}
#mobileStick:before,#mobileStick:after{content:'';position:absolute;background:#e6d9ad33;left:50%;top:15%;width:1px;height:70%}#mobileStick:after{transform:rotate(90deg)}
#mobileStickKnob{position:absolute;left:50%;top:50%;width:44px;height:44px;border-radius:50%;border:1px solid #f4e2ae99;background:#a8c4ac55;transform:translate(-50%,-50%)}
#mobileStick[data-slashing=true]{border-color:#ffe1aacc;background:#81573544}
#mobileStickHint{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);max-width:calc(100% - 24px);padding:6px 9px;background:#102329b8;color:#e5dfc6;border-radius:5px;text-align:center;font:10px/1.5 monospace;pointer-events:none;z-index:6}
@media(any-pointer:coarse) and (max-width:1100px){#board{touch-action:none;user-select:none;-webkit-user-select:none}}
`;document.head.append(style);
const ring=document.createElement('div');ring.id='mobileStick';ring.hidden=true;ring.setAttribute('aria-hidden','true');
const knob=document.createElement('div');knob.id='mobileStickKnob';ring.append(knob);
const hint=document.createElement('div');hint.id='mobileStickHint';hint.textContent='Hold map + drag to run · second finger to slash';hint.hidden=!mobile.matches;host.append(ring,hint);
let latest=null,primary=null,second=null,timer=null,frame=0,active=false,origin=null,point=null,speed=0,last=0,nextSlash=0,suppressUntil=0;
const dialogs=['inventoryPanel','characterPanel','questBoard','workBoard','livingPanel','respawnScreen','interfaceMenu','tradePanel','travelMapPanel','pilgrimJournal','itemContext','enemyInspectCard','atlasPanel'];
function blocked(){return Boolean(document.querySelector('dialog[open]'))||dialogs.some(id=>{const n=document.getElementById(id);return n&&!n.hidden;})||host.inert||board.closest('[inert]');}
function usable(){return mobile.matches&&!document.hidden&&latest&&latest.player.hp>0&&!latest.gameState.gulchPermanentGameOver?.ended&&!blocked();}
function release(id){if(id!==null&&board.hasPointerCapture?.(id)){try{board.releasePointerCapture(id);}catch(error){}}}
function reset(){
 const a=primary,b=second;primary=second=null;clearTimeout(timer);timer=null;active=false;speed=0;last=0;nextSlash=0;
 Gulch.setMovement(0,0);ring.hidden=true;ring.dataset.slashing='false';
 if(frame)cancelAnimationFrame(frame);frame=0;release(a);release(b);
}
function tick(now){
 frame=0;if(!active||!usable()||!window.GulchMovementState?.focused){reset();return;}
 const dt=last?Math.min(50,now-last):16;last=now;
 const dx=point.x-origin.x,dy=point.y-origin.y,length=Math.hypot(dx,dy),fraction=length?Math.min(44,length)/length:0;
 knob.style.marginLeft=dx*fraction+'px';knob.style.marginTop=dy*fraction+'px';
 const desired=length<12?0:Math.min(1,Math.max(.35,(length-12)/32));
 speed+=Math.sign(desired-speed)*Math.min(Math.abs(desired-speed),dt/(desired>speed?300:100));
 if(!desired){speed=0;Gulch.setMovement(0,0);}
 else{const angle=Math.round(Math.atan2(dy,dx)/(Math.PI/4))*Math.PI/4;Gulch.setMovement(Math.round(Math.cos(angle)),Math.round(Math.sin(angle)),170-105*speed);}
 if(second!==null&&now>=nextSlash&&!window.GulchMovementState.inFlight){const attack=document.querySelector('#swordControls button');if(attack&&!attack.disabled){attack.click();nextSlash=now+360;}}
 frame=requestAnimationFrame(tick);
}
function begin(){
 timer=null;if(primary===null||!usable())return reset();
 active=true;const r=host.getBoundingClientRect();ring.style.left=origin.x-r.left+'px';ring.style.top=origin.y-r.top+'px';ring.hidden=false;hint.hidden=true;suppressUntil=performance.now()+650;window.GulchFrameBudget?.activate();frame=requestAnimationFrame(tick);
}
board.addEventListener('pointerdown',e=>{
 if(e.pointerType!=='touch'||!usable())return;
 if(primary===null){reset();primary=e.pointerId;origin={x:e.clientX,y:e.clientY};point={...origin};try{board.setPointerCapture(primary);}catch(error){}timer=setTimeout(begin,100);}
 else if(e.pointerId!==primary&&second===null){second=e.pointerId;nextSlash=0;ring.dataset.slashing='true';try{board.setPointerCapture(second);}catch(error){}}
 e.preventDefault();
});
board.addEventListener('pointermove',e=>{if(e.pointerId!==primary)return;point={x:e.clientX,y:e.clientY};e.preventDefault();});
function end(e){
 if(e.pointerId===second){const id=second;second=null;ring.dataset.slashing='false';release(id);return;}
 if(e.pointerId!==primary)return;
 if(active)suppressUntil=performance.now()+650;reset();
}
board.addEventListener('pointerup',end);board.addEventListener('pointercancel',end);board.addEventListener('lostpointercapture',end);
board.addEventListener('click',e=>{if(performance.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
window.addEventListener('contextmenu',e=>{if(e.target===board&&(active||primary!==null||performance.now()<suppressUntil)){e.preventDefault();e.stopImmediatePropagation();}},true);
window.addEventListener('blur',reset);window.addEventListener('resize',reset);
document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
window.addEventListener('message',e=>{if(e.source===parent&&e.data?.type==='gulch:focus'&&e.data.granted===false)reset();});
mobile.addEventListener('change',()=>{reset();hint.hidden=!mobile.matches;});
new MutationObserver(()=>{if(primary!==null&&blocked())reset();}).observe(host,{subtree:true,attributes:true,attributeFilter:['hidden','inert']});
Gulch.register('mobile-floating-joystick',{snapshot(s){const old=latest;latest=s;if(old&&String(old.gameState.respawnSettings?.token||'original')!==String(s.gameState.respawnSettings?.token||'original')||!usable())reset();}});
const help=document.getElementById('keyHelp');if(help){const p=document.createElement('p');p.textContent='Mobile: hold the map and drag in eight directions. Drag farther to accelerate smoothly; center or release to stop immediately. Hold a second finger on the map to slash while running. Movement waits for shared confirmation without dropping the held direction. Keyboard: hold WASD or arrows; E or > uses an exit.';help.append(p);}
})();
