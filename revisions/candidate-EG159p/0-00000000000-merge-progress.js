(function(){
'use strict';
const commit=Gulch.commit;
let latest=null,queued=false;
const epoch=d=>String(d?.respawnSettings?.token||'original');
const limit=(n,max)=>Number.isFinite(n)?Math.max(0,Math.min(max,Math.floor(n))):0;
function definitions(data){const f=data?.freeformForge;return f?.epoch===epoch(data)&&f.definitions&&typeof f.definitions==='object'?f.definitions:{};}
function completed(data){
 const v=data?.mergeCharge;
 return Math.max(v?.epoch===epoch(data)?limit(v.completed,96):0,Math.min(96,Object.keys(definitions(data)).length));
}
function requirements(data){const merges=completed(data);return {completed:merges,steps:20+merges*10,kills:3+merges*2};}
function progress(data){
 const r=requirements(data),v=data?.mergeCharge;
 return {...r,earnedSteps:v?.epoch===epoch(data)?limit(v.steps,r.steps):0,earnedKills:v?.epoch===epoch(data)?limit(v.kills,r.kills):0};
}
// Existing forge consumers compare against 20 and 3. Expose proportional
// charge while persisting actual movement and kill counts in shared state.
function state(data){const p=progress(data);return {epoch:epoch(data),steps:p.earnedSteps===p.steps?20:20*p.earnedSteps/p.steps,kills:p.earnedKills===p.kills?3:3*p.earnedKills/p.kills};}
function enemy(e){return e&&e.id!=='player'&&e.faction==='hostile'&&Number.isFinite(e.hp)&&e.hp>0&&!e.practiceTarget&&!e.isPlayer&&!e.playerId&&!e.clientId&&!e.ownerId&&!e.loreSpeaker&&!e.swordQuestLandmark&&!e.ecosystemLoot&&e.itemId==null&&!/item|loot|prop|weapon|armor|resource/i.test(String(e.kind||''));}
window.GulchMergeCharge=Object.freeze({state,progress,requirements,steps:20,kills:3});
function text(node,value){if(node&&node.textContent!==value)node.textContent=value;}
function render(){
 queued=false;
 const root=document.getElementById('mergeForge');if(!root||!latest)return;
 const p=progress(latest.gameState);
 const travel=root.querySelector('progress[aria-label="Movement charge"]'),hunt=root.querySelector('progress[aria-label="Defeat charge"]');
 for(const [bar,earned,total,label] of [[travel,p.earnedSteps,p.steps,'Movement charge'],[hunt,p.earnedKills,p.kills,'Enemy defeats']]){
  if(!bar)continue;
  if(bar.max!==total)bar.max=total;
  if(bar.value!==earned)bar.value=earned;
  const description=earned+' / '+total;
  if(bar.getAttribute('aria-valuetext')!==description)bar.setAttribute('aria-valuetext',description);
  text(bar.previousElementSibling,label+' · '+description);
 }
 let guide=document.getElementById('mergeEscalationGuide');
 if(!guide){guide=document.createElement('p');guide.id='mergeEscalationGuide';root.querySelector('h2')?.after(guide);}
 text(guide,'Merge '+(p.completed+1)+' requires '+p.steps+' movement steps and '+p.kills+' enemy defeats. Each confirmed merge adds 10 steps and 2 defeats to the next requirement. These bars fill through gameplay, not waiting. Both travelers share progress; a new expedition resets the requirements.');
 for(const node of root.children){
  if(node.tagName==='P'&&node.textContent.startsWith('Merging costs 20 movement charge and 3 enemy defeats.'))text(node,'Merge costs increase after each confirmed creation. Adding, replacing and returning grid items costs nothing. A replacement returns the old item to the waiting box. Powers recharge on played turns and cannot revive you. All nine slots are shared. Up to 96 creation definitions are retained per expedition.');
 }
}
function schedule(){if(queued)return;queued=true;queueMicrotask(render);}
Gulch.register('merge-charge',{snapshot(s){latest=s;schedule();}});
Gulch.commit=function(data,activity,options){
 if(!latest||!data?.seed)return commit.call(this,data,activity,options);
 if(epoch(data)!==epoch(latest.gameState))return commit.call(this,{...data,mergeCharge:{epoch:epoch(data),steps:0,kills:0,completed:0}},activity,options);
 const beforeData=latest.gameState,p=progress(beforeData),oldDefinitions=definitions(beforeData),newDefinitions=definitions(data);
 const added=Object.keys(newDefinitions).filter(id=>!Object.prototype.hasOwnProperty.call(oldDefinitions,id));
 const merged=added.length>0&&data.freeformForge?.receipt&&data.freeformForge.receipt!==beforeData.freeformForge?.receipt;
 if(merged){
  if(added.length!==1||p.earnedSteps<p.steps||p.earnedKills<p.kills){
   const notice=document.getElementById('mergeForgeStatus');
   text(notice,'Merge requires '+p.steps+' movement steps and '+p.kills+' enemy defeats. Nothing was spent.');
   schedule();return;
  }
  return commit.call(this,{...data,mergeCharge:{epoch:epoch(data),steps:0,kills:0,completed:Math.min(96,p.completed+1)}},activity,options);
 }
 const charge={epoch:epoch(data),steps:p.earnedSteps,kills:p.earnedKills,completed:p.completed};
 if(Number(data.turn)>Number(latest.turn)){
  const before=latest.player,after=data.seed.entities.find(e=>e.id==='player');
  if(after&&before.map===after.map){const distance=Math.hypot(after.x-before.x,after.y-before.y);if(distance>0&&distance<=Math.SQRT2+.001)charge.steps=Math.min(p.steps,charge.steps+1);}
  const remaining=new Map(data.seed.entities.map(e=>[e.id,e]));
  if(after?.map===before.map&&data.seed.maps.some(m=>m.id===before.map)){
   for(const e of latest.seed.entities){
    if(!enemy(e)||e.map!==before.map)continue;
    const next=remaining.get(e.id);
    if(!next||Number.isFinite(next.hp)&&next.hp<=0)charge.kills=Math.min(p.kills,charge.kills+1);
   }
  }
 }
 return commit.call(this,{...data,mergeCharge:charge},activity,options);
};
function mount(){
 const panel=document.getElementById('inventoryPanel');if(!panel)return;
 new MutationObserver(schedule).observe(panel,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','data-inventory-page','value','max']});
 schedule();
}
if(document.readyState==='complete')mount();else window.addEventListener('load',mount,{once:true});
})();
