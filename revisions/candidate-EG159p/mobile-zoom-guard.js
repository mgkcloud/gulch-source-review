(function(){
'use strict';
const viewport=document.querySelector('meta[name="viewport"]');
if(viewport)viewport.setAttribute('content','width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no');
const coarse=window.matchMedia('(any-pointer: coarse)');
const style=document.createElement('style');
style.textContent='@media(any-pointer:coarse){html,body{touch-action:pan-x pan-y}button,a,input,select,textarea,summary,[role="button"]{touch-action:manipulation}#board{touch-action:none}}';
document.head.append(style);
function preventPinch(event){
 if(coarse.matches&&event.touches&&event.touches.length>1&&event.cancelable)event.preventDefault();
}
document.addEventListener('touchstart',preventPinch,{capture:true,passive:false});
document.addEventListener('touchmove',preventPinch,{capture:true,passive:false});
for(const type of ['gesturestart','gesturechange','gestureend'])document.addEventListener(type,event=>{
 if(coarse.matches&&event.cancelable)event.preventDefault();
},{capture:true,passive:false});
})();
