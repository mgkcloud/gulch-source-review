(function(){
'use strict';
const coarse=window.matchMedia('(any-pointer: coarse)');
const style=document.createElement('style');
style.textContent=`
@media(any-pointer:coarse){
 html,body,body *,body *::before,body *::after{
  -webkit-user-select:none!important;
  user-select:none!important;
  -webkit-touch-callout:none!important;
 }
 canvas,img,a{-webkit-user-drag:none!important}
 input,textarea,[contenteditable]{-webkit-touch-callout:none!important}
}
`;
document.head.append(style);
function clearSelection(){
 if(!coarse.matches)return;
 const selection=window.getSelection();
 if(selection&&selection.rangeCount&&!selection.isCollapsed)selection.removeAllRanges();
}
function preventNative(event){
 if(coarse.matches&&event.cancelable)event.preventDefault();
}
document.addEventListener('selectstart',preventNative,true);
document.addEventListener('dragstart',preventNative,true);
// Cancel the browser callout without blocking the game's context-menu handlers.
document.addEventListener('contextmenu',preventNative,true);
document.addEventListener('selectionchange',clearSelection);
document.addEventListener('pointerdown',clearSelection,{capture:true,passive:true});
let editingTouch=null;
function editor(target){
 if(!(target instanceof Element))return null;
 const node=target.closest('input,textarea,[contenteditable]');
 if(!node)return null;
 if(node instanceof HTMLInputElement&&!['text','search','email','url','tel','password','number'].includes(node.type))return null;
 if(node.hasAttribute('contenteditable')&&!node.isContentEditable)return null;
 return node;
}
function placeCaret(node){
 if(node instanceof HTMLInputElement||node instanceof HTMLTextAreaElement){
  try{const end=node.value.length;node.setSelectionRange(end,end);}catch(error){}
 }else if(node.isContentEditable){
  const selection=window.getSelection(),range=document.createRange();
  range.selectNodeContents(node);range.collapse(false);
  selection?.removeAllRanges();selection?.addRange(range);
 }
}
document.addEventListener('touchstart',event=>{
 if(!coarse.matches)return;
 clearSelection();
 const node=editor(event.target);
 if(!node||node.disabled||node.closest('[inert]'))return;
 // WebKit's editable-field loupe requires cancelling the native caret gesture;
 // user-select alone does not suppress it. Keyboard editing remains native.
 if(event.cancelable)event.preventDefault();
 editingTouch=event.changedTouches[0]?.identifier??null;
 const alreadyFocused=document.activeElement===node;
 node.focus({preventScroll:true});
 if(!alreadyFocused)placeCaret(node);
},{capture:true,passive:false});
function ownsTouch(event){return editingTouch!==null&&Array.from(event.changedTouches).some(t=>t.identifier===editingTouch);}
document.addEventListener('touchmove',event=>{
 if(!coarse.matches||!ownsTouch(event))return;
 if(event.cancelable)event.preventDefault();
 clearSelection();
},{capture:true,passive:false});
document.addEventListener('touchend',event=>{
 if(!ownsTouch(event))return;
 if(event.cancelable)event.preventDefault();
 editingTouch=null;clearSelection();
},{capture:true,passive:false});
document.addEventListener('touchcancel',event=>{
 if(ownsTouch(event))editingTouch=null;
},{capture:true,passive:true});
window.addEventListener('blur',()=>{editingTouch=null;});
document.addEventListener('visibilitychange',()=>{if(document.hidden)editingTouch=null;});
coarse.addEventListener('change',()=>{editingTouch=null;clearSelection();});
clearSelection();
})();
