(function(){
'use strict';
function bounded(value,max,integer){
 if(!Number.isFinite(value))return 0;
 return Math.max(0,Math.min(max,integer?Math.floor(value):value));
}
function progression(previousGameState,nextGameState){
 const before=previousGameState?.seed?.entities?.find(e=>e.id==='player');
 const after=nextGameState?.seed?.entities?.find(e=>e.id==='player');
 if(!before||!after)return nextGameState;
 const oldToken=previousGameState.respawnSettings?.token;
 const newToken=nextGameState.respawnSettings?.token;
 // A new expedition supplies its own fresh progression and anchor.
 if(oldToken!==newToken)return nextGameState;
 const supplied=nextGameState.runningProgress;
 const previous=previousGameState.runningProgress||{};
 const moved=before.map!==after.map||before.x!==after.x||before.y!==after.y;
 if(!moved&&supplied?.anchor?.map===after.map&&supplied.anchor.x===after.x&&supplied.anchor.y===after.y){
  return nextGameState;
 }
 const distance=before.map===after.map?Math.hypot(after.x-before.x,after.y-before.y):0;
 const adjacent=moved&&distance>0&&distance<=Math.SQRT2+.001;
 const xp=bounded(previous.xp,100000000,true);
 const traveled=bounded(previous.distance,10000000,false);
 const progress={
  xp:Math.min(100000000,xp+(adjacent?10:0)),
  distance:Math.min(10000000,Math.round((traveled+(adjacent?distance:0))*1000)/1000),
  anchor:{map:after.map,x:after.x,y:after.y}
 };
 return {...nextGameState,runningProgress:progress};
}
globalThis.GulchTurnEffects=Object.freeze({progression});
})();
