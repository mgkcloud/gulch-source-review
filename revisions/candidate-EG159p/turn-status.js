(function(){
'use strict';
const host=document.getElementById('left');
if(!host)return;
const style=document.createElement('style');
style.textContent='#left{height:calc(100% - 24px)!important}#gameTurnStatus{height:24px;padding:4px 12px;background:var(--ink,#0b0d0c);color:var(--dim,#7d8a6a);border-top:1px solid var(--line,#252a1f);font:11px/15px ui-monospace,monospace;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;pointer-events:none}';
document.head.append(style);
const line=document.createElement('div');
line.id='gameTurnStatus';
line.textContent='Turn —';
host.after(line);
Gulch.register('turn-status-line',{
 snapshot(s){
  const turn=s.gameState?.turn;
  const text='Turn '+(Number.isFinite(turn)?turn:'—');
  if(line.textContent!==text)line.textContent=text;
 }
});
})();
